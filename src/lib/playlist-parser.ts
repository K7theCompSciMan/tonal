// src/lib/playlist-parser.ts
// Parses M3U, JSON, CSV, and TXT playlist files into a common track format

export interface ParsedTrack {
    title: string;
    artist: string;
    duration?: number;       // seconds
    hintUrl?: string;        // direct stream URL if already known (from M3U)
  }
  
  // ---- M3U -------------------------------------------------------------------
  
  export function parseM3U(text: string): ParsedTrack[] {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const tracks: ParsedTrack[] = [];
    let pending: Partial<ParsedTrack> = {};
  
    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        // #EXTINF:duration,Artist - Title
        const match = line.match(/^#EXTINF:(-?\d+),(.*)$/);
        if (match) {
          const duration = parseInt(match[1]);
          const info = match[2].trim();
          const dashIdx = info.indexOf(' - ');
          if (dashIdx !== -1) {
            pending.artist = info.slice(0, dashIdx).trim();
            pending.title = info.slice(dashIdx + 3).trim();
          } else {
            pending.title = info;
            pending.artist = '';
          }
          if (duration > 0) pending.duration = duration;
        }
      } else if (!line.startsWith('#')) {
        // URL line — attach to pending or create minimal entry
        const hintUrl = line.startsWith('http') ? line : undefined;
        tracks.push({
          title: pending.title ?? 'Unknown',
          artist: pending.artist ?? '',
          duration: pending.duration,
          hintUrl,
        });
        pending = {};
      }
    }
    return tracks;
  }
  
  // ---- JSON ------------------------------------------------------------------
  
  export function parseJSON(text: string): ParsedTrack[] {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return []; }
  
    const arr: unknown[] = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>)?.tracks
      ? ((parsed as Record<string, unknown>).tracks as unknown[])
      : [parsed];
  
    return arr.flatMap((item) => {
      if (typeof item !== 'object' || !item) return [];
      const o = item as Record<string, unknown>;
      const title = (o.title ?? o.name ?? o.track_name ?? '') as string;
      const artist = (o.artist ?? o.artist_name ?? o.artistName ?? '') as string;
      const hintUrl = (o.url ?? o.stream_url ?? o.audio ?? o.preview_url ?? '') as string || undefined;
      if (!title && !artist) return [];
      return [{ title: String(title), artist: String(artist), hintUrl }];
    });
  }
  
  // ---- CSV -------------------------------------------------------------------
  
  export function parseCSV(text: string): ParsedTrack[] {
    const rows = text.split('\n').map(r => r.trim()).filter(Boolean);
    if (!rows.length) return [];
  
    // Auto-detect header
    const header = rows[0].toLowerCase().split(',').map(h => h.replace(/"/g, '').trim());
    const titleIdx = ['title', 'name', 'track', 'track_name', 'song'].map(k => header.indexOf(k)).find(i => i !== -1) ?? 0;
    const artistIdx = ['artist', 'artist_name', 'artistname', 'author'].map(k => header.indexOf(k)).find(i => i !== -1) ?? 1;
    const urlIdx = ['url', 'stream_url', 'audio', 'link'].map(k => header.indexOf(k)).find(i => i !== -1) ?? -1;
  
    const dataRows = header.some(h => ['title', 'name', 'artist'].includes(h)) ? rows.slice(1) : rows;
  
    return dataRows.flatMap(row => {
      const cols = row.split(',').map(c => c.replace(/^"|"$/g, '').trim());
      const title = cols[titleIdx] ?? '';
      const artist = cols[artistIdx] ?? '';
      const hintUrl = urlIdx !== -1 ? cols[urlIdx] : undefined;
      if (!title) return [];
      return [{ title, artist, hintUrl: hintUrl || undefined }];
    });
  }
  
  // ---- TXT -------------------------------------------------------------------
  
  export function parseTXT(text: string): ParsedTrack[] {
    return text.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .flatMap(line => {
        // Smart dash detection: "Artist - Title" or "Artist – Title" or "Artist — Title"
        const dashMatch = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
        if (dashMatch) {
          return [{ artist: dashMatch[1].trim(), title: dashMatch[2].trim() }];
        }
        return [{ title: line, artist: '' }];
      });
  }
  
  // ---- Dispatcher ------------------------------------------------------------
  
  export function parsePlaylistFile(text: string, filename: string): ParsedTrack[] {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'm3u':
      case 'm3u8':
        return parseM3U(text);
      case 'json':
        return parseJSON(text);
      case 'csv':
        return parseCSV(text);
      case 'txt':
      default:
        // Try JSON first (sometimes .txt is actually JSON)
        if (text.trimStart().startsWith('[') || text.trimStart().startsWith('{')) {
          const result = parseJSON(text);
          if (result.length) return result;
        }
        return parseTXT(text);
    }
  }
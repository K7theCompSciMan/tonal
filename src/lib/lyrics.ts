// src/lib/lyrics.ts
// Synced lyrics using lrclib.net (free, no key) with fallback to lyrics.ovh

export interface LyricLine {
    time: number; // seconds
    text: string;
  }
  
  /** Parse .lrc format into timed lines */
  export function parseLRC(lrc: string): LyricLine[] {
    const lines = lrc.split('\n');
    const result: LyricLine[] = [];
    for (const line of lines) {
      const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
      if (!match) continue;
      const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
      const text = match[3].trim();
      if (text) result.push({ time, text });
    }
    return result.sort((a, b) => a.time - b.time);
  }
  
  /** Fetch synced lyrics from lrclib.net, fallback to plain lyrics */
  export async function fetchLyrics(
    title: string,
    artist: string,
    album?: string
  ): Promise<{ synced: LyricLine[] | null; plain: string | null }> {
    // Try lrclib.net first (has synced LRC)
    try {
      const params = new URLSearchParams({ track_name: title, artist_name: artist });
      if (album) params.set('album_name', album);
      const res = await fetch(`https://lrclib.net/api/get?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) {
          return { synced: parseLRC(data.syncedLyrics), plain: data.plainLyrics ?? null };
        }
        if (data.plainLyrics) {
          return { synced: null, plain: data.plainLyrics };
        }
      }
    } catch (_) { /* fall through */ }
  
    // Fallback to lyrics.ovh (plain text only)
    try {
      const res = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.lyrics) return { synced: null, plain: data.lyrics };
      }
    } catch (_) { /* give up */ }
  
    return { synced: null, plain: null };
  }
  
  /** Given current playback time and sorted lyric lines, return the active line index */
  export function getActiveLyricIndex(lines: LyricLine[], currentTime: number): number {
    if (!lines.length) return -1;
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime) idx = i;
      else break;
    }
    return idx;
  }
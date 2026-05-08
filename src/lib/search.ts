// src/lib/search.ts
// Auto-resolve tracks against Jamendo and YouTube

export interface ResolvedTrack {
    source: 'jamendo' | 'youtube' | 'direct';
    streamUrl: string;        // direct audio URL (jamendo) or YouTube watch URL
    jamendoId?: string;       // cache this, not the audio URL (it expires)
    youtubeId?: string;       // cache this
    thumbnailUrl?: string;
  }
  
  // ---- Jamendo ---------------------------------------------------------------
  
  interface JamendoTrack {
    id: string;
    name: string;
    artist_name: string;
    audio: string;
    album_image: string;
  }
  
  export async function searchJamendo(query: string): Promise<JamendoTrack | null> {
    const clientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID;
    if (!clientId) return null;
    try {
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}`
        + `&search=${encodeURIComponent(query.slice(0, 128))}&audioformat=mp32&limit=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.results?.[0] ?? null;
    } catch {
      return null;
    }
  }
  
  /** Re-fetch audio URL from Jamendo by track ID (URLs expire, so store ID not URL) */
  export async function fetchJamendoAudioUrl(jamendoId: string): Promise<string | null> {
    const clientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID;
    if (!clientId) return null;
    try {
      const res = await fetch(
        `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&id=${jamendoId}&audioformat=mp32`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.results?.[0]?.audio ?? null;
    } catch {
      return null;
    }
  }
  
  // ---- YouTube ---------------------------------------------------------------
  
  interface YouTubeItem {
    id: { videoId: string };
    snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } };
  }
  
  export async function searchYouTube(query: string): Promise<YouTubeItem | null> {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) return null;
    try {
      const url = `https://www.googleapis.com/youtube/v3/search`
        + `?q=${encodeURIComponent(query)}&type=video&videoCategoryId=10`
        + `&maxResults=1&part=snippet&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.items?.[0] ?? null;
    } catch {
      return null;
    }
  }
  
  // ---- Combined resolver -----------------------------------------------------
  
  export async function autoResolveTrack(
    title: string,
    artist: string
  ): Promise<ResolvedTrack | null> {
    const query = `${artist} ${title}`.trim();
  
    // 1. Try Jamendo first (better audio quality, no embed restriction)
    const jamendo = await searchJamendo(query);
    if (jamendo?.audio) {
      return {
        source: 'jamendo',
        streamUrl: jamendo.audio,
        jamendoId: jamendo.id,
        thumbnailUrl: jamendo.album_image,
      };
    }
  
    // 2. Fall back to YouTube
    const yt = await searchYouTube(query);
    if (yt?.id?.videoId) {
      return {
        source: 'youtube',
        streamUrl: `https://www.youtube.com/watch?v=${yt.id.videoId}`,
        youtubeId: yt.id.videoId,
        thumbnailUrl: yt.snippet.thumbnails.default.url,
      };
    }
  
    return null;
  }
  
  // ---- Combined search for SearchBar -----------------------------------------
  // Returns merged results from both sources for display in search UI
  
  export interface SearchResult {
    id: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    source: 'jamendo' | 'youtube';
    streamUrl: string;
    jamendoId?: string;
    youtubeId?: string;
  }
  
  export async function searchAllSources(query: string): Promise<SearchResult[]> {
    const [jamendoResults, youtubeResults] = await Promise.allSettled([
      searchJamendoMulti(query),
      searchYouTubeMulti(query),
    ]);
  
    const jamendo: SearchResult[] = jamendoResults.status === 'fulfilled'
      ? (jamendoResults.value ?? [])
      : [];
    const youtube: SearchResult[] = youtubeResults.status === 'fulfilled'
      ? (youtubeResults.value ?? [])
      : [];
  
    // Interleave: 1 Jamendo, 1 YouTube, etc.
    const merged: SearchResult[] = [];
    const max = Math.max(jamendo.length, youtube.length);
    for (let i = 0; i < max; i++) {
      if (jamendo[i]) merged.push(jamendo[i]);
      if (youtube[i]) merged.push(youtube[i]);
    }
    return merged;
  }
  
  async function searchJamendoMulti(query: string): Promise<SearchResult[]> {
    const clientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID;
    if (!clientId) return [];
    try {
      const res = await fetch(
        `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}`
        + `&search=${encodeURIComponent(query)}&audioformat=mp32&limit=5`
      );
      const data = await res.json();
      return (data.results ?? []).map((t: JamendoTrack) => ({
        id: `jamendo-${t.id}`,
        title: t.name,
        artist: t.artist_name,
        thumbnailUrl: t.album_image,
        source: 'jamendo' as const,
        streamUrl: t.audio,
        jamendoId: t.id,
      }));
    } catch { return []; }
  }
  
  async function searchYouTubeMulti(query: string): Promise<SearchResult[]> {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) return [];
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query)}`
        + `&type=video&videoCategoryId=10&maxResults=5&part=snippet&key=${apiKey}`
      );
      const data = await res.json();
      return (data.items ?? []).map((item: YouTubeItem) => ({
        id: `youtube-${item.id.videoId}`,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnailUrl: item.snippet.thumbnails.default.url,
        source: 'youtube' as const,
        streamUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        youtubeId: item.id.videoId,
      }));
    } catch { return []; }
  }
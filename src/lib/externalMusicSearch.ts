import type { DbSong } from "./types";
import { toYouTubeEmbedUrl } from "./youtube";
import type { ExternalSong } from "./trackUtils";

const ytApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? "";
const jamendoClientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID ?? "";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/official|video|audio|lyrics|lyric|hd|hq|remaster(ed)?|feat\.?|ft\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenScore(expected: string, candidate: string): number {
  const expectedTokens = new Set(normalizeText(expected).split(" ").filter(Boolean));
  const candidateTokens = new Set(normalizeText(candidate).split(" ").filter(Boolean));
  if (expectedTokens.size === 0) return 0;
  let hits = 0;
  expectedTokens.forEach((token) => {
    if (candidateTokens.has(token)) hits += 1;
  });
  return hits / expectedTokens.size;
}

export function scoreTrackMatch(
  expectedTitle: string,
  expectedArtist: string,
  candidateTitle: string,
  candidateArtist: string,
): number {
  const titleNorm = normalizeText(expectedTitle);
  const artistNorm = normalizeText(expectedArtist);
  const candidateTitleNorm = normalizeText(candidateTitle);
  const candidateArtistNorm = normalizeText(candidateArtist);
  const titleScore = titleNorm && candidateTitleNorm === titleNorm ? 1 : tokenScore(expectedTitle, candidateTitle);
  const artistScore = artistNorm && candidateArtistNorm.includes(artistNorm) ? 1 : tokenScore(expectedArtist, candidateArtist);
  return Math.round((titleScore * 0.72 + artistScore * 0.28) * 100) / 100;
}

export async function searchYouTubeSongs(query: string): Promise<ExternalSong[]> {
  if (!ytApiKey.trim()) return [];
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoCategoryId: "10",
    maxResults: "8",
    key: ytApiKey,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) return [];
  const payload = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: { medium?: { url?: string } };
      };
    }[];
  };
  return (payload.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      return {
        title: item.snippet?.title || "YouTube",
        artist: item.snippet?.channelTitle || "YouTube",
        streamUrl: toYouTubeEmbedUrl(url) ?? url,
        sourceType: "youtube" as const,
        sourceProvider: "youtube" as const,
        coverUrl: item.snippet?.thumbnails?.medium?.url,
      };
    })
    .filter(Boolean) as ExternalSong[];
}

export async function searchITunesSongs(query: string): Promise<ExternalSong[]> {
  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: "10",
  });
  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!res.ok) return [];
  const payload = (await res.json()) as {
    results?: {
      trackName?: string;
      artistName?: string;
      previewUrl?: string;
      artworkUrl100?: string;
      collectionName?: string;
    }[];
  };
  return (payload.results ?? [])
    .filter((r) => r.previewUrl)
    .map((r) => ({
      title: r.trackName || "Preview",
      artist: r.artistName || "Unknown",
      streamUrl: r.previewUrl!,
      sourceType: "direct" as const,
      sourceProvider: "itunes" as const,
      coverUrl: r.artworkUrl100,
      album: r.collectionName,
    }));
}

export async function searchJamendoSongs(query: string): Promise<ExternalSong[]> {
  if (!jamendoClientId.trim()) return [];
  const params = new URLSearchParams({
    client_id: jamendoClientId,
    format: "json",
    limit: "10",
    namesearch: query,
    include: "musicinfo",
  });
  const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`);
  if (!res.ok) return [];
  const payload = (await res.json()) as {
    results?: {
      name?: string;
      artist_name?: string;
      audio?: string;
      image?: string;
      album_name?: string;
    }[];
  };
  return (payload.results ?? [])
    .filter((r) => r.audio)
    .map((r) => ({
      title: r.name || "Jamendo",
      artist: r.artist_name || "Unknown",
      streamUrl: r.audio!,
      sourceType: "direct" as const,
      sourceProvider: "jamendo" as const,
      coverUrl: r.image,
      album: r.album_name,
    }));
}

function dedupeByStreamUrl(songs: ExternalSong[]): ExternalSong[] {
  const seen = new Set<string>();
  return songs.filter((s) => {
    const u = s.streamUrl;
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

export function filterLocalLibrary(query: string, songs: DbSong[]): DbSong[] {
  const q = query.toLowerCase();
  return songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      (s.album?.toLowerCase().includes(q) ?? false),
  );
}

/** Runs Jamendo, YouTube, and iTunes in parallel; returns provider-grouped results. */
export async function searchAllStreamingSources(query: string): Promise<ExternalSong[]> {
  const [jam, yt, itunes] = await Promise.all([
    searchYouTubeSongs(query),
    searchITunesSongs(query),
    searchJamendoSongs(query),
  ]);
  const rank = (song: ExternalSong) => scoreTrackMatch(query, "", song.title, song.artist);
  return dedupeByStreamUrl([
    ...yt.sort((a, b) => rank(b) - rank(a)),
    ...jam.sort((a, b) => rank(b) - rank(a)),
    ...itunes.sort((a, b) => rank(b) - rank(a)),
  ]);
}

export { normalizeText };

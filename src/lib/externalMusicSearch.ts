import type { DbSong } from "./types";
import { toYouTubeEmbedUrl } from "./youtube";
import type { ExternalSong } from "./trackUtils";

const ytApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? "";
const jamendoClientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID ?? "";

// ─── Text normalisation ───────────────────────────────────────────────────────

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(
      /official|video|audio|lyrics|lyric|hd|hq|remaster(ed)?|feat\.?|ft\.?/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenScore(expected: string, candidate: string): number {
  const expectedTokens = new Set(
    normalizeText(expected).split(" ").filter(Boolean),
  );
  const candidateTokens = new Set(
    normalizeText(candidate).split(" ").filter(Boolean),
  );
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
  const titleScore =
    titleNorm && candidateTitleNorm === titleNorm
      ? 1
      : tokenScore(expectedTitle, candidateTitle);
  const artistScore =
    artistNorm && candidateArtistNorm.includes(artistNorm)
      ? 1
      : tokenScore(expectedArtist, candidateArtist);
  return Math.round((titleScore * 0.72 + artistScore * 0.28) * 100) / 100;
}

// ─── Cover-URL helpers ────────────────────────────────────────────────────────

/**
 * Upgrade an iTunes artworkUrl100 thumbnail to a much larger version.
 * iTunes URLs look like: .../100x100bb.jpg — we swap in 600x600.
 */
export function upgradeItunesCoverUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // Replace dimensions in the URL: 100x100bb → 600x600bb
  return url.replace(/\d+x\d+bb(\.\w+)$/, "600x600bb$1");
}

/**
 * Upgrade a YouTube thumbnail from default (120×90) to maxresdefault or hqdefault.
 * Falls back gracefully if maxres doesn't exist (handled at display time).
 */
export function upgradeYouTubeCoverUrl(videoId: string): string {
  // maxresdefault (1280×720) — best quality; may 404 for some videos
  // hqdefault (480×360) — always available
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

export async function searchYouTubeSongs(query: string): Promise<ExternalSong[]> {
  if (!ytApiKey.trim()) return [];
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoCategoryId: "10",
    maxResults: "10",                 // fetch more so scoring has candidates
    key: ytApiKey,
  });
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
  );
  if (!res.ok) return [];
  const payload = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
          maxres?: { url?: string };
        };
      };
    }[];
  };
  return (payload.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      // Prefer the highest-resolution thumbnail available from the API response,
      // then fall back to our own hqdefault construction.
      const thumbFromApi =
        item.snippet?.thumbnails?.maxres?.url ??
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.medium?.url;
      return {
        title: item.snippet?.title || "YouTube",
        artist: item.snippet?.channelTitle || "YouTube",
        streamUrl: toYouTubeEmbedUrl(url) ?? url,
        sourceType: "youtube" as const,
        sourceProvider: "youtube" as const,
        coverUrl: thumbFromApi ?? upgradeYouTubeCoverUrl(videoId),
      };
    })
    .filter(Boolean) as ExternalSong[];
}

// ─── iTunes ───────────────────────────────────────────────────────────────────

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
      // Upgrade from 100×100 to 600×600 for much better display quality
      coverUrl: upgradeItunesCoverUrl(r.artworkUrl100),
      album: r.collectionName,
    }));
}

// ─── Jamendo ─────────────────────────────────────────────────────────────────

export async function searchJamendoSongs(query: string): Promise<ExternalSong[]> {
  if (!jamendoClientId.trim()) return [];
  const params = new URLSearchParams({
    client_id: jamendoClientId,
    format: "json",
    limit: "10",
    namesearch: query,
    include: "musicinfo",
    // imagesize=600 requests a larger cover from Jamendo's CDN
    imagesize: "600",
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

// ─── Library-first filter ─────────────────────────────────────────────────────

/**
 * Search the local Supabase library before hitting external APIs.
 * Returns songs whose title, artist, or album contains the query string,
 * scored so exact prefix/word matches rank higher.
 */
export function filterLocalLibrary(
  query: string,
  songs: DbSong[],
): DbSong[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const qNorm = normalizeText(q);

  return songs
    .map((s) => {
      const titleNorm = normalizeText(s.title);
      const artistNorm = normalizeText(s.artist);
      const albumNorm = normalizeText(s.album ?? "");

      // Simple relevance: exact substring match scores higher
      let score = 0;
      if (titleNorm.includes(qNorm)) score += 3;
      if (artistNorm.includes(qNorm)) score += 2;
      if (albumNorm.includes(qNorm)) score += 1;
      // Boost if the title starts with the query
      if (titleNorm.startsWith(qNorm)) score += 2;

      return { song: s, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ song }) => song);
}

// ─── Dedup ────────────────────────────────────────────────────────────────────

function dedupeByStreamUrl(songs: ExternalSong[]): ExternalSong[] {
  const seen = new Set<string>();
  return songs.filter((s) => {
    const u = s.streamUrl;
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

// ─── Combined search ──────────────────────────────────────────────────────────

/**
 * Search all streaming sources. YouTube is always placed first because:
 * 1. It has the broadest catalogue (virtually every commercial release)
 * 2. It provides higher-fidelity playback than 30-second iTunes previews
 * 3. Jamendo is limited to CC-licensed tracks
 *
 * Within each source results are scored by title/artist token overlap so the
 * best match floats to the top.
 */
export async function searchAllStreamingSources(
  query: string,
): Promise<ExternalSong[]> {
  const [yt, itunes, jam] = await Promise.all([
    searchYouTubeSongs(query),
    searchITunesSongs(query),
    searchJamendoSongs(query),
  ]);

  const rank = (song: ExternalSong) =>
    scoreTrackMatch(query, "", song.title, song.artist);

  const rankedYt = yt.sort((a, b) => rank(b) - rank(a));
  const rankedItunes = itunes.sort((a, b) => rank(b) - rank(a));
  const rankedJam = jam.sort((a, b) => rank(b) - rank(a));

  // YouTube first, then iTunes (full previews), then Jamendo (CC-only)
  return dedupeByStreamUrl([...rankedYt, ...rankedItunes, ...rankedJam]);
}

export { normalizeText };
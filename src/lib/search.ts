// src/lib/search.ts
// Auto-resolve tracks: library → YouTube → Jamendo
// YouTube is now the primary external source for broadest catalogue coverage.

import { scoreTrackMatch, upgradeYouTubeCoverUrl } from "./externalMusicSearch";
import type { DbSong } from "./types";
import { toYouTubeEmbedUrl } from "./youtube";

export interface ResolvedTrack {
  source: "library" | "youtube" | "jamendo" | "direct";
  streamUrl: string;
  jamendoId?: string;
  youtubeId?: string;
  thumbnailUrl?: string;
  matchedTitle?: string;
  matchedArtist?: string;
  matchScore?: number;
}

// ─── Jamendo ─────────────────────────────────────────────────────────────────

interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  audio: string;
  album_image: string;
}

async function searchJamendoMulti(query: string): Promise<SearchResult[]> {
  const clientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  try {
    const res = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}` +
        `&search=${encodeURIComponent(query.slice(0, 128))}&audioformat=mp32&limit=8&imagesize=600`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((t: JamendoTrack) => ({
      id: `jamendo-${t.id}`,
      title: t.name,
      artist: t.artist_name,
      // imagesize=600 gives us a proper album art URL
      thumbnailUrl: t.album_image,
      source: "jamendo" as const,
      streamUrl: t.audio,
      jamendoId: t.id,
    }));
  } catch {
    return [];
  }
}

/** Re-fetch audio URL from Jamendo by track ID (audio URLs expire). */
export async function fetchJamendoAudioUrl(
  jamendoId: string,
): Promise<string | null> {
  const clientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID;
  if (!clientId) return null;
  try {
    const res = await fetch(
      `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&id=${jamendoId}&audioformat=mp32`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0]?.audio ?? null;
  } catch {
    return null;
  }
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

interface YouTubeSnippet {
  title: string;
  channelTitle: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
    maxres?: { url: string };
  };
}

interface YouTubeItem {
  id: { videoId: string };
  snippet: YouTubeSnippet;
}

async function searchYouTubeMulti(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?q=${encodeURIComponent(query)}` +
        `&type=video&videoCategoryId=10&maxResults=10&part=snippet&key=${apiKey}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map((item: YouTubeItem) => {
      const videoId = item.id.videoId;
      const s = item.snippet;
      // Best available thumbnail from the API, falling back to hqdefault
      const thumbUrl =
        s.thumbnails.maxres?.url ??
        s.thumbnails.high?.url ??
        s.thumbnails.medium?.url ??
        upgradeYouTubeCoverUrl(videoId);
      return {
        id: `youtube-${videoId}`,
        title: s.title,
        artist: s.channelTitle,
        thumbnailUrl: thumbUrl,
        source: "youtube" as const,
        streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
        youtubeId: videoId,
      };
    });
  } catch {
    return [];
  }
}

// ─── Combined resolver ────────────────────────────────────────────────────────

/**
 * Resolve a track in priority order:
 *  1. Local Supabase library (exact title+artist match — zero API cost)
 *  2. YouTube (broadest catalogue, highest quality audio)
 *  3. Jamendo (CC-licensed fallback)
 *
 * Pass `librarySnapshot` to enable library-first resolution.
 */
export async function autoResolveTrack(
  title: string,
  artist: string,
  librarySnapshot?: DbSong[],
): Promise<ResolvedTrack | null> {
  // ── Step 1: check local library ───────────────────────────────────────────
  if (librarySnapshot && librarySnapshot.length > 0) {
    const q = `${title} ${artist}`.toLowerCase();
    const libMatch = librarySnapshot.find((s) => {
      const score = scoreTrackMatch(title, artist, s.title, s.artist);
      return score >= 0.80;
    });
    if (libMatch) {
      const streamUrl =
        libMatch.source_type === "youtube"
          ? toYouTubeEmbedUrl(libMatch.stream_url) ?? libMatch.stream_url
          : libMatch.stream_url;
      return {
        source: "library",
        streamUrl,
        youtubeId:
          libMatch.source_type === "youtube"
            ? (libMatch.stream_url.match(/[?&]v=([^&]+)/)?.[1] ?? undefined)
            : undefined,
        thumbnailUrl: libMatch.cover_url ?? undefined,
        matchedTitle: libMatch.title,
        matchedArtist: libMatch.artist,
        matchScore: 1.0,
      };
    }
  }

  const query = `${artist} ${title}`.trim();

  // ── Step 2: YouTube + Jamendo in parallel ─────────────────────────────────
  const [youtubeResults, jamendoResults] = await Promise.all([
    searchYouTubeMulti(query),
    searchJamendoMulti(query),
  ]);

  const rank = (track: SearchResult) =>
    scoreTrackMatch(title, artist, track.title, track.artist);

  const rankedYoutube = youtubeResults
    .map((t) => ({ track: t, score: rank(t) }))
    .sort((a, b) => b.score - a.score);

  const rankedJamendo = jamendoResults
    .map((t) => ({ track: t, score: rank(t) }))
    .sort((a, b) => b.score - a.score);

  // Score thresholds
  const EXACT = 0.86;
  const CLOSE = 0.62;

  const exactYoutube = rankedYoutube.find((c) => c.score >= EXACT);
  const closeYoutube = rankedYoutube.find((c) => c.score >= CLOSE);
  const exactJamendo = rankedJamendo.find((c) => c.score >= EXACT);
  const closeJamendo = rankedJamendo.find((c) => c.score >= CLOSE);

  // ── Step 3: prefer YouTube first ─────────────────────────────────────────
  // Exact YouTube match
  const bestYt = exactYoutube ?? closeYoutube ?? rankedYoutube[0];
  if (bestYt?.track.youtubeId) {
    return {
      source: "youtube",
      streamUrl: bestYt.track.streamUrl,
      youtubeId: bestYt.track.youtubeId,
      thumbnailUrl: bestYt.track.thumbnailUrl,
      matchedTitle: bestYt.track.title,
      matchedArtist: bestYt.track.artist,
      matchScore: bestYt.score,
    };
  }

  // ── Step 4: Jamendo fallback ──────────────────────────────────────────────
  const bestJam = exactJamendo ?? closeJamendo ?? rankedJamendo[0];
  if (bestJam?.track.streamUrl) {
    const jamendoId = bestJam.track.jamendoId?.replace(/^jamendo-/, "");
    return {
      source: "jamendo",
      streamUrl: bestJam.track.streamUrl,
      jamendoId,
      thumbnailUrl: bestJam.track.thumbnailUrl,
      matchedTitle: bestJam.track.title,
      matchedArtist: bestJam.track.artist,
      matchScore: bestJam.score,
    };
  }

  return null;
}

// ─── SearchResult (used by searchAllSources / SearchBar) ─────────────────────

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  source: "jamendo" | "youtube";
  streamUrl: string;
  jamendoId?: string;
  youtubeId?: string;
}

/**
 * Merged search result for the UI search bar.
 * YouTube results are placed first since they cover the widest catalogue.
 */
export async function searchAllSources(query: string): Promise<SearchResult[]> {
  const [youtubeResults, jamendoResults] = await Promise.allSettled([
    searchYouTubeMulti(query),
    searchJamendoMulti(query),
  ]);

  const youtube: SearchResult[] =
    youtubeResults.status === "fulfilled" ? (youtubeResults.value ?? []) : [];
  const jamendo: SearchResult[] =
    jamendoResults.status === "fulfilled" ? (jamendoResults.value ?? []) : [];

  // YouTube first — then interleave Jamendo results
  const merged: SearchResult[] = [...youtube];
  jamendo.forEach((j, i) => {
    // Insert Jamendo results after every 2nd YouTube result
    const insertAt = Math.min(2 + i * 3, merged.length);
    merged.splice(insertAt, 0, j);
  });
  return merged;
}
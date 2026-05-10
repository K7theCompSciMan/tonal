import type { DbSong } from "./types";
import { toYouTubeEmbedUrl } from "./youtube";
import { upgradeItunesCoverUrl, upgradeYouTubeCoverUrl } from "./externalMusicSearch";

export type ExternalSong = {
  title: string;
  artist: string;
  streamUrl: string;
  sourceType: "direct" | "youtube";
  sourceProvider?: "jamendo" | "youtube" | "itunes" | "direct";
  coverUrl?: string;
  album?: string;
};

export type PlayableTrack = DbSong | ExternalSong;

export function isDbSong(track: PlayableTrack): track is DbSong {
  return "stream_url" in track;
}

export function getStreamUrl(track: PlayableTrack): string {
  const raw = isDbSong(track) ? track.stream_url : track.streamUrl;
  if (!raw) return "";
  if (isDbSong(track) && track.source_type === "youtube") {
    return toYouTubeEmbedUrl(raw) ?? raw;
  }
  if (!isDbSong(track) && track.sourceType === "youtube") {
    return toYouTubeEmbedUrl(raw) ?? raw;
  }
  return raw;
}

/**
 * Return the best available cover URL for a track, upgraded to the highest
 * quality variant the source supports.
 */
export function getCoverUrl(track: PlayableTrack | null): string | undefined {
  if (!track) return undefined;

  if (isDbSong(track)) {
    return track.cover_url ?? undefined;
  }

  // External song — upgrade based on provider
  const raw = track.coverUrl;
  if (!raw) return undefined;

  if (track.sourceProvider === "itunes") {
    return upgradeItunesCoverUrl(raw);
  }

  if (track.sourceProvider === "youtube") {
    // Extract video ID from the stream URL and request hqdefault
    const videoIdMatch = track.streamUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (videoIdMatch) return upgradeYouTubeCoverUrl(videoIdMatch[1]);
  }

  // Jamendo already returns a sized URL (we request imagesize=600 in the API)
  return raw;
}

export function getAlbum(track: PlayableTrack | null): string | undefined {
  if (!track) return undefined;
  return isDbSong(track) ? track.album ?? undefined : track.album;
}

export function isSameTrack(a: PlayableTrack, b: PlayableTrack): boolean {
  const urlA = getStreamUrl(a);
  const urlB = getStreamUrl(b);
  if (urlA && urlB && urlA === urlB) return true;
  return a.title === b.title && a.artist === b.artist;
}

// ─── Media Session API ────────────────────────────────────────────────────────
// Sets the OS-level "Now Playing" metadata so:
// • iOS/Android lock-screen controls work
// • Desktop media keys work
// • Headphone button/AirPod controls work
// • Background playback continues without the tab being killed on mobile

export function setMediaSessionMetadata(
  track: PlayableTrack,
  handlers: {
    onPlay?: () => void;
    onPause?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onSeekForward?: () => void;
    onSeekBackward?: () => void;
  } = {},
): void {
  if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

  const coverUrl = getCoverUrl(track);
  const artwork: MediaImage[] = coverUrl
    ? [
        { src: coverUrl, sizes: "512x512", type: "image/jpeg" },
        { src: coverUrl, sizes: "256x256", type: "image/jpeg" },
      ]
    : [];

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: getAlbum(track) ?? "",
    artwork,
  });

  navigator.mediaSession.playbackState = "playing";

  // Register action handlers — these fire even when the tab is in the background
  if (handlers.onPlay) {
    navigator.mediaSession.setActionHandler("play", handlers.onPlay);
  }
  if (handlers.onPause) {
    navigator.mediaSession.setActionHandler("pause", handlers.onPause);
  }
  if (handlers.onNext) {
    navigator.mediaSession.setActionHandler("nexttrack", handlers.onNext);
  }
  if (handlers.onPrev) {
    navigator.mediaSession.setActionHandler("previoustrack", handlers.onPrev);
  }
  if (handlers.onSeekForward) {
    navigator.mediaSession.setActionHandler("seekforward", handlers.onSeekForward);
  }
  if (handlers.onSeekBackward) {
    navigator.mediaSession.setActionHandler("seekbackward", handlers.onSeekBackward);
  }
}

export function clearMediaSession(): void {
  if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
  for (const action of [
    "play",
    "pause",
    "nexttrack",
    "previoustrack",
    "seekforward",
    "seekbackward",
  ] as MediaSessionAction[]) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {
      // Some browsers throw if the action isn't supported
    }
  }
}
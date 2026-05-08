import type { DbSong } from "./types";
import { toYouTubeEmbedUrl } from "./youtube";

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

export function getCoverUrl(track: PlayableTrack | null): string | undefined {
  if (!track) return undefined;
  return isDbSong(track) ? track.cover_url ?? undefined : track.coverUrl;
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

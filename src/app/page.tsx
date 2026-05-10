"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import ReactPlayer from "react-player";
import type { User } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import { DbPlaylist, DbSong } from "@/lib/types";
import { filterLocalLibrary, searchAllStreamingSources } from "@/lib/externalMusicSearch";
import type { ParsedTrack } from "@/lib/playlist-parser";
import type { ResolvedTrack } from "@/lib/search";
import { toYouTubeEmbedUrl } from "@/lib/youtube";
import {
  type PlayableTrack,
  getStreamUrl,
  getCoverUrl,
  getAlbum,
  isSameTrack,
  isDbSong,
} from "@/lib/trackUtils";
import {
  setMediaSessionMetadata,
  clearMediaSession,
} from "@/lib/trackUtils";

import LyricsPanel from "@/components/LyricsPanel";
import MobileNav from "@/components/MobileNav";
import NowPlayingExpanded from "@/components/NowPlayingExpanded";
import PlaylistImportModal from "@/components/PlaylistImportModal";
import { useSyncedLyrics } from "@/hooks/useSyncedLyrics";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

type Tab = "home" | "search" | "library";
type AuthMode = "sign-in" | "sign-up";
type TrackMenuState = {
  key: string;
  track: PlayableTrack;
  playlistId?: string;
};

const SESSION_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Supabase session check timed out."));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function shuffleTracks<T>(tracks: T[]): T[] {
  return [...tracks].sort(() => Math.random() - 0.5);
}

function getTrackKey(track: PlayableTrack, fallback: string | number): string {
  return isDbSong(track) ? track.id : `${track.title}-${track.artist}-${getStreamUrl(track)}-${fallback}`;
}

function getSourceLabel(track: PlayableTrack): string {
  if (isDbSong(track)) {
    if (track.source_type === "youtube") return "YouTube";
    return "Library";
  }
  if (track.sourceProvider === "jamendo") return "Jamendo";
  if (track.sourceProvider === "youtube") return "YouTube";
  if (track.sourceProvider === "itunes") return "iTunes preview";
  return track.sourceType === "youtube" ? "YouTube" : "Web";
}

function ShuffleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h2.4c2.1 0 3.4 1.1 4.7 3.1l1.8 2.8c1.2 1.9 2.4 3.1 4.7 3.1H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 13l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17h2.4c1.5 0 2.5-.5 3.4-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14.2 8.5c.9-1 1.9-1.5 3.4-1.5H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 4l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PreviousIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h2v14H6V5Zm13 1.5v11L9.5 12 19 6.5Z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16 5h2v14h-2V5ZM5 6.5 14.5 12 5 17.5v-11Z" />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17 2l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 22l-4-4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SwipeableTrackRow({
  track,
  index,
  isCurrent = false,
  subtitle,
  rightLabel = "Add to queue",
  leftLabel = "Options",
  onPlay,
  onMenu,
  onSwipeRight,
  onSwipeLeft,
}: {
  track: PlayableTrack;
  index: number;
  isCurrent?: boolean;
  subtitle?: string;
  rightLabel?: string;
  leftLabel?: string;
  onPlay: () => void;
  onMenu: () => void;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  useSwipeGesture(rowRef, { onSwipeRight, onSwipeLeft }, 48);

  return (
    <div
      ref={rowRef}
      className={`tonal-track-row group ${isCurrent ? "is-current" : ""}`}
      title={`Swipe right: ${rightLabel}. Swipe left: ${leftLabel}.`}
    >
      <button type="button" onClick={onPlay} className="tonal-track-main">
        <span className="tonal-track-index">{isCurrent ? "▶" : index + 1}</span>
        <div className="tonal-thumb tonal-track-thumb">
          {getCoverUrl(track) && <img src={getCoverUrl(track)} alt="" />}
        </div>
        <div className="tonal-min">
          <p className="tonal-track-title">{track.title}</p>
          <p className="tonal-track-meta">{subtitle ?? track.artist}</p>
        </div>
      </button>
      <button
        type="button"
        className="tonal-more-button"
        onClick={(e) => {
          e.stopPropagation();
          onMenu();
        }}
        aria-label={`More options for ${track.title}`}
      >
        ...
      </button>
    </div>
  );
}

export default function TonalApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [showMobileAuth, setShowMobileAuth] = useState(false);

  const [playlists, setPlaylists] = useState<DbPlaylist[]>([]);
  const [librarySongs, setLibrarySongs] = useState<DbSong[]>([]);

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistSongs, setSelectedPlaylistSongs] = useState<DbSong[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [trackMenu, setTrackMenu] = useState<TrackMenuState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [queue, setQueue] = useState<PlayableTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [queueOrderBeforeShuffle, setQueueOrderBeforeShuffle] = useState<PlayableTrack[] | null>(
    null,
  );
  const [volume, setVolume] = useState(0.3);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const currentSong = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  const playbackUrl = currentSong ? getStreamUrl(currentSong) : "";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayableTrack[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);


  const setVolumeLocalStorage = (volume: number) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("volume", volume.toString());
    }
    return setVolume(volume);
  }

  useEffect(() => {
    const storedVolume = window.localStorage.getItem("volume");
    if (!storedVolume) return;
    const parsedVolume = Number(storedVolume);
    if (Number.isNaN(parsedVolume)) return;
    setVolume(parsedVolume);
  }, []);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? null,
    [playlists, selectedPlaylistId],
  );
  const searchSections = useMemo(
    () => [
      {
        label: "Your Library",
        tracks: searchResults.filter((track) => isDbSong(track)),
      },
      {
        label: "YouTube",
        tracks: searchResults.filter(
          (track) =>
            (!isDbSong(track) && track.sourceProvider === "youtube") ||
            (!isDbSong(track) && track.sourceType === "youtube"),
        ),
      },
      {
        label: "Jamendo",
        tracks: searchResults.filter(
          (track) => !isDbSong(track) && track.sourceProvider === "jamendo",
        ),
      },
      {
        label: "Other previews",
        tracks: searchResults.filter(
          (track) =>
            !isDbSong(track) &&
            track.sourceProvider !== "jamendo" &&
            track.sourceProvider !== "youtube" &&
            track.sourceType !== "youtube",
        ),
      },
    ].filter((section) => section.tracks.length > 0),
    [searchResults],
  );

  const fetchData = async (userId: string | null = user?.id ?? null) => {
    try {
      const { data: songs } = await supabase
        .from("songs")
        .select("*")
        .order("created_at", { ascending: false });
      const playlistQuery = supabase
        .from("playlists")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: pls } = userId ? await playlistQuery.eq("owner_id", userId) : { data: [] };
      if (songs) setLibrarySongs(songs as DbSong[]);
      if (pls) setPlaylists(pls as DbPlaylist[]);
      if (!userId) {
        setSelectedPlaylistId(null);
        setSelectedPlaylistSongs([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    void fetchData(null);
  }, []);

    useEffect(() => {
    if (!currentSong) {
      clearMediaSession();
      return;
    }
 
    setMediaSessionMetadata(currentSong, {
      onPlay:  () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onNext:  handleNext,
      onPrev:  handlePrev,
      onSeekForward:  () => seekTo(Math.min(playedSeconds + 10, duration)),
      onSeekBackward: () => seekTo(Math.max(playedSeconds - 10, 0)),
    });
 
    // Sync the playbackState flag so iOS knows when we're paused vs playing
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [currentSong, isPlaying]);

  useEffect(() => {
    if (!currentSong) {
      clearMediaSession();
      return;
    }
 
    setMediaSessionMetadata(currentSong, {
      onPlay:  () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onNext:  handleNext,
      onPrev:  handlePrev,
      onSeekForward:  () => seekTo(Math.min(playedSeconds + 10, duration)),
      onSeekBackward: () => seekTo(Math.max(playedSeconds - 10, 0)),
    });
 
    // Sync the playbackState flag so iOS knows when we're paused vs playing
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [currentSong, isPlaying]);


  useEffect(() => {
    let mounted = true;

    if (!hasSupabaseEnv) {
      setAuthMessage("Add your Supabase URL and anon key to .env.local.");
      setAuthLoading(false);
      return () => {
        mounted = false;
      };
    }

    void withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS)
      .then(({ data }) => {
        if (!mounted) return;
        setUser(data.session?.user ?? null);
        void fetchData(data.session?.user?.id ?? null);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error(error);
        setAuthMessage("Could not reach Supabase. You can still try logging in.");
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      setAuthMessage(null);
      void fetchData(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!hasSupabaseEnv) {
      setAuthMessage("Supabase environment variables are missing.");
      return;
    }
    setAuthSubmitting(true);
    setAuthMessage(null);

    try {
      const email = authEmail.trim();
      const password = authPassword;
      const result =
        authMode === "sign-in"
          ? await withTimeout(
              supabase.auth.signInWithPassword({ email, password }),
              10000,
            )
          : await withTimeout(supabase.auth.signUp({ email, password }), 10000);

      if (result.error) {
        setAuthMessage(result.error.message);
      } else if (authMode === "sign-up" && !result.data.session) {
        setAuthMessage("Check your email to confirm your account, then sign in.");
      } else {
        setAuthEmail("");
        setAuthPassword("");
        setShowMobileAuth(false);
      }
    } catch (error) {
      console.error(error);
      setAuthMessage("Supabase did not respond. Check your project URL, anon key, and network.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setAuthSubmitting(true);
    setAuthMessage(null);
    try {
      const { error } = await withTimeout(supabase.auth.signOut(), 10000);
      if (error) setAuthMessage(error.message);
    } catch (error) {
      console.error(error);
      setAuthMessage("Supabase did not respond while logging out.");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const fetchPlaylistSongs = async (playlistId: string) => {
    const { data: links, error } = await supabase
      .from("playlist_songs")
      .select("song_id, position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true });
    if (error || !links?.length) return [];
    const ids = links.map((l) => l.song_id);
    const { data: songRows } = await supabase.from("songs").select("*").in("id", ids);
    const list = (songRows ?? []) as DbSong[];
    const map = new Map(list.map((s) => [s.id, s]));
    return ids.map((id) => map.get(id)).filter(Boolean) as DbSong[];
  };

  const openPlaylist = async (playlistId: string) => {
    setPlaylistLoading(true);
    setSelectedPlaylistId(playlistId);
    setActiveTab("library");
    setShowQueue(false);
    try {
      setSelectedPlaylistSongs(await fetchPlaylistSongs(playlistId));
    } finally {
      setPlaylistLoading(false);
    }
  };

  const startPlaylist = async (playlistId: string, shuffled = false) => {
    const songs =
      playlistId === selectedPlaylistId && selectedPlaylistSongs.length > 0
        ? selectedPlaylistSongs
        : await fetchPlaylistSongs(playlistId);
    const ordered = shuffled ? shuffleTracks(songs) : songs;
    if (ordered.length === 0) {
      setQueue([]);
      setCurrentIndex(-1);
      setIsPlaying(false);
      setStatusMessage("This playlist is empty.");
      return;
    }
    setQueue(ordered);
    setCurrentIndex(0);
    setIsPlaying(true);
    setIsShuffled(shuffled);
    setQueueOrderBeforeShuffle(shuffled ? songs : null);
    setActiveTab("library");
    setShowQueue(false);
  };

  const handlePlaylistImport = async (
    name: string,
    tracks: Array<ParsedTrack & { resolved?: ResolvedTrack }>,
  ) => {
    if (!user) {
      window.alert("Sign in to Supabase (authenticated session) to import playlists.");
      return;
    }
    const { data: plRow, error: plErr } = await supabase
      .from("playlists")
      .insert({ name, owner_id: user.id, is_public: true, description: null })
      .select("id")
      .single();
    if (plErr || !plRow?.id) {
      console.error(plErr);
      return;
    }
    let position = 0;
    for (const t of tracks) {
      const r = t.resolved;
      if (!r?.streamUrl?.trim()) continue;
      const isYt = r.source === "youtube";
      const streamUrl = isYt ? toYouTubeEmbedUrl(r.streamUrl) ?? r.streamUrl : r.streamUrl;
      const { data: songRow, error: songErr } = await supabase
        .from("songs")
        .insert({
          title: t.title?.trim() || "Unknown",
          artist: t.artist?.trim() || "Unknown",
          stream_url: streamUrl,
          source_type: isYt ? "youtube" : "direct",
          cover_url: r.thumbnailUrl ?? null,
          uploaded_by: user.id,
        })
        .select("id")
        .single();
      if (songErr || !songRow?.id) continue;
      await supabase.from("playlist_songs").insert({
        playlist_id: plRow.id,
        song_id: songRow.id,
        position: position++,
      });
    }
    await fetchData(user.id);
  };

  // Debounced search: local library + YouTube + Jamendo + iTunes (automatic)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const local = filterLocalLibrary(q, librarySongs);
          const remote = await searchAllStreamingSources(q);
          const merged: PlayableTrack[] = [...local, ...remote];
          const seen = new Set<string>();
          const deduped = merged.filter((track) => {
            const key = getStreamUrl(track) || `${track.title}::${track.artist}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setSearchResults(deduped);
        } catch {
          setSearchResults(filterLocalLibrary(q, librarySongs));
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 450);

    return () => clearTimeout(t);
  }, [searchQuery, librarySongs]);

  const handlePlaySong = (song: PlayableTrack, fromList: PlayableTrack[]) => {
    setQueue(fromList);
    const idx = fromList.findIndex((s) => isSameTrack(s, song));
    setCurrentIndex(idx >= 0 ? idx : 0);
    setIsPlaying(true);
    setShowQueue(false);
  };

  const addToQueue = (track: PlayableTrack, playIfIdle = false) => {
    setQueue((existing) => {
      const next = [...existing, track];
      if (existing.length === 0 || currentIndex < 0) {
        setCurrentIndex(0);
        if (playIfIdle) setIsPlaying(true);
      }
      return next;
    });
    setStatusMessage(`Added "${track.title}" to queue.`);
  };

  const saveExternalTrackToLibrary = async (track: PlayableTrack) => {
    if (isDbSong(track)) return track;
    if (!user) {
      setShowMobileAuth(true);
      throw new Error("Sign in to save web songs.");
    }
    const isYt = track.sourceType === "youtube";
    const streamUrl = isYt ? toYouTubeEmbedUrl(track.streamUrl) ?? track.streamUrl : track.streamUrl;
    const { data, error } = await supabase
      .from("songs")
      .insert({
        title: track.title,
        artist: track.artist,
        album: track.album ?? null,
        cover_url: track.coverUrl ?? null,
        stream_url: streamUrl,
        source_type: isYt ? "youtube" : "direct",
        uploaded_by: user.id,
      })
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not save song.");
    const dbSong = data as DbSong;
    setLibrarySongs((songs) => [dbSong, ...songs]);
    return dbSong;
  };

  const addTrackToPlaylist = async (playlistId: string, track: PlayableTrack) => {
    if (!user) {
      setShowMobileAuth(true);
      setStatusMessage("Log in to edit playlists.");
      return;
    }
    const playlist = playlists.find((pl) => pl.id === playlistId);
    if (!playlist || playlist.owner_id !== user.id) {
      setStatusMessage("You can only edit playlists you own.");
      return;
    }
    try {
      const dbSong = await saveExternalTrackToLibrary(track);
      const existingSongs =
        playlistId === selectedPlaylistId ? selectedPlaylistSongs : await fetchPlaylistSongs(playlistId);
      const exists = existingSongs.some((song) => song.id === dbSong.id);
      if (exists) {
        setStatusMessage(`"${dbSong.title}" is already in ${playlist.name}.`);
        return;
      }
      const { error } = await supabase.from("playlist_songs").insert({
        playlist_id: playlistId,
        song_id: dbSong.id,
        position: existingSongs.length,
      });
      if (error) throw error;
      if (playlistId === selectedPlaylistId) {
        setSelectedPlaylistSongs((songs) => [...songs, dbSong]);
      }
      setStatusMessage(`Added "${dbSong.title}" to ${playlist.name}.`);
    } catch (error) {
      console.error(error);
      setStatusMessage("Could not add this song to the playlist.");
    }
  };

  const removeTrackFromPlaylist = async (playlistId: string, track: PlayableTrack) => {
    if (!isDbSong(track)) return;
    const playlist = playlists.find((pl) => pl.id === playlistId);
    if (!user || !playlist || playlist.owner_id !== user.id) {
      setStatusMessage("You can only edit playlists you own.");
      return;
    }
    const { error } = await supabase
      .from("playlist_songs")
      .delete()
      .eq("playlist_id", playlistId)
      .eq("song_id", track.id);
    if (error) {
      setStatusMessage("Could not remove this song.");
      return;
    }
    const nextSongs = selectedPlaylistSongs.filter((song) => song.id !== track.id);
    setSelectedPlaylistSongs(nextSongs);
    await Promise.all(
      nextSongs.map((song, position) =>
        supabase
          .from("playlist_songs")
          .update({ position })
          .eq("playlist_id", playlistId)
          .eq("song_id", song.id),
      ),
    );
    setStatusMessage(`Removed "${track.title}" from ${playlist.name}.`);
  };

  const editStreamLink = async (track: PlayableTrack) => {
    if (!isDbSong(track)) {
      setStatusMessage("Save this web result to your library before editing its link.");
      return;
    }
    if (!user) {
      setShowMobileAuth(true);
      setStatusMessage("Log in to edit song links.");
      return;
    }
    const nextUrl = window.prompt("Stream link", track.stream_url)?.trim();
    if (!nextUrl || nextUrl === track.stream_url) return;
    const sourceType = nextUrl.includes("youtube.com") || nextUrl.includes("youtu.be") ? "youtube" : "direct";
    const streamUrl = sourceType === "youtube" ? toYouTubeEmbedUrl(nextUrl) ?? nextUrl : nextUrl;
    const { data, error } = await supabase
      .from("songs")
      .update({ stream_url: streamUrl, source_type: sourceType })
      .eq("id", track.id)
      .select("*")
      .single();
    if (error || !data) {
      console.error(error);
      setStatusMessage("Could not update this stream link. You may not own this song row.");
      return;
    }
    const updated = data as DbSong;
    setLibrarySongs((songs) => songs.map((song) => (song.id === updated.id ? updated : song)));
    setSelectedPlaylistSongs((songs) =>
      songs.map((song) => (song.id === updated.id ? updated : song)),
    );
    setQueue((items) =>
      items.map((item) => (isDbSong(item) && item.id === updated.id ? updated : item)),
    );
    setStatusMessage(`Updated stream link for "${updated.title}".`);
  };

  const renameSelectedPlaylist = async () => {
    if (!selectedPlaylist || !user || selectedPlaylist.owner_id !== user.id) {
      setStatusMessage("You can only rename playlists you own.");
      return;
    }
    const name = window.prompt("Playlist name", selectedPlaylist.name)?.trim();
    if (!name || name === selectedPlaylist.name) return;
    const { error } = await supabase
      .from("playlists")
      .update({ name })
      .eq("id", selectedPlaylist.id);
    if (error) {
      setStatusMessage("Could not rename this playlist.");
      return;
    }
    setPlaylists((items) =>
      items.map((playlist) => (playlist.id === selectedPlaylist.id ? { ...playlist, name } : playlist)),
    );
  };

  const deleteSelectedPlaylist = async () => {
    if (!selectedPlaylist || !user || selectedPlaylist.owner_id !== user.id) {
      setStatusMessage("You can only delete playlists you own.");
      return;
    }
    if (!window.confirm(`Delete "${selectedPlaylist.name}"?`)) return;
    const { error } = await supabase.from("playlists").delete().eq("id", selectedPlaylist.id);
    if (error) {
      setStatusMessage("Could not delete this playlist.");
      return;
    }
    setPlaylists((items) => items.filter((playlist) => playlist.id !== selectedPlaylist.id));
    setSelectedPlaylistId(null);
    setSelectedPlaylistSongs([]);
  };

  const handlePlayQueueIndex = (index: number) => {
    if (index < 0 || index >= queue.length) return;
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    if (currentIndex < queue.length - 1) setCurrentIndex((i) => i + 1);
    else if (isLooping) setCurrentIndex(0);
    else setIsPlaying(false);
  };

  const handlePrev = () => {
    const el = playerRef.current;
    if (playedSeconds > 3 && el) {
      el.currentTime = 0;
      setPlayedSeconds(0);
    } else if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const seekTo = (seconds: number) => {
    const el = playerRef.current;
    if (el) {
      el.currentTime = seconds;
      setPlayedSeconds(seconds);
    }
  };

  const toggleShuffle = () => {
    if (!isShuffled) {
      setQueueOrderBeforeShuffle([...queue]);
      const cur = queue[currentIndex];
      const rest = queue.filter((_, i) => i !== currentIndex);
      const shuffled = [...rest].sort(() => Math.random() - 0.5);
      const next = cur ? [cur, ...shuffled] : shuffled;
      setQueue(next);
      setCurrentIndex(0);
      setIsShuffled(true);
    } else if (queueOrderBeforeShuffle) {
      const cur = queue[currentIndex];
      setQueue(queueOrderBeforeShuffle);
      const restoredIdx = cur
        ? queueOrderBeforeShuffle.findIndex((s) => isSameTrack(s, cur))
        : 0;
      setCurrentIndex(restoredIdx >= 0 ? restoredIdx : 0);
      setQueueOrderBeforeShuffle(null);
      setIsShuffled(false);
    }
  };

  const toggleQueue = () => setShowQueue((open) => !open);

  const { syncedLines, plainLyrics, activeIndex, loading: lyricsLoading } = useSyncedLyrics(
    currentSong?.title,
    currentSong?.artist,
    getAlbum(currentSong),
    playedSeconds,
  );

  useKeyboardShortcuts({
    onPlayPause: () => setIsPlaying((p) => !p),
    onNext: handleNext,
    onPrev: handlePrev,
    onToggleLyrics: () => setShowLyrics((v) => !v),
    onToggleQueue: () => setShowQueue((v) => !v),
  });

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const formatTime = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const expandedSong = useMemo(() => {
    if (!currentSong) return null;
    return {
      title: currentSong.title,
      artist: currentSong.artist,
      album: getAlbum(currentSong),
      coverUrl: getCoverUrl(currentSong),
    };
  }, [currentSong]);

  const renderAuthPanel = (compact = false) => (
    <section
      className={`tonal-auth-panel rounded-lg border border-[#282828] bg-[#121212] ${
        compact ? "p-4" : "p-4"
      }`}
    >
      {authLoading ? (
        <p className="tonal-muted text-sm text-gray-400">Checking session...</p>
      ) : user ? (
        <div className="space-y-3">
          <div className="min-w-0">
            <p className="tonal-green text-xs font-semibold uppercase tracking-wide text-[#1DB954]">
              Signed in
            </p>
            <p className="truncate text-sm font-semibold text-white">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={authSubmitting}
            className="tonal-secondary w-full rounded-full border border-[#727272] px-4 py-2 text-sm font-bold text-white hover:border-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authSubmitting ? "Signing out..." : "Log out"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleAuthSubmit} className="tonal-auth-form space-y-3">
          <div>
            <p className="text-sm font-bold text-white">
              {authMode === "sign-in" ? "Log in to Tonal" : "Create your Tonal account"}
            </p>
            <p className="tonal-muted mt-1 text-xs text-gray-400">
              Save playlists, imports, and library changes with your account.
            </p>
          </div>
          <input
            type="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className="tonal-input w-full rounded-md border border-[#333] bg-[#242424] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white"
          />
          <input
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password"
            autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
            minLength={6}
            required
            className="tonal-input w-full rounded-md border border-[#333] bg-[#242424] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white"
          />
          <button
            type="submit"
            disabled={authSubmitting}
            className="tonal-primary w-full rounded-full bg-[#1DB954] px-4 py-2 text-sm font-black text-black hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authSubmitting
              ? "Working..."
              : authMode === "sign-in"
                ? "Log in"
                : "Sign up"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode((mode) => (mode === "sign-in" ? "sign-up" : "sign-in"));
              setAuthMessage(null);
            }}
            className="tonal-link-button w-full text-xs font-semibold text-gray-300 hover:text-white"
          >
            {authMode === "sign-in"
              ? "Need an account? Sign up"
              : "Already have an account? Log in"}
          </button>
          {authMessage && <p className="tonal-error text-xs text-[#f15e6c]">{authMessage}</p>}
        </form>
      )}
    </section>
  );

  return (
    <div className="tonal-shell flex h-dvh bg-black text-white overflow-hidden font-sans pb-[env(safe-area-inset-bottom)]">
      {/* SIDEBAR — desktop */}
      <aside className="tonal-sidebar hidden md:flex w-[240px] bg-black p-2 flex-col gap-2 shrink-0">
        <nav className="tonal-nav bg-[#121212] rounded-lg p-4 space-y-4">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`tonal-nav-button ${activeTab === "home" ? "is-active text-white" : "text-gray-400"}`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`tonal-nav-button ${activeTab === "search" ? "is-active text-white" : "text-gray-400"}`}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`tonal-nav-button ${activeTab === "library" ? "is-active text-white" : "text-gray-400"}`}
          >
            Your Library
          </button>
        </nav>
        <div className="tonal-playlists flex-1 bg-[#121212] rounded-lg p-4 overflow-y-auto">
          <div className="tonal-playlists-head flex justify-between items-center mb-4">
            <span className="font-bold text-gray-400">Playlists</span>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="tonal-icon-button text-gray-400 hover:text-white"
            >
              +
            </button>
          </div>
          {playlists.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => void openPlaylist(pl.id)}
              className={`tonal-list-button w-full text-left py-2 hover:bg-[#282828] cursor-pointer rounded px-2 text-white ${
                selectedPlaylistId === pl.id ? "is-active" : ""
              }`}
            >
              {pl.name}
            </button>
          ))}
        </div>
        {renderAuthPanel()}
        <div className="h-[96px] md:h-24">
        </div>
      </aside>

      {/* MAIN */}
      <main
        className="tonal-main flex-1 m-0 md:m-2 rounded-none md:rounded-lg overflow-y-auto p-4 pt-[calc(4.25rem+env(safe-area-inset-top))] md:p-6 pb-44 md:pb-28 bg-[linear-gradient(to_bottom,#222222,#121212)]"
      >
        <header className="tonal-mobile-header fixed left-0 right-0 top-0 z-20 flex items-center justify-between border-b border-[#282828] bg-black/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className="tonal-brand text-xl font-black tracking-tight"
          >
            Tonal
          </button>
          <div className="tonal-mobile-actions flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="tonal-primary rounded-full bg-[#1DB954] px-3 py-2 text-xs font-black text-black"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setShowMobileAuth(true)}
              className="tonal-secondary max-w-[8rem] truncate rounded-full border border-[#727272] px-3 py-2 text-xs font-bold text-white"
            >
              {user?.email ?? "Log in"}
            </button>
          </div>
        </header>

        {activeTab === "home" && (
          <div>
            <div className="tonal-page-head mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="tonal-title text-2xl md:text-3xl font-bold">Welcome back</h1>
                <p className="tonal-copy mt-1 text-sm text-gray-400">
                  {user ? "Your Supabase session is active." : "Log in to save playlists and imports."}
                </p>
              </div>
              {!user && (
                <button
                  type="button"
                  onClick={() => setShowMobileAuth(true)}
                  className="tonal-secondary md:hidden w-fit rounded-full bg-white px-4 py-2 text-sm font-bold text-black"
                >
                  Log in
                </button>
              )}
            </div>
            <div className="tonal-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4">
              {librarySongs.map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => handlePlaySong(song, librarySongs)}
                  className="tonal-card text-left bg-[#181818] p-3 md:p-4 rounded-lg hover:bg-[#282828] transition-colors cursor-pointer group min-w-0"
                >
                  <div className="tonal-cover aspect-square bg-[#333] rounded-md mb-4 shadow-lg overflow-hidden">
                    {song.cover_url && (
                      <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <p className="tonal-track-title font-bold truncate text-sm md:text-base">{song.title}</p>
                  <p className="tonal-track-meta text-sm text-gray-400 truncate">{song.artist}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "search" && (
          <div>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Artists, songs, or podcasts"
              className="tonal-search w-full max-w-xl bg-[#242424] px-4 py-3 text-base rounded-full outline-none mb-2 focus:ring-2 focus:ring-white text-white placeholder:text-gray-500"
            />
            <p className="tonal-muted text-xs text-gray-500 mb-6">
              Searching your library, YouTube, Jamendo, and iTunes previews automatically.
            </p>
            {searchLoading && <p className="text-gray-400 text-sm mb-4">Searching…</p>}
            <div className="tonal-results space-y-1 max-w-3xl">
              {searchSections.map((section) => (
                <section key={section.label} className="tonal-search-section">
                  <h2 className="tonal-section-heading">{section.label}</h2>
                  {section.tracks.map((song, i) => {
                    const key = getTrackKey(song, `${section.label}-${i}`);
                    return (
                      <SwipeableTrackRow
                        key={key}
                        track={song}
                        index={i}
                        subtitle={`${song.artist} · ${getSourceLabel(song)}`}
                        onPlay={() => handlePlaySong(song, section.tracks)}
                        onMenu={() => setTrackMenu({ key, track: song })}
                        onSwipeRight={() => addToQueue(song, true)}
                        onSwipeLeft={() => setTrackMenu({ key, track: song })}
                      />
                    );
                  })}
                </section>
              ))}
            </div>
          </div>
        )}

        {activeTab === "library" && (
          <div>
            {selectedPlaylist ? (
              <section>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlaylistId(null);
                    setSelectedPlaylistSongs([]);
                  }}
                  className="tonal-link-button mb-4 text-sm"
                >
                  ← Your Library
                </button>
                <div className="tonal-playlist-hero">
                  <div className="tonal-playlist-cover">
                    {selectedPlaylistSongs[0]?.cover_url ? (
                      <img src={selectedPlaylistSongs[0].cover_url} alt="" />
                    ) : (
                      <span>♪</span>
                    )}
                  </div>
                  <div className="tonal-playlist-copy">
                    <p className="tonal-muted text-xs font-bold uppercase">Playlist</p>
                    <h1 className="tonal-playlist-title">{selectedPlaylist.name}</h1>
                    {selectedPlaylist.description && (
                      <p className="tonal-copy">{selectedPlaylist.description}</p>
                    )}
                    <p className="tonal-muted text-sm">
                      {selectedPlaylistSongs.length} song{selectedPlaylistSongs.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="tonal-playlist-actions">
                  <button
                    type="button"
                    onClick={() => void startPlaylist(selectedPlaylist.id)}
                    className="tonal-primary tonal-round-play"
                    aria-label={`Play ${selectedPlaylist.name}`}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => void startPlaylist(selectedPlaylist.id, true)}
                    className="tonal-secondary tonal-icon-text"
                  >
                    <ShuffleIcon />
                    <span>Shuffle</span>
                  </button>
                  <button type="button" onClick={() => void renameSelectedPlaylist()} className="tonal-secondary">
                    Rename
                  </button>
                  <button type="button" onClick={() => void deleteSelectedPlaylist()} className="tonal-secondary">
                    Delete
                  </button>
                </div>
                {playlistLoading ? (
                  <p className="tonal-muted">Loading playlist...</p>
                ) : selectedPlaylistSongs.length === 0 ? (
                  <div className="tonal-empty">
                    <p>This playlist is empty.</p>
                    <p className="tonal-muted text-sm">Use song menus or swipe search results to add tracks.</p>
                  </div>
                ) : (
                  <div className="tonal-track-list">
                    <div className="tonal-track-list-head">
                      <span>#</span>
                      <span>Title</span>
                      <span className="tonal-hide-mobile">Album</span>
                      <span>Actions</span>
                    </div>
                    {selectedPlaylistSongs.map((song, index) => (
                      <SwipeableTrackRow
                        key={song.id}
                        track={song}
                        index={index}
                        isCurrent={currentSong ? isSameTrack(currentSong, song) : false}
                        subtitle={`${song.artist}${song.album ? ` · ${song.album}` : ""}`}
                        onPlay={() => handlePlaySong(song, selectedPlaylistSongs)}
                        onMenu={() =>
                          setTrackMenu({ key: getTrackKey(song, index), track: song, playlistId: selectedPlaylist.id })
                        }
                        onSwipeRight={() => addToQueue(song)}
                        onSwipeLeft={() =>
                          setTrackMenu({ key: getTrackKey(song, index), track: song, playlistId: selectedPlaylist.id })
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <>
                <h1 className="tonal-title text-2xl font-bold mb-4">Your Library</h1>
                <div className="tonal-library-head mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="tonal-copy text-gray-400 text-sm">
                    Open a playlist to view songs, edit details, play, or shuffle.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="tonal-primary w-fit rounded-full bg-[#1DB954] px-4 py-2 text-sm font-black text-black hover:bg-[#1ed760]"
                  >
                    Import playlist
                  </button>
                </div>
                <div className="tonal-library-list space-y-2">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className="tonal-playlist-card tonal-playlist-card-row w-full text-left p-4 bg-[#181818] rounded-lg hover:bg-[#282828] transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => void openPlaylist(pl.id)}
                        className="tonal-playlist-open"
                      >
                        <p className="font-semibold">{pl.name}</p>
                        {pl.description && (
                          <p className="text-sm text-gray-400 mt-1">{pl.description}</p>
                        )}
                        <p className="text-xs text-[#1DB954] mt-2">Open playlist</p>
                      </button>
                      <div className="tonal-playlist-quick-actions">
                        <button
                          type="button"
                          className="tonal-primary tonal-small-round"
                          onClick={() => void startPlaylist(pl.id)}
                          aria-label={`Play ${pl.name}`}
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          className="tonal-secondary tonal-icon-only"
                          onClick={() => void startPlaylist(pl.id, true)}
                          aria-label={`Shuffle ${pl.name}`}
                        >
                          <ShuffleIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* LYRICS — desktop side panel (Spotify-style) */}
      {showLyrics && (
        <aside className="tonal-side-panel hidden lg:flex w-[340px] shrink-0 bg-[#121212] m-2 ml-0 rounded-lg overflow-hidden flex-col border border-[#282828]">
          <div className="tonal-panel-head p-3 border-b border-[#282828] flex items-center justify-between">
            <span className="font-bold text-sm">Lyrics</span>
            <button
              type="button"
              onClick={() => setShowLyrics(false)}
              className="text-gray-400 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <LyricsPanel
              syncedLines={syncedLines}
              plainLyrics={plainLyrics}
              activeIndex={activeIndex}
              loading={lyricsLoading}
            />
          </div>
        </aside>
      )}

      {/* MOBILE: full-screen lyrics when toggled */}
      {showLyrics && (
        <div className="tonal-overlay lg:hidden fixed inset-x-0 top-0 bottom-[96px] z-30 bg-[#121212] flex flex-col pt-12">
          <div className="tonal-panel-head flex items-center justify-between p-4 border-b border-[#282828]">
            <span className="font-bold">Lyrics</span>
            <button type="button" onClick={() => setShowLyrics(false)} className="text-[#1DB954]">
              Done
            </button>
          </div>
          <div className="tonal-panel-body flex-1 min-h-0">
            <LyricsPanel
              syncedLines={syncedLines}
              plainLyrics={plainLyrics}
              activeIndex={activeIndex}
              loading={lyricsLoading}
            />
          </div>
        </div>
      )}

      {/* QUEUE PANEL */}
      {showQueue && (
        <div
          role="presentation"
          className="tonal-overlay fixed inset-x-0 top-0 bottom-[96px] z-40 md:inset-auto md:top-0 md:right-0 md:bottom-24 md:w-[380px] md:left-auto bg-[#121212] md:bg-[#121212] flex flex-col border-l border-[#282828] pt-[env(safe-area-inset-top)]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQueue(false);
          }}
        >
          <div className="tonal-panel-head flex items-center justify-between p-4 border-b border-[#282828]">
            <span className="font-bold">Queue</span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowQueue(false);
              }}
              className="text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="tonal-panel-body flex-1 overflow-y-auto p-2">
            {queue.length === 0 ? (
              <p className="text-gray-500 text-sm p-4">Play a track to build your queue.</p>
            ) : (
              queue.map((track, i) => (
                <button
                  key={"id" in track ? track.id : `${i}-${getStreamUrl(track)}`}
                  type="button"
                  onClick={() => handlePlayQueueIndex(i)}
                  className={`w-full flex items-center gap-3 p-2 rounded-md text-left ${
                    i === currentIndex ? "bg-[#1DB954]/20" : "hover:bg-[#ffffff0d]"
                  }`}
                >
                  <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="truncate text-xs text-gray-400">{track.artist}</p>
                  </div>
                  {i === currentIndex && (
                    <span className="text-[#1DB954] text-xs shrink-0">Playing</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* PLAYER BAR */}
      <footer className="tonal-player fixed bottom-0 left-0 right-0 z-30 h-[96px] md:h-24 bg-black border-t border-[#282828] px-3 md:px-4 flex items-center gap-2 md:gap-4 pb-[max(0.65rem,env(safe-area-inset-bottom))] md:pb-3">
        <div className="tonal-player-track w-[32%] md:w-[30%] flex items-center gap-2 md:gap-4 min-w-0">
          {currentSong && (
            <button
              type="button"
              onClick={() => setShowExpandedPlayer(true)}
              className="tonal-now-button flex items-center gap-2 md:gap-4 min-w-0 text-left hover:opacity-90"
            >
              <div className="tonal-player-art w-11 h-11 md:w-14 md:h-14 bg-gray-800 rounded overflow-hidden shrink-0">
                {getCoverUrl(currentSong) && (
                  <img
                    src={getCoverUrl(currentSong)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="tonal-player-info overflow-hidden hidden min-[430px]:block">
                <p className="tonal-track-title text-sm font-bold truncate">{currentSong.title}</p>
                <p className="tonal-track-meta text-xs text-gray-400 truncate">{currentSong.artist}</p>
              </div>
            </button>
          )}
        </div>

        <div className="tonal-controls flex-1 flex flex-col items-center gap-1 md:gap-2 min-w-0">
          <div className="tonal-control-row flex items-center gap-2 min-[430px]:gap-3 md:gap-6">
            <button
              type="button"
              onClick={toggleShuffle}
              className={`tonal-control tonal-shuffle ${isShuffled ? "is-active text-[#1DB954]" : "text-gray-400"} hidden min-[430px]:inline`}
              aria-label="Shuffle"
            >
              <ShuffleIcon />
            </button>
            <button type="button" onClick={handlePrev} className="tonal-control text-lg md:text-2xl" aria-label="Previous">
              <PreviousIcon />
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="tonal-play w-10 h-10 md:w-10 md:h-10 bg-white text-black rounded-full flex items-center justify-center font-bold shrink-0"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "Ⅱ" : "▶"}
            </button>
            <button type="button" onClick={handleNext} className="tonal-control text-lg md:text-2xl" aria-label="Next">
              <NextIcon />
            </button>
            <button
              type="button"
              onClick={() => setIsLooping((looping) => !looping)}
              className={`tonal-control ${isLooping ? "is-active text-[#1DB954]" : "text-gray-400"} hidden min-[430px]:inline`}
              aria-label="Loop queue"
            >
              <LoopIcon />
            </button>
          </div>
          <div className="tonal-progress w-full max-w-xl hidden min-[430px]:flex items-center gap-2 text-[10px] md:text-xs text-gray-400">
            <span className="tabular-nums shrink-0">{formatTime(playedSeconds)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(playedSeconds, duration || 0)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="flex-1 accent-white min-w-0"
            />
            <span className="tabular-nums shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="tonal-player-tools w-[32%] md:w-[30%] flex justify-end items-center gap-1 md:gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleQueue}
            className={`tonal-tool tonal-tool-label hidden sm:inline-flex px-2 py-1.5 rounded text-xs font-semibold ${showQueue ? "is-active text-[#1DB954]" : "text-gray-400 hover:text-white"}`}
          >
            Queue
          </button>
          <button
            type="button"
            onClick={toggleQueue}
            className="tonal-tool sm:hidden text-gray-400 hover:text-white p-2"
            aria-label="Queue"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 10h3v7H4zm7.5 0h3v4h-3zM20 10h-3v9h3zM6 5v3h12V5z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowLyrics(!showLyrics)}
            className={`tonal-tool tonal-tool-label hidden md:inline-flex px-2 py-1.5 rounded text-xs font-semibold ${showLyrics ? "is-active text-[#1DB954]" : "text-gray-400 hover:text-white"}`}
          >
            Lyrics
          </button>
          <button
            type="button"
            onClick={() => setShowLyrics(!showLyrics)}
            className={`tonal-tool md:hidden p-2 rounded ${showLyrics ? "is-active text-[#1DB954]" : "text-gray-400"}`}
            aria-label="Lyrics"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 22h12v-2H6v2zm6-4c2.76 0 5-2.24 5-5V4H7v9c0 2.76 2.24 5 5 5zm0-2c-1.65 0-3-1.35-3-3V6h6v7c0 1.65-1.35 3-3 3z" />
            </svg>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolumeLocalStorage(Number(e.target.value))}
            className="tonal-volume w-16 md:w-24 accent-[#1DB954] hidden sm:block"
            aria-label="Volume"
          />
        </div>
      </footer>

      {/* Hidden player — ReactPlayer v3 uses src + native video ref */}
      <div className="fixed pointer-events-none opacity-0 w-px h-px overflow-hidden" aria-hidden>
      <ReactPlayer
        ref={playerRef}
        src={playbackUrl || ""}
        playing={isPlaying && Boolean(playbackUrl)}
        volume={volume}
        controls={false}
        onTimeUpdate={(e) => setPlayedSeconds(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onEnded={handleNext}
      />

      </div>
      <div className="md:hidden">
        <MobileNav
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as Tab)}
          hasNowPlaying={Boolean(currentSong)}
          onNowPlayingClick={() => setShowExpandedPlayer(true)}
        />
      </div>
      {showExpandedPlayer && expandedSong && (
        <NowPlayingExpanded
          song={expandedSong}
          isPlaying={isPlaying}
          currentTime={playedSeconds}
          duration={duration}
          onPlayPause={() => setIsPlaying((p) => !p)}
          onNext={handleNext}
          onPrev={handlePrev}
          onSeek={seekTo}
          onCollapse={() => setShowExpandedPlayer(false)}
          syncedLines={syncedLines}
          plainLyrics={plainLyrics}
          activeIndex={activeIndex}
          lyricsLoading={lyricsLoading}
        />
      )}

      {isImportModalOpen && (
        <PlaylistImportModal
          onClose={() => setIsImportModalOpen(false)}
          onImport={handlePlaylistImport}
          librarySnapshot={librarySongs}
        />
      )}

      {trackMenu && (
        <div className="tonal-action-backdrop" onClick={() => setTrackMenu(null)}>
          <div className="tonal-action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="tonal-action-head">
              <div className="tonal-min">
                <p className="tonal-track-title">{trackMenu.track.title}</p>
                <p className="tonal-track-meta">{trackMenu.track.artist}</p>
              </div>
              <button type="button" className="tonal-icon-button" onClick={() => setTrackMenu(null)}>
                Close
              </button>
            </div>
            <button
              type="button"
              className="tonal-action-item"
              onClick={() => {
                addToQueue(trackMenu.track, true);
                setTrackMenu(null);
              }}
            >
              Add to queue
            </button>
            {trackMenu.playlistId && (
              <>
                <button
                  type="button"
                  className="tonal-action-item"
                  onClick={() => {
                    void editStreamLink(trackMenu.track);
                    setTrackMenu(null);
                  }}
                >
                  Edit stream link
                </button>
                <button
                  type="button"
                  className="tonal-action-item"
                  onClick={() => {
                    void removeTrackFromPlaylist(trackMenu.playlistId!, trackMenu.track);
                    setTrackMenu(null);
                  }}
                >
                  Remove from this playlist
                </button>
              </>
            )}
            <div className="tonal-action-group-title">Add to playlist</div>
            {playlists.length === 0 ? (
              <p className="tonal-muted text-sm">No playlists yet. Import one to get started.</p>
            ) : (
              playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="tonal-action-item"
                  onClick={() => {
                    void addTrackToPlaylist(playlist.id, trackMenu.track);
                    setTrackMenu(null);
                  }}
                >
                  {playlist.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {statusMessage && <div className="tonal-toast">{statusMessage}</div>}

      {showMobileAuth && (
        <div className="tonal-mobile-sheet fixed inset-0 z-50 flex flex-col bg-black/70 md:hidden">
          <button
            type="button"
            aria-label="Close login panel"
            className="tonal-sheet-spacer flex-1"
            onClick={() => setShowMobileAuth(false)}
          />
          <div className="tonal-sheet rounded-t-2xl border-t border-[#282828] bg-black p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="tonal-sheet-head mb-3 flex items-center justify-between">
              <p className="text-lg font-black">Account</p>
              <button
                type="button"
                onClick={() => setShowMobileAuth(false)}
                className="rounded-full bg-[#242424] px-3 py-1.5 text-sm font-bold text-white"
              >
                Done
              </button>
            </div>
            {renderAuthPanel(true)}
          </div>
        </div>
      )}
    </div>
  );
}

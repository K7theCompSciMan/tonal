"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import ReactPlayer from "react-player";
import { Session } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import { DbPlaylist, DbSong } from "@/lib/types";
import { toYouTubeEmbedUrl } from "@/lib/youtube";

type Tab = "home" | "search" | "library" | "upload" | "settings";
type PlaylistWithSongs = DbPlaylist & { songs: DbSong[] };
type PlaylistImportPayload = { name?: string; description?: string; songs?: Partial<DbSong>[] };
type AppSettings = {
  persistentQueueOrdering: boolean;
  enableSwipeGestures: boolean;
  enableNowPlayingView: boolean;
};
type ExternalSong = {
  title: string;
  artist: string;
  streamUrl: string;
  sourceType: "direct" | "youtube";
  coverUrl?: string;
  album?: string;
};

const ytApiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? "";
const jamendoClientId = process.env.NEXT_PUBLIC_JAMENDO_CLIENT_ID ?? "";
const SETTINGS_STORAGE_KEY = "tonal.settings.v1";

function isProbablyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function parseM3uSongs(content: string): Partial<DbSong>[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  const songs: Partial<DbSong>[] = [];
  let pendingMeta: { title?: string; artist?: string } = {};

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const payload = line.split(",", 2)[1] ?? "";
      const [artist, title] = payload.split(" - ");
      pendingMeta = {
        artist: artist?.trim() || "Unknown Artist",
        title: title?.trim() || "Untitled",
      };
      continue;
    }
    if (line.startsWith("#")) continue;
    songs.push({
      title: pendingMeta.title || "Imported Track",
      artist: pendingMeta.artist || "Unknown Artist",
      stream_url: line,
      source_type: toYouTubeEmbedUrl(line) ? "youtube" : "direct",
    });
    pendingMeta = {};
  }
  return songs;
}

function parseCsvOrTxtSongs(content: string): Partial<DbSong>[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];
  const first = lines[0].toLowerCase();
  const hasHeader =
    first.includes("title") || first.includes("song") || first.includes("artist") || first.includes("author");

  return lines
    .slice(hasHeader ? 1 : 0)
    .map((line) => {
      const byComma = line.split(",").map((part) => part.trim());
      if (byComma.length >= 2) {
        const [firstPart, secondPart, thirdPart] = byComma;
        const maybeUrl = thirdPart || secondPart;
        const hasUrl = maybeUrl ? isProbablyUrl(maybeUrl) : false;
        return {
          title: firstPart || "Imported Track",
          artist: secondPart || "Unknown Artist",
          stream_url: hasUrl ? maybeUrl : undefined,
          source_type: hasUrl && toYouTubeEmbedUrl(maybeUrl) ? "youtube" : "direct",
        } as Partial<DbSong>;
      }

      const byDash = line.split(" - ").map((part) => part.trim());
      if (byDash.length >= 2) {
        return {
          artist: byDash[0] || "Unknown Artist",
          title: byDash[1] || "Imported Track",
        };
      }

      return { title: line, artist: "Unknown Artist" };
    })
    .filter((song) => song.title || song.artist);
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

async function searchYouTubeSongs(query: string): Promise<ExternalSong[]> {
  if (!ytApiKey) return [];
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoCategoryId: "10",
    maxResults: "10",
    key: ytApiKey,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } } }[];
  };
  return (payload.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;
      return {
        title: item.snippet?.title || "YouTube Track",
        artist: item.snippet?.channelTitle || "YouTube",
        streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
        sourceType: "youtube" as const,
        coverUrl: item.snippet?.thumbnails?.medium?.url,
      };
    })
    .filter(Boolean) as ExternalSong[];
}

async function searchITunesSongs(query: string): Promise<ExternalSong[]> {
  const params = new URLSearchParams({ term: query, media: "music", entity: "song", limit: "12" });
  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    results?: { trackName?: string; artistName?: string; previewUrl?: string; artworkUrl100?: string; collectionName?: string }[];
  };
  return (payload.results ?? [])
    .filter((row) => row.previewUrl)
    .map((row) => ({
      title: row.trackName || "Preview Track",
      artist: row.artistName || "Unknown Artist",
      streamUrl: row.previewUrl || "",
      sourceType: "direct" as const,
      coverUrl: row.artworkUrl100,
      album: row.collectionName,
    }));
}

async function searchJamendoSongs(query: string): Promise<ExternalSong[]> {
  if (!jamendoClientId) return [];
  const params = new URLSearchParams({
    client_id: jamendoClientId,
    format: "json",
    limit: "10",
    namesearch: query,
    include: "musicinfo",
  });
  const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`);
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    results?: { name?: string; artist_name?: string; audio?: string; image?: string; album_name?: string }[];
  };
  return (payload.results ?? [])
    .filter((row) => row.audio)
    .map((row) => ({
      title: row.name || "Jamendo Track",
      artist: row.artist_name || "Unknown Artist",
      streamUrl: row.audio || "",
      sourceType: "direct" as const,
      coverUrl: row.image,
      album: row.album_name,
    }));
}

async function resolveImportedSongUrl(song: Partial<DbSong>): Promise<Partial<DbSong> | null> {
  const rawUrl = song.stream_url?.trim() || "";
  if (rawUrl) {
    const source = song.source_type || (toYouTubeEmbedUrl(rawUrl) ? "youtube" : "direct");
    const normalized =
      source === "youtube" ? toYouTubeEmbedUrl(rawUrl) ?? rawUrl : rawUrl;
    return { ...song, stream_url: normalized, source_type: source };
  }

  const query = [song.title, song.artist].filter(Boolean).join(" ").trim();
  if (!query) return null;

  const [youtube, itunes, jamendo] = await Promise.all([
    searchYouTubeSongs(query),
    searchITunesSongs(query),
    searchJamendoSongs(query),
  ]);
  const best = youtube[0] ?? itunes[0] ?? jamendo[0];
  if (!best) return null;

  return {
    ...song,
    title: song.title || best.title,
    artist: song.artist || best.artist,
    album: song.album || best.album,
    cover_url: song.cover_url || best.coverUrl,
    stream_url: best.streamUrl,
    source_type: best.sourceType,
  };
}

export default function Home() {
  if (!hasSupabaseEnv) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex items-center justify-center">
        <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-2">
          <h1 className="text-2xl font-semibold">Tonal</h1>
          <p className="text-zinc-300">Missing Supabase environment variables.</p>
          <p className="text-sm text-zinc-400">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then restart.
          </p>
        </div>
      </main>
    );
  }

  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [loading, setLoading] = useState(true);
  const [songs, setSongs] = useState<DbSong[]>([]);
  const [playlistQueue, setPlaylistQueue] = useState<DbSong[]>([]);
  const [playlists, setPlaylists] = useState<DbPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistWithSongs | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [nowPlaying, setNowPlaying] = useState<DbSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [editingPlaylistName, setEditingPlaylistName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNowPlayingView, setShowNowPlayingView] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchRowIndex, setTouchRowIndex] = useState<number | null>(null);
  const [searchingExternal, setSearchingExternal] = useState(false);
  const [externalResults, setExternalResults] = useState<ExternalSong[]>([]);
  const [lyrics, setLyrics] = useState<string>("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    persistentQueueOrdering: true,
    enableSwipeGestures: true,
    enableNowPlayingView: true,
  });
  const [newSong, setNewSong] = useState({
    title: "",
    artist: "",
    album: "",
    cover_url: "",
    stream_url: "",
    source_type: "direct",
    genre: "",
    mood: "",
    duration_seconds: "",
  });

  useEffect(() => {
    const run = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      setSession(initialSession);
      setLoading(false);
    };
    run();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      setSettings((prev) => ({
        ...prev,
        ...parsed,
      }));
    } catch {
      // Ignore invalid persisted settings.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!session) {
      setSongs([]);
      setPlaylistQueue([]);
      setPlaylists([]);
      setSelectedPlaylist(null);
      return;
    }
    void Promise.all([loadSongs(), loadPlaylists()]);
  }, [session]);

  useEffect(() => {
    const run = async () => {
      if (!nowPlaying?.title || !nowPlaying.artist) {
        setLyrics("");
        return;
      }
      setLyricsLoading(true);
      try {
        const response = await fetch(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(nowPlaying.artist)}/${encodeURIComponent(nowPlaying.title)}`,
        );
        if (!response.ok) {
          setLyrics("Lyrics not found.");
          return;
        }
        const payload = (await response.json()) as { lyrics?: string };
        setLyrics(payload.lyrics || "Lyrics not found.");
      } catch {
        setLyrics("Lyrics unavailable right now.");
      } finally {
        setLyricsLoading(false);
      }
    };
    void run();
  }, [nowPlaying?.title, nowPlaying?.artist]);

  async function loadSongs() {
    const { data, error } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
    if (error) {
      setStatus(error.message);
      return;
    }
    setSongs((data ?? []) as DbSong[]);
    if (!nowPlaying && data && data.length > 0) {
      setNowPlaying(data[0] as DbSong);
      setQueueIndex(0);
    }
  }

  async function loadPlaylists() {
    if (!session?.user.id) return;
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .or(`owner_id.eq.${session.user.id},is_public.eq.true`)
      .order("created_at", { ascending: false });
    if (error) {
      setStatus(error.message);
      return;
    }
    setPlaylists((data ?? []) as DbPlaylist[]);
  }

  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      const matchesSearch = [song.title, song.artist, song.album ?? ""].join(" ").toLowerCase().includes(search.toLowerCase());
      const matchesGenre = genreFilter ? song.genre === genreFilter : true;
      const matchesMood = moodFilter ? song.mood === moodFilter : true;
      return matchesSearch && matchesGenre && matchesMood;
    });
  }, [songs, search, genreFilter, moodFilter]);

  const uniqueGenres = useMemo(() => Array.from(new Set(songs.map((s) => s.genre).filter(Boolean))).sort() as string[], [songs]);
  const uniqueMoods = useMemo(() => Array.from(new Set(songs.map((s) => s.mood).filter(Boolean))).sort() as string[], [songs]);
  const queue = activePlaylistId ? playlistQueue : filteredSongs;

  useEffect(() => {
    if (!nowPlaying && queue.length > 0) {
      setNowPlaying(queue[0]);
      setQueueIndex(0);
    }
  }, [queue, nowPlaying]);

  async function signInOrSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("");
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (!signIn.error) {
      setStatus("Signed in.");
      return;
    }
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) {
      setStatus(signUp.error.message);
      return;
    }
    setStatus("Account created. Check email if confirmation is enabled.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStatus("Signed out.");
    setNowPlaying(null);
    setIsPlaying(false);
  }

  async function createPlaylist(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user.id || !newPlaylistName.trim()) return;
    const { error } = await supabase.from("playlists").insert({
      name: newPlaylistName.trim(),
      description: newPlaylistDescription || null,
      owner_id: session.user.id,
      is_public: true,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setNewPlaylistName("");
    setNewPlaylistDescription("");
    setStatus("Playlist created.");
    await loadPlaylists();
  }

  async function uploadSong(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user.id || !newSong.title.trim() || !newSong.stream_url.trim()) return;
    const sourceType = newSong.source_type === "youtube" ? "youtube" : "direct";
    const streamUrl = sourceType === "youtube" ? toYouTubeEmbedUrl(newSong.stream_url) ?? newSong.stream_url : newSong.stream_url;

    const { error } = await supabase.from("songs").insert({
      title: newSong.title,
      artist: newSong.artist || "Unknown Artist",
      album: newSong.album || null,
      cover_url: newSong.cover_url || null,
      stream_url: streamUrl,
      source_type: sourceType,
      genre: newSong.genre || null,
      mood: newSong.mood || null,
      duration_seconds: newSong.duration_seconds ? Number(newSong.duration_seconds) : null,
      uploaded_by: session.user.id,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    setNewSong({
      title: "",
      artist: "",
      album: "",
      cover_url: "",
      stream_url: "",
      source_type: "direct",
      genre: "",
      mood: "",
      duration_seconds: "",
    });
    setStatus("Song added.");
    await loadSongs();
    setActiveTab("home");
  }

  async function saveExternalResult(result: ExternalSong) {
    if (!session?.user.id) return;
    const normalizedStream = result.sourceType === "youtube" ? toYouTubeEmbedUrl(result.streamUrl) ?? result.streamUrl : result.streamUrl;
    const { data: existing } = await supabase.from("songs").select("*").eq("stream_url", normalizedStream).maybeSingle();
    if (existing) {
      playSong(existing as DbSong);
      setStatus("Song already exists in your library. Playing it now.");
      return;
    }
    const { data, error } = await supabase
      .from("songs")
      .insert({
        title: result.title,
        artist: result.artist,
        album: result.album || null,
        cover_url: result.coverUrl || null,
        stream_url: normalizedStream,
        source_type: result.sourceType,
        uploaded_by: session.user.id,
      })
      .select("*")
      .single();
    if (error || !data) {
      setStatus(error?.message || "Could not save track.");
      return;
    }
    setSongs((current) => [data as DbSong, ...current]);
    playSong(data as DbSong);
    setStatus("Added track from external search.");
  }

  async function runExternalSearch() {
    const query = search.trim();
    if (!query) {
      setExternalResults([]);
      return;
    }
    setSearchingExternal(true);
    try {
      const [youtube, itunes, jamendo] = await Promise.all([
        searchYouTubeSongs(query),
        searchITunesSongs(query),
        searchJamendoSongs(query),
      ]);
      const merged = [...youtube, ...itunes, ...jamendo];
      const deduped = merged.filter(
        (song, idx) => merged.findIndex((other) => other.streamUrl === song.streamUrl) === idx,
      );
      setExternalResults(deduped);
    } catch {
      setStatus("External search failed.");
    } finally {
      setSearchingExternal(false);
    }
  }

  async function getNextPlaylistPosition(playlistId: string): Promise<number> {
    const { data, error } = await supabase
      .from("playlist_songs")
      .select("position")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return 0;
    return (data[0].position ?? -1) + 1;
  }

  async function persistPlaylistOrder(playlistId: string, orderedSongs: DbSong[]) {
    if (!settings.persistentQueueOrdering) return;
    await Promise.all(
      orderedSongs.map((song, index) =>
        supabase
          .from("playlist_songs")
          .update({ position: index })
          .eq("playlist_id", playlistId)
          .eq("song_id", song.id),
      ),
    );
  }

  async function addSongToPlaylist(songId: string, playlistId: string) {
    const position = await getNextPlaylistPosition(playlistId);
    const { error } = await supabase
      .from("playlist_songs")
      .insert({ song_id: songId, playlist_id: playlistId, position });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Song added to playlist.");
    if (selectedPlaylist?.id === playlistId) await openPlaylist(playlistId);
  }

  async function openPlaylist(playlistId: string) {
    const selected = playlists.find((p) => p.id === playlistId) ?? null;
    setSelectedPlaylist(selected ? { ...selected, songs: [] } : null);
    setEditingPlaylistName(selected?.name ?? "");

    const { data, error } = await supabase
      .from("playlist_songs")
      .select("song_id, position, added_at")
      .eq("playlist_id", playlistId)
      .order(settings.persistentQueueOrdering ? "position" : "added_at", {
        ascending: true,
      });
    if (error) {
      setStatus(error.message);
      return;
    }
    const songIds = (data ?? []).map((item) => item.song_id);
    if (songIds.length === 0) {
      setActivePlaylistId(playlistId);
      setPlaylistQueue([]);
      setStatus("Playlist is empty.");
      setActiveTab("library");
      if (selected) setSelectedPlaylist({ ...selected, songs: [] });
      return;
    }
    const { data: songRows, error: songError } = await supabase.from("songs").select("*").in("id", songIds);
    if (songError) {
      setStatus(songError.message);
      return;
    }
    const songMap = new Map((songRows ?? []).map((song) => [song.id, song as DbSong]));
    const loadedSongs = songIds
      .map((id) => songMap.get(id))
      .filter(Boolean) as DbSong[];
    setActivePlaylistId(playlistId);
    setPlaylistQueue(loadedSongs);
    if (selected) setSelectedPlaylist({ ...selected, songs: loadedSongs });
    if (loadedSongs.length > 0) {
      setNowPlaying(loadedSongs[0]);
      setQueueIndex(0);
    }
    setActiveTab("library");
  }

  async function removeSongFromPlaylist(songId: string) {
    if (!selectedPlaylist) return;
    const { error } = await supabase
      .from("playlist_songs")
      .delete()
      .eq("playlist_id", selectedPlaylist.id)
      .eq("song_id", songId);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Song removed from playlist.");
    await openPlaylist(selectedPlaylist.id);
  }

  async function updatePlaylistName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPlaylist || !editingPlaylistName.trim()) return;
    const { error } = await supabase
      .from("playlists")
      .update({ name: editingPlaylistName.trim() })
      .eq("id", selectedPlaylist.id);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Playlist renamed.");
    await loadPlaylists();
    await openPlaylist(selectedPlaylist.id);
  }

  async function deletePlaylist() {
    if (!selectedPlaylist) return;
    const { error } = await supabase.from("playlists").delete().eq("id", selectedPlaylist.id);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Playlist deleted.");
    setSelectedPlaylist(null);
    setActivePlaylistId(null);
    setPlaylistQueue([]);
    await loadPlaylists();
  }

  function moveQueueItem(from: number, to: number) {
    if (from < 0 || to < 0 || from >= queue.length || to >= queue.length || from === to) return;
    const nextQueue = [...queue];
    const [item] = nextQueue.splice(from, 1);
    nextQueue.splice(to, 0, item);
    setPlaylistQueue(nextQueue);
    setSelectedPlaylist((prev) =>
      prev && prev.id === activePlaylistId ? { ...prev, songs: nextQueue } : prev,
    );
    if (nowPlaying) {
      const nextIndex = nextQueue.findIndex((song) => song.id === nowPlaying.id);
      setQueueIndex(nextIndex >= 0 ? nextIndex : 0);
    }
    if (activePlaylistId) {
      void persistPlaylistOrder(activePlaylistId, nextQueue);
    }
  }

  function removeFromQueue(index: number) {
    if (index < 0 || index >= queue.length) return;
    const target = queue[index];
    const nextQueue = queue.filter((_, idx) => idx !== index);
    setPlaylistQueue(nextQueue);
    setSelectedPlaylist((prev) =>
      prev && prev.id === activePlaylistId ? { ...prev, songs: nextQueue } : prev,
    );
    if (nowPlaying?.id === target.id) {
      const fallback = nextQueue[index] ?? nextQueue[index - 1] ?? null;
      setNowPlaying(fallback);
      setQueueIndex(Math.max(0, index - 1));
    } else if (nowPlaying) {
      const newIdx = nextQueue.findIndex((song) => song.id === nowPlaying.id);
      setQueueIndex(newIdx >= 0 ? newIdx : 0);
    }
    if (activePlaylistId) {
      void persistPlaylistOrder(activePlaylistId, nextQueue);
    }
  }

  function handleQueueTouchStart(index: number, clientX: number) {
    if (!settings.enableSwipeGestures) return;
    setTouchStartX(clientX);
    setTouchRowIndex(index);
  }

  function handleQueueTouchEnd(index: number, clientX: number) {
    if (!settings.enableSwipeGestures) return;
    if (touchStartX === null || touchRowIndex !== index) return;
    const deltaX = clientX - touchStartX;
    if (deltaX <= -70) {
      removeFromQueue(index);
    } else if (deltaX >= 70 && queue[index]) {
      playSong(queue[index]);
    }
    setTouchStartX(null);
    setTouchRowIndex(null);
  }

  function exportSelectedPlaylistJson() {
    if (!selectedPlaylist) return;
    const payload = {
      name: selectedPlaylist.name,
      description: selectedPlaylist.description,
      songs: selectedPlaylist.songs,
      exported_at: new Date().toISOString(),
      source: "tonal",
      format_version: 1,
    };
    downloadTextFile(`${selectedPlaylist.name.replace(/\s+/g, "_").toLowerCase()}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportSelectedPlaylistM3u() {
    if (!selectedPlaylist) return;
    const rows = ["#EXTM3U"];
    for (const song of selectedPlaylist.songs) {
      rows.push(`#EXTINF:${song.duration_seconds ?? -1},${song.artist} - ${song.title}`);
      rows.push(song.stream_url);
    }
    downloadTextFile(`${selectedPlaylist.name.replace(/\s+/g, "_").toLowerCase()}.m3u`, rows.join("\n"), "audio/x-mpegurl");
  }

  async function handlePlaylistImport(e: ChangeEvent<HTMLInputElement>) {
    if (!session?.user.id) return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const content = await file.text();
    const lower = file.name.toLowerCase();
    let importedName = file.name.replace(/\.(json|m3u|m3u8|csv|txt)$/i, "");
    let importedSongs: Partial<DbSong>[] = [];

    if (lower.endsWith(".json")) {
      const parsed = JSON.parse(content) as PlaylistImportPayload;
      importedName = parsed.name || importedName;
      importedSongs = parsed.songs ?? [];
    } else if (lower.endsWith(".m3u") || lower.endsWith(".m3u8")) {
      importedSongs = parseM3uSongs(content);
    } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      importedSongs = parseCsvOrTxtSongs(content);
    } else {
      setStatus("Unsupported import file. Use JSON, M3U, CSV, or TXT.");
      return;
    }

    const { data: playlistData, error: playlistError } = await supabase
      .from("playlists")
      .insert({
        name: importedName,
        description: "Imported playlist",
        owner_id: session.user.id,
        is_public: true,
      })
      .select("id")
      .single();
    if (playlistError || !playlistData?.id) {
      setStatus(playlistError?.message ?? "Failed to create imported playlist.");
      return;
    }

    let added = 0;
    let skipped = 0;
    let position = 0;
    for (const rawSong of importedSongs) {
      const song = await resolveImportedSongUrl(rawSong);
      if (!song?.stream_url) {
        skipped += 1;
        continue;
      }
      const srcType = song.source_type || (toYouTubeEmbedUrl(song.stream_url) ? "youtube" : "direct");
      const normalizedUrl = srcType === "youtube" ? toYouTubeEmbedUrl(song.stream_url) ?? song.stream_url : song.stream_url;

      let songId: string | null = null;
      const existing = await supabase.from("songs").select("id").eq("stream_url", normalizedUrl).maybeSingle();
      if (!existing.error && existing.data?.id) {
        songId = existing.data.id;
      } else {
        const inserted = await supabase
          .from("songs")
          .insert({
            title: song.title || "Imported Track",
            artist: song.artist || "Unknown Artist",
            album: song.album || null,
            cover_url: song.cover_url || null,
            stream_url: normalizedUrl,
            source_type: srcType,
            genre: song.genre || null,
            mood: song.mood || null,
            duration_seconds: song.duration_seconds || null,
            uploaded_by: session.user.id,
          })
          .select("id")
          .single();
        if (!inserted.error && inserted.data?.id) songId = inserted.data.id;
      }

      if (songId) {
        await supabase
          .from("playlist_songs")
          .upsert({ playlist_id: playlistData.id, song_id: songId, position });
        position += 1;
        added += 1;
      } else {
        skipped += 1;
      }
    }

    setStatus(`Imported "${importedName}" (${added} tracks added, ${skipped} skipped).`);
    await loadSongs();
    await loadPlaylists();
    await openPlaylist(playlistData.id);
  }

  function playSong(song: DbSong) {
    const idx = queue.findIndex((q) => q.id === song.id);
    setNowPlaying(song);
    setQueueIndex(idx >= 0 ? idx : 0);
    setIsPlaying(true);
  }

  function playNext() {
    if (queue.length === 0) return;
    const next = (queueIndex + 1) % queue.length;
    setQueueIndex(next);
    setNowPlaying(queue[next]);
    setIsPlaying(true);
  }

  function playPrevious() {
    if (queue.length === 0) return;
    const prev = (queueIndex - 1 + queue.length) % queue.length;
    setQueueIndex(prev);
    setNowPlaying(queue[prev]);
    setIsPlaying(true);
  }

  if (loading) return <main className="p-6">Loading Tonal...</main>;

  if (!session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex items-center justify-center">
        <form className="w-full max-w-md rounded-xl bg-zinc-900 p-6 border border-zinc-800 space-y-4" onSubmit={signInOrSignUp}>
          <h1 className="text-2xl font-semibold">Tonal</h1>
          <p className="text-sm text-zinc-400">Sign in or create an account to stream.</p>
          <input className="w-full rounded bg-zinc-800 px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full rounded bg-zinc-800 px-3 py-2" type="password" placeholder="Password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="w-full rounded bg-emerald-500 px-3 py-2 font-medium text-black" type="submit">Continue</button>
          {status ? <p className="text-sm text-zinc-300">{status}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linear-to-b from-black to-zinc-950 text-zinc-100 pb-44 md:pb-36">
      <div className="mx-auto max-w-[1400px] p-3 md:p-5">
        <div className="grid min-h-[calc(100vh-170px)] gap-3 md:gap-4 md:grid-cols-[280px_1fr]">
          <aside className={`rounded-2xl border border-zinc-800 bg-zinc-900/85 p-4 backdrop-blur md:block ${mobileMenuOpen ? "block" : "hidden"}`}>
            <div className="mb-5">
              <h1 className="text-3xl font-bold tracking-tight">Tonal</h1>
              <p className="text-xs text-zinc-400">Mobile-first streaming workspace</p>
            </div>

            <div className="space-y-1">
              {(["home", "search", "library", "upload", "settings"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  className={`w-full rounded-lg px-3 py-2 text-left ${activeTab === tab ? "bg-zinc-200 text-zinc-900" : "hover:bg-zinc-800"}`}
                  onClick={() => {
                    setActiveTab(tab);
                    setMobileMenuOpen(false);
                  }}
                >
                  {tab === "home"
                    ? "Home"
                    : tab === "search"
                      ? "Search"
                      : tab === "library"
                        ? "Your Library"
                        : tab === "upload"
                          ? "Upload Track"
                          : "Settings"}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-2">
              <h2 className="text-xs font-semibold uppercase text-zinc-400">Playlists</h2>
              <div className="max-h-72 space-y-1 overflow-auto pr-1">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedPlaylist?.id === playlist.id ? "bg-emerald-500 text-black" : "bg-zinc-800/70 hover:bg-zinc-800"}`}
                    onClick={() => void openPlaylist(playlist.id)}
                  >
                    {playlist.name}
                  </button>
                ))}
              </div>
            </div>

            <button className="mt-6 w-full rounded-lg bg-red-500 px-3 py-2 font-medium text-black" onClick={signOut}>Sign out</button>
          </aside>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-4 md:p-6 space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-zinc-400">
                  {activeTab === "home" && "Home"}
                  {activeTab === "search" && "Search catalog + APIs"}
                  {activeTab === "library" && "Playlist Management"}
                  {activeTab === "upload" && "Upload to Catalog"}
                  {activeTab === "settings" && "App Settings"}
                </p>
                <h2 className="text-2xl font-semibold md:text-3xl">{selectedPlaylist?.name ?? "Find your next track"}</h2>
              </div>
              <button className="rounded-lg bg-zinc-800 px-3 py-2 text-sm md:hidden" onClick={() => setMobileMenuOpen((v) => !v)}>
                {mobileMenuOpen ? "Close menu" : "Open menu"}
              </button>
            </header>

            {status ? <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">{status}</p> : null}

            {(activeTab === "home" || activeTab === "search") && (
              <section className="space-y-4">
                <div className="grid gap-2 md:grid-cols-4">
                  <input className="rounded-lg bg-zinc-800 px-3 py-2 md:col-span-2" placeholder="Search songs / artist / album" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <select className="rounded-lg bg-zinc-800 px-3 py-2" value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
                    <option value="">All genres</option>
                    {uniqueGenres.map((genre) => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))}
                  </select>
                  <select className="rounded-lg bg-zinc-800 px-3 py-2" value={moodFilter} onChange={(e) => setMoodFilter(e.target.value)}>
                    <option value="">All moods</option>
                    {uniqueMoods.map((mood) => (
                      <option key={mood} value={mood}>{mood}</option>
                    ))}
                  </select>
                </div>

                {activeTab === "search" && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-black" onClick={() => void runExternalSearch()}>
                        {searchingExternal ? "Searching..." : "Search YouTube + iTunes + Jamendo"}
                      </button>
                      <p className="text-xs text-zinc-400">
                        Add `NEXT_PUBLIC_YOUTUBE_API_KEY` and `NEXT_PUBLIC_JAMENDO_CLIENT_ID` for full search coverage.
                      </p>
                    </div>
                    {externalResults.length > 0 ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        {externalResults.map((result, index) => (
                          <div key={`${result.streamUrl}-${index}`} className="rounded-lg bg-zinc-800/80 p-2 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{result.title}</p>
                              <p className="truncate text-xs text-zinc-400">{result.artist} · {result.sourceType === "youtube" ? "YouTube" : "API stream"}</p>
                            </div>
                            <button className="rounded bg-emerald-500 px-2 py-1 text-xs text-black" onClick={() => void saveExternalResult(result)}>
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredSongs.map((song) => {
                    const isCurrent = nowPlaying?.id === song.id;
                    return (
                      <article key={song.id} className={`rounded-xl border p-3 transition ${isCurrent ? "border-emerald-400 bg-zinc-900" : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-600"}`}>
                        <div className="flex gap-3">
                          <img
                            className="h-16 w-16 rounded object-cover bg-zinc-700"
                            src={song.cover_url || "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=300&q=80"}
                            alt={song.title}
                          />
                          <div className="min-w-0">
                            <h3 className="truncate font-medium">{song.title}</h3>
                            <p className="truncate text-sm text-zinc-400">{song.artist}</p>
                            <p className="text-xs text-zinc-500">{song.source_type === "youtube" ? "YouTube" : "Direct stream"}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button className="rounded-lg bg-emerald-500 px-3 py-1 text-sm font-medium text-black" onClick={() => playSong(song)}>Play</button>
                          <select
                            className="flex-1 rounded-lg bg-zinc-800 px-2 py-1 text-sm"
                            onChange={(e) => (e.target.value ? void addSongToPlaylist(song.id, e.target.value) : null)}
                            defaultValue=""
                          >
                            <option value="">Add to playlist</option>
                            {playlists
                              .filter((p) => p.owner_id === session.user.id)
                              .map((playlist) => (
                                <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                              ))}
                          </select>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {activeTab === "library" && (
              <section className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  <form className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 grid gap-2" onSubmit={createPlaylist}>
                    <h3 className="font-medium">Create Playlist</h3>
                    <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Playlist name" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} required />
                    <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Description" value={newPlaylistDescription} onChange={(e) => setNewPlaylistDescription(e.target.value)} />
                    <button className="rounded-lg bg-emerald-500 px-3 py-2 font-medium text-black" type="submit">Create playlist</button>
                  </form>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
                    <h3 className="font-medium">Import / Export</h3>
                    <p className="text-sm text-zinc-400">Supports JSON, M3U, CSV, and TXT. CSV/TXT can contain name/author lines; URLs are optional.</p>
                    <label className="inline-block rounded-lg bg-zinc-800 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-700">
                      Import playlist file
                      <input className="hidden" type="file" accept=".json,.m3u,.m3u8,.csv,.txt" onChange={(e) => void handlePlaylistImport(e)} />
                    </label>
                    {selectedPlaylist ? (
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-lg bg-zinc-800 px-3 py-2 text-sm" onClick={exportSelectedPlaylistJson}>Export JSON</button>
                        <button className="rounded-lg bg-zinc-800 px-3 py-2 text-sm" onClick={exportSelectedPlaylistM3u}>Export M3U</button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedPlaylist ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                    <form className="flex flex-wrap gap-2" onSubmit={updatePlaylistName}>
                      <input className="flex-1 min-w-[180px] rounded-lg bg-zinc-800 px-3 py-2" value={editingPlaylistName} onChange={(e) => setEditingPlaylistName(e.target.value)} />
                      <button className="rounded-lg bg-zinc-100 px-3 py-2 text-zinc-900" type="submit">Rename</button>
                      <button className="rounded-lg bg-red-500 px-3 py-2 text-black" type="button" onClick={() => void deletePlaylist()}>Delete</button>
                    </form>

                    <div className="space-y-2">
                      {selectedPlaylist.songs.map((song, index) => (
                        <div
                          key={song.id}
                          className="rounded-lg bg-zinc-800/70 p-2"
                          onTouchStart={(e) => handleQueueTouchStart(index, e.changedTouches[0].clientX)}
                          onTouchEnd={(e) => handleQueueTouchEnd(index, e.changedTouches[0].clientX)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{song.title}</p>
                              <p className="truncate text-sm text-zinc-400">{song.artist}</p>
                            </div>
                            <button className="rounded-lg bg-emerald-500 px-3 py-1 text-sm text-black" onClick={() => playSong(song)}>Play</button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button className="rounded bg-zinc-700 px-2 py-1 text-xs disabled:opacity-50" onClick={() => moveQueueItem(index, index - 1)} disabled={index === 0}>Up</button>
                            <button className="rounded bg-zinc-700 px-2 py-1 text-xs disabled:opacity-50" onClick={() => moveQueueItem(index, index + 1)} disabled={index === selectedPlaylist.songs.length - 1}>Down</button>
                            <button className="rounded bg-zinc-700 px-2 py-1 text-xs" onClick={() => removeFromQueue(index)}>Remove from queue</button>
                            <button className="rounded bg-zinc-700 px-2 py-1 text-xs" onClick={() => void removeSongFromPlaylist(song.id)}>Remove from playlist</button>
                          </div>
                        </div>
                      ))}
                      {selectedPlaylist.songs.length === 0 ? <p className="text-sm text-zinc-400">No songs in this playlist yet.</p> : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-400">Select a playlist from the sidebar to manage it.</p>
                )}
              </section>
            )}

            {activeTab === "upload" && (
              <section>
                <form className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 grid gap-2 md:grid-cols-2" onSubmit={uploadSong}>
                  <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Title" required value={newSong.title} onChange={(e) => setNewSong({ ...newSong, title: e.target.value })} />
                  <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Artist" value={newSong.artist} onChange={(e) => setNewSong({ ...newSong, artist: e.target.value })} />
                  <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Album" value={newSong.album} onChange={(e) => setNewSong({ ...newSong, album: e.target.value })} />
                  <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Cover image URL" value={newSong.cover_url} onChange={(e) => setNewSong({ ...newSong, cover_url: e.target.value })} />
                  <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Stream URL or YouTube URL" required value={newSong.stream_url} onChange={(e) => setNewSong({ ...newSong, stream_url: e.target.value })} />
                  <select className="rounded-lg bg-zinc-800 px-3 py-2" value={newSong.source_type} onChange={(e) => setNewSong({ ...newSong, source_type: e.target.value as "direct" | "youtube" })}>
                    <option value="direct">Direct audio stream</option>
                    <option value="youtube">YouTube</option>
                  </select>
                  <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Genre" value={newSong.genre} onChange={(e) => setNewSong({ ...newSong, genre: e.target.value })} />
                  <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Mood" value={newSong.mood} onChange={(e) => setNewSong({ ...newSong, mood: e.target.value })} />
                  <input className="rounded-lg bg-zinc-800 px-3 py-2" placeholder="Duration (seconds)" type="number" min={1} value={newSong.duration_seconds} onChange={(e) => setNewSong({ ...newSong, duration_seconds: e.target.value })} />
                  <button className="rounded-lg bg-emerald-500 px-3 py-2 font-medium text-black" type="submit">Add song to catalog</button>
                </form>
              </section>
            )}

            {activeTab === "settings" && (
              <section className="space-y-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                  <h3 className="font-medium">Experience</h3>
                  <label className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800/70 p-3">
                    <span>
                      <p className="font-medium">Persistent Queue Ordering</p>
                      <p className="text-xs text-zinc-400">Save playlist queue order changes in Supabase.</p>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.persistentQueueOrdering}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          persistentQueueOrdering: e.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800/70 p-3">
                    <span>
                      <p className="font-medium">Swipe Gestures (Mobile)</p>
                      <p className="text-xs text-zinc-400">Swipe left to remove, right to play queue item.</p>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.enableSwipeGestures}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          enableSwipeGestures: e.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800/70 p-3">
                    <span>
                      <p className="font-medium">Now Playing Full View</p>
                      <p className="text-xs text-zinc-400">Enable full-screen now playing panel from bottom bar.</p>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.enableNowPlayingView}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          enableNowPlayingView: e.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            )}
          </section>
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-black/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto grid max-w-[1400px] gap-2 md:grid-cols-[1fr_auto_420px]">
          <div className="min-w-0">
            <p className="truncate font-medium">{nowPlaying?.title ?? "No song selected"}</p>
            <p className="truncate text-sm text-zinc-400">{nowPlaying?.artist ?? "Choose a song to begin."}</p>
            <p className="mt-1 text-xs text-zinc-500">{lyricsLoading ? "Loading lyrics..." : lyrics.slice(0, 140) || "Lyrics unavailable."}</p>
          </div>
          <div className="flex gap-2 md:items-center">
            <button className="rounded-lg bg-zinc-800 px-3 py-2" onClick={playPrevious}>Prev</button>
            <button className="rounded-lg bg-emerald-500 px-3 py-2 text-black" onClick={() => setIsPlaying((v) => !v)}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button className="rounded-lg bg-zinc-800 px-3 py-2" onClick={playNext}>Next</button>
            {settings.enableNowPlayingView ? (
              <button
                className="rounded-lg bg-zinc-800 px-3 py-2"
                onClick={() => setShowNowPlayingView(true)}
              >
                Now Playing
              </button>
            ) : null}
          </div>
          <div className="w-full">
            {nowPlaying ? (
              <ReactPlayer
                src={nowPlaying.source_type === "youtube" ? toYouTubeEmbedUrl(nowPlaying.stream_url) ?? undefined : nowPlaying.stream_url}
                playing={isPlaying}
                controls
                width="100%"
                height="56px"
                onEnded={playNext}
              />
            ) : null}
          </div>
        </div>
      </footer>

      {settings.enableNowPlayingView && showNowPlayingView && nowPlaying ? (
        <div className="fixed inset-0 z-40 bg-black/95 p-4 md:p-8">
          <div className="mx-auto flex h-full max-w-2xl flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Now Playing</h3>
              <button
                className="rounded-lg bg-zinc-800 px-3 py-2 text-sm"
                onClick={() => setShowNowPlayingView(false)}
              >
                Close
              </button>
            </div>
            <img
              className="mx-auto h-72 w-72 max-w-full rounded-xl object-cover bg-zinc-800"
              src={
                nowPlaying.cover_url ||
                "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=800&q=80"
              }
              alt={nowPlaying.title}
            />
            <div className="text-center">
              <p className="text-2xl font-semibold">{nowPlaying.title}</p>
              <p className="text-zinc-400">{nowPlaying.artist}</p>
            </div>
            <div className="flex justify-center gap-2">
              <button className="rounded-lg bg-zinc-800 px-4 py-2" onClick={playPrevious}>Prev</button>
              <button className="rounded-lg bg-emerald-500 px-4 py-2 text-black" onClick={() => setIsPlaying((v) => !v)}>
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button className="rounded-lg bg-zinc-800 px-4 py-2" onClick={playNext}>Next</button>
            </div>
            <div className="rounded-lg bg-zinc-800/60 p-3 text-sm whitespace-pre-wrap overflow-auto">
              {lyricsLoading ? "Loading lyrics..." : lyrics || "Lyrics unavailable."}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

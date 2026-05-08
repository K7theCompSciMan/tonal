"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import ReactPlayer from "react-player";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { DbPlaylist, DbSong } from "@/lib/types";

// Hooks & Components
import LyricsPanel from "@/components/LyricsPanel";
import MobileNav from "@/components/MobileNav";
import NowPlayingExpanded from "@/components/NowPlayingExpanded";
import PlaylistImportModal from "@/components/PlaylistImportModal";
import { useSyncedLyrics } from "@/hooks/useSyncedLyrics";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

type Tab = "home" | "search" | "library";
type ExternalSong = {
  title: string; artist: string; streamUrl: string; 
  sourceType: "direct" | "youtube"; coverUrl?: string; album?: string;
};

export default function TonalApp() {
  // --- State: Auth & Data ---
  const [session, setSession] = useState<Session | null>(null);
  const [playlists, setPlaylists] = useState<DbPlaylist[]>([]);
  const [librarySongs, setLibrarySongs] = useState<DbSong[]>([]);
  
  // --- State: UI ---
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showLyrics, setShowLyrics] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // --- State: Player & Queue ---
  const [queue, setQueue] = useState<(DbSong | ExternalSong)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<ReactPlayer>(null);

  const currentSong = queue[currentIndex] || null;

  // --- State: Search ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ExternalSong[]>([]);

  // --- Helpers: Data Fetching ---
  const fetchData = async () => {
    const { data: songs } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
    const { data: pls } = await supabase.from("playlists").select("*");
    if (songs) setLibrarySongs(songs);
    if (pls) setPlaylists(pls);
  };

  useEffect(() => {
    fetchData();
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  // --- Helpers: Search Logic ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      // Placeholder for your YouTube/Jamendo fetcher logic
      // For now, filtering local library to show it works
      const filtered = librarySongs.filter(s => 
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.artist.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered as any);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, librarySongs]);

  // --- Handlers: Playback ---
  const handlePlaySong = (song: DbSong | ExternalSong, fromList: (DbSong | ExternalSong)[]) => {
    setQueue(fromList);
    const idx = fromList.findIndex(s => s.title === song.title && s.artist === song.artist);
    setCurrentIndex(idx);
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (currentIndex < queue.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (playedSeconds > 3) {
      playerRef.current?.seekTo(0);
    } else if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const toggleShuffle = () => {
    if (!isShuffled) {
      const remaining = queue.filter((_, i) => i !== currentIndex);
      const shuffled = [queue[currentIndex], ...remaining.sort(() => Math.random() - 0.5)];
      setQueue(shuffled);
      setCurrentIndex(0);
    } else {
      // Logic to restore original order would go here if originalQueue is stored
    }
    setIsShuffled(!isShuffled);
  };

  // --- Hooks Execution ---
  const { syncedLines, plainLyrics, activeIndex, loading: lyricsLoading } = useSyncedLyrics(
    currentSong?.title, currentSong?.artist, currentSong?.album, playedSeconds
  );

  useKeyboardShortcuts({
    onPlayPause: () => setIsPlaying(!isPlaying),
    onNext: handleNext,
    onPrev: handlePrev,
    onToggleLyrics: () => setShowLyrics(!showLyrics),
  });

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-[240px] bg-black p-2 flex flex-col gap-2 shrink-0">
        <nav className="bg-[#121212] rounded-lg p-4 space-y-4">
          <button onClick={() => setActiveTab("home")} className={`flex items-center gap-4 w-full font-bold ${activeTab === 'home' ? 'text-white' : 'text-gray-400'}`}>Home</button>
          <button onClick={() => setActiveTab("search")} className={`flex items-center gap-4 w-full font-bold ${activeTab === 'search' ? 'text-white' : 'text-gray-400'}`}>Search</button>
        </nav>
        <div className="flex-1 bg-[#121212] rounded-lg p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold text-gray-400">Your Library</span>
            <button onClick={() => setIsImportModalOpen(true)} className="text-gray-400 hover:text-white">+</button>
          </div>
          {playlists.map(pl => (
            <div key={pl.id} className="py-2 hover:bg-[#282828] cursor-pointer rounded px-2">{pl.name}</div>
          ))}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 bg-gradient-to-b from-[#222222] to-[#121212] m-2 rounded-lg overflow-y-auto p-6">
        {activeTab === "home" && (
          <div>
            <h1 className="text-3xl font-bold mb-6">Welcome Back</h1>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {librarySongs.map(song => (
                <div 
                  key={song.id} 
                  onClick={() => handlePlaySong(song, librarySongs)}
                  className="bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition-colors cursor-pointer group"
                >
                  <div className="aspect-square bg-[#333] rounded-md mb-4 shadow-lg overflow-hidden">
                    {song.cover_url && <img src={song.cover_url} className="w-full h-full object-cover" />}
                  </div>
                  <p className="font-bold truncate">{song.title}</p>
                  <p className="text-sm text-gray-400 truncate">{song.artist}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "search" && (
          <div>
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for songs or artists..."
              className="w-full max-w-md bg-[#242424] px-4 py-3 rounded-full outline-none mb-8 focus:ring-2 focus:ring-white"
            />
            <div className="space-y-2">
              {searchResults.map((song, i) => (
                <div 
                  key={i} 
                  onClick={() => handlePlaySong(song, searchResults)}
                  className="flex items-center gap-4 p-2 hover:bg-[#ffffff1a] rounded cursor-pointer"
                >
                  <div className="w-10 h-10 bg-gray-700 rounded" />
                  <div>
                    <p className="font-medium">{song.title}</p>
                    <p className="text-xs text-gray-400">{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* LYRICS PANEL */}
      {showLyrics && (
        <aside className="w-[320px] bg-[#121212] m-2 ml-0 rounded-lg overflow-hidden">
          <LyricsPanel 
            syncedLines={syncedLines} 
            plainLyrics={plainLyrics} 
            activeIndex={activeIndex} 
            loading={lyricsLoading} 
          />
        </aside>
      )}

      {/* PLAYER BAR */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-black border-t border-[#282828] px-4 flex items-center justify-between">
        <div className="w-[30%] flex items-center gap-4">
          {currentSong && (
            <>
              <div className="w-14 h-14 bg-gray-800 rounded" />
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{currentSong.title}</p>
                <p className="text-xs text-gray-400 truncate">{currentSong.artist}</p>
              </div>
            </>
          )}
        </div>

        <div className="w-[40%] flex flex-col items-center gap-2">
          <div className="flex items-center gap-6">
            <button onClick={toggleShuffle} className={isShuffled ? "text-[#1DB954]" : "text-gray-400"}>🔀</button>
            <button onClick={handlePrev} className="text-2xl">⏮</button>
            <button onClick={() => setIsPlaying(!isPlaying)} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center font-bold">
              {isPlaying ? "Ⅱ" : "▶"}
            </button>
            <button onClick={handleNext} className="text-2xl">⏭</button>
          </div>
          <div className="w-full flex items-center gap-2 text-xs text-gray-400">
            <span>{Math.floor(playedSeconds / 60)}:{(playedSeconds % 60).toFixed(0).padStart(2, '0')}</span>
            <input 
              type="range" min={0} max={duration} value={playedSeconds} 
              onChange={(e) => playerRef.current?.seekTo(Number(e.target.value))}
              className="flex-1 accent-white"
            />
            <span>{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="w-[30%] flex justify-end items-center gap-4">
          <button onClick={() => setShowLyrics(!showLyrics)} className={showLyrics ? "text-[#1DB954]" : "text-gray-400"}>🎙</button>
          <input 
            type="range" min={0} max={1} step={0.01} value={volume} 
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24 accent-[#1DB954]"
          />
        </div>
      </footer>

      <div className="hidden">
        {currentSong && (
          <ReactPlayer
            ref={playerRef}
            url={currentSong.streamUrl}
            playing={isPlaying}
            volume={volume}
            onProgress={(p) => setPlayedSeconds(p.playedSeconds)}
            onDuration={(d) => setDuration(d)}
            onEnded={handleNext}
          />
        )}
      </div>

      {isImportModalOpen && <PlaylistImportModal onClose={() => setIsImportModalOpen(false)} onImport={fetchData} />}
    </div>
  );
}
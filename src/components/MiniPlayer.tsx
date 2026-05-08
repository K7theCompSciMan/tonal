'use client';
// src/components/MiniPlayer.tsx - 72px bottom strip for mobile

import { DbSong } from '@/lib/types';

type ExternalSong = {
  title: string;
  artist: string;
  streamUrl: string;
  sourceType: 'direct' | 'youtube';
  coverUrl?: string;
  album?: string;
};

interface MiniPlayerProps {
  song: (DbSong | ExternalSong) | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onExpand: () => void;
}

export default function MiniPlayer({ song, isPlaying, onPlayPause, onExpand }: MiniPlayerProps) {
  if (!song) return null;

  return (
    <div 
      className="md:hidden fixed bottom-[56px] left-0 right-0 h-[72px] bg-[#181818] border-t border-[#282828] flex items-center px-4 z-40"
      onClick={onExpand}
    >
      {/* Album art thumbnail */}
      <div className="w-12 h-12 bg-[#333] rounded overflow-hidden shrink-0 mr-3">
        {'cover_url' in song && song.cover_url ? (
          <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">🎵</div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{song.title}</p>
        <p className="text-xs text-[#B3B3B3] truncate">{song.artist}</p>
      </div>

      {/* Play/Pause button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlayPause();
        }}
        className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 ml-2"
      >
        {isPlaying ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="black" style={{ marginLeft: 2 }}>
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
    </div>
  );
}

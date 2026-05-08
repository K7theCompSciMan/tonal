'use client';
// src/components/QueuePanel.tsx - Spotify-style right-side queue panel

import { useState, useRef } from 'react';
import { DbSong } from '@/lib/types';

type ExternalSong = {
  title: string;
  artist: string;
  streamUrl: string;
  sourceType: 'direct' | 'youtube';
  coverUrl?: string;
  album?: string;
};

interface QueuePanelProps {
  queue: (DbSong | ExternalSong)[];
  currentIndex: number;
  isPlaying: boolean;
  onPlayIndex: (index: number) => void;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onClose: () => void;
}

export default function QueuePanel({
  queue,
  currentIndex,
  isPlaying,
  onPlayIndex,
  onRemove,
  onReorder,
  onClose,
}: QueuePanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Split queue into "Playing Next" and "Up Next"
  const playingNext = queue.slice(0, currentIndex + 1);
  const upNext = queue.slice(currentIndex + 1);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const renderTrack = (song: DbSong | ExternalSong, index: number, isCurrentPlaylist: boolean) => {
    const isCurrent = index === currentIndex;
    const isDragging = draggedIndex === index;

    return (
      <div
        key={`${index}-${song.title}`}
        draggable={isCurrentPlaylist}
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
        className={`
          flex items-center gap-3 p-2 rounded-md cursor-pointer group transition-colors
          ${isCurrent ? 'bg-[#282828]' : 'hover:bg-[#1f1f1f]'}
          ${isDragging ? 'opacity-50' : ''}
        `}
        onClick={() => onPlayIndex(index)}
      >
        {/* Drag handle */}
        {isCurrentPlaylist && (
          <div className="text-[#6A6A6A] cursor-grab active:cursor-grabbing p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </div>
        )}

        {/* Album art / placeholder */}
        <div className="w-10 h-10 bg-[#333] rounded shrink-0 overflow-hidden relative">
          {'cover_url' in song && song.cover_url ? (
            <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">🎵</div>
          )}
          {isCurrent && isPlaying && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="flex gap-0.5">
                <div className="w-1 h-3 bg-[#1DB954] animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-3 bg-[#1DB954] animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-3 bg-[#1DB954] animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isCurrent ? 'text-[#1DB954]' : 'text-white'}`}>
            {song.title}
          </p>
          <p className="text-xs text-[#B3B3B3] truncate">{song.artist}</p>
        </div>

        {/* Remove button */}
        {!isCurrent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="opacity-0 group-hover:opacity-100 text-[#B3B3B3] hover:text-white p-1 transition-opacity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 bg-[#121212] border-l border-[#282828] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#282828]">
        <h2 className="text-white font-bold text-lg">Queue</h2>
        <button
          onClick={onClose}
          className="text-[#B3B3B3] hover:text-white transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {/* Queue content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Playing Next section */}
        {playingNext.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wider mb-2">
              Playing Next
            </h3>
            <div className="space-y-1">
              {playingNext.map((song, i) => renderTrack(song, i, true))}
            </div>
          </div>
        )}

        {/* Up Next section */}
        {upNext.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-[#B3B3B3] uppercase tracking-wider mb-2">
              Up Next
            </h3>
            <div className="space-y-1">
              {upNext.map((song, i) => renderTrack(song, i + currentIndex + 1, true))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {queue.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[#6A6A6A] text-sm">Your queue is empty</p>
            <p className="text-[#6A6A6A] text-xs mt-1">Add songs to start listening</p>
          </div>
        )}
      </div>
    </div>
  );
}

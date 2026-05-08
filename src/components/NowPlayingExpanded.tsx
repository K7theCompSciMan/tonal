'use client';
// src/components/NowPlayingExpanded.tsx
// Full-screen Now Playing view for mobile with swipe gestures

import { useRef, useState } from 'react';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import LyricsPanel from './LyricsPanel';
import { LyricLine } from '../lib/lyrics';

interface Props {
  song: {
    title: string;
    artist: string;
    album?: string;
    coverUrl?: string;
  } | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onCollapse: () => void;
  // Lyrics
  syncedLines: LyricLine[];
  plainLyrics: string | null;
  activeIndex: number;
  lyricsLoading: boolean;
}

export default function NowPlayingExpanded({
  song, isPlaying, currentTime, duration,
  onPlayPause, onNext, onPrev, onSeek, onCollapse,
  syncedLines, plainLyrics, activeIndex, lyricsLoading,
}: Props) {
  const [tab, setTab] = useState<'player' | 'lyrics'>('player');
  const containerRef = useRef<HTMLDivElement>(null);

  useSwipeGesture(containerRef, {
    onSwipeDown: onCollapse,
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
  });

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!song) return null;

  const hasLyrics = syncedLines.length > 0 || plainLyrics;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #121212 60%)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-12 pb-4">
        <button onClick={onCollapse} className="text-[#B3B3B3] hover:text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
          </svg>
        </button>
        <div className="text-center">
          <p className="text-white text-sm font-semibold truncate max-w-[180px]">
            {song.album ?? 'Now Playing'}
          </p>
        </div>
        <button className="text-[#B3B3B3] hover:text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>

      {/* Tab switcher (if lyrics available) */}
      {hasLyrics && (
        <div className="flex gap-4 px-6 mb-4">
          {(['player', 'lyrics'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors capitalize
                ${tab === t ? 'text-white border-white' : 'text-[#B3B3B3] border-transparent'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'player' ? (
          <div className="flex flex-col items-center px-8 py-4 h-full">
            {/* Album Art */}
            <div className="w-64 h-64 rounded-2xl overflow-hidden shadow-2xl mb-8 bg-[#282828]">
              {song.coverUrl ? (
                <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">🎵</div>
              )}
            </div>

            {/* Track info */}
            <div className="w-full mb-6 flex items-center justify-between">
              <div>
                <p className="text-white text-xl font-bold truncate max-w-[220px]">{song.title}</p>
                <p className="text-[#B3B3B3] text-base">{song.artist}</p>
              </div>
              <button className="text-[#B3B3B3] hover:text-[#1DB954] transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </button>
            </div>

            {/* Seek bar */}
            <div className="w-full mb-4">
              <input
                type="range"
                min={0}
                max={duration || 1}
                value={currentTime}
                onChange={e => onSeek(Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none bg-[#444] accent-[#1DB954] cursor-pointer"
              />
              <div className="flex justify-between text-[#B3B3B3] text-xs mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between w-full mt-2">
              <button onClick={onPrev} className="text-[#B3B3B3] hover:text-white p-2">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>
              <button
                onClick={onPlayPause}
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="black">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="black" style={{ marginLeft: 3 }}>
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              <button onClick={onNext} className="text-[#B3B3B3] hover:text-white p-2">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <LyricsPanel
            syncedLines={syncedLines}
            plainLyrics={plainLyrics}
            activeIndex={activeIndex}
            loading={lyricsLoading}
          />
        )}
      </div>
    </div>
  );
}
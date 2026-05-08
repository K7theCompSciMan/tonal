'use client';
// src/components/LyricsPanel.tsx

import { useEffect, useRef } from 'react';
import { LyricLine } from '../lib/lyrics';

interface LyricsPanelProps {
  syncedLines: LyricLine[];
  plainLyrics: string | null;
  activeIndex: number;
  loading: boolean;
}

export default function LyricsPanel({ syncedLines, plainLyrics, activeIndex, loading }: LyricsPanelProps) {
  const activeRef = useRef<HTMLParagraphElement>(null);

  // Smooth-scroll active line into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[#6A6A6A] text-sm">
        Loading lyrics…
      </div>
    );
  }

  // Synced lyrics view
  if (syncedLines.length > 0) {
    return (
      <div className="overflow-y-auto h-full px-8 py-16 text-center select-none">
        {syncedLines.map((line, i) => {
          const isPast = i < activeIndex;
          const isActive = i === activeIndex;
          const isFuture = i > activeIndex;
          return (
            <p
              key={i}
              ref={isActive ? activeRef : null}
              className="text-2xl font-bold leading-relaxed mb-3 transition-all duration-300"
              style={{
                color: isActive ? '#FFFFFF' : isPast ? '#6A6A6A' : '#B3B3B3',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                opacity: isFuture ? 0.5 : 1,
              }}
            >
              {line.text || '♪'}
            </p>
          );
        })}
        <div className="h-32" />
      </div>
    );
  }

  // Plain lyrics fallback
  if (plainLyrics) {
    return (
      <div className="overflow-y-auto h-full px-8 py-8 text-[#B3B3B3] text-base leading-7 whitespace-pre-wrap">
        {plainLyrics}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-[#6A6A6A]">
      <span className="text-4xl">♪</span>
      <p className="text-sm">No lyrics found for this track.</p>
    </div>
  );
}
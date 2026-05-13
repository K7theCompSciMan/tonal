'use client';
// src/hooks/useSyncedLyrics.ts
// Fetches lyrics once per song (debounced), never throws, never blocks playback.

import { useState, useEffect, useRef } from 'react';
import { fetchLyrics, LyricLine } from '../lib/lyrics';

export function useSyncedLyrics(
  title: string | null | undefined,
  artist: string | null | undefined,
  album: string | null | undefined,
  playedSeconds: number,
) {
  const [syncedLines, setSyncedLines] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  // Track which song we last fetched for to avoid duplicate fetches
  const lastFetchKey = useRef<string>('');

  useEffect(() => {
    const key = `${title ?? ''}::${artist ?? ''}`;

    // No song, or same song as last fetch — skip
    if (!title?.trim() || !artist?.trim()) {
      setSyncedLines([]);
      setPlainLyrics(null);
      setActiveIndex(-1);
      setLoading(false);
      lastFetchKey.current = '';
      return;
    }

    // Don't re-fetch if the song hasn't changed (e.g. seek events)
    if (key === lastFetchKey.current) return;
    lastFetchKey.current = key;

    let cancelled = false;
    setSyncedLines([]);
    setPlainLyrics(null);
    setActiveIndex(-1);
    setLoading(true);

    // fetchLyrics never throws — safe to call without try/catch
    fetchLyrics(title, artist, album ?? undefined).then((res) => {
      if (cancelled) return;
      setSyncedLines(res.synced ?? []);
      setPlainLyrics(res.plain ?? null);
      setLoading(false);
    });

    return () => { cancelled = true; };
  // Only re-run when the song identity changes, not on every seek
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, artist, album]);

  // Update active line index based on playback time
  useEffect(() => {
    if (syncedLines.length === 0) {
      setActiveIndex(-1);
      return;
    }
    // Binary-search-style: find the last line whose time <= playedSeconds
    const index = syncedLines.findIndex((line) => line.time > playedSeconds);
    setActiveIndex(
      index === -1 ? syncedLines.length - 1 : Math.max(0, index - 1),
    );
  }, [playedSeconds, syncedLines]);

  return { syncedLines, plainLyrics, activeIndex, loading };
}
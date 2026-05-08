'use client';

import { useState, useEffect } from 'react';
import { fetchLyrics, LyricLine } from '../lib/lyrics';

export function useSyncedLyrics(
  title: string | null | undefined,
  artist: string | null | undefined,
  album: string | null | undefined,
  playedSeconds: number
) {
  const [syncedLines, setSyncedLines] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Prevent the 500 crash by checking if we actually have song data
    if (!title || !artist) {
      setSyncedLines([]);
      setPlainLyrics(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchLyrics(title, artist, album || undefined)
      .then((res) => {
        if (isMounted) {
          setSyncedLines(res.synced || []);
          setPlainLyrics(res.plain || null);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Lyrics fetch failed:", err);
        if (isMounted) {
          setSyncedLines([]);
          setPlainLyrics(null);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [title, artist, album]);

  useEffect(() => {
    if (syncedLines.length === 0) {
      setActiveIndex(-1);
      return;
    }
    const index = syncedLines.findIndex((line) => line.time > playedSeconds);
    setActiveIndex(index === -1 ? syncedLines.length - 1 : Math.max(0, index - 1));
  }, [playedSeconds, syncedLines]);

  return { syncedLines, plainLyrics, activeIndex, loading };
}
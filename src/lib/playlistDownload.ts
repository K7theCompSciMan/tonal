'use client';

import { fetchLyrics } from './lyrics';

export async function exportPlaylistOffline(
  playlistName: string,
  tracks: any[],
) {
  const exportedTracks = await Promise.all(
    tracks.map(async (track, index) => {
      try {
        const response = await fetch(track.stream_url || track.streamUrl);
        const blob = await response.blob();

        const lyrics = await fetchLyrics(
          track.title,
          track.artist,
          track.album,
        ).catch(() => ({ synced: null, plain: null }));

        return {
          order: index,
          metadata: {
            title: track.title,
            artist: track.artist,
            album: track.album,
            coverUrl: track.cover_url || track.coverUrl,
          },
          audio: await blob.arrayBuffer(),
          lyrics,
        };
      } catch {
        return null;
      }
    }),
  );

  const payload = {
    version: 1,
    exportedAt: Date.now(),
    playlistName,
    tracks: exportedTracks.filter(Boolean),
  };

  const blob = new Blob([
    JSON.stringify(payload),
  ], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${playlistName}.tonal.json`;
  a.click();

  URL.revokeObjectURL(url);
}
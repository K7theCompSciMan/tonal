'use client';

import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportPlaylistOffline } from '@/lib/playlistDownload';

interface Props {
  playlistName: string;
  tracks: any[];
  onImport: (tracks: any[]) => void;
}

export default function OfflinePlaylistControls({
  playlistName,
  tracks,
  onImport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleImport(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    const text = await file.text();
    const parsed = JSON.parse(text);

    const rebuiltTracks = parsed.tracks.map((t: any) => {
      const uint8 = new Uint8Array(t.audio.data || t.audio);

      const blob = new Blob([uint8], {
        type: 'audio/mpeg',
      });

      const localUrl = URL.createObjectURL(blob);

      return {
        id: crypto.randomUUID(),
        title: t.metadata.title,
        artist: t.metadata.artist,
        album: t.metadata.album,
        cover_url: t.metadata.coverUrl,
        local: true,
        localUrl,
        localLyrics: t.lyrics,
      };
    });

    onImport(rebuiltTracks);
  }

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={() => exportPlaylistOffline(playlistName, tracks)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
      >
        <Download size={16} />
        Download Playlist
      </button>

      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
      >
        <Upload size={16} />
        Import Playlist
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".tonal.json"
        hidden
        onChange={handleImport}
      />
    </div>
  );
}
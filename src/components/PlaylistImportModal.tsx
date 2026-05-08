'use client';
// src/components/PlaylistImportModal.tsx
// 4-step playlist import wizard: Upload → Preview → Resolve → Import

import { useCallback, useRef, useState } from 'react';
import { ParsedTrack, parsePlaylistFile } from '../lib/playlist-parser';
import { autoResolveTrack, ResolvedTrack } from '../lib/search';

interface Props {
  onClose: () => void;
  onImport: (name: string, tracks: Array<ParsedTrack & { resolved?: ResolvedTrack }>) => Promise<void>;
}

type Step = 'upload' | 'preview' | 'resolve' | 'done';

export default function PlaylistImportModal({ onClose, onImport }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [playlistName, setPlaylistName] = useState('Imported Playlist');
  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [resolvedMap, setResolvedMap] = useState<Record<number, ResolvedTrack | null>>({});
  const [resolveProgress, setResolveProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 1: read file
  const handleFile = useCallback((file: File) => {
    setPlaylistName(file.name.replace(/\.[^.]+$/, '') || 'Imported Playlist');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parsePlaylistFile(text, file.name);
      setTracks(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Step 2 → 3: resolve tracks
  const startResolve = useCallback(async () => {
    setStep('resolve');
    const map: Record<number, ResolvedTrack | null> = {};
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      // Skip if has direct hint URL that looks like a direct audio stream
      if (t.hintUrl && !t.hintUrl.includes('youtube') && !t.hintUrl.includes('youtu.be')) {
        map[i] = { source: 'direct', streamUrl: t.hintUrl };
      } else {
        map[i] = await autoResolveTrack(t.title, t.artist);
      }
      setResolveProgress(Math.round(((i + 1) / tracks.length) * 100));
    }
    setResolvedMap(map);
    setStep('done');
  }, [tracks]);

  // Step 4: import
  const handleImport = useCallback(async () => {
    setImporting(true);
    const enriched = tracks.map((t, i) => ({ ...t, resolved: resolvedMap[i] ?? undefined }));
    await onImport(playlistName, enriched);
    setImporting(false);
    onClose();
  }, [tracks, resolvedMap, playlistName, onImport, onClose]);

  const resolvedCount = Object.values(resolvedMap).filter(Boolean).length;
  const jamendoCount = Object.values(resolvedMap).filter((r) => r?.source === 'jamendo').length;
  const youtubeCount = Object.values(resolvedMap).filter((r) => r?.source === 'youtube').length;
  const directCount = Object.values(resolvedMap).filter((r) => r?.source === 'direct').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#282828] rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-bold">Import Playlist</h2>
          <button onClick={onClose} className="text-[#B3B3B3] hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {(['upload', 'preview', 'resolve', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step === s ? 'bg-[#1DB954] text-black' : 'bg-[#444] text-[#888]'}`}>
                {i + 1}
              </div>
              {i < 3 && <div className="flex-1 h-0.5 bg-[#444] w-8" />}
            </div>
          ))}
        </div>

        {/* ---- STEP 1: Upload ---- */}
        {step === 'upload' && (
          <div
            className="border-2 border-dashed border-[#444] rounded-xl p-8 text-center cursor-pointer hover:border-[#1DB954] transition-colors"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".m3u,.m3u8,.json,.csv,.txt"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            <div className="text-4xl mb-3">📂</div>
            <p className="text-white font-semibold mb-1">Drop a playlist file here</p>
            <p className="text-[#B3B3B3] text-sm">Supports M3U, M3U8, JSON, CSV, TXT</p>
          </div>
        )}

        {/* ---- STEP 2: Preview ---- */}
        {step === 'preview' && (
          <div>
            <div className="mb-4">
              <label className="text-[#B3B3B3] text-sm mb-1 block">Playlist name</label>
              <input
                className="w-full bg-[#3E3E3E] text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#1DB954]"
                value={playlistName}
                onChange={e => setPlaylistName(e.target.value)}
              />
            </div>
            <p className="text-[#B3B3B3] text-sm mb-3">{tracks.length} tracks found</p>
            <div className="max-h-48 overflow-y-auto space-y-1 mb-4">
              {tracks.slice(0, 50).map((t, i) => (
                <div key={i} className="flex gap-2 text-sm text-[#E0E0E0] py-1 border-b border-[#333]">
                  <span className="text-[#6A6A6A] w-5 shrink-0">{i + 1}</span>
                  <span className="flex-1 truncate">{t.title || '?'}</span>
                  <span className="text-[#B3B3B3] truncate max-w-[120px]">{t.artist}</span>
                </div>
              ))}
              {tracks.length > 50 && (
                <p className="text-[#6A6A6A] text-xs text-center py-2">…and {tracks.length - 50} more</p>
              )}
            </div>
            <button
              onClick={startResolve}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-3 rounded-full transition-colors"
            >
              Find Stream URLs ({tracks.length} tracks)
            </button>
          </div>
        )}

        {/* ---- STEP 3: Resolving ---- */}
        {step === 'resolve' && (
          <div className="py-8 text-center">
            <p className="text-white font-semibold mb-4">Finding music sources…</p>
            <div className="w-full bg-[#444] rounded-full h-2 mb-3">
              <div
                className="bg-[#1DB954] h-2 rounded-full transition-all duration-300"
                style={{ width: `${resolveProgress}%` }}
              />
            </div>
            <p className="text-[#B3B3B3] text-sm">
              {resolveProgress}% — prioritizing exact Jamendo, then close Jamendo, then exact YouTube
            </p>
          </div>
        )}

        {/* ---- STEP 4: Done ---- */}
        {step === 'done' && (
          <div>
            <div className="py-4 text-center mb-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-white font-semibold">{resolvedCount} / {tracks.length} tracks resolved</p>
              <p className="text-[#B3B3B3] text-sm mt-2">
                Jamendo: {jamendoCount} · YouTube: {youtubeCount} · Direct links: {directCount}
              </p>
              {resolvedCount < tracks.length && (
                <p className="text-[#B3B3B3] text-sm mt-1">
                  {tracks.length - resolvedCount} tracks could not be found — they will be imported without a stream URL.
                </p>
              )}
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-bold py-3 rounded-full transition-colors"
            >
              {importing ? 'Importing…' : `Import "${playlistName}"`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

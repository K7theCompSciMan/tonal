'use client';
// src/hooks/useKeyboardShortcuts.ts
// Global keyboard shortcuts — wire this into your root layout or player component

import { useEffect } from 'react';

interface Shortcuts {
  onPlayPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeekForward?: () => void;   // +5s
  onSeekBack?: () => void;      // -5s
  onLike?: () => void;
  onToggleQueue?: () => void;
  onShowHelp?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          shortcuts.onPlayPause?.();
          break;
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); shortcuts.onNext?.(); }
          else { e.preventDefault(); shortcuts.onSeekForward?.(); }
          break;
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); shortcuts.onPrev?.(); }
          else { e.preventDefault(); shortcuts.onSeekBack?.(); }
          break;
        case 'ArrowUp':
          e.preventDefault();
          shortcuts.onVolumeUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          shortcuts.onVolumeDown?.();
          break;
        case 'l':
        case 'L':
          shortcuts.onLike?.();
          break;
        case 'q':
        case 'Q':
          shortcuts.onToggleQueue?.();
          break;
        case '?':
          shortcuts.onShowHelp?.();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);
}

// ---- Shortcuts help modal data (use this to render the ShortcutsModal) ----
export const SHORTCUT_LIST = [
  { keys: ['Space'], description: 'Play / Pause' },
  { keys: ['←', '→'], description: 'Seek back / forward 5s' },
  { keys: ['Ctrl', '←'], description: 'Previous track' },
  { keys: ['Ctrl', '→'], description: 'Next track' },
  { keys: ['↑', '↓'], description: 'Volume up / down' },
  { keys: ['L'], description: 'Like / unlike current track' },
  { keys: ['Q'], description: 'Toggle queue panel' },
  { keys: ['?'], description: 'Show this help' },
];
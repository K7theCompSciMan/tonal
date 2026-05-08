'use client';
// src/components/ShortcutsModal.tsx - Keyboard shortcuts help modal

import { SHORTCUT_LIST } from '@/hooks/useKeyboardShortcuts';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div 
        className="bg-[#282828] rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-xl font-bold">Keyboard Shortcuts</h2>
          <button 
            onClick={onClose}
            className="text-[#B3B3B3] hover:text-white text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-3">
          {SHORTCUT_LIST.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#3E3E3E] last:border-0">
              <div className="flex gap-1">
                {shortcut.keys.map((key, j) => (
                  <kbd 
                    key={j}
                    className="px-2 py-1 bg-[#3E3E3E] rounded text-xs font-mono text-white min-w-[24px] text-center"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
              <span className="text-[#B3B3B3] text-sm">{shortcut.description}</span>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-[#6A6A6A] text-xs text-center mt-6">
          Press ? to toggle this help
        </p>
      </div>
    </div>
  );
}

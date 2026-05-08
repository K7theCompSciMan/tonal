'use client';
// src/hooks/useSwipeGesture.ts

import { RefObject, useEffect } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

/**
 * Attach swipe gesture detection to a DOM element.
 * Uses passive touch listeners for performance.
 * A gesture is only fired if the primary axis movement exceeds `threshold` px
 * AND the primary axis movement is at least 1.5x the secondary axis movement.
 */
export function useSwipeGesture(
  ref: RefObject<HTMLElement | null>,
  handlers: SwipeHandlers,
  threshold = 50
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > threshold && absDx > absDy * 1.5) {
        if (dx < 0) handlers.onSwipeLeft?.();
        else handlers.onSwipeRight?.();
      } else if (absDy > threshold && absDy > absDx * 1.5) {
        if (dy < 0) handlers.onSwipeUp?.();
        else handlers.onSwipeDown?.();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref, handlers, threshold]);
}
'use client';
// src/hooks/useColorExtraction.ts - Extract dominant color from album art

import { useState, useEffect } from 'react';

export function useColorExtraction(imageUrl: string | null | undefined) {
  const [dominantColor, setDominantColor] = useState<string>('#121212');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setDominantColor('#121212');
      return;
    }

    setIsLoading(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setDominantColor('#121212');
          setIsLoading(false);
          return;
        }

        // Resize for performance
        canvas.width = 100;
        canvas.height = 100;
        ctx.drawImage(img, 0, 0, 100, 100);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Simple color averaging (you can use more sophisticated algorithms)
        let r = 0, g = 0, b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4 * 10) { // Sample every 10th pixel
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        setDominantColor(hex);
      } catch (e) {
        setDominantColor('#121212');
      }
      setIsLoading(false);
    };

    img.onerror = () => {
      setDominantColor('#121212');
      setIsLoading(false);
    };
  }, [imageUrl]);

  return { dominantColor, isLoading };
}

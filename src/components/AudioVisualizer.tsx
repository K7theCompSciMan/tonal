'use client';
// src/components/AudioVisualizer.tsx - Web Audio API frequency visualization

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
}

export default function AudioVisualizer({ audioElement, isPlaying }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return;

    // Initialize Audio Context
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create analyser only once
    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 64; // 32 bars (fftSize / 2)
      analyserRef.current.smoothingTimeConstant = 0.8;
    }

    const analyser = analyserRef.current;

    // Connect source only once
    if (!sourceRef.current) {
      sourceRef.current = audioContext.createMediaElementSource(audioElement);
      sourceRef.current.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      if (!isPlaying) {
        // Clear canvas when not playing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 1.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // Spotify green at 60% opacity
        ctx.fillStyle = `rgba(29, 185, 84, 0.6)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioElement, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="w-full h-10"
      style={{ display: 'block' }}
    />
  );
}

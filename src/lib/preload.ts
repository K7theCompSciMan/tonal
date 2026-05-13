const preloaded = new Set<string>();

export function preloadAudio(url?: string | null) {
  if (!url || preloaded.has(url)) return;

  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;

  preloaded.add(url);
}
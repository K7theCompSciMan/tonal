// src/lib/lyrics.ts
// Synced lyrics: lrclib.net (synced LRC) → lyrics.ovh (plain) → silent fail
// All fetches have a 6-second timeout and treat 404 as "not found", not an error.
const lyricsCache = new Map<
	string,
	{ synced: LyricLine[] | null; plain: string | null }
>();
export interface LyricLine {
	time: number; // seconds
	text: string;
}

/** Parse .lrc format into timed lines. Handles both MM:SS.xx and MM:SS.xxx */
export function parseLRC(lrc: string): LyricLine[] {
	const result: LyricLine[] = [];
	for (const line of lrc.split("\n")) {
		// Match [MM:SS.xx] or [MM:SS.xxx]
		const match = line.match(/\[(\d{1,2}):(\d{2}(?:\.\d+)?)\](.*)/);
		if (!match) continue;
		const time = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
		const text = match[3].trim();
		if (text) result.push({ time, text });
	}
	return result.sort((a, b) => a.time - b.time);
}

/** Fetch with a timeout. Returns null on timeout or network error instead of throwing. */
async function fetchWithTimeout(
	url: string,
	timeoutMs = 6000,
): Promise<Response | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		return res;
	} catch {
		// Aborted (timeout) or network error — treat as "not found"
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Fetch synced lyrics from lrclib.net.
 * 404 = track not in their database — not an error, just no lyrics.
 * Any other failure (timeout, 5xx) also returns null silently.
 */
async function fetchFromLrcLib(
	title: string,
	artist: string,
	album?: string,
): Promise<{ synced: LyricLine[] | null; plain: string | null } | null> {
	try {
		const params = new URLSearchParams({
			track_name: title,
			artist_name: artist,
		});
		if (album) params.set("album_name", album);
		const res = await fetchWithTimeout(
			`https://lrclib.net/api/get?${params}`,
		);
		if (!res || !res.ok) return null; // 404, timeout, etc. — all silent
		const data = await res.json();
		if (data.syncedLyrics) {
			return {
				synced: parseLRC(data.syncedLyrics),
				plain: data.plainLyrics ?? null,
			};
		}
		if (data.plainLyrics) {
			return { synced: null, plain: data.plainLyrics };
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Fetch plain lyrics from lyrics.ovh.
 * This API is unreliable — timeout aggressively at 5s.
 */
async function fetchFromLyricsOvh(
	title: string,
	artist: string,
): Promise<string | null> {
	try {
		const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
		const res = await fetchWithTimeout(url, 5000);
		if (!res || !res.ok) return null;
		const data = await res.json();
		return typeof data.lyrics === "string" && data.lyrics.trim()
			? data.lyrics
			: null;
	} catch {
		return null;
	}
}

/**
 * Main lyrics fetch function.
 * Priority: lrclib.net (synced) → lrclib.net (plain) → lyrics.ovh (plain) → null
 * Never throws. Always resolves.
 */
export async function fetchLyrics(
	title: string,
	artist: string,
	album?: string,
): Promise<{ synced: LyricLine[] | null; plain: string | null }> {
	const cacheKey = `${title}::${artist}::${album ?? ""}`;

	if (lyricsCache.has(cacheKey)) {
		return lyricsCache.get(cacheKey)!;
	}

	const safeReturn = {
		synced: null,
		plain: null,
	};

	try {
		const result = await Promise.race([
			(async () => {
				const lrcLibResult = await fetchFromLrcLib(
					title,
					artist,
					album,
				);
				if (lrcLibResult) return lrcLibResult;

				if (album) {
					const fallback = await fetchFromLrcLib(title, artist);
					if (fallback) return fallback;
				}

				const ovhLyrics = await fetchFromLyricsOvh(title, artist);
				if (ovhLyrics) {
					return {
						synced: null,
						plain: ovhLyrics,
					};
				}

				return safeReturn;
			})(),

			new Promise<typeof safeReturn>((resolve) => {
				setTimeout(() => resolve(safeReturn), 2500);
			}),
		]);

		lyricsCache.set(cacheKey, result);

		return result;
	} catch {
		return safeReturn;
	}
}

/** Given current playback time and sorted lyric lines, return the active line index */
export function getActiveLyricIndex(
	lines: LyricLine[],
	currentTime: number,
): number {
	if (!lines.length) return -1;
	let idx = 0;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].time <= currentTime) idx = i;
		else break;
	}
	return idx;
}

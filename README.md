# Tonal

Spotify-like music streaming web app using Next.js + Supabase.

## Features

- Email/password auth with Supabase.
- Song discovery with search + genre/mood filters.
- External song search via YouTube Data API + iTunes + Jamendo APIs.
- Playback queue with previous/next and pause/play controls.
- Queue adjustment controls (move up/down, remove from queue).
- Playlists (create playlist, add songs, load playlist queue).
- Playlist management (rename, delete, remove tracks).
- Playlist portability (import JSON/M3U/CSV/TXT and export JSON/M3U).
- Upload songs into catalog (direct stream URL or YouTube URL/video ID).
- YouTube playback via embedded player support (through `react-player`).
- Song lyric lookup with automatic matching while a song plays.
- Responsive Spotify-inspired UI with mobile sidebar toggle.

## Tech Stack

- Next.js App Router + TypeScript + Tailwind.
- Supabase (Auth + Postgres + RLS).
- `react-player` for mixed source playback (direct audio + YouTube).

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Create Supabase project

1. Create a project in [Supabase](https://supabase.com).
2. Go to SQL Editor and run:
   - `supabase/schema.sql`
   - optional sample data: `supabase/seed.sql`
3. In Authentication > Providers, keep Email enabled.
4. In Authentication > URL Configuration, set Site URL to `http://localhost:3000`.

### 3) Configure environment variables

Copy `.env.example` to `.env.local` and fill values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_YOUTUBE_API_KEY=...
NEXT_PUBLIC_JAMENDO_CLIENT_ID=...
```

You can find these in Supabase Project Settings > API.
For external APIs:
- YouTube key: create a key in Google Cloud Console for YouTube Data API v3.
- Jamendo client ID: create from Jamendo developer dashboard.
- iTunes Search API and lyrics.ovh are used without API keys.

### 4) Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Important Notes About YouTube Streaming

- This implementation plays YouTube links through an embedded player (not raw audio extraction).
- If you want background server-side extraction/transcoding behavior, you will need your own media service and must ensure compliance with YouTube Terms of Service and local law.

## Suggested Next Improvements

- Add Supabase Storage upload flow for audio files.
- Add artist/album pages and likes/follows.
- Add realtime "currently listening" presence.
- Add admin moderation and reporting tools.

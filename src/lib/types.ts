export type DbSong = {
  id: string;
  created_at: string;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  stream_url: string;
  source_type: "direct" | "youtube";
  genre: string | null;
  mood: string | null;
  duration_seconds: number | null;
  uploaded_by: string | null;
};

export type DbPlaylist = {
  id: string;
  created_at: string;
  name: string;
  description: string | null;
  is_public: boolean;
  owner_id: string;
};

export type DbPlaylistSong = {
  playlist_id: string;
  song_id: string;
  added_at: string;
};

export type SongWithPlaylistState = DbSong & {
  inActivePlaylist: boolean;
};

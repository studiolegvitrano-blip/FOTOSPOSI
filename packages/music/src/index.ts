// @fotosposi/music — Colonna sonora condivisa matrimonio (Spotify + QR wedding playlist)
// vedi PROJECT_STATUS sessione 04/08/2026 — feature "colonna sonora condivisa"

export type { EventSong, AddSongParams, SongListResult } from './service';
export type { SpotifyTrack, SpotifySearchResult } from './spotify';

export {
  addSong,
  listSongs,
  deleteSong,
  getSongById,
  ensureSpotifyCredentials,
} from './service';

export {
  searchTracks,
  getSpotifyToken,
  isSpotifyConfigured,
  resetSpotifyCacheForTests,
} from './spotify';

export { exportM3U, exportPDFHtml, buildPlaylistPdfHtml } from './export';

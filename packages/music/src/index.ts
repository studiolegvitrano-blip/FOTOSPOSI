// @fotosposi/music — Colonna sonora condivisa matrimonio (iTunes Search API)
// vedi PROJECT_STATUS sessione 05/08/2026 — provider iTunes (Spotify richiede Premium)

export type { EventSong, AddSongParams, SongListResult } from './service';
export type { TrackItem, TrackSearchResult } from './itunes';

export {
  addSong,
  listSongs,
  deleteSong,
  getSongById,
  formatArtists,
} from './service';

export { searchTracks, upscaleArtwork, setItunesFetchForTests } from './itunes';

export { exportM3U, exportPDFHtml, buildPlaylistPdfHtml } from './export';

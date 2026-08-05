import { describe, it, expect } from 'vitest';
import { exportM3U, buildPlaylistPdfHtml } from '../export';
import type { EventSong } from '../service';

const baseSong: EventSong = {
  id: 'song-1',
  event_id: 'ev-1',
  track_id: '1441146346',
  title: 'A Sky Full of Stars',
  artist: 'Coldplay',
  album: 'Ghost Stories',
  art_url: 'https://is1-ssl.mzstatic.com/image/thumb/300x300bb.jpg',
  duration_ms: 268_040,
  preview_url: 'https://audio-ssl.itunes.apple.com/itunes-assets/abc.m4a',
  external_url: 'https://music.apple.com/it/album/1441146346',
  added_by_user_id: 'user-1',
  added_by_name: 'Agostino Spera',
  added_at: '2026-08-04T12:00:00Z',
  brand: 'Sposi.live',
};

const songs: EventSong[] = [
  baseSong,
  {
    ...baseSong,
    id: 'song-2',
    track_id: '1441186772',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    album: '÷ (Divide)',
    duration_ms: 263_440,
    added_by_name: 'Danila Villa',
    external_url: 'https://music.apple.com/it/album/1441186772',
  },
];

describe('export M3U', () => {
  it('riga iniziale #EXTM3U', () => {
    const m = exportM3U(songs);
    expect(m.split('\n')[0]).toBe('#EXTM3U');
  });

  it('include il nome playlist come commento dopo #EXTM3U', () => {
    const m = exportM3U(songs, 'Nozze Agostino e Danila');
    const lines = m.split('\n');
    expect(lines[0]).toBe('#EXTM3U');
    expect(lines[1]).toBe('# PLAYLIST: Nozze Agostino e Danila');
  });

  it('per ogni brano: EXTINF con durata + titolo/artista + URL', () => {
    const m = exportM3U(songs);
    // brano 1
    expect(m).toContain('#EXTINF:268,A Sky Full of Stars - Coldplay');
    expect(m).toContain('https://music.apple.com/it/album/1441146346');
    // brano 2
    expect(m).toContain('#EXTINF:263,Perfect - Ed Sheeran');
    expect(m).toContain('https://music.apple.com/it/album/1441186772');
  });

  it('durata null diventa -1 (placeholder M3U standard)', () => {
    const songsNull = [{ ...baseSong, duration_ms: null }];
    const m = exportM3U(songsNull);
    expect(m).toContain('#EXTINF:-1,');
  });

  it('sanitizza newline in titolo/artista', () => {
    const songsBad = [
      {
        ...baseSong,
        title: 'A\nTitle',
        artist: 'Bad\nArtist',
      } as EventSong,
    ];
    const m = exportM3U(songsBad);
    expect(m).not.toContain('A\nTitle');
    expect(m).toContain('A Title');
    expect(m).toContain('Bad Artist');
  });

  it('lista vuota produce solo header #EXTM3U (+ eventualmente nome playlist)', () => {
    const m = exportM3U([], '');
    expect(m.trim()).toBe('#EXTM3U');
  });
});

describe('export HTML/PDF', () => {
  it('genera HTML con titolo + brand + count + righe', () => {
    const html = buildPlaylistPdfHtml(songs, {
      playlistName: 'Nozze Danila & Agostino',
      coupleName: 'Danila Villa e Agostino Spera',
      eventDate: '30/07/2026',
      brand: 'Sposi.live',
    });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Nozze Danila &amp; Agostino — Danila Villa e Agostino Spera</title>');
    expect(html).toContain('Sposi.live');
    expect(html).toContain('2 brani');
    expect(html).toContain('A Sky Full of Stars');
    expect(html).toContain('Coldplay');
    expect(html).toContain('Ghost Stories');
    expect(html).toContain('4:28'); // 268040ms = 4:28
    expect(html).toContain('proposto da Agostino Spera');
    expect(html).toContain('proposto da Danila Villa');
  });

  it('sanitizza XSS in titoli/nomi', () => {
    const songsBad = [
      {
        ...baseSong,
        title: '<script>alert(1)</script>',
        added_by_name: '" onerror="alert(2)',
      } as EventSong,
    ];
    const html = buildPlaylistPdfHtml(songsBad, {
      playlistName: 'Test',
      coupleName: 'A & B',
      eventDate: '',
      brand: 'Sposi.live',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('" onerror="alert(2)');
    expect(html).toContain('&quot; onerror=&quot;alert(2)');

  });

  it('brand JustMarry.live appare nel footer', () => {
    const html = buildPlaylistPdfHtml(songs, {
      playlistName: 'Wedding Playlist',
      coupleName: 'John & Jane',
      eventDate: '2026-09-15',
      brand: 'JustMarry.live',
    });
    expect(html).toContain('JustMarry.live');
  });

  it('righe alternate per leggibilità stampa', () => {
    const html = buildPlaylistPdfHtml(songs, {
      playlistName: 'P',
      coupleName: '',
      eventDate: '',
      brand: 'Sposi.live',
    });
    expect(html).toContain('row-a');
    expect(html).toContain('row-b');
  });

  it('manca art_url — niente img, ma numero e titolo restano', () => {
    const songsNoArt = [{ ...baseSong, art_url: null }];
    const html = buildPlaylistPdfHtml(songsNoArt, {
      playlistName: 'P',
      coupleName: '',
      eventDate: '',
      brand: 'Sposi.live',
    });
    expect(html).toContain('01');
    expect(html).toContain('A Sky Full of Stars');
  });
});

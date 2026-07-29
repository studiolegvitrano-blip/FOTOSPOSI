import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // sharp ships native bindings; letting webpack try to bundle it (via the
  // @fotosposi/photo-overlay workspace package) makes it go looking for
  // @img/sharp-libvips-dev/* files that don't exist in the Vercel build image.
  // Keeping it external forces Node's normal require() at runtime instead.
  // ffmpeg-static: se webpack lo inlinea, il path del binario viene calcolato dal
  // __dirname della route bundlata (.next/server/app/api/...) e spawn fallisce con
  // ENOENT ("spawn .../api/guestbook/messages/ffmpeg" — visto nei log Vercel).
  // Tenendolo esterno, require() risolve il vero node_modules/ffmpeg-static a runtime
  // (il binario arriva nella lambda grazie a outputFileTracingIncludes qui sotto).
  serverExternalPackages: ['sharp', 'ffmpeg-static', '@fotosposi/photo-overlay', '@fotosposi/video-overlay', '@fotosposi/media'],
  transpilePackages: [
    '@fotosposi/core',
    '@fotosposi/events',
    '@fotosposi/media',
    '@fotosposi/games',
    '@fotosposi/social-sharing',
    '@fotosposi/commerce',
    '@fotosposi/site-builder',
    '@fotosposi/notifications',
    '@fotosposi/ui',
    '@fotosposi/video-overlay',
  ],
  // Make sure Vercel's function tracer bundles the ffmpeg-static binary (it's invoked via
  // child_process.spawn, which the tracer can't follow like a normal `require`).
  outputFileTracingIncludes: {
    // Oltre a ffmpeg, ogni route che imprime watermark ha bisogno dei font in
    // assets/fonts: le lambda Vercel non hanno font di sistema e senza questi
    // il testo del watermark viene rasterizzato come quadrati (tofu).
    // sharp qui viene caricato via import() dinamico dentro photo-overlay/video-overlay:
    // il tracer non lo segue e la lambda restava senza binario ("Could not load the
    // sharp module using the linux-x64 runtime" nei log) → share sempre in 500.
    'src/app/api/photos/[id]/share/route.ts': ['../../node_modules/ffmpeg-static/**', 'assets/fonts/**', 'public/fonts/**', 'public/logo-*.png', '../../node_modules/sharp/**', '../../node_modules/@img/**'],
    // Il watermark video ora viene bruciato anche durante il processing della coda
    // (upload ospiti), nello sweep del cron e sui video guestbook: tutte queste
    // route spawnano ffmpeg e usano sharp via import() dinamico.
    // FIX 28/07/2026 (post-deploy): process-queue.ts falliva su Vercel con
    // "Could not load the sharp module using the linux-x64 runtime" perché sharp
    // è importato dinamicamente dentro @fotosposi/photo-overlay e il tracer di
    // Next.js non segue import() dinamici. Aggiunto sharp/@img qui.
    'src/app/api/r2/process-queue/route.ts': ['../../node_modules/ffmpeg-static/**', 'assets/fonts/**', 'public/fonts/**', 'public/logo-*.png', '../../node_modules/sharp/**', '../../node_modules/@img/**'],
    'src/app/api/cron/maintenance/route.ts': ['../../node_modules/ffmpeg-static/**', 'assets/fonts/**', 'public/fonts/**', 'public/logo-*.png', '../../node_modules/sharp/**', '../../node_modules/@img/**'],
    'src/app/api/guestbook/messages/route.ts': ['../../node_modules/ffmpeg-static/**', 'assets/fonts/**', 'public/fonts/**', 'public/logo-*.png', '../../node_modules/sharp/**', '../../node_modules/@img/**'],
    // FIX 28/07/2026: mancava del tutto. repairWatermarkForEvent (chiamata da
    // questa route) usa applyWatermark esattamente come process-queue.ts — senza
    // questi asset bundlati, il repair dei 40 file dell'evento di test avrebbe
    // riprodotto IDENTICO il bug che sta cercando di correggere.
    // FIX post-deploy: aggiunto anche sharp/@img (vedi commento sopra per la causa).
    'src/app/api/r2/repair-watermark/route.ts': ['assets/fonts/**', 'public/fonts/**', 'public/logo-*.png', '../../node_modules/sharp/**', '../../node_modules/@img/**'],
  },
};

export default withNextIntl(nextConfig);

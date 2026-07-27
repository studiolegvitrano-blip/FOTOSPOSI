# VPS sidecar: video watermark server

HTTP server minimale da lanciare sul VPS che ospita già wa-automate-nodejs per
WhatsApp. Riceve richieste watermark video dalla lambda Vercel, scarica il video
originale da R2 via presigned URL, applica il watermark con `ffmpeg` di sistema
(no bundle 70MB ffmpeg-static), e uploada il watermarkato via presigned PUT.

## Requisiti VPS

- Node.js 18+
- `ffmpeg` installato di sistema (`apt install ffmpeg` su Debian/Ubuntu,
  `brew install ffmpeg` su macOS, già presente su Raspberry Pi OS bookworm+)
- `sharp` npm (per rendering del PNG overlay del watermark, come nella lambda)

## Installazione

```bash
ssh user@vps
mkdir -p ~/fotosposi-vps && cd ~/fotosposi-vps
npm init -y
npm install sharp
# Copia qui gli ultimi due file:
#   - video-watermark-server.js  (questo script)
#   - overlay.js                 (logica SVG → PNG → ffmpeg composita, no dipendenze dal repo principale)

# Avvia (consigliato: dietro nginx + certbot, oppure tunnel cloudflare)
API_KEY="$(openssl rand -hex 32)" PORT=8081 node video-watermark-server.js
```

Per protgeretro HTTPS gratis con Cloudflare Tunnel: `cloudflared tunnel ruta
tcp://localhost:8081 --hostname watermark.vps.example.com` e puntare
`VPS_FFMPEG_URL=https://watermark.vps.example.com` (no expose porta pubblica).

## Logging

stdout per ogni job: `[ISO] start bytes=X duration=Yms ok=1` → facilmente grep
su systemd journal: `journalctl -u fotosposi-watermark -f`.

## Security model

- `X-API-Key` header required per ogni richiesta, confrontato con `API_KEY` env
  in timing-safe (crypto.timingSafeEqual).
- Il server NON vede mai le credenziali R2: lavora solo con URL presigned firmati
  dalla lambda (1h GET, 1h PUT). Anche se l'API key VPS viene compromessa,
  l'attaccante può solo chiedere watermark di video che gli passi lui stesso:
  nessun accesso diretto a R2 / Supabase.
- POST body limit 256KB (branding + URLs). Il video NON attraversa mai la POST:
  transita solo tra R2 e VPS.

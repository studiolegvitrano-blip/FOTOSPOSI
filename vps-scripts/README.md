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

## Installazione (una tantum)

```bash
ssh user@vps
mkdir -p ~/fotosposi-vps && cd ~/fotosposi-vps
npm init -y
npm install sharp
# Copia qui i due file dal repo (vedi sezione "Copiare i file" sotto)
```

### Copiare i file (3 modi)

Da Windows, con PowerShell, i file sono in `C:\Users\agost\OneDrive\Documenti\FOTOSPOSI\vps-scripts\`:

**Modo A — scp (richiede path server noto, es. utente@nas.local o IP):**
```powershell
scp "C:\Users\agost\OneDrive\Documenti\FOTOSPOSI\vps-scripts\video-watermark-server.js" user@vps:~/fotosposi-vps/
scp "C:\Users\agost\OneDrive\Documenti\FOTOSPOSI\vps-scripts\overlay.js" user@vps:~/fotosposi-vps/
```

**Modo B — git pull sul VPS (se hai il repo clonato anche lì):**
```bash
git clone https://github.com/studiolegvitrano-blip/FOTOSPOSI.git ~/fotosposi-fork
cp ~/fotosposi-fork/vps-scripts/*.{js,md} ~/fotosposi-vps/
```

**Modo C — copia-incolla `cat <<EOF > file.js`** dentro i due file della repo direttamente da SSH. Scomodo, ma funziona senza scp/git.

## Gestione servizio: systemd (consigliato)

Crea il unit file una volta sola, poi in 3 comandi è running forever:

```bash
sudo tee /etc/systemd/system/fotosposi-watermark.service > /dev/null <<'EOF'
[Unit]
Description=FOTOSPOSI video watermark sidecar
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/fotosposi-vps
Environment="PORT=8081"
Environment="API_KEY=PUT_HERE_THE_OPENSSL_RAND_HEX_32_OUTPUT"
ExecStart=/usr/bin/node /home/YOUR_USER/fotosposi-vps/video-watermark-server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Ricava una chiave robusta: copiala (sarà incollata in Vercel come VPS_FFMPEG_API_KEY)
openssl rand -hex 32   # output di 64 caratteri, copiarlo

# Incolla quella chiave nel punto "PUT_HERE..." del file sopra, poi:
sudo systemctl daemon-reload
sudo systemctl enable fotosposi-watermark
sudo systemctl start fotosposi-watermark
sudo systemctl status fotosposi-watermark
```

**Comandi utili dopo:**
- `sudo systemctl restart fotosposi-watermark` — riavvia dopo aver cambiato config
- `sudo journalctl -u fotosposi-watermark -f` — log live (Ctrl+C per uscire)
- `sudo journalctl -u fotosposi-watermark --since "1 hour ago"` — log ultima ora

## HTTPS con sottodominio su `sposi.live` / `justmarry.live`

Tre strade, dalla più semplice alla più sicura.

### Strada 1 — Cloudflare Tunnel (consigliata, zero porta esposta)

Prerequisito: dominio `sposi.live` o `justmarry.live` già su Cloudflare (gestito da loro, anche se registrato altrove). Se non è già su Cloudflare, la **Strada 2** è più rapida.

```bash
# Sul VPS
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

cloudflared tunnel login                # si apre browser: autorizzo il dominio
cloudflared tunnel create fotosposi-wm  # crea il tunnel
cloudflared tunnel route dns fotosposi-wm watermark.sposi.live
sudo cloudflared service install        # daemon systemd per il tunnel

# Config tunnel (modificare dopo l'install):
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<'EOF'
tunnel: TUNNEL_ID_DOPO_CREATE
credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: watermark.sposi.live
    service: http://localhost:8081
  - service: http_status:404
EOF
sudo systemctl restart cloudflared
```

Risultato: `https://watermark.sposi.live` raggiunge il server su VPS tramite tunnel HTTPS automatico (certificato gestito da Cloudflare).

### Strada 2 — nginx + certbot sul VPS (richiede porta 80/443 aperta)

Più classica, ma richiede dal provider VPS: porta 80 e 443 aperte in ingresso + DNS A record che punta all'IP pubblico del VPS.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
# Su Register.it (o Cloudflare DNS):
#   A   watermark   VPS_PUBLIC_IP       TTL auto
#   AAAA watermark   (se IPv6)
# Dopo propagazione DNS (5-30 min), verifica:
dig watermark.sposi.live +short   # deve mostrare VPS_PUBLIC_IP

sudo tee /etc/nginx/sites-available/watermark > /dev/null <<'EOF'
server {
    listen 80;
    server_name watermark.sposi.live;
    client_max_body_size 1m;     # body POST sono solo JSON branding, niente video
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/watermark /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d watermark.sposi.live   # Let's Encrypt HTTPS automatico
```

Risultato: `https://watermark.sposi.live` con certificato Let's Encrypt gratis, rinnovato automaticamente.

### Strada 3 — Solo HTTP senza HTTPS (NON per produzione)

Test locale / rete fidata. L'API key passa in chiaro sulla rete → solo per dev.

## Env vars richieste sul Vercel

Una volta che il sidecar è up su `https://watermark.sposi.live` (Strada 1) o `https://watermark.sposi.live` (Strada 2):

| Variabile | Valore |
|---|---|
| `VPS_FFMPEG_URL` | `https://watermark.sposi.live` (NO slash finale) |
| `VPS_FFMPEG_API_KEY` | l'output di `openssl rand -hex 32` che hai incollato nel unit file systemd |

Da impostare in **Vercel → Settings → Environment Variables** di `fotosposi-web`. Redeploy richiesto per applicarla.

## Test end-to-end

Il sidecar deve rispondere a un health check prima di usarlo dalla lambda:

```bash
# Sul VPS
curl http://127.0.0.1:8081/health
# Atteso: {"ok":true,"service":"fotosposi-watermark","uptime":...}

# Dall'esterno tramite dominio pubblico (dopo aver finito setup DNS+nginx/tunnel)
curl -H "X-API-Key: <your key>" -X POST https://watermark.sposi.live/watermark \
  -H "Content-Type: application/json" \
  -d '{"downloadUrl":"...","uploadUrl":"...","branding":{"coupleNames":"Test & Co","date":"","primaryColor":"#000","wordmark":"test"}}'
# Senza presigned URL reali risponderà errore download, ma il formato è giusto.
```

Poi dal browser: condividi un video da `/events/[id]/upload` con r2_key presente, condividi su WhatsApp/Facebook dalla galleria, controlla che il watermark appaia anche su file 200MB+.

## Logging

stdout per ogni job: `[ISO] download bytes=X dlMs=...` poi `ffmpeg encodeMs=...` poi `upload uploadMs=...`. Visibile via `journalctl -u fotosposi-watermark -f`.

## Security model

- `X-API-Key` header required per ogni richiesta, confrontato con `API_KEY` env
  in timing-safe (crypto.timingSafeEqual).
- Il server NON vede mai le credenziali R2: lavora solo con URL presigned firmati
  dalla lambda (1h GET, 1h PUT). Anche se l'API key VPS viene compromessa,
  l'attaccante può solo chiedere watermark di video che gli passi lui stesso:
  nessun accesso diretto a R2 / Supabase.
- POST body limit 256KB (branding + URLs). Il video NON attraversa mai la POST:
  transita solo tra R2 e VPS.

## Manutenzione overlay.js ↔ packages/video-overlay/src/index.ts

I due file **non** sono collegati automaticamente. Quando modifichi la grafica
del watermark nel package Vercel, ricopia i blocchi `escapeXml` e `renderWatermarkOverlay`
in `overlay.js` qui. Drift = video_watermarked lato VPS avrà grafica diversa dalla foto
lato lambda (branding disallineato per gli ospiti).

---

## Setup specifico: Oracle Cloud Free Tier (consigliato per produzione)

L'opzione migliore "free per sempre" nel 2026: **4 VM ARM Ampere A1 con 4 OCPU
totali e 24GB RAM totali, sempre gratis**. ffmpeg gira nativamente ARM
(molto più veloce di x86 sul nostro carico single-thread encode H.264).

### 1. Provisioning dal browser (5 minuti)

1. Vai su https://cloud.oracle.com/free e clicca "Start for Free"
2. Registrati (richiede carta di credito **non** addebitata, serve solo per verifica).
3. Scegli **Home Region**: **EU-Frankfurt** o **EU-Milan** (se disponibile, latenza minore dall'Italia).
4. ☰ → Compute → Instances → Create Instance:
   - **Name**: `fotosposi-watermark`
   - **Image**: Canonical Ubuntu 22.04 (aarch64) — IMPORTANTE: deve essere ARM (aarch64), non x86
   - **Shape**: VM.Standard.A1.Flex — 2 OCPU + 12 GB RAM (metà del free tier; l'altra metà la tieni per backup/scale-out futuro)
   - **SSH**: `ssh-keygen -t ed25519` se non hai già chiave, poi "Paste" della public key
5. Create. Annotati l'IP pubblico e l'username (`ubuntu`).

### 2. Setup iniziale (sul VPS)

```bash
ssh ubuntu@<PUBLIC_IP>

sudo apt update && sudo apt upgrade -y
sudo apt install -y ffmpeg nodejs npm

node --version   # verifica >=18. Se <18:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo mkdir -p /opt/fotosposi-vps && sudo chown ubuntu:ubuntu /opt/fotosposi-vps
cd /opt/fotosposi-vps
npm init -y
npm install sharp

# Copia qui i due file (vedi sezione "Copiare i file" sopra)
```

### 3. systemd service

```bash
# Genera API key (COPIALA → Vercel env VPS_FFMPEG_API_KEY)
openssl rand -hex 32

sudo tee /etc/systemd/system/fotosposi-watermark.service > /dev/null <<EOF
[Unit]
Description=FOTOSPOSI video watermark sidecar
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/fotosposi-vps
Environment="PORT=8081"
Environment="API_KEY=INSERISCI_QUI_OUTPUT_OPENSSL_RAND_HEX_32"
ExecStart=/usr/bin/node /opt/fotosposi-vps/video-watermark-server.js
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable fotosposi-watermark
sudo systemctl start fotosposi-watermark
sudo systemctl status fotosposi-watermark   # deve mostrare "active (running)"
```

Log live: `sudo journalctl -u fotosposi-watermark -f`.

### 4. HTTPS con Cloudflare Tunnel (consigliato, zero porta aperta)

Requisito: dominio `sposi.live` su Cloudflare (anche solo DNS). Se non c'è, vedi punto 5.

**Sulla tua macchina locale (dove hai il browser):**
```bash
cloudflared tunnel login   # autorizza via browser
```

**Sul VPS:**
```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

cloudflared tunnel create fotosposi-wm
# Output: TUNNEL_ID + file ~/.cloudflared/<TUNNEL_ID>.json

cloudflared tunnel route dns fotosposi-wm watermark.sposi.live

sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
tunnel: <TUNNEL_ID>
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: watermark.sposi.live
    service: http://localhost:8081
  - service: http_status:404
EOF
sudo cloudflared service install
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

Verifica: `curl -H "X-API-Key: <your-key>" https://watermark.sposi.live/health` → JSON ok.

### 5. Strada alternativa: nginx + Let's Encrypt (dominio DNS classico)

Apri ingress 80 e 443 da Oracle → Networking → Security Lists (0.0.0.0/0).

Aggiungi DNS su Register.it:
```
A    watermark   <PUBLIC_IP_VPS_ORACLE>
```

Aspetta 5-30 minuti per la propagazione. Verifica: `dig watermark.sposi.live +short`.

Sul VPS:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/watermark > /dev/null <<'EOF'
server {
    listen 80;
    server_name watermark.sposi.live;
    client_max_body_size 1m;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/watermark /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d watermark.sposi.live --redirect
```

### 6. Vercel env vars

https://vercel.com/studiolegvitrano-blip/fotosposi-web/settings/environment-variables → Add:

| Name | Value | Environment |
|---|---|---|
| `VPS_FFMPEG_URL` | `https://watermark.sposi.live` (senza `/` finale) | Production |
| `VPS_FFMPEG_API_KEY` | l'API key generata al punto 3 | Production |

Poi Redeploy dell'ultimo commit.

### 7. Test end-to-end

1. Carica video >100MB su un evento di prova (`/events/[id]/upload`)
2. Apri la galleria, condividi il video
3. Verifica che il file scaricato abbia il watermark in basso

Test rapido del solo sidecar (per verificare auth + pipeline):
```bash
# Sul VPS
curl -H "X-API-Key: $API_KEY" -X POST http://localhost:8080/watermark \
  -H "Content-Type: application/json" \
  -d '{"downloadUrl":"https://invalid","uploadUrl":"https://invalid","branding":{"coupleNames":"T","date":"","primaryColor":"#000","wordmark":"w"}}'
# Atteso: {"ok":false,"error":"Download failed: ..."} — significa che auth + pipeline rispondono correttamente.
```

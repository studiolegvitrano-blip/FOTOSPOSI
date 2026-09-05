# deploy-vps.ps1 — Deploy del sidecar watermark sulla VPS Oracle (da WINDOWS).
#
# Uso (PowerShell 5.1, dalla cartella del repo):
#   .\vps-scripts\deploy-vps.ps1 -PublicIp "AA.BB.CC.DD"
#
# Cosa fa:
#   1) scp dei file video-watermark-server.js, overlay.js, setup-oracle.sh → home ubuntu
#   2) ssh: chmod +x + esegue setup-oracle.sh (installa ffmpeg/node, systemd, API key)
#   3) stampa lo stato del service e il comando health check
#
# Prerequisiti:
#   - Chiave SSH già generata: C:\Users\<utente>\.ssh\id_ed25519_oracle
#   - OpenSSH client abilitato su Windows (scp/ssh nel PATH)
#   - Host aggiunto a known_hosts (il primo run chiede conferma fingerprint)

param(
  [Parameter(Mandatory=$true)]
  [string]$PublicIp,
  [string]$Username = "ubuntu",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\id_ed25519_oracle"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = "$Username@$PublicIp"

Write-Host "==> [1/4] Verifica connessione SSH a $server" -ForegroundColor Cyan
ssh -i $KeyPath -o StrictHostKeyChecking=accept-new $server "echo 'SSH OK: $(hostname)'"
if ($LASTEXITCODE -ne 0) { throw "SSH fallito. Controlla IP e che l'istanza sia Running." }

Write-Host "`n==> [2/4] Copia i file sulla VPS (scp)" -ForegroundColor Cyan
scp -i $KeyPath "$scriptDir\video-watermark-server.js" "${server}:~/"
scp -i $KeyPath "$scriptDir\overlay.js" "${server}:~/"
scp -i $KeyPath "$scriptDir\setup-oracle.sh" "${server}:~/"

Write-Host "`n==> [3/4] Esegue setup-oracle.sh sulla VPS (elaborazione, può richiedere 2-4 min)" -ForegroundColor Cyan
ssh -i $KeyPath $server "chmod +x ~/setup-oracle.sh && sudo -n true 2>/dev/null || echo 'USE_SUDO'"

# sudo senza password potrebbe non essere attivo di default su Ubuntu (l'utente
# ubuntu ha sudo con password vuota su Oracle? No: serve password). Per evitare
# di chiedere la password interattivamente, proviamo sudo -S con stdin vuoto.
# In alternativa l'utente esegue manualmente: ssh ... 'sudo ./setup-oracle.sh'
Write-Host "    Nota: setup-oracle.sh richiede sudo. Oracle non imposta password per l'utente ubuntu"
Write-Host "    (login solo via chiave). Eseguendo ora con 'sudo bash'..." -ForegroundColor Yellow
ssh -i $KeyPath -t $server "chmod +x ~/setup-oracle.sh && sudo bash ~/setup-oracle.sh"
if ($LASTEXITCODE -ne 0) {
  Write-Host "`n⚠️  setup fallito o richiesto intervento. Rilancia manualmente:" -ForegroundColor Yellow
  Write-Host "    ssh -i $KeyPath $server"
  Write-Host "    sudo bash ~/setup-oracle.sh"
  exit 1
}

Write-Host "`n==> [4/4] Stato finale" -ForegroundColor Cyan
ssh -i $KeyPath $server "sudo systemctl status fotosposi-watermark --no-pager -l | head -n 20"

Write-Host "`n✅ Deploy completato. Health check locale:" -ForegroundColor Green
Write-Host "    ssh -i $KeyPath $server 'curl http://127.0.0.1:8081/health'"
Write-Host "`nProssimi passi (manuali/Tu):"
Write-Host "  1. Configura HTTPS (Cloudflare Tunnel o nginx) → watermark.sposi.live"
Write-Host "  2. Imposta su Vercel: VPS_FFMPEG_URL e VPS_FFMPEG_API_KEY (la key stampata da setup-oracle.sh)"
Write-Host "  3. Redeploy su Vercel"
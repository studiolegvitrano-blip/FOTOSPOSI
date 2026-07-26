# Shot-list tecnico — "Da un sì all'altro" (14")

**Brand:** Sposi.live
**Durata totale:** 14.00 sec @ 24fps → 336 frame
**Master:** 1920×1080 H.264 MP4 + VP9 WebM, audio none (autoplay muted loop),
**Loop:** si (head/tail saldabili con crossfade nero 4 frame)
**Frame rate:** 24fps (cinematic) — alternativa 30fps per playback mobile più snappy

---

## Concept

Una corsa nel tempo: dal "sì" bisbigliato nel 1889 al Teatro Massimo di Palermo, al "sì" moderno declinato
da Ferrari Purosangue che attraversa la stessa città oggi. Il brand Sposi.live emerge come filigrana
sottile dall'inizio, si svela al centro al reveal, e chiude con payoff a fade.

Il montaggio gioca sul contrasto **seppia/B&N → colore**, **statico→movimento**, **storia→moderno**:
un "sì" non è mai passato di moda, ma il modo di raccontarlo sì.

---

## Asset sorgenti (`FOTO AGO/foto animazione/`)

| ID | File | Risoluzione | Uso shot |
|----|------|-------------|----------|
| T1 | `teatro massimo centrale.jpg` | 800×531 (3:2) | Piano 1 + Piano 2 (push-in) |
| T2 | `teatro massimo laterale.jpg` | 800×533 (3:2) | Fallback T1 se push-in serve via croce differente |
| F1 | `ferrari purosangue 1.webp` | ~16:9 (verificare) | Reveal proclaim + px bg-in |
| F2 | `ferrari purosangue 2.webp` | ~16:9 | Piano 3 — headlight sx→dx (principale) |
| F3 | `ferrari purosangue 3.webp` | ~16:9 | Alternate shot (montaggio a 3 stabilito) |
| F4 | `ferrari purosangue 4.webp` | ~16:9 | Alternate shot (chrominance check) |

**Verifica da fare al primo export:** confermare aspect ratio F1-F4. Se 4:3, ricomporre in 16:9 con
letterbox grigio 8% (non nero, evita mismatch con reveal nero finale; se 16:9 nativo, OK).

---

## Brand watermark da renderizzare (filigrana top-right, dal frame 1)

- **Asset:** `apps/web/public/logo-sposi-trans.png` (PNG canale alpha, scritta + 2 anelli)
- **Posizione:** top-right, padding 32px, altezza 14% frame (≈270px @ 1920 alto? No, width-locked: 200px larghezza)
- **Opacità:** 60% (composita con layer SVG fill-opacity 0.4, blend 'over')
- **Timeline:** presente dal frame 0 (inserisce subito il marchio come dettaglio sottile), resta fino a frame 233 (10s 24°)
  - dal frame 234 (10s 24°): scivola dal angolo top-right al centro con scale 1→4 (210→840px) e ease-out quartico 0.8s
  - dal frame 253 (10s 17°): fermo al centro 4x, rampa opacità 60%→100% in 12 frame (~500ms)
- **Font watermark testuale (Piano 1/Piano 3):** Lucida Calligraphy (file: `apps/web/public/fonts/LucidaCalligraphy.ttf`)
  - testo Piano 1: `Guido ❤️ Melissa · Sposi · 25/08/2026`
  - testo Piano 3: stesso testo, stessa posizione (centro basso sotto timeline)
  - stile: bianco 80% opacità, 48pt @ 1080p, ombra nera 2px diagonal off (leggera)

---

## Piano per piano (timeline 14s)

### Piano 1 — Teatro Massimo 1889, fermo seppia (0.0s → 4.0s)

| Campo | Valore |
|-------|--------|
| Source | T1 (centrale) uprezzato a 1920×1080 via Real-ESRGAN 4x oppure SwinIR |
| Trattamento colore | Seppia monochrome con bump selettivo giallo-arancio (#a08050 gamut) |
| Look filtri | Vignettatura 35% radial → bordo nero 12% opacità, scratch film grain 8% (proxy ochre shed), micro-flicker 2-3% luminosità ogni 4 frame |
| Motion | Statico (camera fissa, drone "volava ma in hover"), con breathing 1% scale in/out (100→100.4→100) su 96 frame ease-in-out |
| Caption burn-in | "Palermo · 1889" — font serif quantity Bodoni Moda (fallback: Playfair Display Italic 700), 36pt, colore seppia chiaro #d8c09a, top-left padding 48px |
| Watermark brand | top-right filigrana 60% (vedi sopra) |
| Audio | Silenzio (sarà musicato in post) |

**Frame count:** 0 → 95 (96 frame, 4s @ 24fps)

---

### Transizione 1→2 — Smaterializzazione B&N → colore (4.0s → 6.0s)

| Campo | Valore |
|-------|--------|
| Style | iris wipe radiale dal portico del teatro: cerchio colore esplode verso fuori in 1.6s (40 frame), grading caldo rampa in 0.4s |
| Motion | Push-in slow: T1 scalato 100→118% su 48 frame (lungo asse Z simulato), offset centro verso portico (focus architettura) |
| Transizione tecniche | Color bleed-in frame 88→128 (40f): overlay "color grade caldo" via cross-fade alfa 0→1, desaturazione -100%→-20%, temperatura +800K, contrasto +5% |
| Timeline UI | Inizia a comparire al frame 100 (4.2s) in basso al centro: barra orizzontale 720px larghezza, 4px altezza, fill seppia→oro Sposi #c4956a, progesso 0%→100% in 10s, resta fino al payoff |
| Caption | "Palermo · 1889" fade out frame 96→112 (16f, 670ms) |

**Frame count:** 96 → 143 (48 frame, 2s @ 24fps)

---

### Piano 3 — Colore pieno, Ferrari Purosangue sx→dx (6.0s → 9.0s)

| Campo | Valore |
|-------|--------|
| Source | F2 (principale) — se aspect non perfetto, croppato/reframed 16:9. Studio alternative F1/F3 intermedie se serve taglio |
| Trattamento colore | Grading caldo: temperatura +600K, saturazione +12%, lift ombre 4% per dettaglio, contoured highlights su carrozzeria |
| Motion | Camera fissa o micro-dolly (1% pan sx→dx in 72f); subject Ferrari entra da sinistra esce da destra (loop-friendly: la Ferrari deve GIA essere in quadro al frame 144) |
| Caption | "Palermo · Oggi" top-left, stesso stile di Piano 1 ma colore bianco puro #ffffff, 36pt |
| Watermark brand | top-right filigrana 60% |
| Timeline UI | Avanza 0%→70% sui 72 frame |
| Audio | Silenzio |

**Frame count:** 144 → 215 (72 frame, 3s @ 24fps)

---

### Reveal — Logo Sposi.live scivola al centro (9.0s → 11.0s)

| Campo | Valore |
|-------|--------|
| Visual | Shot F2 sfuma a nero "soft" in 24f (1s), audio silenzio |
| Logo motion | Logo Sposi.live filigrana in top-right (200px wrasth 0%→100% held) start reduction positionトップ-right → ciccia al centro in 0.8s via ease-out-quartic (esempio `t'=1-(1-t)^4`), valore scale 0.5x (small) → 2.5x (center) |
| Easing | Posizione: ease-out quartico 0.8s → fermo 0.2s center hold |
| Opacità | 60% → 100% in 12 frame (0.5s) |
| Background | Nero #000 mantenuto |
| Timeline UI | Avanza 70%→100% in 24f, si stabilizza al 100% (logo centro frame) |
| Audio | Silenzio assoluto |

**Frame count:** 216 → 263 (48 frame, 2s @ 24fps)

---

### Payoff — Claim testuale + loop (11.0s → 14.0s)

| Campo | Valore |
|-------|--------|
| Visual | Nero pieno. Logo Sposi.live resta fermo al centro alto (45% from top, 30% of height), sotto appare il claim |
| Claim text | "L'amore non è mai passato di moda." \[a capo\] "Il modo di raccontarlo, sì." |
| Claim font | Playfair Display Italic 400, kerning +0.02em, 56pt @ 1920×1080, colore #ffffff |
| Claim motion | fade-in 0→100% in 18f (0.75s), hold 35f (1.5s), fade-out 100→0 in 12f (0.5s) |
| Sotto claim | Sotto il testo, minuscolo: `sposi.live` in Inter 500, 24pt, opacità 70%, fade-in+fade-out sync con claim |
| Loop closure | Il fade-out del claim coincide con il fade-in del first frame di Piano 1 (ricomincia col Teatro seppia). Crossfade 4 frame al nero totale garantisce seam non visibile. |

**Frame count:** 264 → 335 (72 frame, 3s @ 24fps)

---

## Tabella timeline master (24fps)

| Sec | Frame | Piano | Colore | Caption | Brand | Timeline UI |
|-----|-------|-------|--------|---------|-------|-------------|
| 0.0 | 0 | P1 Teatro | Seppia + grain + vignette | "Palermo · 1889" | Filigrana TR 60% | — |
| 4.0 | 96 | T1→2 | Iris wipe + push-in | Caption fade out | Filigrana TR | Inizia barra |
| 6.0 | 144 | P3 Ferrari | Colore pieno | "Palermo · Oggi" | Filigrana TR 60% | 0→70% |
| 9.0 | 216 | Reveal | Soft fade nero | — | Logo scende centro, 60→100% | 70→100% |
| 11.0 | 264 | Payoff | Nero + logo | Claim fade in hold out | Centro-alto fermo | 100% held |
| 14.0 | 335 | == loop== | crossfade → P1 | "Palermo · 1889" | Filigrana TR | Reset |

---

## Pipeline ComfyUI end-to-end (generazione assistita AI)

Vedi `WORKFLOW_comfyui.md` per il JSON importabile. Sintesi:

### Stage 1 — Upscale sorgenti
- **Nodo Real-ESRGAN 4x** su T1 → 3200×2124 (o SwinIR se serve low artifacts su architettura)
- **Nodo Chop Image** per crop 16:9 da 3:2 (centrato, 3200→2832×1593)
- F1-F4 stesso upscale a ~3840×2160 (4K)

### Stage 2 — Piano 1 seppia
Nodi:
1. `Load Image` (T1 upscaled)
2. `Color Correct` → saturation 0.05, hue +18°, gamma 0.95
3. `Vignette` → 40% strength, feather 0.5, aspect 1.5
4. `Film Grain` → 8% amount, ochre tint, animated via frame index (% 4 == 0 boosted)
5. `Brightness Contrast` keyframed 100%→100.4% su 96 frame
6. `Save Video Frame Range` → `/out/p1_seppia_%04d.png`

### Stage 3 — Transizione 1→2 (iris wipe)
Nodo `VFI_Animatediff` con:
- **start:** frame 96, end frame 143
- Frame 96-128: cerchio colore cresce, grading interpolated
- Frame 128-143: grading caldo completo, push-in active (scale 100→118%)
- Cross-fade overlay T1 → T1-colored

### Stage 4 — Piano 3 Ferrari
1. `Load Image` F2;
2. `Color Match` reference automotive ad stock (es. Boseman Toyota Urban tone)
3. `Differential Motion`: micro-pan 1% sx→dx lineare 72f
4. Headlight motion: daughteriness se l'auto statica, animare una "mask shape" che simulate l'headlight trail via `Image With Alpha Composite` layer
5. Cache out PNG sequence con alpha separato per Ferrari
6. Background compositing via `Image Composite Masked` con F3/F4 come bg alternate / preliminary calibrations

### Stage 5 — Reveal logo motion
1. `Load Image` logo Sposi (PNG alpha)
2. Posizione keyframed: TR → center interpolato su 20 frame (0.83s @ 24fps) → **easing quartico ease-out**: `eased_t = 1 - (1 - t)^4` con t normalizzato 0→1
3. Scale: 0.5x → 2.5x lineare 20f
4. Opacità: 60→100% lineare 12f, hold 8f
5. Background nero composato via `Image Composite` con source F2 sfumato

### Stage 6 — Payoff testuale
1. `Text Render` Playfair Display Italic, due righe.
2. `Opacity Keyframe` fade in 18f, hold 35f, out 12f
3. `Save Video Frame Range` → `/out/payoff_%04d.png`

### Stage 7 — Encoding finale
- **ComfyUI VAE Encode + Video Writer** o sequenza PNG → ffmpeg
- **ffmpeg command (orchestratore post):**

```bash
# Frame sequence → MP4 H.264
ffmpeg -framerate 24 -i out/frame_%04d.png -c:v libx264 \
  -profile:v high -level 4.0 -pix_fmt yuv420p -crf 18 -preset slow \
  -movflags +faststart -vf "scale=1920:1080,format=yuv420p" \
  -an sposi_da-un-si-all-altro.mp4

# Frame sequence → WebM VP9 (per autoplay cross-browser)
ffmpeg -framerate 24 -i out/frame_%04d.png -c:v libvpx-vp9 \
  -b:v 2M -maxrate 3M -bufsize 6M -row-mt 1 -tile-columns 2 \
  -an -loop 0 sposi_da-un-si-all-altro.webm

# Loop crossfade (no seam): tagliare ultimi 4 frame e ersten head, crossfade ffmpeg filter
# Alternativa: generare 15s e tagliare a 14s lasciando il frame finale identico al primo.
```

### Stage 8 — HTML embed su homepage

```html
<video
  autoplay
  muted
  loop
  playsinline
  preload="auto"
  poster="/marketing/hero/da-un-si-poster.jpg"
  class="w-full h-full object-cover"
>
  <source src="/marketing/hero/da-un-si-all-altro.webm" type="video/webm" />
  <source src="/marketing/hero/da-un-si-all-altro.mp4" type="video/mp4" />
</video>
```

**Note:**
- No GIF: dimensioni 5×, qualità menore, no alpha channel per overlay testuale.
- MP4 prima WebM poi: in ordine inverso alcuni browser (Safari old) possono pickare MP4 solo se è il primo `<source>`. Mobile-friendly questo ordine.
- `preload="auto"` assicura frame 0 subito (autoplay muted fallisce senza user gesture track, muted risolve).
- `playsinline`: iOS.10+ playback inline senza fullscreen.

---

## Output finali da produrre

| File | Path target | Note |
|------|------------|------|
| MP4 H.264 1080p | `apps/web/public/marketing/hero/da-un-si-all-altro.mp4` | Master, 3-6 MB target |
| WebM VP9 1080p | `apps/web/public/marketing/hero/da-un-si-all-altro.webm` | Compatibilità browser, 2-4 MB |
| Poster JGP 1080p | `apps/web/public/marketing/hero/da-un-si-poster.jpg` | Frame 0 pronto al play |
| Shot-list + questo documento | `docs/video/SHOT-LIST_da-un-si-all-altro.md` | Sorgente di verità |
| Workflow ComfyUI JSON | `docs/video/WORKFLOW_comfyui.md` | Importabile |
| Sequenza PNG (debug) | `out/frame_%04d.png` | Per QA frame-by-frame |

---

## Note di regia

1. **Filigrana discreta-costante**: il brand "sfarza" il marchio fin da frame 0 in angolo: il giocatore occhio lo nota al reveal. Non insistere con pulsazione/blink — scoccia, scazza l'eleganza.
2. **Caption posizionamento**: top-left per cultura italiana (abituata a sottotitoli angolo alto nei cinema)
3. **Loop quality**: il frame 335 deve essere ~ simile al frame 0 con fade al nero al centro, altrimenti il seam salta. Crossfade 4 frame tra 335 e 96 del pneumonio successivo.
4. **Color palette coerente col sito**: seppia #b09060 → oro Sposi #c4956a → nero pay-off. Tutto scratched within brand.
5. **Tweaks cinematografici possibili**: lens flare 0.05 each headlight (frame F2 highlight), 35mm film stock emulation in Plane 1 (LUT Bleach Bypass però osare non serve).
6. **Subtitles/Captions hard burned**: i caption "Palermo · 1889" / "Palermo · Oggi" sono hard burn nella immagine (no SRT separato), più facile deployment web.
7. **No music scoring**: per video autoplay mutato, audio spreca bandwidth e non serve ai fini del loopHomepage. Se in futuro vorrai un variant sonato (TV/stand fiero mix), registrare stem separato e masterare audio.
8. **5second rule**: autoplay loop accade nei 5 sec critical. Piano 1 deve GIA mostrare il Teatro dal frame 0. No fade in dal nero all'inizio (seam).

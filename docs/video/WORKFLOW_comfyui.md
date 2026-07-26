# ComfyUI Workflow — "Da un sì all'altro" (14")

Questo documento **non** è il JSON ComfyUI finale (i nodi scipy-specific cambiano di versione in
versione), ma è la specifica nodi-by-nodi con valori esatti per poterlo ricreare manualmente o
via AI (es. prompt a `comfyworkflows.com`, `gallery.civitai.com` o a un agente Claude memset).

Per importarlo:
1. Apri ComfyUI (localhost:8188)
2. Workflow → New → trascina i nodi sotto, oppure usa il commando "Search node" con il nome
   dato nel paragrafo "Nomi nodo" di ciascuno step.
3. Salva il workflow `.json` in `docs/video/workflow_comfyui.json` (da PR futura).

Alternativa: importare il `AnimateDiff-ifyWan21` template ufficiale e customizzare.

---

## Setup globale

```
Graph ID: sposi_da_un_si_all_altro_v1
Frame rate: 24
Length: 336 frame (14s)
Resolution: 1920x1080 (16:9)
VAE: sdxl-vae-fp16-fix
Scheduler: karras
Sampler: dpmpp_2m
CFG: 7.5
Steps per frame: 20 (non-default 30 → 24fps cinematic approved, save 30% render time)
Seed: 12345 (fixed per prod consistency)
```

---

## Gruppo 1 — Upscale sorgenti Teatro + Ferrari

**Node: LoadImage** (×6)
- Paths:
  - `FOTO AGO/foto animazione/teatro massimo centrale.jpg`
  - `FOTO AGO/foto animazione/teatro massimo laterale.jpg`
  - `FOTO AGO/foto animazione/ferrari purosangue 1.webp`
  - `FOTO AGO/foto animazione/ferrari purosangue 2.webp`
  - `FOTO AGO/foto animazione/ferrari purosangue 3.webp`
  - `FOTO AGO/foto animazione/ferrari purosangue 4.webp`

**Node: ImageUpscale (Real-ESRGAN x4plus)** — chain su T1, F1, F2, F3, F4
- model: `RealESRGAN_x4plus.pth`
- tile: 512
- upscale: 4
- output: 3200×2124 (T1), ~3840×2160 (F1-F4)

**Node: ChopImage / ImageCrop** (per T1 → 16:9)
- top: 0, left: 184, right: 184 (centro 16:9 da 3:2 → 2832×1593)
- output: 2832×1593 (T1_cropped), poi downscale a 1920×1080 via Lanczos bilinear

**Node: SaveImage** — cache intermediate
- path: `/workspace/scope_cache/T1_up.png`, `/F1_up.png` ecc.

---

## Gruppo 2 — Piano 1: Teatro seppia (frame 0-95, 96f)

**Node: LoadImage** source = T1_cropped_1920

**Node: ColorMatch**
- source: T1_cropped
- target: `ref/teatro_seppia_ref.jpg` (provide, codifica tono seppia)
- method: mkm

**Node: HueSaturation**
- hue: 18°
- saturation: 0.08 (was quasi-mono)
- lightness: -2%

**Node: Brightness/Contrast**
- brightness: -4
- contrast: 6
- (animated via batched keyframe at 0f, 48f, 95f → returns to subtle breathing)

**Node: Vignette**
- strength: 0.35
- feather: 0.5
- aspect: 1.5

**Node: FilmGrain**
- intensity: 0.08
- color: ochre #b89968
- animated: yes — pattern ogni 4 frame intake (frame % 4 == 0 → boost 1.5x)

**Node: TextRender** (hard burn caption top-left)
- text: "Palermo · 1889"
- font: BodoniModa-Italic.ttf (procurare, fallback PlayfairDisplay-Italic.ttf)
- size: 36pt @ 1920×1080
- position: x=48, y=48
- color: #d8c09a
- alpha: 80%

**Node: ImageComposite** — composita T1_seppia + caption + brand watermark:
- T1_seppia × caption → base_with_cap
- base_with_cap × brand_logo_filigrana (200w top-right @ 60%)
- = `P1_seppia_with_wm`

**Node: SaveVideoFrameRange**
- pattern: `/out/p1_seppia_%04d.png`
- frame range: 0 → 95

---

## Gruppo 3 — Transizione P1→P2 (frame 96-143, 48f)

**Strategy: animated keyframe via AnimateDiff**
- batched frame embedding: 48 frames
- base model: SDXL realisticvision v6 + LoRA "film-iris-wipe" (provide su civitai "Film Transition LoRA")

**Node: LoadImagesBatch** — [T1_cropped, T1_cropped_colored] (48 frames blend)

**Node: ColorMatchBatched**
- frame 96: 100% seppia T1
- frame 112: 70% seppia / 30% warm grade
- frame 128: 30% seppia / 70% warm grade
- frame 143: 100% warm grade

**Node: IrisWipeMask** (custom via python node o `Mask Circular Grow`)
- center: (960, 540) (centro 1920×1080)
- radius_start: 0 → 2500 frame 96→128 (esponential ease)
- radius_end: fullscreen att frame 128
- feather: 80px

**Node: ImageScaleAnimated** (push-in slow)
- scale: 100% → 118% lineare 48f
- crop center: (960, 500)

**Composite final**: iris_wipe_mask * (colored_T1) + (1 - mask) * (seppia_T1)
→ `transition_1_2`

**Save**: `/out/trans12_%04d.png` (frame 96-143)

---

## Gruppo 4 — Piano 3 Ferrari (frame 144-215, 72f)

**Node: LoadImage** source = F2_cropped

**Node: ColorMatch** to automotive-golden-hour.preset
- temperature: +600K
- saturation: +12%

**Node: ImagePanAnimated** (micro-dolly)
- pan_x: 0 → +24 px over 72 frame
- pan_y: 0
- interpolation: linear

**Node: HeadlightGlowEnhance** (custom image processing via `ImageFilterMask` + Blend)
- mask via `ColorRange` per i fari (HL bianco/azzurro RGB 200-255 range)
- glow enlarge 2px feather via `Blur` warm overlay
- alpha: 70%

**Node: TextRender** (caption top-left)
- text: "Palermo · Oggi"
- font: BodoniModa-Regular.ttf (fallback PlayfairDisplay-Regular.ttf)
- size: 36pt
- position: x=48, y=48
- color: #ffffff
- alpha: 95%

**Node: ImageComposite** — F2_grading + caption + watermark brand (top-right 60%)

**Save**: `/out/p3_ferrari_%04d.png` (frame 144-215)

---

## Gruppo 5 — Timeline UI element (frame 96-335)

**Node: RectangleMask** (animated width)
- center: (960, 1020)
- height: 4 px
- width: frame (96-n) → 0 a 720 pixels
- progresso: frame 96 (0%) → 264 (100%) → held 264-335

**Color**: seppia #b09060 frame 96→128 → fade a #c4956a (oro Sposi) frame 128→end

**Node: ImageComposite** — overlay su qualsiasi dei frame product

---

## Gruppo 6 — Reveal logo (frame 216-263, 48f)

**Node: LoadImage** `logo-sposi-trans.png` (PNG con alpha)
- pre-scale a 200px larghezza per TR position

**Node: PositionKeyframeAnimated**
- frame 216: pos (1720, 80) [top-right], scale 200px, opacity 60%
- frame 236: pos (960, 350) [center], scale 480px, opacity 80% [end animation, 20f @ 24fps = 0.83s]
- Easing: ease-out quartico → in Python:
  ```python
  def ease_out_quart(t):
      return 1 - (1 - t) ** 4
  ```
  applicable to both position and scale interpolation
- frame 248: pos (960, 350) [center], scale 480px, opacity 100% [rampa 12f = 0.5s]
- frame 263: same (hold)

**Node: BlackBackgroundSource** — fill 1920×1080 #000000

**Node: ImageCompositeWithAlpha** — nero base + logo reveal

**Save**: `/out/reveal_%04d.png` (frame 216-263)

---

## Gruppo 7 — Payoff (frame 264-335, 72f)

**Node: BlackBackgroundSource** 1920×1080 #000000

**Node: LoadImage** `logo-sposi-trans.png` (centro-alto, 320px wide, 100% opacity)

**Node: TextRender** (claim, due righe, fade-in/out)
- text line 1: "L'amore non è mai passato di moda."
- text line 2: "Il modo di raccontarlo, sì."
- font: PlayfairDisplay-Italic.ttf (already self-hosted in globals.css)
- size: 56pt
- position: center x=960, y=720 [top of claim baseline]
- color: #ffffff
- opacity keyframe:
  - frame 264: 0%
  - frame 282: 100% (fade-in 18f = 0.75s)
  - frame 317: 100% (hold 35f = 1.5s)
  - frame 329: 0% (fade-out 12f = 0.5s)
  - frame 335: 0% (last frame for seam)

**Node: TextRender** (sotto-claim `sposi.live`)
- font: Inter-Medium.ttf
- size: 24pt
- color: #ffffff
- opacity: 70% (tied to claim opacity keyframe)

**Save**: `/out/payoff_%04d.png` (frame 264-335)

---

## Gruppo 8 — Composite finale + output

**Node: ImageSequenceConcat**
- inputs in order:
  1. `p1_seppia_%04d.png` (0-95)
  2. `trans12_%04d.png` (96-143)
  3. `p3_ferrari_%04d.png` (144-215)
  4. `reveal_%04d.png` (216-263)
  5. `payoff_%04d.png` (264-335)
- output: 336 frames continui

**Node: VideoWriter (ffmpeg):**
```
-f图像2 -framerate 24 -i /out/composite_%04d.png
-c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -crf 18 -preset slow
-movflags +faststart
-vf "scale=1920:1080,format=yuv420p"
-an
y /out/sposi_da-un-si-all-altro.mp4
```

**Node: VideoWriter (WebM):**
```
-f图像2 -framerate 24 -i /out/composite_%04d.png
-c:v libvpx-vp9 -b:v 2M -maxrate 3M -bufsize 6M -row-mt 1 -tile-columns 2
-loop 0
-an
y /out/sposi_da-un-si-all-altro.webm
```

**Loop crossfade polish** — opzionale step successivo:
- Prendere ultimi 4 frame (332-335) + primi 4 frame del prossimo loop (0-3 di P1)
- Crossfade 50-50 via `ImageBlend` mode average
- Re-render il video finale con questa sequenza "stitched" (len 332 + 4 = ancora 336 frame, ma frame 0 del loop è crossfade del frame 335 prev, seam invisibile)

---

## Alternativa: Wan2.2 (per chi non ha ComfyUI custom)

Wan2.2 di Alibaba è un text-to-video model con controllo shot limitato ma sufficente per clip 4-6s.
Per "Da un sì all'altro" serve **comporre 3-4 clip di 4-6s** generati Wan2.2 + montaggio ffmpeg.

### Prompt per Wan2.2 — segmento 1 (Piano 1+2, 0-6s)

```
Cinematic historical establishing shot of Teatro Massimo opera house in Palermo
circa 1889, sepia tone, soft vignette, subtle film grain, slight breathing
camera motion, drone's-eye perspective, ornate baroque facade, sky bright
ochre dusk, late 19th century horse-drawn carriages parked outside, smokestack
atmosphere. Slow push-in on the portico. Transitions in last 2 seconds to
modern color grade with warm golden hour light. Style: 35mm film stock, LUT
bleach bypass.
```

### Prompt per Wan2.2 — segmento 2 (Piano 3, 6-9s)

```
Modern cinematic Palermo street shot, golden hour, Ferrari Purosangue
enters from left of frame, headlights on, drives across the street exiting
right, same Teatro Massimo facade visible in deep background. Camera fixed,
slight gentle right-pan following the car. Warm grading 5800K, +12%
saturation, lifted shadows for detail in car body. Style: modern automotive
commercial, 24mm lens.
```

### Prompt per Wan2.2 — segmento 3 (Reveal + Payoff, 9-14s)

```
Pure black background, slow fade from a small watermark logo in top-right
corner into a large centered logo of a wedding platform brand, elegant
serif lettering. Holds for the rest of the clip. Then text "L'amore non è
mai passato di moda. Il modo di raccontarlo, sì." fades in centered below
the logo in elegant italic serif. White text on black. No audio.
Cinematic, minimal, brand reveal.
```

**Note Wan2.2:**
- Durationi max 4-6s per shot. Segment 3 va splittato in 2 (reveal 2s + payoff 3s) e stitched.
- Driver "I2V" (image-to-video) è più fedele al brand rispetto a "T2V": alimentare T1_cropped per seg 1, F2 cropped per seg 2, per reveal una base nera + logo pre-rendered via ImageMagick esportato PNG.
- AnimateDiff Compatibility: Wan2.2 ha schede native ComfyUI (video-to-video workflows) disponibili su `comfyworkflows.com/q/wan21`.

---

## DRenny template: prompt summary per il videomaker motion designer

Se una persona (non AI) deve curare l'animazione in After Effects o DaVinci
Resolve, lo shot-list del Markdown principale + questo pagina di prompt Wan2.2
sono autosufficienti. Il compositing finale può essere fatto in NLE classico
senza ComfyUI.

**Tools alternativi validi, non-AI, più rapidi:**
- Adobe After Effects + plugin Twitch/Trapcode: 2-3h prod
- DaVinci Resolve Fusion page + bulbs seppia LUT: stessa durata
- Runway Gen-3 + CapCut desktop per edit: AI-assisted moderno

La frazione di tempo è simile, la differenza è il costo (AE ~$30/mo, DR free)
rispetto a Runway ($95/mo) o ComfyUI self-hosted (GPU rental $0.5/h × 14s clip ≈
$0.20最终, cheapest).

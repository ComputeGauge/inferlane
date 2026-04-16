# InferLane demo video — script + recording instructions

**Goal:** 30-second video that makes a developer watching on HN, Twitter, or the landing page say *"wait, what?"* within the first 10 seconds. Becomes the hero video on `inferlane.dev` + the embed on the Show HN post + the gif in the blog post.

**Format:** 30 seconds, 1080p screen recording, no voice-over (most devs watch muted). Captions only.

---

## What you need

1. A Mac (macOS ≥ 13) — QuickTime Player or `Cmd+Shift+5` recorder
2. Terminal with large font (18pt+) — commenters have to read it on mobile
3. Claude Code open in one window
4. The InferLane plugin already installed (we did this earlier)
5. Ollama + Gemma 4 already pulled locally
6. The blog post + benchmark data already public (so the "save 73%" claim isn't vapor)
7. ~5 minutes of practice runs before recording the take you'll publish

---

## The 30-second script

### Scene 1 — The pain (0:00 - 0:05)

**What to show:**
A terminal window. At the top: `$ claude code` running. A task is mid-stream. In the corner, a small overlay or caption:

```
[caption] Claude Sonnet 4 → $0.23 per task
```

**What to do:** Run a simple extraction task — e.g. "extract all URLs from this markdown file" — with default Claude Code. Let it complete. The cost ($0.23 or whatever) flashes on screen.

---

### Scene 2 — The reveal (0:05 - 0:10)

**What to show:**
Fade the word "WAIT" across the screen for 1 second, then reveal the same task running through InferLane with Gemma 4 local.

**Caption:**
```
Same task. Same output. $0.00.
```

**What to do:** Run the identical extraction task but with InferLane's local routing enabled. The cost shows $0.00. Output is equivalent (or visibly almost identical). The terminal shows "routed to gemma4 (local)".

---

### Scene 3 — The scale (0:10 - 0:20)

**What to show:**
A screen showing the InferLane dashboard with the fleet session view. Numbers animate:

```
Last 30 days
Without InferLane:  $847.32
With InferLane:     $213.15
Saved:              $634.17  (73%)
```

**Caption:**
```
73% of your tasks don't need Opus.
InferLane knows which ones.
```

(Replace these numbers with your *actual* savings from the benchmark. Don't invent numbers.)

---

### Scene 4 — The install (0:20 - 0:25)

**What to show:**
Terminal with just one command:

```
$ curl -fsSL https://inferlane.dev/install.sh | bash
```

Hit enter. The installer's banner appears, progress ticks through "Detecting platform → Installing Ollama → Pulling Gemma 4 → Smoke test". Speed this up 4× in post so it fits in 5 seconds.

**Caption:**
```
One command. Free. Open source.
```

---

### Scene 5 — The CTA (0:25 - 0:30)

**What to show:**
The InferLane logo (from `public/logo.svg`) + the domain.

**Caption:**
```
inferlane.dev
```

---

## Recording steps (macOS)

### 1. Prep the environment

```bash
# Full brightness, all notifications off
# System Settings → Notifications → Focus → "Do Not Disturb"
# Close everything except: Terminal, Claude Code, browser with inferlane.dev
# Set terminal font: 18pt Menlo or similar
# Clear terminal history: clear && printf '\e[3J'
# Resize terminal to a clean 120×30 window
# Set wallpaper to solid black or the gradient at public/og-image.png
```

### 2. Set up the two terminal windows

- **Left half of screen:** a terminal labeled "STOCK" at the top (via PS1 or tmux status bar)
- **Right half of screen:** a terminal labeled "INFERLANE" at the top
- Both running the same `claude` session or two separate ones
- Both pointed at the same test file (`test-input.md` with a few URLs)

### 3. Record with the macOS screen recorder

```
Cmd + Shift + 5 → "Record Selected Portion" → drag the whole screen → Record
```

Do 5 practice runs. Only keep the 6th. Aim for ≤30 seconds; you can trim later but trimming more than 5s usually means re-shoot.

### 4. Edit

Use **iMovie** (free, comes with macOS) or **DaVinci Resolve** (free, more power). Do these things and nothing else:

- Trim to exactly 30 seconds
- Add the captions from the script as simple white-on-black text overlays, 36pt, bottom third
- Speed up the installer scene 4× (otherwise it's 20+ seconds alone)
- Add a 0.5-second fade in at start, fade out at end
- Export 1080p MP4, H.264, ~8 Mbps — should be under 10 MB for easy sharing

### 5. Generate the GIF version

HN and Reddit posts can't embed MP4 inline. Generate a GIF version for thumbnails:

```bash
# Install ffmpeg if missing
brew install ffmpeg

# Convert (optimized palette for smaller file size)
ffmpeg -i inferlane-demo.mp4 -vf "fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" inferlane-demo.gif

# Target: <5 MB for inline embeds on most platforms
```

### 6. Publish

- Upload MP4 to `public/inferlane-demo.mp4` in the Next.js app
- Upload GIF to `public/inferlane-demo.gif`
- Reference from `src/app/page.tsx` hero:
  ```tsx
  <video autoPlay muted loop playsInline className="w-full rounded-xl">
    <source src="/inferlane-demo.mp4" type="video/mp4" />
  </video>
  ```
- Also upload to YouTube as **Unlisted** (not public) so you have a stable link for Twitter/HN embeds

---

## What NOT to include

- **Voice-over.** Muted views dominate. If you really want voice, record a separate voiced version for YouTube and leave the Twitter/HN one silent.
- **Logos of OpenAI, Google, Anthropic.** Trademark risk, and visually it reads like you're in bed with them. Just names in text is fine.
- **Fake data.** If your actual benchmark savings are 40% not 73%, use 40%. Devs will re-run it and call out the discrepancy.
- **A face.** Nobody cares what you look like in a 30-second dev tool demo. Don't spend time on a founder intro.
- **Music.** Unless you're confident in the edit, music makes it feel like a pitch deck. Silence + captions is cleaner.

---

## Time budget if you're really doing this

| Task | Minutes |
|---|---|
| Env setup (terminals, fonts, notifications off) | 15 |
| Practice runs (5 takes) | 15 |
| Final recording | 5 |
| Trim + captions in iMovie | 20 |
| Speed up installer scene | 5 |
| Export MP4 | 3 |
| Generate GIF | 2 |
| Upload to repo + reference in page.tsx | 10 |
| **Total** | **~75 min** |

Longer than the "1 hour" estimate but honest — if this is the one thing that lands on the HN post or the top of the landing page, 75 minutes is the right investment.

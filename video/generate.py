#!/usr/bin/env python3
"""
Generate a 10-second looping MP4 + GIF telling the InferLane benchmark story.

No screen recording. Every frame is an SVG parameterized on time, rasterized
to PNG via rsvg-convert, then stitched to MP4/GIF with ffmpeg.

Scenes:
  0.0-2.0s  Problem: "$18,136" bill pulses in red on black, tagline fades in
  2.0-5.0s  Benchmark: 5 bars grow from 0 to their final scores
  5.0-7.0s  Reveal: bars settle, winner (Sonnet) highlighted in amber
  7.0-9.0s  Savings: "$18,136 → $4,163" with struck-through old number
  9.0-10.0s Brand + URL + loop hint
"""
import math
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
FRAMES_DIR = HERE / "frames"
FRAMES_DIR.mkdir(exist_ok=True)

WIDTH = 1200
HEIGHT = 630
FPS = 24
DURATION = 10.0
TOTAL_FRAMES = int(DURATION * FPS)


# ─── Easing helpers ──────────────────────────────────────────────────────
def ease_out_cubic(t: float) -> float:
    return 1 - (1 - t) ** 3

def ease_in_out_cubic(t: float) -> float:
    return 4 * t ** 3 if t < 0.5 else 1 - ((-2 * t + 2) ** 3) / 2

def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))

def scene_progress(t: float, start: float, end: float) -> float:
    """0 before start, 1 after end, linear between."""
    if t < start:
        return 0.0
    if t >= end:
        return 1.0
    return (t - start) / (end - start)


# ─── Scene composers ─────────────────────────────────────────────────────

def scene1_problem(t: float) -> str:
    """0.0-2.0s — the bill shocks in"""
    p = scene_progress(t, 0.0, 0.6)  # number fades in
    p2 = scene_progress(t, 0.4, 1.2)  # tagline fades in
    p3 = scene_progress(t, 1.2, 1.8)  # fade out into next scene
    fade_out = 1 - ease_in_out_cubic(p3)

    # Pulse on the big number
    pulse = 1 + 0.02 * math.sin((t - 0.6) * 8) if 0.6 <= t < 1.2 else 1

    return f'''
      <g opacity="{ease_out_cubic(p) * fade_out}">
        <text x="600" y="245" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="16" font-weight="600" fill="#6b7280" letter-spacing="4">
          MY CLAUDE CODE BILL · LAST 90 DAYS
        </text>
      </g>
      <g transform="translate(600 400) scale({pulse}) translate(-600 -400)"
         opacity="{ease_out_cubic(p) * fade_out}">
        <text x="600" y="420" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="180" font-weight="900" fill="#ef4444" letter-spacing="-4">
          $18,136
        </text>
      </g>
      <g opacity="{ease_out_cubic(p2) * fade_out}">
        <text x="600" y="490" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="22" font-weight="500" fill="#9ca3af">
          97% of it on Opus 4. I wanted to know if it was worth it.
        </text>
      </g>
    '''


def scene2_benchmark_bars(t: float) -> str:
    """2.0-5.0s — growing bars, labeled"""
    fade_in = scene_progress(t, 1.8, 2.3)
    grow = ease_out_cubic(scene_progress(t, 2.2, 4.8))
    settle_out = scene_progress(t, 4.8, 5.0)
    fade_out = 1 - settle_out

    # Models and final scores (5-model benchmark)
    models = [
        ("Sonnet 4",    25.6, "#fbbf24", True),   # winner
        ("Haiku 4.5",   25.3, "#60a5fa", False),
        ("Opus 4",      24.5, "#ef4444", False),
        ("Grok 4",      24.2, "#a78bfa", False),
        ("Gemma 2 2B",  12.9, "#34d399", False),
    ]
    max_score = 30.0

    parts = []
    parts.append(f'''
      <g opacity="{fade_in * fade_out}">
        <text x="600" y="85" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="16" font-weight="600" fill="#6b7280" letter-spacing="4">
          I BENCHMARKED 5 MODELS ON 20 REAL CODING TASKS
        </text>
      </g>
    ''')

    bar_top = 140
    bar_h = 52
    bar_gap = 18
    bar_x = 220
    bar_max_w = 760

    for i, (name, score, color, is_winner) in enumerate(models):
        y = bar_top + i * (bar_h + bar_gap)
        w = (score / max_score) * bar_max_w * grow
        pct_text = f"{score:.1f}"

        glow = ''
        if is_winner and grow > 0.8:
            glow_opacity = (grow - 0.8) * 5  # 0→1
            glow = f'''
              <rect x="{bar_x - 6}" y="{y - 6}" width="{w + 12}" height="{bar_h + 12}"
                    rx="10" fill="none" stroke="{color}" stroke-width="3"
                    opacity="{clamp(glow_opacity) * 0.6}"/>
            '''

        parts.append(f'''
          <g opacity="{fade_in * fade_out}">
            <text x="{bar_x - 20}" y="{y + bar_h/2 + 7}" text-anchor="end"
                  font-family="-apple-system, Inter, sans-serif"
                  font-size="22" font-weight="700" fill="#e5e7eb">
              {name}
            </text>
            <rect x="{bar_x}" y="{y}" width="{bar_max_w}" height="{bar_h}"
                  rx="6" fill="#1e1e2e"/>
            <rect x="{bar_x}" y="{y}" width="{w}" height="{bar_h}"
                  rx="6" fill="{color}"/>
            {glow}
            <text x="{bar_x + w + 14}" y="{y + bar_h/2 + 7}" text-anchor="start"
                  font-family="-apple-system, Inter, sans-serif"
                  font-size="20" font-weight="800" fill="{color}"
                  opacity="{clamp((grow - 0.5) * 2)}">
              {pct_text}/30
            </text>
          </g>
        ''')

    return "\n".join(parts)


def scene3_reveal(t: float) -> str:
    """5.0-7.0s — winner callout + cost comparison"""
    fade_in = scene_progress(t, 4.9, 5.4)
    fade_out = 1 - scene_progress(t, 6.6, 7.0)
    opacity = fade_in * fade_out

    # Cost ticker — counts up to each cost value
    tick = ease_out_cubic(scene_progress(t, 5.2, 6.4))

    costs = [
        ("Sonnet 4",    0.23,  "#fbbf24"),
        ("Haiku 4.5",   0.10,  "#60a5fa"),
        ("Opus 4",      1.21,  "#ef4444"),
        ("Grok 4",      1.02,  "#a78bfa"),
    ]

    rows = []
    for i, (name, final_cost, color) in enumerate(costs):
        y = 180 + i * 75
        animated_cost = final_cost * tick
        rows.append(f'''
          <g opacity="{opacity}">
            <text x="280" y="{y}" text-anchor="end"
                  font-family="-apple-system, Inter, sans-serif"
                  font-size="26" font-weight="600" fill="#9ca3af">
              {name}
            </text>
            <text x="320" y="{y}" text-anchor="start"
                  font-family="-apple-system, SF Mono, Menlo, monospace"
                  font-size="44" font-weight="900" fill="{color}">
              ${animated_cost:.2f}
            </text>
          </g>
        ''')

    banner_p = scene_progress(t, 5.6, 6.2)

    return f'''
      <g opacity="{opacity}">
        <text x="600" y="100" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="14" font-weight="600" fill="#6b7280" letter-spacing="4">
          SAME 20 TASKS · BLIND QUALITY GRADING
        </text>
        <text x="600" y="150" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="32" font-weight="800" fill="#ffffff">
          And the cost to run them...
        </text>
      </g>
      {"".join(rows)}
      <g opacity="{ease_out_cubic(banner_p) * opacity}">
        <rect x="340" y="505" width="520" height="54" rx="27"
              fill="rgba(16,185,129,0.1)" stroke="#10b981" stroke-width="2"/>
        <text x="600" y="540" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="22" font-weight="800" fill="#10b981">
          Sonnet won on quality AND cost. Both reasoning models lost.
        </text>
      </g>
    '''


def scene4_savings(t: float) -> str:
    """7.0-9.0s — the big save"""
    fade_in = scene_progress(t, 6.9, 7.3)
    fade_out = 1 - scene_progress(t, 8.7, 9.0)
    opacity = fade_in * fade_out

    arrow_p = ease_in_out_cubic(scene_progress(t, 7.4, 8.2))

    # Old number strikethrough progress
    strike = ease_out_cubic(scene_progress(t, 7.5, 8.0))

    return f'''
      <g opacity="{opacity}">
        <text x="600" y="140" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="16" font-weight="600" fill="#6b7280" letter-spacing="4">
          SAME 90 DAYS · BENCHMARK-BACKED ROUTING
        </text>
      </g>

      <!-- Old bill (strike-through as it recedes) -->
      <g opacity="{opacity * (1 - strike * 0.3)}">
        <text x="340" y="340" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="110" font-weight="900" fill="#6b7280" letter-spacing="-2">
          $18,136
        </text>
        <line x1="{190 + (1 - strike) * 150}" y1="308" x2="490" y2="308"
              stroke="#ef4444" stroke-width="6" opacity="{strike}"/>
      </g>

      <!-- Arrow -->
      <g opacity="{arrow_p * opacity}">
        <path d="M 540 300 L 640 300" stroke="#10b981" stroke-width="5"
              stroke-linecap="round"/>
        <path d="M 620 285 L 640 300 L 620 315" fill="none"
              stroke="#10b981" stroke-width="5"
              stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <!-- New bill -->
      <g opacity="{arrow_p * opacity}">
        <text x="870" y="340" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="120" font-weight="900" fill="#10b981" letter-spacing="-2">
          $4,163
        </text>
      </g>

      <!-- Save banner -->
      <g opacity="{scene_progress(t, 7.9, 8.3) * opacity}">
        <text x="600" y="470" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="32" font-weight="800" fill="#ffffff">
          I saved $13,973 in 90 days.
        </text>
        <text x="600" y="510" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="20" font-weight="500" fill="#9ca3af">
          77% less. Same quality. Free Claude Code plugin.
        </text>
      </g>
    '''


def scene5_brand(t: float) -> str:
    """9.0-10.0s — brand card, loop hint"""
    fade_in = scene_progress(t, 8.9, 9.3)

    return f'''
      <g opacity="{fade_in}">
        <!-- Mark -->
        <rect x="460" y="240" width="80" height="80" rx="18" fill="url(#brandGrad)"/>
        <path d="M 504 260 L 504 285 L 524 297 L 504 309 L 504 334 L 476 297 Z"
              fill="#0a0a0f" stroke="#0a0a0f" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Wordmark -->
        <text x="560" y="305" text-anchor="start"
              font-family="-apple-system, Inter, sans-serif"
              font-size="68" font-weight="900" fill="#ffffff" letter-spacing="-2">
          InferLane
        </text>

        <!-- URL -->
        <text x="600" y="390" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="28" font-weight="600" fill="#fbbf24">
          inferlane.dev
        </text>
        <text x="600" y="430" text-anchor="middle"
              font-family="-apple-system, Inter, sans-serif"
              font-size="16" font-weight="500" fill="#6b7280">
          Free · MIT · github.com/ComputeGauge/inferlane
        </text>
      </g>
    '''


# ─── Frame compositor ────────────────────────────────────────────────────

def render_frame(t: float) -> str:
    """Return a full SVG string for time t in seconds."""
    # Decide which scenes contribute
    parts = []
    if t < 2.2:
        parts.append(scene1_problem(t))
    if 1.8 <= t < 5.2:
        parts.append(scene2_benchmark_bars(t))
    if 4.9 <= t < 7.2:
        parts.append(scene3_reveal(t))
    if 6.9 <= t < 9.2:
        parts.append(scene4_savings(t))
    if 8.9 <= t <= DURATION:
        parts.append(scene5_brand(t))

    # Ambient glows — subtle, always on
    glow_a = f'''
      <circle cx="280" cy="180" r="420" fill="url(#glowA)" opacity="0.15"/>
      <circle cx="920" cy="460" r="420" fill="url(#glowB)" opacity="0.18"/>
    '''

    return f'''<svg width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}"
     xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glowA" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ef4444"/>
      <stop offset="1" stop-color="#ef4444" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="{WIDTH}" height="{HEIGHT}" fill="#0a0a0f"/>
  {glow_a}
  {"".join(parts)}
</svg>'''


def main():
    print(f"Generating {TOTAL_FRAMES} frames ({DURATION}s × {FPS}fps)...")
    for i in range(TOTAL_FRAMES):
        t = i / FPS
        svg = render_frame(t)
        svg_path = FRAMES_DIR / f"f{i:04d}.svg"
        svg_path.write_text(svg)
        if i % 30 == 0:
            print(f"  t={t:.2f}s  frame {i}/{TOTAL_FRAMES}")

    print(f"\nAll SVG frames written to {FRAMES_DIR}")
    print("Next: rasterize with rsvg-convert, then stitch with ffmpeg")


if __name__ == "__main__":
    main()

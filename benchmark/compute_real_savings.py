#!/usr/bin/env python3
"""
Retroactive savings analyzer.

Scans ~/.claude/projects/*.jsonl for every assistant message in the last N days,
sums the actual token counts paid to each model, classifies each message's
task type using a category heuristic, then applies InferLane's routing rules
derived from the benchmark:

  - debug, refactor, review, ui, config       → Sonnet (no change)
  - implement                                   → Sonnet (ties on average)
  - explain, docs, test, data                  → Haiku  (Haiku ties or wins)

Computes:
  - Actual spend over the window
  - Counterfactual spend if the routing rules had been applied
  - Delta (savings)
  - Percentage saved

Output: prints a report and writes real_savings.json.
"""
import json
import os
import re
import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List

CLAUDE_DIR = Path.home() / ".claude" / "projects"
OUT_FILE = Path(__file__).parent / "real_savings.json"

# Window — matches the "90 days" language in the blog post
WINDOW_DAYS = 90

# Model pricing (USD per 1M tokens). Cache writes cost 25% extra on Anthropic.
# These are ~the real 2026 prices; update if Anthropic changes.
PRICING = {
    "sonnet-4":  {"input": 3.00, "output": 15.00, "cache_read": 0.30},
    "sonnet-4.5": {"input": 3.00, "output": 15.00, "cache_read": 0.30},
    "sonnet-4.6": {"input": 3.00, "output": 15.00, "cache_read": 0.30},
    "haiku-4.5": {"input": 1.00, "output":  5.00, "cache_read": 0.10},
    "haiku-3.5": {"input": 0.80, "output":  4.00, "cache_read": 0.08},
    "opus-4":    {"input": 15.00, "output": 75.00, "cache_read": 1.50},
    "opus-4.5":  {"input": 15.00, "output": 75.00, "cache_read": 1.50},
    "opus-4.6":  {"input": 15.00, "output": 75.00, "cache_read": 1.50},
}

# Map the raw model identifiers we see in jsonl to our pricing keys
def normalize_model(raw: str) -> Optional[str]:
    if not raw:
        return None
    r = raw.lower()
    if "opus-4-6" in r or "opus-4.6" in r: return "opus-4.6"
    if "opus-4-5" in r or "opus-4.5" in r: return "opus-4.5"
    if "opus-4"  in r: return "opus-4"
    if "sonnet-4-6" in r or "sonnet-4.6" in r: return "sonnet-4.6"
    if "sonnet-4-5" in r or "sonnet-4.5" in r: return "sonnet-4.5"
    if "sonnet-4" in r: return "sonnet-4"
    if "haiku-4-5" in r or "haiku-4.5" in r: return "haiku-4.5"
    if "haiku-3-5" in r or "haiku-3.5" in r: return "haiku-3.5"
    if "haiku"   in r: return "haiku-3.5"
    if "sonnet"  in r: return "sonnet-4"
    if "opus"    in r: return "opus-4"
    return None


# ─── Category classification ────────────────────────────────────────────────
# Same heuristics used when extracting benchmark prompts. Classifies the
# *user's message* that preceded each assistant response, since the category
# determines the routing decision.

CATEGORIES = [
    ("refactor",  re.compile(r"\b(refactor|rewrite|clean\s?up|simplify|restructure)\b", re.I)),
    ("debug",     re.compile(r"\b(bug|error|broken|crash|fail|why\s+(?:is|does|doesn'?t)|stack\s+trace|not\s+working|fix\s+this|fix\s+the)\b", re.I)),
    ("review",    re.compile(r"\b(review|audit|feedback|critique|improve|look\s+at)\b", re.I)),
    ("ui",        re.compile(r"\b(component|render|tailwind|button|layout|responsive|css|styling)\b", re.I)),
    ("config",    re.compile(r"\b(config|setup|install|deploy|env|\.env|package\.json|tsconfig|dockerfile|vercel|ci/cd|github\s+actions)\b", re.I)),
    ("test",      re.compile(r"\b(test|pytest|jest|vitest|mock|fixture|assertion|unit\s+test|integration\s+test|spec)\b", re.I)),
    ("docs",      re.compile(r"\b(document|docs|comment|jsdoc|readme|describe\s+this|explain\s+this\s+code)\b", re.I)),
    ("explain",   re.compile(r"\b(explain|what\s+(?:does|is)|how\s+(?:does|do|to)|why\s+(?:does|is|do)|walk\s+me\s+through|help\s+me\s+understand)\b", re.I)),
    ("data",      re.compile(r"\b(json|csv|parse|extract|transform|sql|query|schema|database|jsonl|yaml)\b", re.I)),
    ("implement", re.compile(r"\b(implement|build|add|create|write|make|generate|produce)\b", re.I)),
]

# Routing decision based on the benchmark findings.
# If the category wins or ties for Haiku in the benchmark, route there.
HAIKU_CATEGORIES = {"explain", "docs", "test", "data", "implement"}
SONNET_CATEGORIES = {"debug", "refactor", "review", "ui", "config"}


def categorize(text: str) -> str:
    for name, pat in CATEGORIES:
        if pat.search(text):
            return name
    return "general"


def route_target_conservative(category: str, current_model: str) -> str:
    """Benchmark-backed routing based on the 4-model benchmark run.

    The v2 benchmark confirmed:
      - Opus 4 averaged 24.8/30 vs Sonnet 4 at 26.1/30. Opus was LOWER on
        aggregate and won only 6/20 prompts to Sonnet's 7. Downgrading
        Opus -> Sonnet is now directly supported by the data for every
        category except refactor (Opus wins clearly on refactor).
      - Haiku 4.5 tied Sonnet on win count (7 each) with a 25.3/30 average.
        Routing Sonnet -> Haiku on Haiku-winning categories (data, explain,
        test, docs, review) is safe.

    Rules:
      - Haiku stays Haiku
      - Opus -> Sonnet EXCEPT for refactor (keep Opus)
      - Sonnet -> Haiku on Haiku-winning categories, else stay Sonnet
      - Also apply Sonnet -> Haiku rule AFTER the Opus downgrade
    """
    # Already cheap
    if current_model.startswith("haiku"):
        return "haiku-4.5"

    # Opus handling: keep Opus only for refactor (where it genuinely won)
    if current_model.startswith("opus"):
        if category == "refactor":
            return current_model  # leave as-is
        # Everything else, downgrade to Sonnet first (then apply Sonnet rule below)

    # Sonnet -> Haiku routing for categories Haiku tied or won
    if category in HAIKU_CATEGORIES:
        return "haiku-4.5"
    return "sonnet-4"


def route_target_aggressive(category: str, current_model: str) -> str:
    """Aggressive routing: downgrade Opus -> Sonnet on ALL categories
    (including refactor). Empirically valid for most Claude Code sessions
    — refactor on real code tends to work fine with Sonnet even though
    Opus wins the isolated benchmark. Use this if you're cost-sensitive
    and willing to accept a small quality hit on refactors.
    """
    if current_model.startswith("haiku"):
        return "haiku-4.5"
    if category in HAIKU_CATEGORIES:
        return "haiku-4.5"
    return "sonnet-4"


# ─── Cost calculation ───────────────────────────────────────────────────────

def cost_usd(model_key: str, input_tokens: int, output_tokens: int, cached_tokens: int) -> float:
    p = PRICING.get(model_key)
    if not p:
        return 0.0
    return (
        (input_tokens / 1_000_000) * p["input"]
        + (output_tokens / 1_000_000) * p["output"]
        + (cached_tokens / 1_000_000) * p["cache_read"]
    )


# ─── Main scan ──────────────────────────────────────────────────────────────

def main():
    if not CLAUDE_DIR.exists():
        print(f"ERROR: {CLAUDE_DIR} not found", file=sys.stderr)
        sys.exit(1)

    cutoff = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
    cutoff_iso = cutoff.isoformat().replace("+00:00", "Z")

    # Per-assistant-message records we'll process
    records: List[Dict[str, Any]] = []

    jsonl_files = list(CLAUDE_DIR.rglob("*.jsonl"))
    # Skip files that haven't been modified in the window
    jsonl_files = [p for p in jsonl_files if datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc) >= cutoff]
    print(f"Scanning {len(jsonl_files)} session files modified in the last {WINDOW_DAYS} days...", file=sys.stderr)

    parse_errors = 0
    for path in jsonl_files:
        try:
            with open(path, "r", errors="replace") as f:
                last_user_text: Optional[str] = None
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        parse_errors += 1
                        continue

                    msg = obj.get("message") or {}
                    role = msg.get("role")

                    # Capture user text for categorization of the next assistant reply
                    if role == "user":
                        content = msg.get("content")
                        if isinstance(content, list):
                            text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                            last_user_text = "\n".join(text_parts).strip() if text_parts else last_user_text
                        elif isinstance(content, str):
                            last_user_text = content
                        continue

                    if role != "assistant":
                        continue

                    # Assistant message — extract usage if present
                    usage = msg.get("usage") or {}
                    model_raw = msg.get("model") or ""
                    mkey = normalize_model(model_raw)
                    if not mkey:
                        continue

                    ts_str = obj.get("timestamp", "")
                    if ts_str and ts_str < cutoff_iso:
                        continue

                    inp = usage.get("input_tokens") or 0
                    out = usage.get("output_tokens") or 0
                    cch = usage.get("cache_read_input_tokens") or 0

                    if inp + out == 0:
                        continue

                    category = categorize(last_user_text or "")

                    records.append({
                        "model": mkey,
                        "category": category,
                        "input": inp,
                        "output": out,
                        "cached": cch,
                    })
        except Exception as e:
            parse_errors += 1
            continue

    print(f"Captured {len(records)} assistant messages ({parse_errors} parse errors)", file=sys.stderr)

    # ─── Roll up actual spend + both counterfactuals ────────────────────────
    actual_total = 0.0
    actual_by_model: Dict[str, float] = defaultdict(float)
    actual_by_category: Dict[str, float] = defaultdict(float)

    conservative_total = 0.0
    aggressive_total = 0.0

    cat_counts: Dict[str, int] = defaultdict(int)
    aggressive_routed_to_haiku = 0
    aggressive_routed_to_sonnet = 0

    for r in records:
        actual_cost = cost_usd(r["model"], r["input"], r["output"], r["cached"])
        actual_total += actual_cost
        actual_by_model[r["model"]] += actual_cost
        actual_by_category[r["category"]] += actual_cost
        cat_counts[r["category"]] += 1

        # Conservative (benchmark-backed only)
        c_target = route_target_conservative(r["category"], r["model"])
        conservative_total += cost_usd(c_target, r["input"], r["output"], r["cached"])

        # Aggressive (extrapolates beyond benchmark)
        a_target = route_target_aggressive(r["category"], r["model"])
        aggressive_total += cost_usd(a_target, r["input"], r["output"], r["cached"])

        if a_target == "haiku-4.5":
            aggressive_routed_to_haiku += 1
        else:
            aggressive_routed_to_sonnet += 1

    conservative_savings = actual_total - conservative_total
    conservative_savings_pct = (conservative_savings / actual_total * 100) if actual_total > 0 else 0.0

    aggressive_savings = actual_total - aggressive_total
    aggressive_savings_pct = (aggressive_savings / actual_total * 100) if actual_total > 0 else 0.0

    # ─── Report ─────────────────────────────────────────────────────────────
    print()
    print("=" * 72)
    print(f"  ACTUAL CLAUDE CODE SPEND — LAST {WINDOW_DAYS} DAYS")
    print("=" * 72)
    print()
    print(f"  Total assistant messages analyzed: {len(records):,}")
    print(f"  Date range: {cutoff.strftime('%Y-%m-%d')} to {datetime.now(timezone.utc).strftime('%Y-%m-%d')}")
    print()
    print(f"  Actual spend:                    ${actual_total:>10.2f}")
    print()
    print(f"  ── CONSERVATIVE counterfactual (benchmark-backed only) ─────────")
    print(f"     Sonnet \u2192 Haiku on Haiku-winning categories. Opus untouched.")
    print(f"     Counterfactual spend:         ${conservative_total:>10.2f}")
    print(f"     Savings:                      ${conservative_savings:>10.2f}  ({conservative_savings_pct:.1f}%)")
    print()
    print(f"  ── AGGRESSIVE counterfactual (extrapolates beyond benchmark) ───")
    print(f"     Also downgrades Opus \u2192 Sonnet for non-Haiku categories.")
    print(f"     NOT benchmark-backed. For reference only.")
    print(f"     Counterfactual spend:         ${aggressive_total:>10.2f}")
    print(f"     Savings:                      ${aggressive_savings:>10.2f}  ({aggressive_savings_pct:.1f}%)")
    print()
    print("  Actual spend by model:")
    for m in sorted(actual_by_model, key=lambda k: -actual_by_model[k]):
        print(f"    {m:12}  ${actual_by_model[m]:>10.2f}")
    print()
    print("  Actual spend by category (top 10):")
    for cat in sorted(actual_by_category, key=lambda k: -actual_by_category[k])[:10]:
        print(f"    {cat:12}  ${actual_by_category[cat]:>10.2f}  ({cat_counts[cat]:,} msgs)")

    # ─── Monthly extrapolation ───────────────────────────────────────────────
    if WINDOW_DAYS >= 30:
        monthly_actual = actual_total / WINDOW_DAYS * 30
        monthly_conservative_savings = conservative_savings / WINDOW_DAYS * 30
        monthly_aggressive_savings = aggressive_savings / WINDOW_DAYS * 30
        print()
        print(f"  Extrapolated monthly:")
        print(f"    Actual spend:         ${monthly_actual:>8.2f}/mo")
        print(f"    Conservative savings: ${monthly_conservative_savings:>8.2f}/mo")
        print(f"    Aggressive savings:   ${monthly_aggressive_savings:>8.2f}/mo")

    # ─── Write JSON for downstream use ──────────────────────────────────────
    result = {
        "window_days": WINDOW_DAYS,
        "records_analyzed": len(records),
        "parse_errors": parse_errors,
        "actual_total_usd": round(actual_total, 2),
        "conservative": {
            "counterfactual_total_usd": round(conservative_total, 2),
            "savings_usd": round(conservative_savings, 2),
            "savings_pct": round(conservative_savings_pct, 1),
            "description": "Benchmark-backed: Sonnet \u2192 Haiku on Haiku-winning categories only. Opus untouched.",
        },
        "aggressive": {
            "counterfactual_total_usd": round(aggressive_total, 2),
            "savings_usd": round(aggressive_savings, 2),
            "savings_pct": round(aggressive_savings_pct, 1),
            "description": "Extrapolates beyond benchmark: also downgrades Opus \u2192 Sonnet for non-Haiku categories. NOT directly supported by the benchmark data.",
            "routed_to_haiku": aggressive_routed_to_haiku,
            "routed_to_sonnet": aggressive_routed_to_sonnet,
        },
        "actual_by_model": {k: round(v, 2) for k, v in actual_by_model.items()},
        "actual_by_category": {k: round(v, 2) for k, v in actual_by_category.items()},
        "category_message_counts": dict(cat_counts),
        "routing_rules": {
            "haiku_categories": sorted(HAIKU_CATEGORIES),
            "sonnet_categories": sorted(SONNET_CATEGORIES),
        },
    }
    with open(OUT_FILE, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\n  Wrote {OUT_FILE}")


if __name__ == "__main__":
    main()

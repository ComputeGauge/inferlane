#!/usr/bin/env python3
"""
Extract representative user prompts from Claude Code session history.

Scans ~/.claude/projects/*.jsonl, pulls out first-turn user messages
(actual user asks, not assistant replies or tool results), filters for
reasonable length and coding content, and writes a diverse sample to
prompts.json for the benchmark runner.
"""
import json
import os
import re
import random
from pathlib import Path
from collections import defaultdict
from typing import Optional, Dict, List

CLAUDE_DIR = Path.home() / ".claude" / "projects"
TARGET_COUNT = 20
MIN_CHARS = 40       # skip trivial one-liners
MAX_CHARS = 1500     # skip huge context dumps
MIN_WORDS = 8
MAX_FILES = 200      # cap scan time
random.seed(42)

# Category heuristics — rough tagging so we can pick a diverse mix
CATEGORIES = {
    "refactor":   re.compile(r"\b(refactor|rewrite|clean ?up|simplify|restructure)\b", re.I),
    "debug":      re.compile(r"\b(bug|error|broken|crash|fail|why\s+(?:is|does|doesn'?t)|stack trace|not working)\b", re.I),
    "implement":  re.compile(r"\b(implement|build|add|create|write|make)\b", re.I),
    "explain":    re.compile(r"\b(explain|what (?:does|is)|how (?:does|do|to)|why|walk me through)\b", re.I),
    "review":     re.compile(r"\b(review|audit|feedback|critique|improve)\b", re.I),
    "docs":       re.compile(r"\b(document|docs|comment|jsdoc|readme)\b", re.I),
    "config":     re.compile(r"\b(config|setup|install|deploy|env|\.env|package\.json|tsconfig)\b", re.I),
    "data":       re.compile(r"\b(json|csv|parse|extract|transform|sql|query|schema|database)\b", re.I),
    "test":       re.compile(r"\b(test|pytest|jest|vitest|mock|fixture|assertion)\b", re.I),
    "ui":         re.compile(r"\b(component|render|style|css|tailwind|button|layout)\b", re.I),
}

# Skip prompts that are just command approvals or tool chatter
NOISE_PATTERNS = re.compile(
    r"^(y|yes|no|ok|thanks|go|continue|try again|do it|next|done|looks good|run the|"
    r"please continue|<system-|<task-|Caveat:|Stop hook|<command-|Set tool limit|"
    r"<file_|<bash_|<local-command)",
    re.I,
)


def categorize(text: str) -> str:
    matches = [name for name, pat in CATEGORIES.items() if pat.search(text)]
    return matches[0] if matches else "general"


def extract_first_user_prompt(jsonl_path: Path) -> Optional[dict]:
    """Return {'text', 'category', 'file'} for the first real user ask in a session, or None."""
    try:
        # Read only first ~2MB to avoid loading huge files
        with open(jsonl_path, "r", errors="replace") as f:
            for line in f.readlines()[:500]:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                # Claude Code transcript format: user messages are role=user in message.content
                msg = obj.get("message") or {}
                if msg.get("role") != "user":
                    continue

                content = msg.get("content")
                # Content can be a string OR a list of parts
                if isinstance(content, list):
                    text_parts = [p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"]
                    text = "\n".join(text_parts).strip()
                else:
                    text = (content or "").strip()

                if not text:
                    continue
                if NOISE_PATTERNS.match(text):
                    continue
                if len(text) < MIN_CHARS or len(text) > MAX_CHARS:
                    continue
                if len(text.split()) < MIN_WORDS:
                    continue
                # Skip if it's obviously a tool result pasted in
                if text.startswith("{") and text.endswith("}"):
                    continue

                return {
                    "text": text,
                    "category": categorize(text),
                    "source_file": jsonl_path.name,
                }
    except Exception:
        return None
    return None


def main():
    if not CLAUDE_DIR.exists():
        print(f"ERROR: {CLAUDE_DIR} not found")
        return

    print(f"Scanning {CLAUDE_DIR}...")
    jsonl_files = list(CLAUDE_DIR.rglob("*.jsonl"))
    # Prefer recent files — sort by mtime desc
    jsonl_files.sort(key=lambda p: -p.stat().st_mtime)
    jsonl_files = jsonl_files[:MAX_FILES]
    print(f"Scanning {len(jsonl_files)} most recent session files")

    prompts_by_category: Dict[str, List[dict]] = defaultdict(list)
    for path in jsonl_files:
        p = extract_first_user_prompt(path)
        if p:
            prompts_by_category[p["category"]].append(p)

    total = sum(len(v) for v in prompts_by_category.values())
    print(f"Found {total} candidate prompts across {len(prompts_by_category)} categories:")
    for cat, items in sorted(prompts_by_category.items(), key=lambda kv: -len(kv[1])):
        print(f"  {cat:12} {len(items):4}")

    # Pick diverse sample — round-robin through categories
    picked: List[dict] = []
    # Shuffle each category
    for cat in prompts_by_category:
        random.shuffle(prompts_by_category[cat])

    cats = list(prompts_by_category.keys())
    random.shuffle(cats)
    idx = 0
    while len(picked) < TARGET_COUNT and any(prompts_by_category[c] for c in cats):
        cat = cats[idx % len(cats)]
        if prompts_by_category[cat]:
            picked.append(prompts_by_category[cat].pop())
        idx += 1

    # Tag with id
    for i, p in enumerate(picked):
        p["id"] = i + 1

    out_path = Path(__file__).parent / "prompts.json"
    with open(out_path, "w") as f:
        json.dump(picked, f, indent=2)
    print(f"\nWrote {len(picked)} prompts to {out_path}")
    print("\n=== Preview ===")
    for p in picked:
        preview = p["text"][:80].replace("\n", " ")
        print(f"  [{p['id']:2}] [{p['category']:10}] {preview}...")


if __name__ == "__main__":
    main()

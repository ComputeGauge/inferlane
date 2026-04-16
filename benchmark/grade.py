#!/usr/bin/env python3
"""
LLM-as-judge grading of benchmark outputs.

For each prompt, we show the model's output to Claude Sonnet 4 (acting as
judge) along with the original question and a rubric. Sonnet scores each
output on a 1-10 scale for correctness, quality, and completeness, and
picks a winner across models.

We grade Sonnet's own outputs too (self-judging) which is unavoidable
since Sonnet is the best judge we have access to — and we acknowledge
this bias in the blog post. To partially correct for it, we blind the
judge: the model_id is redacted before grading.

Output: grades.json with per-prompt scores + summary stats.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, List, Any

HERE = Path(__file__).parent
PROMPTS_FILE = HERE / "prompts.json"
RESULTS_DIR = HERE / "results"
GRADES_FILE = HERE / "grades.json"

JUDGE_MODEL = "claude-sonnet-4-20250514"
MODEL_IDS = ["opus-4", "sonnet-4", "haiku-4.5", "grok-4", "gemma-2b"]
LETTERS = ["A", "B", "C", "D", "E"]


def build_judge_prompt(prompt: str, category: str, labeled_responses: Dict[str, str]) -> str:
    """Build the judge prompt for N responses labeled by letter."""
    response_blocks = "\n\n".join(
        f"## Response {letter}\n{labeled_responses[letter]}" for letter in sorted(labeled_responses.keys())
    )
    letters = sorted(labeled_responses.keys())
    json_entries = ",\n  ".join(
        f'"{letter}": {{"correctness": 0, "quality": 0, "completeness": 0, "notes": "one sentence"}}'
        for letter in letters
    )
    return f"""You are grading {len(labeled_responses)} AI model responses to the same coding prompt. Your job is to be a fair, rigorous judge.

# Original prompt
{prompt}

# Category
{category}

# Responses to grade (blinded — identified only as Response {"/".join(letters)}, randomized order)

{response_blocks}

# Rubric
Grade each response on three dimensions:

1. **Correctness (0-10)**: Does the code/answer actually work? Does it solve the problem as stated? For debugging prompts, did the model identify the real bug? For implementation prompts, would the code run?
2. **Quality (0-10)**: Is the code idiomatic, well-structured, and maintainable? For explanation prompts, is it accurate and clear?
3. **Completeness (0-10)**: Does it address all parts of the prompt? For test prompts, are enough cases included? For review prompts, are findings ranked as asked?

A response that confidently gives wrong information should score <5 on correctness regardless of how polished it looks.

# Output format — ONLY this JSON, no other text
{{
  {json_entries},
  "winner": "{letters[0]}",
  "winner_reason": "one sentence"
}}"""


def call_judge(prompt_text: str) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    body = json.dumps({
        "model": JUDGE_MODEL,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt_text}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")


def load_prompt_outputs(prompt_id: int) -> Dict[str, Dict[str, Any]]:
    out = {}
    for mid in MODEL_IDS:
        path = RESULTS_DIR / mid / f"prompt_{prompt_id:02d}.json"
        if not path.exists():
            continue
        with open(path) as f:
            out[mid] = json.load(f)
    return out


def extract_json(text: str) -> dict:
    """Judge sometimes wraps JSON in ```json``` fences. Strip them."""
    t = text.strip()
    if t.startswith("```"):
        lines = t.split("\n")
        # Remove first fence line and last fence line if present
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        t = "\n".join(lines)
    return json.loads(t)


def main():
    with open(PROMPTS_FILE) as f:
        prompts = json.load(f)

    # Load existing grades to allow resume
    existing = {}
    if GRADES_FILE.exists():
        with open(GRADES_FILE) as f:
            existing = json.load(f)

    all_grades = existing.copy()

    for prompt in prompts:
        pid = prompt["id"]
        key = f"prompt_{pid:02d}"
        if key in all_grades:
            print(f"[{pid:2}] {prompt['category']:10} cached")
            continue

        outputs = load_prompt_outputs(pid)
        if len(outputs) < len(MODEL_IDS):
            print(f"[{pid:2}] {prompt['category']:10} SKIP — only {len(outputs)} of {len(MODEL_IDS)} models complete")
            continue

        # Randomize order to reduce position bias (fixed seed per prompt for repro)
        import random
        rnd = random.Random(pid * 7919)
        order = MODEL_IDS.copy()
        rnd.shuffle(order)

        # Build judge prompt — blinded letters
        letter_to_model = {LETTERS[i]: order[i] for i in range(len(order))}
        labeled = {
            LETTERS[i]: outputs[order[i]].get("output", "(error / empty)")
            for i in range(len(order))
        }
        judge_prompt = build_judge_prompt(
            prompt=prompt["text"],
            category=prompt["category"],
            labeled_responses=labeled,
        )

        try:
            raw = call_judge(judge_prompt)
            parsed = extract_json(raw)
        except Exception as e:
            print(f"[{pid:2}] {prompt['category']:10} ERROR: {e}")
            all_grades[key] = {"error": str(e)}
            continue

        # Un-blind: map A/B/C back to model IDs
        per_model = {}
        for letter, model_id in letter_to_model.items():
            scores = parsed.get(letter, {})
            per_model[model_id] = {
                "correctness": scores.get("correctness", 0),
                "quality": scores.get("quality", 0),
                "completeness": scores.get("completeness", 0),
                "total": (
                    scores.get("correctness", 0)
                    + scores.get("quality", 0)
                    + scores.get("completeness", 0)
                ),
                "notes": scores.get("notes", ""),
            }

        winner_letter = str(parsed.get("winner", "")).strip().upper()[:1]
        winner_model = letter_to_model.get(winner_letter)
        if not winner_model:
            # Fallback: pick highest total score
            winner_model = max(per_model.items(), key=lambda kv: kv[1]["total"])[0]

        all_grades[key] = {
            "prompt_id": pid,
            "category": prompt["category"],
            "order": order,
            "letter_to_model": letter_to_model,
            "scores": per_model,
            "winner": winner_model,
            "winner_reason": parsed.get("winner_reason", ""),
        }

        # Save incrementally so a crash doesn't lose progress
        with open(GRADES_FILE, "w") as f:
            json.dump(all_grades, f, indent=2)

        winner_score = per_model[winner_model]["total"]
        print(
            f"[{pid:2}] {prompt['category']:10} winner={winner_model} "
            f"({winner_score}/30)  "
            + "  ".join(f"{m}={per_model[m]['total']}" for m in MODEL_IDS)
        )

    # Summary
    print("\n\n=== SUMMARY ===")
    wins = {m: 0 for m in MODEL_IDS}
    avg_scores = {m: {"correctness": 0, "quality": 0, "completeness": 0, "total": 0} for m in MODEL_IDS}
    n = 0
    for key, g in all_grades.items():
        if "error" in g:
            continue
        n += 1
        wins[g["winner"]] = wins.get(g["winner"], 0) + 1
        for m in MODEL_IDS:
            if m in g["scores"]:
                for k in ("correctness", "quality", "completeness", "total"):
                    avg_scores[m][k] += g["scores"][m][k]

    print(f"\nGraded {n} prompts. Wins:")
    for m, w in wins.items():
        print(f"  {m:12} {w} wins ({100*w/max(n,1):.0f}%)")

    print(f"\nAverage scores (out of 10 per dimension, 30 total):")
    for m in MODEL_IDS:
        if n > 0:
            a = avg_scores[m]
            print(
                f"  {m:12} correctness={a['correctness']/n:.1f}  "
                f"quality={a['quality']/n:.1f}  "
                f"completeness={a['completeness']/n:.1f}  "
                f"total={a['total']/n:.1f}/30"
            )


if __name__ == "__main__":
    main()

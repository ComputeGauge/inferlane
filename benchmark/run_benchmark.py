#!/usr/bin/env python3
"""
Run all prompts through all models and save outputs.

Models:
  - anthropic/claude-sonnet-4-20250514  (cloud, paid)
  - anthropic/claude-haiku-4-5-20251001 (cloud, cheap)
  - ollama/gemma4                        (local, free)

DeepSeek is skipped (no API key available). Added later if a key is provided.

Outputs:
  results/{model_id}/prompt_{id}.json  — per-prompt result with tokens, latency, cost
  results/summary.json                 — aggregated totals
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, Optional

HERE = Path(__file__).parent
PROMPTS_FILE = HERE / "prompts.json"
RESULTS_DIR = HERE / "results"
RESULTS_DIR.mkdir(exist_ok=True)

# ─── Pricing (USD per 1M tokens) ─────────────────────────────────────────────
PRICING = {
    "claude-opus-4-20250514":       {"input": 15.00, "output": 75.00},
    "claude-sonnet-4-20250514":     {"input":  3.00, "output": 15.00},
    "claude-haiku-4-5-20251001":    {"input":  1.00, "output":  5.00},
    "ollama/gemma2:2b":             {"input":  0.00, "output":  0.00},
    # Grok 4 pricing per xAI docs as of 2026-04
    # grok-4-0709: $3/M input, $15/M output (same as Sonnet tier pricing)
    "grok-4-0709":                  {"input":  3.00, "output": 15.00},
}

# ─── Model runners ───────────────────────────────────────────────────────────

def run_anthropic(prompt: str, model: str) -> Dict[str, Any]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    body = json.dumps({
        "model": model,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
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
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        raise RuntimeError(f"Anthropic HTTP {e.code}: {err_body[:200]}")
    latency_ms = int((time.time() - t0) * 1000)

    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    usage = data.get("usage", {})
    return {
        "text": text,
        "input_tokens": usage.get("input_tokens", 0),
        "output_tokens": usage.get("output_tokens", 0),
        "latency_ms": latency_ms,
        "stop_reason": data.get("stop_reason"),
    }


def run_xai(prompt: str, model: str) -> Dict[str, Any]:
    """Grok via xAI Chat Completions API (OpenAI-compatible)."""
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise RuntimeError("XAI_API_KEY not set")

    body = json.dumps({
        "model": model,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://api.x.ai/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        raise RuntimeError(f"xAI HTTP {e.code}: {err_body[:200]}")
    latency_ms = int((time.time() - t0) * 1000)

    choices = data.get("choices", [])
    text = choices[0]["message"]["content"] if choices else ""
    usage = data.get("usage", {})
    # Grok-4 is a reasoning model: completion_tokens includes visible output
    # but the billable output often also includes hidden reasoning_tokens.
    # We count reasoning tokens as output so cost reflects the real bill.
    completion_tokens = usage.get("completion_tokens", 0)
    reasoning_tokens = usage.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
    return {
        "text": text,
        "input_tokens": usage.get("prompt_tokens", 0),
        "output_tokens": completion_tokens + reasoning_tokens,
        "latency_ms": latency_ms,
        "stop_reason": choices[0].get("finish_reason") if choices else None,
    }


def run_ollama(prompt: str, model: str) -> Dict[str, Any]:
    body = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"num_predict": 800, "temperature": 0.2},
    }).encode()
    req = urllib.request.Request(
        "http://localhost:11434/api/generate",
        data=body,
        headers={"content-type": "application/json"},
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError as e:
        raise RuntimeError(f"Ollama unreachable: {e}")
    latency_ms = int((time.time() - t0) * 1000)
    return {
        "text": data.get("response", ""),
        "input_tokens": data.get("prompt_eval_count", 0),
        "output_tokens": data.get("eval_count", 0),
        "latency_ms": latency_ms,
        "stop_reason": "stop" if data.get("done") else "unknown",
    }


# ─── Orchestration ───────────────────────────────────────────────────────────

MODELS = [
    {
        "id": "opus-4",
        "label": "Claude Opus 4",
        "provider": "anthropic",
        "api_model": "claude-opus-4-20250514",
        "run": lambda p: run_anthropic(p, "claude-opus-4-20250514"),
    },
    {
        "id": "sonnet-4",
        "label": "Claude Sonnet 4",
        "provider": "anthropic",
        "api_model": "claude-sonnet-4-20250514",
        "run": lambda p: run_anthropic(p, "claude-sonnet-4-20250514"),
    },
    {
        "id": "haiku-4.5",
        "label": "Claude Haiku 4.5",
        "provider": "anthropic",
        "api_model": "claude-haiku-4-5-20251001",
        "run": lambda p: run_anthropic(p, "claude-haiku-4-5-20251001"),
    },
    {
        "id": "grok-4",
        "label": "Grok 4",
        "provider": "xai",
        "api_model": "grok-4-0709",
        "run": lambda p: run_xai(p, "grok-4-0709"),
    },
    {
        "id": "gemma-2b",
        "label": "Gemma 2 2B (local)",
        "provider": "ollama",
        "api_model": "ollama/gemma2:2b",
        "run": lambda p: run_ollama(p, "gemma2:2b"),
    },
]


def cost_usd(api_model: str, input_tokens: int, output_tokens: int) -> float:
    p = PRICING.get(api_model)
    if not p:
        return 0.0
    return input_tokens / 1_000_000 * p["input"] + output_tokens / 1_000_000 * p["output"]


def main():
    with open(PROMPTS_FILE) as f:
        prompts = json.load(f)

    print(f"Loaded {len(prompts)} prompts")
    print(f"Running across {len(MODELS)} models = {len(prompts) * len(MODELS)} total calls\n")

    all_results = []
    for model in MODELS:
        model_dir = RESULTS_DIR / model["id"]
        model_dir.mkdir(exist_ok=True)
        print(f"\n=== {model['label']} ({model['api_model']}) ===")

        for prompt in prompts:
            out_path = model_dir / f"prompt_{prompt['id']:02d}.json"
            if out_path.exists():
                # Resume from previous run
                with open(out_path) as f:
                    result = json.load(f)
                all_results.append(result)
                print(f"  [{prompt['id']:2}] {prompt['category']:10} cached ({result.get('latency_ms', 0)}ms)")
                continue

            try:
                r = model["run"](prompt["text"])
                cost = cost_usd(model["api_model"], r["input_tokens"], r["output_tokens"])
                result = {
                    "prompt_id": prompt["id"],
                    "category": prompt["category"],
                    "model_id": model["id"],
                    "model_label": model["label"],
                    "api_model": model["api_model"],
                    "input_tokens": r["input_tokens"],
                    "output_tokens": r["output_tokens"],
                    "latency_ms": r["latency_ms"],
                    "cost_usd": cost,
                    "stop_reason": r["stop_reason"],
                    "output": r["text"],
                }
                with open(out_path, "w") as f:
                    json.dump(result, f, indent=2)
                all_results.append(result)
                print(
                    f"  [{prompt['id']:2}] {prompt['category']:10} "
                    f"{r['input_tokens']:4}in/{r['output_tokens']:5}out "
                    f"{r['latency_ms']:6}ms  ${cost:.5f}"
                )
            except Exception as e:
                err = {
                    "prompt_id": prompt["id"],
                    "category": prompt["category"],
                    "model_id": model["id"],
                    "error": str(e),
                }
                with open(out_path, "w") as f:
                    json.dump(err, f, indent=2)
                all_results.append(err)
                print(f"  [{prompt['id']:2}] {prompt['category']:10} ERROR: {e}")

    # Summary
    summary: Dict[str, Dict[str, Any]] = {}
    for model in MODELS:
        mid = model["id"]
        rs = [r for r in all_results if r.get("model_id") == mid and "error" not in r]
        summary[mid] = {
            "label": model["label"],
            "api_model": model["api_model"],
            "count": len(rs),
            "total_input_tokens": sum(r["input_tokens"] for r in rs),
            "total_output_tokens": sum(r["output_tokens"] for r in rs),
            "total_cost_usd": sum(r["cost_usd"] for r in rs),
            "avg_latency_ms": sum(r["latency_ms"] for r in rs) / max(len(rs), 1),
            "errors": len([r for r in all_results if r.get("model_id") == mid and "error" in r]),
        }

    with open(RESULTS_DIR / "summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("\n\n=== SUMMARY ===")
    print(f"{'Model':20} {'Count':>6} {'InTok':>10} {'OutTok':>10} {'Cost':>10} {'AvgLat':>10}")
    for mid, s in summary.items():
        print(
            f"{s['label']:20} {s['count']:6} {s['total_input_tokens']:10} "
            f"{s['total_output_tokens']:10} ${s['total_cost_usd']:9.4f} "
            f"{s['avg_latency_ms']:9.0f}ms"
        )


if __name__ == "__main__":
    main()

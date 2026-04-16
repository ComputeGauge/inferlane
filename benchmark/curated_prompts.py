#!/usr/bin/env python3
"""
Curated benchmark prompts — 20 self-contained coding tasks derived from
real work observed in the session history, but rewritten so each prompt
contains all the context needed to answer (no filesystem access required).

This makes them fair for ALL models including local Gemma 4 via Ollama,
which has no tool-use capability. The categories mirror the distribution
we saw in the real session extract.
"""
import json
from pathlib import Path

PROMPTS = [
    # ── implement (35% of real traffic) ────────────────────────────────────
    {
        "id": 1, "category": "implement",
        "text": "Write a TypeScript function `debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void` that returns a debounced version of fn. Multiple rapid calls should collapse into one invocation `delay` ms after the last call. Cover cleanup of stale timers. No external dependencies.",
    },
    {
        "id": 2, "category": "implement",
        "text": "Write a Python function `group_by(items: list, key) -> dict` where `key` can be either a callable or a string attribute/key name. If `key` is a string, support both object attributes and dict keys. Return a dict mapping key values to lists of matching items, preserving input order.",
    },
    {
        "id": 3, "category": "implement",
        "text": "Write a Node.js script that reads a CSV file from stdin, detects the delimiter automatically (comma, tab, or semicolon), parses it respecting quoted fields with embedded commas, and writes the result to stdout as newline-delimited JSON. No npm dependencies — use only built-ins.",
    },
    {
        "id": 4, "category": "implement",
        "text": "Implement a SQL query (PostgreSQL 15) that, given tables `orders(id, customer_id, created_at, total_cents)` and `customers(id, email, created_at)`, returns the top 10 customers by lifetime revenue, including their email, total spent, order count, and days since signup. Exclude customers with fewer than 2 orders. Sort descending by revenue.",
    },

    # ── debug (real pain point — bugs in existing code) ────────────────────
    {
        "id": 5, "category": "debug",
        "text": "This Python function is supposed to return all subsets of a list but silently returns wrong output for empty input. Find the bug and explain why it's subtle:\n\n```python\ndef subsets(nums):\n    result = [[]]\n    for n in nums:\n        for i in range(len(result)):\n            result.append(result[i] + [n])\n    return result\n```",
    },
    {
        "id": 6, "category": "debug",
        "text": "This React component renders twice on every state update, even when the state value doesn't change. Identify the cause and fix it:\n\n```jsx\nfunction Counter({ items }) {\n  const [count, setCount] = useState(0);\n  const doubled = items.map(x => x * 2);\n  return <div onClick={() => setCount(c => c + 1)}>{count} ({doubled.join(',')})</div>;\n}\n```",
    },
    {
        "id": 7, "category": "debug",
        "text": "A Go HTTP handler works in dev but leaks goroutines in production after ~1000 requests. What's the bug?\n\n```go\nfunc handleUpload(w http.ResponseWriter, r *http.Request) {\n    ch := make(chan string)\n    go func() { ch <- processFile(r.Body) }()\n    select {\n    case result := <-ch:\n        fmt.Fprint(w, result)\n    case <-time.After(5 * time.Second):\n        http.Error(w, \"timeout\", 504)\n    }\n}\n```",
    },

    # ── refactor ────────────────────────────────────────────────────────────
    {
        "id": 8, "category": "refactor",
        "text": "Refactor this callback-hell JavaScript to use async/await. Preserve error handling — if any step fails, log the failing step name and rethrow:\n\n```js\nfunction run(cb) {\n  fetchUser(id, (err, user) => {\n    if (err) return cb(err);\n    fetchOrders(user.id, (err, orders) => {\n      if (err) return cb(err);\n      enrichOrders(orders, (err, enriched) => {\n        if (err) return cb(err);\n        cb(null, { user, orders: enriched });\n      });\n    });\n  });\n}\n```",
    },
    {
        "id": 9, "category": "refactor",
        "text": "Simplify this TypeScript type helper without changing its public behavior. Add a short comment explaining what it does.\n\n```ts\ntype DeepPartial<T> = T extends object ? { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] } : T;\n```",
    },

    # ── explain ─────────────────────────────────────────────────────────────
    {
        "id": 10, "category": "explain",
        "text": "Explain in 3 paragraphs, pitched at a mid-level JS developer, what the JavaScript event loop is, the difference between microtasks and macrotasks, and why `await` resumes before `setTimeout(fn, 0)`. Give one concrete output example.",
    },
    {
        "id": 11, "category": "explain",
        "text": "Explain the CAP theorem in the context of choosing between Postgres and DynamoDB for a new payments service. Specifically: if I pick Postgres, which letter am I sacrificing and what does it mean operationally during a network partition?",
    },
    {
        "id": 12, "category": "explain",
        "text": "Why does `array.push(...hugeArray)` crash with 'Maximum call stack size exceeded' in V8 but `array.concat(hugeArray)` doesn't? Explain the implementation difference.",
    },

    # ── review ──────────────────────────────────────────────────────────────
    {
        "id": 13, "category": "review",
        "text": "Review this authentication endpoint for security issues. Rank findings by severity.\n\n```typescript\napp.post('/login', async (req, res) => {\n  const { email, password } = req.body;\n  const user = await db.user.findOne({ email });\n  if (!user) return res.status(401).json({ error: 'Invalid credentials' });\n  if (user.password !== password) {\n    return res.status(401).json({ error: 'Invalid password for ' + email });\n  }\n  const token = jwt.sign({ id: user.id }, 'secret123');\n  res.json({ token, user });\n});\n```",
    },
    {
        "id": 14, "category": "review",
        "text": "Review this Dockerfile for a Node 22 app. Identify issues that would hurt image size, build time, or security.\n\n```dockerfile\nFROM node:latest\nCOPY . /app\nWORKDIR /app\nRUN npm install\nRUN npm run build\nEXPOSE 3000\nCMD npm start\n```",
    },

    # ── data ────────────────────────────────────────────────────────────────
    {
        "id": 15, "category": "data",
        "text": "Write a regex that matches URLs in Markdown but NOT inside code blocks or inline code. The regex should match `https://example.com` in 'check out https://example.com!' but not in '`wget https://example.com`' or inside a ```fenced``` block. Explain the limits of regex-only solutions here.",
    },
    {
        "id": 16, "category": "data",
        "text": "Given a JSONL file where each line is `{timestamp: ISO8601, user_id: string, event: string, metadata?: object}`, write a Python 3 one-liner (or short block) that prints the top 5 users by number of distinct event types across the last 7 days. Read from sys.stdin. No external libs.",
    },

    # ── test ────────────────────────────────────────────────────────────────
    {
        "id": 17, "category": "test",
        "text": "Write a Jest test suite for a function `formatCurrency(cents: number, currency: string): string` that handles: zero, negative values, values over 1 billion cents, unsupported currency codes (should throw), and floating-point precision (e.g., 1999 cents → '$19.99'). Include at least 6 test cases.",
    },

    # ── config / devops ────────────────────────────────────────────────────
    {
        "id": 18, "category": "config",
        "text": "Write a GitHub Actions workflow that runs on every PR: (1) installs pnpm and Node 22, (2) runs `pnpm install --frozen-lockfile`, (3) runs `pnpm typecheck && pnpm test`, (4) comments on the PR with coverage % if it drops by more than 5% vs main. Use only marketplace actions that are widely trusted.",
    },

    # ── ui ──────────────────────────────────────────────────────────────────
    {
        "id": 19, "category": "ui",
        "text": "Write a React + Tailwind component `<CopyButton text={string} />` that copies `text` to the clipboard on click, shows a checkmark for 1.5 seconds, then reverts. Include ARIA live-region feedback for screen readers. No external state library.",
    },

    # ── docs ────────────────────────────────────────────────────────────────
    {
        "id": 20, "category": "docs",
        "text": "Write a clear JSDoc block for this function including param types, return type, one usage example, and a @throws annotation for the error cases. Infer the behavior from the code:\n\n```js\nfunction parseDuration(str) {\n  const m = /^(\\d+(?:\\.\\d+)?)(ms|s|m|h|d)$/.exec(str.trim());\n  if (!m) throw new Error('Invalid duration: ' + str);\n  const n = parseFloat(m[1]);\n  const u = m[2];\n  const mult = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[u];\n  return Math.round(n * mult);\n}\n```",
    },
]


def main():
    out = Path(__file__).parent / "prompts.json"
    with open(out, "w") as f:
        json.dump(PROMPTS, f, indent=2)
    print(f"Wrote {len(PROMPTS)} curated prompts to {out}")
    cats = {}
    for p in PROMPTS:
        cats[p["category"]] = cats.get(p["category"], 0) + 1
    print("\nCategory distribution:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat:10} {count}")


if __name__ == "__main__":
    main()

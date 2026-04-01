# Show HN Draft -- InferLane

## Title Options (ranked by likely engagement):

1. **Show HN: InferLane -- MCP server that gives AI agents a cost brain (Apache-2.0)**
   _Why #1: "cost brain" is concrete and memorable. "MCP server" signals technical depth. "Apache-2.0" tells HN it's truly open source. 74 chars._

2. **Show HN: InferLane -- Open-source cost intelligence for AI agents via MCP**
   _Why #2: Clear, professional, hits all keywords. 68 chars._

3. **Show HN: I was spending $800/mo on AI APIs blindly, so I built an MCP cost layer**
   _Why #3: Personal pain-point hook. HN loves "I had a problem so I built X." 73 chars._

---

## Post Body

I've been building with Claude Code and Cursor daily. One thing that bugged me: these tools make dozens of API calls per session, and I had zero visibility into what anything cost until the bill showed up.

I tried tracking it in a spreadsheet but that breaks down when agents are calling APIs autonomously -- there's no manual logging step. The MCP protocol gave me a way to solve this: inject cost awareness directly into the agent's tool set.

InferLane is an MCP server (Apache-2.0) that any MCP-compatible agent can call. Setup is one line in your config:

```json
{
  "mcpServers": {
    "inferlane": {
      "command": "npx",
      "args": ["-y", "@inferlane/mcp"]
    }
  }
}
```

No account needed. No telemetry. Runs locally.

**What the agent gets (18 tools):**

- `pick_model` -- Before each sub-task, the agent asks "what should I use?" We score 20+ models across cost, quality, and speed for 14 task types (code review, summarization, translation, etc.). Log-scale normalization handles the 1000x price range between models. This is where most of the savings come from.
- `log_request` + `session_cost` -- Real-time spend tracking per session. The agent knows its running total and can get budget alerts before overshooting.
- Local-to-cloud routing -- Auto-detects Ollama, vLLM, llama.cpp, TGI, and LocalAI endpoints on your network. Routes to cloud only when local quality falls short for the task type.
- Credibility scoring -- A 0-1000 reputation score for agents. Agents earn points for accurate cost reporting and smart routing decisions. More on this below since it's the most experimental part.

**What I'm seeing in practice:** 40-70% cost reduction in my own workflows, almost entirely from `pick_model` routing cheaper models to tasks that don't need the top tier. A code review doesn't need the same model as a complex architecture decision.

**Tech details:** The MCP server is pure Node.js with zero runtime dependencies. The agent decision engine uses log-scale normalization so it can meaningfully compare a $0.25/M-token model against a $75/M-token model. Model quality scores are seeded from benchmark data and updated via a feedback loop (`rate_recommendation`).

There's also a web dashboard ($9/mo) for cross-session analytics, team cost breakdowns, and provider comparisons -- but the open-source server works standalone and that's the thing I'm showing today.

**What I'd genuinely like feedback on:**

1. The credibility scoring -- useful retention mechanism, or over-engineered? The idea is that if agents self-report costs, you need a way to verify honesty. But I go back and forth on whether the complexity is worth it.
2. Does anyone actually run local inference alongside cloud? I built the hybrid routing assuming people do, but I'm not sure how common it is outside my own setup.
3. What's missing? What would make you actually install this?

GitHub: [link]
npm: `npm install -g @inferlane/mcp`
Demo dashboard: [link] (no signup required, uses sample data)

---

## Maker Comment (post immediately after submission)

Hey HN, maker here. Some background on the technical decisions:

I started building this because I was spending $800+/month across Anthropic, OpenAI, and Google AI, and my only cost visibility was checking each provider's billing page manually. When I started using Claude Code and Cursor heavily, the problem got worse -- they make API calls autonomously so there's no point where you consciously decide "I'll use this model for this task."

The MCP protocol turned out to be the right integration point because it lets you give tools to the agent itself, rather than wrapping the API layer. The agent calls `pick_model("code_review", "balanced")` and gets back a recommendation with a cost/quality/speed score. It's not a proxy -- the agent still calls the provider directly. We just give it the information to make a smarter choice.

The most interesting technical challenge was the scoring engine. Model prices span a 1000x range ($0.25/M to $75/M tokens), so naive linear comparison is useless. I use log-scale normalization so the difference between $0.25 and $2.50 gets weighted similarly to $7.50 and $75. Quality scores start from public benchmarks and get refined through a feedback loop -- agents rate whether the recommendation worked for their task, and those ratings improve future suggestions.

The credibility system is the most experimental piece. The thesis is: if you want agents to self-report costs honestly, you need an incentive. Agents that underreport get penalized, accurate reporters build reputation. I'm genuinely not sure if this is useful or if it's solving a problem that doesn't exist yet. Would love opinions.

I should be transparent: I'm a solo developer, this is pre-revenue, and the MCP server is the only shipped piece so far. The dashboard is in development. I'm posting now because I want feedback on the core concept before building more.

Happy to answer questions about the architecture, MCP integration patterns, or anything else.

---

## Pre-Post Checklist

### Must-haves (do not post without these)

- [ ] npm package published and installable (`npx -y @inferlane/mcp` works)
- [ ] GitHub repo public with Apache-2.0 license, README with setup instructions
- [ ] Demo mode live on inferlane.ai (no signup wall -- sample data pre-loaded)
- [ ] Test the one-line install on a clean machine (Mac + Linux at minimum)
- [ ] Verify `pick_model` returns sensible results for at least 5 task types
- [ ] README includes architecture diagram or explanation
- [ ] No broken links in post body

### Should-haves (strongly recommended)

- [ ] 2-3 screenshots ready: dashboard overview, `pick_model` output in terminal, cost savings summary
- [ ] Short (30-60 sec) terminal recording showing install + first `pick_model` call (asciinema or similar)
- [ ] Maker comment drafted and ready to paste within 60 seconds of posting
- [ ] HN account has some karma and comment history (not a brand-new account)
- [ ] Have someone else proofread the post for marketing-speak (remove any that slipped in)

### Timing

- [ ] Post Tuesday-Thursday, 6-8am PT (HN peak engagement window)
- [ ] Block 2-3 hours after posting to respond to comments quickly (critical for ranking)
- [ ] Have laptop ready -- don't post from phone

### After posting

- [ ] Reply to every substantive comment within 30 minutes
- [ ] If asked about open-source plans, link to the repo directly
- [ ] Don't get defensive about criticism -- thank people and ask follow-ups
- [ ] If it gets traction, tweet/post the HN link (not the other way around -- HN dislikes vote brigading)

---

## Response Templates for Likely Questions

### "How does this compare to Helicone / LangSmith?"

Helicone and LangSmith are observability tools -- they show you what happened after the fact. Logs, traces, evaluations. They're good at that.

InferLane is different in that it sits before the API call, not after it. The agent calls `pick_model` and gets a recommendation for which model to use for this specific task. It's prescriptive rather than descriptive. The cost tracking (`log_request`) is there too, but the main value is the routing intelligence.

The other difference is the integration model. Helicone and LangSmith are SDKs or proxies -- you instrument your code. InferLane is an MCP server -- the agent discovers and calls the tools itself. No code changes needed in your application, just a one-line config addition.

They're complementary, honestly. You could use LangSmith for tracing and InferLane for cost-aware model selection in the same workflow.

### "What about pricing / is this really free?"

The MCP server is Apache-2.0, fully open source, runs locally, no account needed. That's the core product and it's free forever -- I'm not going to pull an open-source bait-and-switch.

The web dashboard is $9/mo for individuals and $29/mo for teams. It adds cross-session analytics, team cost breakdowns, budget alerts, and provider comparisons. It's useful if you want to track costs across days/weeks rather than within a single session. But the MCP server works standalone without it.

I'm a solo dev and the dashboard is still in development, so the paid tier isn't available yet. Right now everything is free.

### "Are you planning to open-source more / what's the open-source roadmap?"

Three packages are open source under Apache-2.0:
- `@inferlane/mcp` -- the MCP server (the main thing)
- `@inferlane/cli` -- command-line interface for spend tracking
- `@inferlane/adapters` -- TypeScript adapter interface for adding new providers

The dashboard, API proxy engine, and enterprise features (budget enforcement, compliance) will be commercial. I think this is a fair split -- the tool that runs on your machine is free, the hosted service that aggregates data across a team is paid.

I'd love community contributions on adapters especially. Right now it ships with Anthropic and OpenAI support, but the adapter interface is designed so anyone can add a new provider.

### "What about privacy / where does the data go?"

The MCP server runs entirely locally. Cost data is stored in a local SQLite file on your machine. Nothing phones home, no telemetry, no analytics. You can verify this in the source code -- it's ~2K lines of TypeScript.

If you opt into the web dashboard, session cost summaries are sent to our API for aggregation. We never see your prompts, responses, or API keys. The only data we receive is: model name, token counts, cost, task type, and quality rating. The privacy policy spells this out.

For teams that can't send any data externally, the MCP server + CLI give you full cost intelligence without any network calls to us.

### "Why MCP instead of an SDK or proxy?"

Three reasons:

1. Zero integration effort. Adding an MCP server is a config change, not a code change. No SDK to import, no API calls to wrap. The agent discovers the tools automatically.

2. Agent-native. The agent itself decides when to call `pick_model`. It's not a middleware layer that silently intercepts calls -- the agent is an active participant in cost optimization. This matters because the agent has context about what it's trying to do.

3. Distribution. There are 10K+ MCP servers and 97M+ monthly SDK downloads. MCP is backed by OpenAI, Google, Anthropic, and Microsoft under the Linux Foundation. Building on MCP means we work everywhere MCP works -- Claude Code, Cursor, VS Code, Windsurf, and anything else that adopts the standard.

The tradeoff is that MCP only works with agents that support it. If you're making raw API calls from a Python script, you'd want the adapter library instead.

### "This seems early-stage -- why should I trust it?"

You're right, it is early. I'm a solo developer, the MCP server is the only shipped piece, and the dashboard is still in development. I'm posting on HN specifically because I want feedback on the concept before building more.

The MCP server itself is small (~2K lines), has zero runtime dependencies, and runs locally. Low risk to try -- worst case you uninstall it. The model pricing data is seeded from public sources and I update it manually when providers change pricing. I'm not claiming this is production-grade enterprise software yet.

What I am claiming is that the idea of giving agents cost awareness at the tool level is underexplored, and the early results (40-70% cost reduction from smarter model selection) are worth investigating.

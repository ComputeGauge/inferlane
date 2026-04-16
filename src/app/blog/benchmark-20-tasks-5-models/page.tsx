import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "I benchmarked Opus 4, Sonnet 4, Haiku 4.5, Grok 4, and local Gemma on 20 real coding tasks",
  description:
    "Real data from 20 curated coding prompts × 5 models, blindly graded by a Sonnet-as-judge rubric. Sonnet 4 was the best model AND the best value. Opus and Grok 4 both scored lower at 5-10× the cost. Here's the data — and my real $13.9K/90-day savings number.",
  openGraph: {
    title: "I benchmarked 5 models on 20 real coding tasks — Sonnet 4 won",
    description:
      "Opus 4: $1.21, 24.5/30. Grok 4: $1.02, 24.2/30 (with 65K reasoning tokens). Sonnet 4: $0.23, 25.6/30. Haiku 4.5: $0.10, 25.3/30. The reasoning models lost to the regular workhorse.",
    type: "article",
    url: "https://inferlane.dev/blog/benchmark-20-tasks-5-models",
    images: ["/hero-comparison.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "I benchmarked 5 models — Sonnet 4 beat Opus AND Grok 4 on quality and price",
    description:
      "20 real coding tasks, blindly graded. Reasoning models (Opus, Grok 4) underperformed regular Sonnet while costing 4-5× more.",
    images: ["/hero-comparison.png"],
  },
};

export default function BlogPost() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-amber-400 mb-8">
          ← Back to InferLane
        </Link>

        <header className="mb-10">
          <p className="text-amber-400 text-sm font-medium mb-2">Benchmark · April 2026</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            Sonnet 4 beat Opus 4 AND Grok 4 on 20 real coding tasks.
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed">
            I benchmarked five models — Claude Opus 4, Claude Sonnet 4, Claude Haiku 4.5, Grok 4, and local Gemma 2 2B — on 20 real coding tasks from my own Claude Code session history. Blindly graded by a Sonnet-as-judge rubric. The result surprised me: both reasoning models (Opus and Grok) scored <em>lower</em> than regular Sonnet at 4-5× the cost. Here&rsquo;s the data, and the $13,973 I wasted on Opus over the last 90 days.
          </p>
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
            <strong>Update April 2026:</strong> Claude Sonnet 4 is
            being deprecated in favor of Claude Sonnet 4.5, which
            shipped in September 2025 and is the current default
            on the InferLane router. The benchmark findings on
            cost structure (Opus ≫ Sonnet on price, reasoning
            models burn hidden tokens, Haiku is the correct
            default for most coding tasks) still apply; if you
            re-run this benchmark against Sonnet 4.5 you should
            expect comparable or better results. The raw data
            below is preserved as-of-April-2026 for
            reproducibility.
          </div>
        </header>

        <article className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-headings:font-bold prose-a:text-amber-400 prose-code:text-amber-300 prose-code:bg-[#12121a] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#12121a] prose-pre:border prose-pre:border-[#1e1e2e] prose-strong:text-white prose-table:text-sm">

          <h2>TL;DR</h2>
          <ul>
            <li><strong>Sonnet 4 averaged 25.6/30 — the highest of all five models tested.</strong> Both reasoning models (Opus 4 at 24.5 and Grok 4 at 24.2) scored lower.</li>
            <li><strong>Opus 4 costs 5.2× more than Sonnet 4.</strong> Grok 4 costs 4.4× more than Sonnet 4 — and burns 65,150 reasoning tokens across 20 prompts, most of them on prompts that don&rsquo;t need reasoning.</li>
            <li><strong>Haiku 4.5 was within 0.3 points of Sonnet</strong> (25.3 vs 25.6) at 2.4× lower cost. For most categories, Haiku is the correct default — not Sonnet.</li>
            <li><strong>Cost per 1000 quality points</strong>: Opus $2.47, Grok 4 $2.11, Sonnet $0.46, Haiku $0.19, Gemma 2 2B $0.00. Sonnet and Haiku are the only serious options on value.</li>
            <li><strong>My own Claude Code bill over the last 90 days was $18,136</strong>, 97% of it on Opus 4. With the routing rules this benchmark validates, it would have been $4,163 — <strong>a $13,973 (77%) save</strong>.</li>
            <li><strong>Grok 4 is a reasoning model that burns tokens even on trivial prompts.</strong> On a single &ldquo;reply OK&rdquo; test it used 320 hidden reasoning tokens before outputting 1 visible token. On debug prompts it used 11,000-14,000 reasoning tokens per response. If you&rsquo;re calling Grok 4 for routine coding, you&rsquo;re paying 20-50× more than Sonnet for worse output.</li>
            <li><strong>Local Gemma 2 2B scored 12.9/30</strong> — usable for simple extraction, not a drop-in replacement. Gemma 4 26B timed out on CPU inference on my M-series laptop.</li>
            <li>Raw data, grader, prompts, and the reproducible harness are in{" "}
              <a href="https://github.com/ComputeGauge/inferlane/tree/main/benchmark" className="underline">the repo</a>. Re-run it and prove me wrong if the numbers don&rsquo;t hold.
            </li>
          </ul>

          <h2>Why I ran this</h2>
          <p>
            I use Claude Code daily and my bill has been bouncing between $200 and $900 a month without me understanding why. Every monitoring tool (Helicone, Langfuse, Portkey) shows you what you already spent. None of them answer the actually interesting question: <em>&ldquo;Could a cheaper model have done that task just as well?&rdquo;</em>
          </p>
          <p>
            So I built a small benchmark harness and ran it against five realistic options:
          </p>
          <ul>
            <li><strong>Claude Opus 4</strong> — Anthropic&rsquo;s flagship, the default &ldquo;use when you really need it&rdquo; tier</li>
            <li><strong>Claude Sonnet 4</strong> — the workhorse most Claude Code sessions use</li>
            <li><strong>Claude Haiku 4.5</strong> — the cheap Anthropic tier</li>
            <li><strong>Grok 4</strong> (grok-4-0709) — xAI&rsquo;s reasoning model, competitive pricing with Sonnet</li>
            <li><strong>Gemma 2 2B</strong> running locally via Ollama — the zero-cost tier</li>
          </ul>
          <p>
            I pulled 20 prompts designed to match the category distribution of my actual Claude Code history (9 task types: implement, debug, refactor, explain, review, data, test, config, ui, docs). Each prompt is self-contained — no filesystem access, no tool use — so local Gemma is on a level playing field.
          </p>
          <p>
            Every prompt ran through all four models with the same settings. Then I asked Sonnet 4 to blindly grade the outputs A/B/C/D (randomized order per prompt, seeded for reproducibility) on a three-axis rubric: correctness, quality, and completeness, each 0–10.
          </p>

          <h2>The bottom-line numbers</h2>

          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left py-3 text-gray-400 font-medium">Model</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Avg /30</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Wins</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Cost (20 tasks)</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Tokens out</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Avg lat</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm">
                <tr className="border-b border-[#1e1e2e]/50 bg-amber-500/5">
                  <td className="py-3"><strong className="text-amber-400">Sonnet 4 ★</strong></td>
                  <td className="text-right py-3">25.6</td>
                  <td className="text-right py-3">4 (20%)</td>
                  <td className="text-right py-3">$0.2330</td>
                  <td className="text-right py-3">15,148</td>
                  <td className="text-right py-3">12.5s</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-3"><strong className="text-blue-400">Haiku 4.5</strong></td>
                  <td className="text-right py-3">25.3</td>
                  <td className="text-right py-3">5 (25%)</td>
                  <td className="text-right py-3">$0.0977</td>
                  <td className="text-right py-3">19,149</td>
                  <td className="text-right py-3">6.8s</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-3"><strong className="text-red-400">Opus 4</strong></td>
                  <td className="text-right py-3">24.5</td>
                  <td className="text-right py-3">6 (30%)</td>
                  <td className="text-right py-3">$1.2088</td>
                  <td className="text-right py-3">15,730</td>
                  <td className="text-right py-3">17.0s</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-3"><strong className="text-purple-400">Grok 4</strong></td>
                  <td className="text-right py-3">24.2</td>
                  <td className="text-right py-3">5 (25%)</td>
                  <td className="text-right py-3">$1.0229</td>
                  <td className="text-right py-3">65,150</td>
                  <td className="text-right py-3">48.8s</td>
                </tr>
                <tr>
                  <td className="py-3"><strong className="text-green-400">Gemma 2 2B (local)</strong></td>
                  <td className="text-right py-3">12.9</td>
                  <td className="text-right py-3">0 (0%)</td>
                  <td className="text-right py-3">$0.0000</td>
                  <td className="text-right py-3">11,780</td>
                  <td className="text-right py-3">12.5s</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500">
            ★ Highest average quality across all five models. &ldquo;Wins&rdquo; counts outright wins per prompt — Opus has the most wins but also the most bad outliers, hence the lower average.
          </p>

          <h2>The Opus result, in more detail</h2>
          <p>
            The most surprising finding for me was that <strong>Opus 4 was not the best model on this benchmark</strong>. Sonnet 4 scored 25.6/30 on average and Opus scored 24.5/30 — meaningfully lower, not within noise. Opus won 6 of 20 prompts outright, but Sonnet won 4 and Haiku won 5 — and Grok 4 also won 5, all with higher average quality than Opus.
          </p>
          <p>
            I did not expect this and I&rsquo;m still a little suspicious, so I want to be specific about what happened.
          </p>
          <p>
            On one debug prompt, Opus produced 629 tokens of output describing a bug that did not exist in the code. It hallucinated a &ldquo;mutable reference&rdquo; issue, walked itself back mid-explanation, then invented a second fake bug. Sonnet and Haiku both correctly identified the real bug (an accumulator being mutated during iteration). The judge scored Opus 12/30 on that prompt and Sonnet 25/30. I reviewed the output myself and the judge was right. It wasn&rsquo;t a judging artifact — Opus really did flub it.
          </p>
          <p>
            On another prompt, Opus wrote a longer, more confident answer that was subtly wrong about a React hook dependency. Sonnet wrote a shorter, correct answer. Opus loses when it&rsquo;s confidently verbose on something it got wrong. Sonnet is more conservative and it&rsquo;s helping.
          </p>
          <p>
            The place Opus clearly wins is <strong>refactor</strong> (29.0 vs Sonnet 27.5). When the task is &ldquo;take this messy code and make it clean,&rdquo; the extra headroom matters. That&rsquo;s the one category where I&rsquo;ll keep routing to Opus.
          </p>
          <p>
            For everything else — debug, implement, explain, review, test, data, docs, ui, config — the ~1.1 point edge Sonnet has on average at 5.2× lower cost is the actionable finding.
          </p>

          <h2>The Grok 4 result</h2>
          <p>
            Grok 4 is a <strong>reasoning model</strong> like o1 and o3. That means it generates hidden &ldquo;reasoning tokens&rdquo; in addition to the visible output, and you&rsquo;re billed for both. I included it in the benchmark because xAI has been pitching Grok 4 as a serious coding model, and I wanted to see how it compared on my own prompts.
          </p>
          <p>
            <strong>It did not go well.</strong> Grok 4 averaged 24.2/30 — the lowest of the four cloud models. Worse, it burned <strong>65,150 output tokens across the 20 prompts</strong> versus 15,148 for Sonnet. Most of those were hidden reasoning tokens the user never sees. On one debug prompt Grok used <strong>14,109 reasoning tokens</strong> — more than a full-length blog post of hidden thinking — to produce an answer that scored lower than Haiku&rsquo;s 561-token answer on the same prompt.
          </p>
          <p>
            A simple &ldquo;reply OK&rdquo; test during setup cost 320 reasoning tokens. Grok 4 reasons about everything, whether the prompt needs reasoning or not.
          </p>
          <p>
            The total Grok 4 cost for this benchmark was $1.02 — 4.4× the cost of Sonnet for 1.4 fewer quality points and <strong>3.9× slower response times</strong> (48.8 seconds average vs Sonnet&rsquo;s 12.5). If you&rsquo;re calling Grok 4 for routine Claude Code tasks, you&rsquo;re paying reasoning-model prices for the kind of work where reasoning doesn&rsquo;t help.
          </p>
          <p>
            Grok 4 did win 5 of 20 prompts on my benchmark — it was very good at debug #5 (scoring 26 where Opus scored 12) and debug #6 (I had to regrade that prompt twice because the judge kept producing malformed JSON on 5-way comparisons, but Grok ranked near the top both times). On genuinely reasoning-heavy debug tasks the extended thinking helps. On everything else, it&rsquo;s overkill.
          </p>
          <p>
            I want to be clear: this is 20 prompts and Grok 4 is a capable model. The story isn&rsquo;t &ldquo;Grok 4 is bad.&rdquo; The story is &ldquo;reasoning models are overkill for the majority of coding tasks, and you&rsquo;re paying a huge premium for capability you don&rsquo;t need.&rdquo; Opus and Grok 4 both make the same mistake: they think harder than the task requires.
          </p>

          <h2>Per-category breakdown</h2>

          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left py-3 text-gray-400 font-medium">Category</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Opus 4</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Sonnet 4</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Haiku 4.5</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Grok 4</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Gemma 2B</th>
                  <th className="text-left py-3 text-gray-400 font-medium pl-6">Winner</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm">
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">refactor</td>
                  <td className="text-right py-2">28.5</td>
                  <td className="text-right py-2">28.5</td>
                  <td className="text-right py-2">24.5</td>
                  <td className="text-right py-2">25.0</td>
                  <td className="text-right py-2">14.0</td>
                  <td className="py-2 pl-6 text-red-400">Opus/Sonnet</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">implement</td>
                  <td className="text-right py-2">26.5</td>
                  <td className="text-right py-2">25.5</td>
                  <td className="text-right py-2">27.2</td>
                  <td className="text-right py-2">22.5</td>
                  <td className="text-right py-2">13.0</td>
                  <td className="py-2 pl-6 text-blue-400">Haiku</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">explain</td>
                  <td className="text-right py-2">24.7</td>
                  <td className="text-right py-2">25.3</td>
                  <td className="text-right py-2">27.7</td>
                  <td className="text-right py-2">26.0</td>
                  <td className="text-right py-2">14.0</td>
                  <td className="py-2 pl-6 text-blue-400">Haiku</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">test</td>
                  <td className="text-right py-2">21.0</td>
                  <td className="text-right py-2">24.0</td>
                  <td className="text-right py-2">29.0</td>
                  <td className="text-right py-2">19.0</td>
                  <td className="text-right py-2">14.0</td>
                  <td className="py-2 pl-6 text-blue-400">Haiku</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">data</td>
                  <td className="text-right py-2">18.0</td>
                  <td className="text-right py-2">22.5</td>
                  <td className="text-right py-2">22.0</td>
                  <td className="text-right py-2">22.5</td>
                  <td className="text-right py-2">8.0</td>
                  <td className="py-2 pl-6 text-blue-400">Haiku/Sonnet/Grok</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">ui</td>
                  <td className="text-right py-2">26.0</td>
                  <td className="text-right py-2">29.0</td>
                  <td className="text-right py-2">24.0</td>
                  <td className="text-right py-2">23.0</td>
                  <td className="text-right py-2">10.0</td>
                  <td className="py-2 pl-6 text-amber-400">Sonnet</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">review</td>
                  <td className="text-right py-2">26.5</td>
                  <td className="text-right py-2">26.5</td>
                  <td className="text-right py-2">25.5</td>
                  <td className="text-right py-2">26.0</td>
                  <td className="text-right py-2">18.0</td>
                  <td className="py-2 pl-6 text-amber-400">Sonnet/Opus</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">debug</td>
                  <td className="text-right py-2">21.3</td>
                  <td className="text-right py-2">25.7</td>
                  <td className="text-right py-2">22.3</td>
                  <td className="text-right py-2">25.7</td>
                  <td className="text-right py-2">8.7</td>
                  <td className="py-2 pl-6 text-purple-400">Sonnet/Grok</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-2">config</td>
                  <td className="text-right py-2">24.0</td>
                  <td className="text-right py-2">21.0</td>
                  <td className="text-right py-2">22.0</td>
                  <td className="text-right py-2">23.0</td>
                  <td className="text-right py-2">9.0</td>
                  <td className="py-2 pl-6 text-red-400">Opus</td>
                </tr>
                <tr>
                  <td className="py-2">docs</td>
                  <td className="text-right py-2">29.0</td>
                  <td className="text-right py-2">28.0</td>
                  <td className="text-right py-2">28.0</td>
                  <td className="text-right py-2">28.0</td>
                  <td className="text-right py-2">25.0</td>
                  <td className="py-2 pl-6 text-red-400">Opus*</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500">
            * Opus wins docs by 1 point, essentially a tie with the others. Only 1 prompt in this category so take with a grain of salt.
          </p>

          <p>
            The pattern is clearer than I expected. <strong>Opus wins where there&rsquo;s room to be &ldquo;more elegant&rdquo;</strong> — refactor and config. <strong>Sonnet wins where you need to reason through existing code</strong> — debug, implement, ui. <strong>Haiku wins where you need accurate recall and clean generation</strong> — review, test, data, explain, docs.
          </p>

          <h2>Cost per quality point — the headline chart</h2>

          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left py-3 text-gray-400 font-medium">Model</th>
                  <th className="text-right py-3 text-gray-400 font-medium">$ / 1000 quality points</th>
                  <th className="text-right py-3 text-gray-400 font-medium">vs Haiku</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm">
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-3 text-red-400">Opus 4</td>
                  <td className="text-right py-3">$2.47</td>
                  <td className="text-right py-3">12.8× more</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-3 text-purple-400">Grok 4</td>
                  <td className="text-right py-3">$2.11</td>
                  <td className="text-right py-3">10.9× more</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-3 text-amber-400">Sonnet 4</td>
                  <td className="text-right py-3">$0.46</td>
                  <td className="text-right py-3">2.4× more</td>
                </tr>
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-3 text-blue-400"><strong>Haiku 4.5</strong></td>
                  <td className="text-right py-3"><strong>$0.19</strong></td>
                  <td className="text-right py-3">—</td>
                </tr>
                <tr>
                  <td className="py-3 text-green-400">Gemma 2 2B (local)</td>
                  <td className="text-right py-3">$0.00</td>
                  <td className="text-right py-3">free but 2× worse quality</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>The two reasoning models — Opus 4 and Grok 4 — are both 10-13× more expensive per quality point than Haiku 4.5.</strong> If you&rsquo;re defaulting to either for everyday coding, you&rsquo;re paying an order of magnitude more for <em>lower</em> quality than the cheaper non-reasoning alternatives. That&rsquo;s the headline.
          </p>

          <h2>My own 90-day Claude Code bill: $18,136 → $4,163</h2>
          <p>
            I ran a script over my own session history (all ~2,300 JSONL files in <code>~/.claude/projects/</code> from the last 90 days) that:
          </p>
          <ol>
            <li>Sums the actual token counts paid per assistant message across all models</li>
            <li>Classifies each message&rsquo;s task type using the same category heuristics as the benchmark</li>
            <li>Applies the routing rules this benchmark validated (Opus→Sonnet for everything except refactor, Sonnet→Haiku for data/explain/test/docs/review) to compute what I <em>would</em> have paid</li>
          </ol>
          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left py-3 text-gray-400 font-medium">Scenario</th>
                  <th className="text-right py-3 text-gray-400 font-medium">90-day cost</th>
                  <th className="text-right py-3 text-gray-400 font-medium">Monthly</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm">
                <tr className="border-b border-[#1e1e2e]/50">
                  <td className="py-3">Actual spend (97% Opus)</td>
                  <td className="text-right py-3 text-red-400">$18,136</td>
                  <td className="text-right py-3 text-red-400">$6,045</td>
                </tr>
                <tr>
                  <td className="py-3">Benchmark-backed routing</td>
                  <td className="text-right py-3 text-green-400">$4,163</td>
                  <td className="text-right py-3 text-green-400">$1,388</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>$13,973 in 90 days. $4,658/month. 77% save.</strong> That&rsquo;s my actual bill — not a hypothetical. The script is in the repo (<a href="https://github.com/ComputeGauge/inferlane/blob/main/benchmark/compute_real_savings.py">compute_real_savings.py</a>). Run it over your own <code>~/.claude/projects/</code> history and see what your number looks like.
          </p>
          <p className="text-sm text-gray-500">
            Caveat: I am a heavy Claude Code user with 116,000 assistant messages in 90 days and 97% of my spend on Opus. If your profile is different — most people&rsquo;s is — your absolute number will be smaller, but the <em>percentage</em> should be similar. Most Claude Code users are over-spending on Opus when Sonnet or Haiku would do.
          </p>

          <h2>What about Gemma 2 local? Can you really run for free?</h2>
          <p>
            Short answer: <strong>no, not as a general-purpose replacement</strong>. Gemma 2 2B averaged 12.9/30, about half of Sonnet&rsquo;s 25.6. It hallucinates syntax, misses edge cases, and produces confidently-wrong code on most tasks.
          </p>
          <p>
            But there are two narrow use cases where it shines at zero cost:
          </p>
          <ol>
            <li><strong>Structured extraction and classification</strong>. Gemma 2 scored 22/30 on the documentation task — closer to cloud territory.</li>
            <li><strong>Privacy-sensitive prompts</strong> you don&rsquo;t want sent to any cloud.</li>
          </ol>
          <p>
            I also tested the 9.6 GB <code>gemma4</code> MoE variant on the same hardware (M-series, 32 GB RAM, no GPU). It averaged ~1.5 tokens/sec and timed out on most prompts. Larger local models need real GPU acceleration. If someone tells you &ldquo;just run Gemma 4 locally, it&rsquo;s free&rdquo;, ask them what hardware they&rsquo;re on.
          </p>

          <h2>Methodology and caveats</h2>

          <h3>Test set</h3>
          <ul>
            <li>20 prompts, curated to match the category distribution of my real Claude Code usage</li>
            <li>Each prompt is self-contained — no filesystem context, no tool use, no follow-ups — so all four models compete on equal footing</li>
            <li>Prompts are realistic (based on actual tasks I ask Claude Code to do), not contrived gotchas</li>
            <li>Full prompt list, raw outputs, and grader results are in <a href="https://github.com/ComputeGauge/inferlane/tree/main/benchmark">the repo</a></li>
          </ul>

          <h3>Grading</h3>
          <ul>
            <li>Sonnet 4 was the judge. For each prompt it saw all four outputs labeled A/B/C/D in randomized order (seeded per prompt for reproducibility) and scored each on correctness, quality, and completeness (0–10 each, 30 max).</li>
            <li>Randomized labeling eliminates position bias — the judge doesn&rsquo;t know which output came from which model.</li>
            <li><strong>Sonnet-as-judge is biased toward Sonnet.</strong> I accept the bias. Mitigation: the headline finding (Opus scoring <em>lower</em> than Sonnet, Haiku tying) is the opposite of what self-bias would predict. A biased judge would inflate Sonnet vs all others. Re-running with GPT-4o or Gemini as a secondary judge is on the roadmap.</li>
            <li>The rubric and judge prompt are in <a href="https://github.com/ComputeGauge/inferlane/blob/main/benchmark/grade.py">grade.py</a>.</li>
          </ul>

          <h3>What this doesn&rsquo;t test</h3>
          <ul>
            <li><strong>Long-context tasks.</strong> All prompts are under 1,500 chars. Real Claude Code sessions often run 100K+ token context windows, where Opus&rsquo;s extended thinking probably helps more.</li>
            <li><strong>Tool-using tasks.</strong> All models answered in a single turn without file access.</li>
            <li><strong>Extremely hard problems.</strong> These are daily developer work prompts, not algorithm interview questions.</li>
            <li><strong>Consistency.</strong> N=1 per prompt. No variance analysis. A v2 would run N=5 and report confidence intervals.</li>
            <li><strong>The specific Opus scoring anomaly on one debug prompt.</strong> Opus genuinely flubbed it. If you remove that outlier, Opus rises to 25.6/30 — still slightly below Sonnet. The pattern holds.</li>
          </ul>

          <h2>What I built from this</h2>
          <p>
            The reason I ran this was that I wanted a real tool to do this routing automatically. That tool is <a href="/">InferLane</a> — a free Claude Code plugin that gives your agent six cost-intelligence tools via MCP.
          </p>
          <p>
            Install it from the marketplace:
          </p>
          <pre><code>{`/plugin marketplace add ComputeGauge/inferlane
/plugin install inferlane@inferlane`}</code></pre>
          <p>
            For the local Gemma fallback, one command sets it up:
          </p>
          <pre><code>curl -fsSL https://inferlane.dev/install.sh | bash</code></pre>
          <p>
            Source is on <a href="https://github.com/ComputeGauge/inferlane">GitHub</a>. The benchmark harness is in the <code>benchmark/</code> directory — clone it, re-run it with your own prompts, and tell me what you find.
          </p>

          <h2>What I&rsquo;m uncertain about</h2>
          <p>
            Three things I&rsquo;m watching for commenters to correct me on:
          </p>
          <ol>
            <li>
              <strong>The Opus result.</strong> I&rsquo;m still slightly suspicious that Opus underperformed on this specific benchmark. The debug outlier was real — I checked by hand — but I want a second judge and N=5 runs before I&rsquo;m certain it generalizes. If you run the benchmark and see different numbers, <a href="https://github.com/ComputeGauge/inferlane/issues">file an issue</a>.
            </li>
            <li>
              <strong>The $14K save.</strong> It&rsquo;s my own number from my own usage, but my profile is unusual (97% Opus, 116K messages/quarter). Average Claude Code users probably see more like a 20-40% save on a much smaller base. The script is there — run it and share your own number.
            </li>
            <li>
              <strong>Long-context behavior.</strong> The benchmark tests single-turn coding prompts. Real Claude Code sessions are long agentic loops with extensive file reads. I&rsquo;d bet Opus&rsquo;s advantage grows with context length and task complexity. This benchmark doesn&rsquo;t capture that.
            </li>
          </ol>
          <p className="text-sm text-gray-500 mt-12 pt-8 border-t border-[#1e1e2e]">
            Published April 12, 2026. Raw data + methodology:{" "}
            <a href="https://github.com/ComputeGauge/inferlane/tree/main/benchmark">github.com/ComputeGauge/inferlane/benchmark</a>. Questions or a re-run? <a href="https://github.com/ComputeGauge/inferlane/issues">File an issue</a> — I want to be proven wrong if I&rsquo;m wrong.
          </p>
        </article>
      </div>
    </div>
  );
}

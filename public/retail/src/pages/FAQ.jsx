/* FAQ page — plain-English answers to common technical and non-technical questions.
   Uses LegalShell for consistent title/eyebrow/body layout. Accordion items are
   expandable <details> blocks styled to match the rest of the site. */

function FAQPage() {
  const groups = [
    {
      heading: 'Basics',
      items: [
        {
          q: 'What is a daemon?',
          a: (
            <>
              <p>"Daemon" is the old Unix word for a small background program that sits running quietly on your computer, waiting to do a job when something asks for it. The print spooler is a daemon. The thing that syncs your iCloud photos is a daemon. They don't have windows, they don't make noise, they just wait and respond.</p>
              <p>The InferLane daemon is the same idea: a signed helper app you install once, that sits in your menu bar or system tray. When the network sends a request, it runs the inference on your GPU, streams the answer back, and scrubs the working memory. Green dot = available to serve. That's the whole job.</p>
            </>
          ),
        },
        {
          q: 'What is a node?',
          a: (
            <>
              <p>A node is just <em>your machine, with the daemon running on it</em>. If you install the daemon on your Mac mini, that Mac mini becomes a node on the network. Turn the daemon off, and it's not a node anymore — just a Mac mini.</p>
              <p>Some people run one node. Some people run a small rack of four or five. The network doesn't care about the count; it cares about the aggregate capacity.</p>
            </>
          ),
        },
        {
          q: 'What does "community-owned AI inference" actually mean?',
          a: (
            <p>It means the machines answering the requests don't belong to us. They belong to the people in the network — hobbyists, studios, developers, small GPU owners. We operate the coordinator (the part that decides who answers which request) and the moderation gate (the part that blocks prohibited content). The compute itself is yours.</p>
          ),
        },
        {
          q: 'Is this cryptocurrency?',
          a: (
            <>
              <p>No. There's no blockchain, no token, no wallet. Nothing is traded on an exchange. Credits (kT) are an internal accounting unit — the same way "airline miles" or "Steam Wallet funds" are internal accounting units. They live in our database, not on a chain.</p>
              <p>We chose this deliberately. Crypto-style networks tend to collapse into speculation; this is meant to stay a utility.</p>
            </>
          ),
        },
        {
          q: 'What is kT?',
          a: (
            <p><strong>kT</strong> = <em>kilo-tokens</em>. Our internal credit unit. You earn 1 kT for approximately every 1,000 tokens of inference your node serves (the exact ratio depends on the model and tier). Credits spend on inference from the network today; cash redemption is not offered.</p>
          ),
        },
      ],
    },
    {
      heading: 'Running a node',
      items: [
        {
          q: 'What hardware do I need?',
          a: (
            <>
              <p>Anything that can run a modern local model: an M-series Mac with 16GB+ of unified memory, a PC with an RTX 3060 or better, a workstation with an A-series or H-series NVIDIA card. We publish a hardware chart on the <a href="#run-a-node">Run a node</a> page with rough per-machine throughput.</p>
              <p>You don't need a datacentre. The median node is somebody's personal Mac mini that was on anyway.</p>
            </>
          ),
        },
        {
          q: 'Will running the daemon hurt my machine?',
          a: (
            <p>No more than running any other background workload. The daemon respects a thermal budget you set — by default it backs off when your GPU is busy with your foreground work (games, video editing, etc.) and picks up when the machine is idle. You can cap CPU, GPU and power draw from the menu bar.</p>
          ),
        },
        {
          q: 'How much electricity will this use?',
          a: (
            <p>Depends on your hardware. An M-series Mac mini draws 15–30W under load. An RTX 4090 rig draws up to 400W. The <a href="#run-a-node">Run a node calculator</a> takes a rough kWh rate and subtracts electricity from estimated earnings so you can see the net. If your power costs are high, we strongly recommend Apple Silicon — it's dramatically more efficient per kT.</p>
          ),
        },
        {
          q: 'Will my IP address be exposed?',
          a: (
            <>
              <p>To the coordinator, yes — we need to route traffic to you. To other operators and consumers, no. The coordinator is the only counterparty that ever sees your IP.</p>
              <p>We publish our data-handling commitments in the <a href="#privacy">Privacy Policy</a> and the <a href="#security">Security Policy</a>.</p>
            </>
          ),
        },
        {
          q: 'Can I stop at any time?',
          a: (
            <p>Yes. Quit the daemon from the menu bar and you stop serving requests within seconds. No lock-up, no penalty, no "you must serve X hours this month" clause. Credits already earned stay in your balance.</p>
          ),
        },
        {
          q: 'Can I get cash instead of credits?',
          a: (
            <p><strong>No. The Service operates in a credits-only mode.</strong> kT credits are redeemable for inference on our network and do not convert to cash, currency, or any other asset. If InferLane ever introduces a cash-payout pathway, it would be a separate opt-in arrangement (not a conversion of existing credits) requiring new terms and identity verification. No timeline; no commitment.</p>
          ),
        },
      ],
    },
    {
      heading: 'Privacy and safety',
      items: [
        {
          q: 'Can my node see what people are asking?',
          a: (
            <>
              <p>The daemon has access to the prompt while it is computing the answer, because it has to — that's what inference is. The moment the response is streamed back, the working memory is scrubbed. Nothing lands on disk. The daemon has no UI to "look" at traffic.</p>
              <p>For requests tagged sensitive (healthcare, legal, finance), the coordinator routes to enclave-backed operators only — machines where the OS itself cannot read the model's memory. See the four privacy tiers on the <a href="#how">How it works</a> page.</p>
            </>
          ),
        },
        {
          q: 'What stops bad actors from running prohibited content through my machine?',
          a: (
            <>
              <p>Every request passes through our <strong>moderation gate at the coordinator</strong> before it reaches any node. Prohibited categories (CSAM, terrorism, WMD, fraud, malware, and the rest of the list on the <a href="#aup">Acceptable Use Policy</a>) are rejected there, not on your machine.</p>
              <p>If a request slips through and a moderator flags it after the fact, the operator is not penalised — the request is logged, the consumer is banned, and post-hoc review happens on the coordinator side.</p>
            </>
          ),
        },
        {
          q: 'Am I liable for what my node computes?',
          a: (
            <p>Short answer: we stand between you and the content. The moderation gate rejects prohibited traffic before it reaches you. The <a href="#operator-agreement">Operator Agreement</a> spells out the indemnity structure in detail — worth reading before you sign up. If you're uncomfortable with the liability position described there, don't register as an operator.</p>
          ),
        },
      ],
    },
    {
      heading: 'Using the network',
      items: [
        {
          q: 'How do I actually use InferLane for inference?',
          a: (
            <>
              <p>Two ways. The easy way is the <strong>MCP plugin</strong> — a one-line install for Claude Code, Cursor, or any MCP-compatible client. It exposes the network as a routing target; your agent keeps calling its normal APIs, but bulk jobs that don't need frontier quality get routed through the peer network at lower cost.</p>
              <p>The more direct way is our <strong>HTTP API</strong> — same shape as OpenAI's Chat Completions, drop-in compatible with existing SDKs. See the <a href="#tech">For engineers</a> page.</p>
            </>
          ),
        },
        {
          q: 'How much does it cost to use?',
          a: (
            <p>For small personal use with the MCP plugin and local fuel gauge, it's free — you're metering your own local usage. Routing through the peer network costs credits, which you can either earn (by running a node) or buy. Published rates are on the <a href="#tech">Tech</a> page. We target 30–60% of hosted-provider pricing for comparable-quality models.</p>
          ),
        },
        {
          q: 'Can I trust the answers?',
          a: (
            <p>The coordinator checks that the operator is running the exact signed build of the daemon we shipped; if anything has been tampered with, the request is moved to the next operator. For higher-assurance workloads (Tier 1), requests run inside hardware-sealed enclaves — H100 Confidential Computing or AWS Nitro — where not even the operator's OS can tamper with the computation.</p>
          ),
        },
        {
          q: 'Does this work with Claude Code / Cursor / my favourite agent?',
          a: (
            <p>Yes — anything that speaks MCP (Model Context Protocol) works out of the box. We ship plugins for Claude Code, Cursor, and Windsurf. For custom agents, the HTTP API is OpenAI-compatible, so any library that targets OpenAI works with a base URL change.</p>
          ),
        },
      ],
    },
    {
      heading: 'The business',
      items: [
        {
          q: 'How do you make money?',
          a: (
            <>
              <p>Two lines, honest about both.</p>
              <ul>
                <li><strong>MCP-Pro subscription</strong> — a paid tier of the local plugin with advanced routing, per-project budgets, and team features. Individual-priced, month-to-month.</li>
                <li><strong>Routing markup</strong> — when inference is routed through the peer network, we take a platform fee (currently 10%). Operators keep the rest; we're transparent about the split.</li>
              </ul>
              <p>No ads. No data sales. No selling prompts to model trainers. Ever.</p>
            </>
          ),
        },
        {
          q: 'Are you VC-backed?',
          a: (
            <p>Not yet. We are deliberately avoiding a venture round until MRR justifies it — the whole point of credits-first is that the network can grow without waiting for external capital. We will take investment when it's additive to the community, not when it dictates what the community becomes.</p>
          ),
        },
        {
          q: 'What happens if InferLane shuts down?',
          a: (
            <p>Credits expire 6 months after issuance per the <a href="#operator-agreement">Operator Agreement</a>; if we announce a shutdown, we'll honour outstanding credits with either a final cash-conversion window or free inference until depletion. The daemon is a signed binary that you installed yourself — it's yours. We publish our shutdown plan in the Operator Agreement.</p>
          ),
        },
        {
          q: 'I still have a question.',
          a: (
            <p>Join the <a href="#community">Discord</a> and ask in <code>#new-operators</code> or <code>#consumers</code>, or email <code>hello@inferlane.dev</code>. For security issues, see <a href="#security">the security policy</a>. For privacy or data requests, <code>privacy@inferlane.dev</code>.</p>
          ),
        },
      ],
    },
  ];

  return (
    <>
      <section className="section" style={{ paddingTop: 100, paddingBottom: 24 }}>
        <div className="wrap-narrow">
          <span className="eyebrow fade-up" style={{ marginBottom: 28, display: 'inline-flex' }}>FAQ</span>
          <h1 className="h-display fade-up fade-up-d1" style={{ fontSize: 'clamp(40px, 5.5vw, 64px)', marginTop: 0 }}>
            Questions, <span className="serif">answered</span> plainly.
          </h1>
          <p className="lede fade-up fade-up-d2" style={{ marginTop: 18 }}>
            If you're new to this, start with "What is a daemon?" and "What is a node?" — the rest builds on those. If you're here to run a rig, jump to the Running a node section.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20, paddingBottom: 100 }}>
        <div className="wrap-narrow">
          {groups.map((g, gi) => (
            <div key={g.heading} className="faq-group fade-up" style={{ marginBottom: 48 }}>
              <h2 className="faq-group-title">{g.heading}</h2>
              <div className="faq-list">
                {g.items.map((it, ii) => (
                  <details key={ii} className="faq-item">
                    <summary className="faq-q">
                      <span>{it.q}</span>
                      <svg className="faq-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </summary>
                    <div className="faq-a">{it.a}</div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

Object.assign(window, { FAQPage });

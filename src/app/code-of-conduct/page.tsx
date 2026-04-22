import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Code of Conduct — InferLane',
  description: 'Community norms for contributors, operators, consumers, and maintainers.',
};

export default function CodeOfConductPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose prose-invert">
      <h1>Code of Conduct</h1>

      <h2>Our pledge</h2>
      <p>
        We want InferLane to be a community where everyone — contributors,
        operators, consumers, and maintainers — feels welcome and safe to
        participate. We commit to this regardless of age, body size,
        disability, ethnicity, gender identity or expression, experience
        level, education, socioeconomic status, nationality, personal
        appearance, race, religion, or sexual identity or orientation.
      </p>

      <h2>What we expect</h2>
      <ul>
        <li>Be respectful. Disagree with ideas, not people.</li>
        <li>Assume good faith. Most friction is a miscommunication, not malice.</li>
        <li>Credit people&apos;s work. A pull request is someone&apos;s time; a benchmark submission is someone&apos;s electricity bill.</li>
        <li>Be honest about uncertainty. &quot;I don&apos;t know&quot; is almost always the right answer when you don&apos;t know.</li>
        <li>Share knowledge back. If someone helped you, help the next person.</li>
      </ul>

      <h2>What&apos;s not OK</h2>
      <ul>
        <li>Harassment, discrimination, or personal attacks of any kind</li>
        <li>Sexualised language or imagery in community spaces</li>
        <li>Doxxing or sharing private information without consent</li>
        <li>Sustained disruption of discussion, talks, or events</li>
        <li>Using contribution status as leverage for special treatment</li>
        <li>Running inference traffic that violates our <Link href="/aup">Acceptable Use Policy</Link></li>
      </ul>

      <h2>Enforcement</h2>
      <p>
        Maintainers may warn, mute, or ban participants who violate this
        code. Decisions are final but reviewable — if you think we got it
        wrong, email <code>conduct@inferlane.dev</code> and another
        maintainer will review. Bans from the codebase or Discord also
        suspend any contribution-reward kT balance. Credits earned through
        abusive means (sock-puppet PRs, gamed benchmarks) will be revoked.
      </p>

      <h2>Reporting</h2>
      <p>
        If you experience or witness unacceptable behaviour, email{' '}
        <code>conduct@inferlane.dev</code>. We read every report. You
        don&apos;t need to be the target — bystander reports are welcome.
        Reports are handled privately unless you ask us to go public.
      </p>

      <h2>Scope</h2>
      <p>
        This applies in all community spaces: GitHub, Discord, Twitter/X
        replies, in-person events, and any other space where you&apos;re
        representing InferLane.
      </p>

      <p className="text-sm text-zinc-500 mt-10">
        Adapted from the Contributor Covenant 2.1, trimmed and rewritten
        for an inference network rather than a pure code project. Full text
        mirrored at{' '}
        <a href="https://github.com/ComputeGauge/inferlane/blob/main/CODE_OF_CONDUCT.md">CODE_OF_CONDUCT.md</a>.
      </p>
    </main>
  );
}

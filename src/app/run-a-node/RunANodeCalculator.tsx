'use client';

import { useState } from 'react';

interface Hardware {
  id: string;
  name: string;
  ram: string;
  kt: number;    // nominal monthly kT earn at 14h/day active
  watts: number; // average draw during inference
  req: number;   // tokens/sec capacity
}

const HARDWARE: Hardware[] = [
  { id: 'm4mini', name: 'M4 Mac mini', ram: '24GB', kt: 38_000, watts: 28, req: 14 },
  { id: 'm4pro',  name: 'M4 Pro MBP',  ram: '64GB', kt: 72_000, watts: 42, req: 22 },
  { id: 'm4max',  name: 'M4 Max Studio', ram: '128GB', kt: 128_000, watts: 88, req: 41 },
  { id: '4090',   name: 'RTX 4090 rig', ram: '24GB', kt: 180_000, watts: 380, req: 66 },
  { id: 'h100',   name: 'H100 80GB',    ram: '80GB', kt: 820_000, watts: 640, req: 188 },
];

function fmtKt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'k';
  return String(n);
}

export default function RunANodeCalculator() {
  const [hwId, setHwId] = useState('m4mini');
  const [hours, setHours] = useState(14);
  const [rate, setRate] = useState(0.18);

  const hw = HARDWARE.find(h => h.id === hwId)!;
  const kt = Math.round(hw.kt * (hours / 14));
  const tokensPerMonth = kt * 1000;
  const elec = (hw.watts * hours * rate * 30) / 1000;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="grid lg:grid-cols-2">
        {/* Left: controls */}
        <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-100">
            Anticipated unit economics
            <span className="ml-1 text-amber-400">*</span>
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Rough estimates at anticipated network demand. Real numbers vary
            with your region, your model residency, and the luck of the
            request queue.
          </p>

          <div className="mt-6 space-y-2">
            <div className="text-xs font-mono uppercase tracking-wide text-zinc-500">Hardware class</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {HARDWARE.map(h => (
                <button
                  key={h.id}
                  onClick={() => setHwId(h.id)}
                  className={`text-left rounded-xl border px-3 py-2.5 transition ${
                    hwId === h.id
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'
                  }`}
                >
                  <div className="text-sm font-medium text-zinc-100">{h.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-500 font-mono">
                    {h.ram} · {h.req} tok/s · {h.watts}W
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wide text-zinc-500 mb-2">
                <span>Hours active / day</span>
                <span className="text-amber-400">{hours}h</span>
              </div>
              <input
                type="range"
                min={1}
                max={24}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wide text-zinc-500 mb-2">
                <span>Electricity (USD / kWh)</span>
                <span className="text-amber-400">${rate.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.55}
                step={0.01}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Right: results */}
        <div className="p-6 md:p-8 bg-zinc-950/40">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-zinc-500">
              Credits earned / month
              <span
                title="kT = kilo-tokens. Internal credit unit. 1 kT is earned per ~1,000 tokens of inference you serve."
                className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-zinc-700 text-[10px] text-zinc-500 cursor-help"
              >?</span>
            </div>
            <div className="mt-2 text-5xl font-bold text-zinc-100 font-mono tabular-nums">
              {fmtKt(kt)} <span className="text-xl text-amber-400/70">kT</span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              ≈ {(tokensPerMonth / 1_000_000).toFixed(1)}M Llama-70B-equivalent tokens served
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-zinc-900/60 border border-zinc-800 p-4 text-xs text-zinc-400 leading-relaxed">
            <strong className="text-zinc-100">kT = kilo-tokens.</strong> Internal credit unit;
            1 kT is earned per ~1,000 tokens of inference you serve. Spendable
            on inference today; cash-redemption is planned.
          </div>

          <div className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Service value of credits (at face rate)</span>
              <span className="font-mono tabular-nums">
                ≈ {(tokensPerMonth / 1_000_000).toFixed(1)}M tokens of inference
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Your electricity cost (info only)</span>
              <span className="font-mono tabular-nums">${elec.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Platform share</span>
              <span className="font-mono tabular-nums">10% of serving rate</span>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-zinc-900/60 border border-amber-500/30 p-4 text-xs text-amber-100/90 leading-relaxed">
            <strong className="text-amber-300">Credits-only mode.</strong>{' '}
            The Service currently operates in a credits-only mode. kT credits
            are redeemable for inference on the network and <strong>do not
            convert to cash</strong>. If a cash pathway is introduced in the
            future, it will require a separate opt-in, new terms, and KYC;
            existing credits will not be converted.
          </div>

          <p className="mt-4 text-[10px] text-zinc-600 leading-relaxed">
            <strong className="text-amber-500">*</strong> Anticipated figures, not guaranteed
            earnings. Illustrative only — not financial advice, not an
            investment, not a security, not a financial product. kT credits
            are a service unit redeemable for inference on the network;
            they are not currency, not tradeable, not transferable between
            users, and carry no claim on InferLane revenue. Cash redemption
            is not offered and may never be offered. Your actual credits
            earned depend on hardware, uptime, regional demand, platform
            fees, and moderation outcomes, and may be zero.
          </p>
        </div>
      </div>
    </div>
  );
}

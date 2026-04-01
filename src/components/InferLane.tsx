'use client';

import { useEffect, useRef, useState } from 'react';

interface InferLaneProps {
  value: number; // 0-100
  size?: number;
  label: string;
  spent: string;
  budget: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

export default function InferLane({
  value,
  size = 160,
  label,
  spent,
  budget,
  color,
  gradientFrom,
  gradientTo,
}: InferLaneProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const gaugeRef = useRef<SVGCircleElement>(null);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const startAngle = 135; // Start from bottom-left
  const sweepAngle = 270; // Sweep 270 degrees (3/4 circle)
  const arcLength = (sweepAngle / 360) * circumference;

  // Determine gauge color based on remaining percentage
  const remaining = 100 - value;
  const gaugeColor = remaining < 15 ? '#ef4444' : remaining < 30 ? '#f59e0b' : color;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const offset = arcLength - (arcLength * animatedValue) / 100;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 140 140"
          className="transform -rotate-[135deg]"
        >
          {/* Background arc */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="#1e1e2e"
            strokeWidth="10"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id={`gauge-gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientFrom} />
              <stop offset="100%" stopColor={gradientTo} />
            </linearGradient>
            <filter id={`glow-${label}`}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {/* Value arc */}
          <circle
            ref={gaugeRef}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={gaugeColor}
            strokeWidth="10"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            filter={`url(#glow-${label})`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color: gaugeColor }}
          >
            {Math.round(100 - animatedValue)}%
          </span>
          <span className="text-xs text-gray-500 mt-0.5">remaining</span>
        </div>
      </div>
      <div className="text-center mt-2">
        <div className="font-semibold text-sm" style={{ color }}>{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">
          <span className="font-mono">${spent}</span>
          <span className="text-gray-600"> / </span>
          <span className="font-mono text-gray-500">${budget}</span>
        </div>
      </div>
    </div>
  );
}

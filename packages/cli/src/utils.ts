import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export function getApiKey(): string | null {
  // Check env var first
  if (process.env.INFERLANE_API_KEY) {
    return process.env.INFERLANE_API_KEY;
  }

  // Check .env file in current directory
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/INFERLANE_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }

  return null;
}

export function getBaseUrl(): string {
  return (process.env.INFERLANE_BASE_URL || 'https://inferlane.com').replace(/\/$/, '');
}

export async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function printTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] || '').length))
  );

  const separator = colWidths.map(w => '─'.repeat(w + 2)).join('┼');
  const formatRow = (cells: string[]) =>
    cells.map((c, i) => ` ${c.padEnd(colWidths[i])} `).join('│');

  console.log(formatRow(headers));
  console.log(separator);
  rows.forEach(r => console.log(formatRow(r)));
}

export function success(msg: string): void {
  console.log(`✅ ${msg}`);
}

export function warn(msg: string): void {
  console.log(`⚠️  ${msg}`);
}

export function info(msg: string): void {
  console.log(`ℹ️  ${msg}`);
}

export function error(msg: string): void {
  console.error(`❌ ${msg}`);
}

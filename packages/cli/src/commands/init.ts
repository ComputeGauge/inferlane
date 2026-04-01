import * as fs from 'fs';
import * as path from 'path';
import { prompt, success, info, warn, error } from '../utils.js';

export async function init(): Promise<void> {
  console.log('\n🚀 InferLane Setup\n');

  // Step 1: Get API key
  info('Get your API key at https://inferlane.com/dashboard/settings');
  const apiKey = await prompt('Enter your InferLane API key (il_xxx): ');

  if (!apiKey.startsWith('il_')) {
    error('Invalid API key format. Keys start with "il_"');
    process.exit(1);
  }

  // Step 2: Validate key
  info('Validating API key...');
  try {
    const res = await fetch('https://inferlane.com/api/mcp/budget-status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      success('API key is valid');
    } else {
      warn('Could not validate API key (server may be unreachable). Continuing anyway...');
    }
  } catch {
    warn('Could not reach InferLane server. Continuing with local setup...');
  }

  // Step 3: Write to .env
  const envPath = path.join(process.cwd(), '.env');
  const envLine = `INFERLANE_API_KEY=${apiKey}`;

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    if (content.includes('INFERLANE_API_KEY')) {
      // Replace existing
      const updated = content.replace(/INFERLANE_API_KEY=.+/, envLine);
      fs.writeFileSync(envPath, updated);
      success('Updated INFERLANE_API_KEY in .env');
    } else {
      fs.appendFileSync(envPath, `\n${envLine}\n`);
      success('Added INFERLANE_API_KEY to .env');
    }
  } else {
    fs.writeFileSync(envPath, `${envLine}\n`);
    success('Created .env with INFERLANE_API_KEY');
  }

  // Step 4: Check if .gitignore includes .env
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.env')) {
      fs.appendFileSync(gitignorePath, '\n.env\n');
      success('Added .env to .gitignore');
    }
  }

  // Step 5: Detect package manager and suggest install
  const hasYarn = fs.existsSync(path.join(process.cwd(), 'yarn.lock'));
  const hasPnpm = fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'));
  const hasBun = fs.existsSync(path.join(process.cwd(), 'bun.lockb'));

  let installCmd = 'npm install @inferlane/sdk';
  if (hasYarn) installCmd = 'yarn add @inferlane/sdk';
  else if (hasPnpm) installCmd = 'pnpm add @inferlane/sdk';
  else if (hasBun) installCmd = 'bun add @inferlane/sdk';

  console.log('\n📦 Next steps:\n');
  console.log(`  1. Install the SDK:  ${installCmd}`);
  console.log('  2. Use in your code:\n');
  console.log("     import { InferLane } from '@inferlane/sdk';");
  console.log("     const cg = new InferLane({ apiKey: process.env.INFERLANE_API_KEY! });");
  console.log('');
  console.log("     const response = await cg.chat({");
  console.log("       model: 'claude-sonnet-4',");
  console.log("       messages: [{ role: 'user', content: 'Hello' }],");
  console.log("       routing: 'cheapest',");
  console.log('     });');
  console.log('');

  // Step 6: Offer MCP install
  const installMcp = await prompt('Install MCP server for Claude Code? (Y/n): ');
  if (installMcp.toLowerCase() !== 'n') {
    const { mcpInstall } = await import('./mcp-install.js');
    await mcpInstall(apiKey);
  }

  console.log('\n🎉 Setup complete!\n');
}

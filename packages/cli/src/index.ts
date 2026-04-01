#!/usr/bin/env node

import { init } from './commands/init.js';
import { mcpInstall } from './commands/mcp-install.js';
import { estimate } from './commands/estimate.js';
import { status } from './commands/status.js';

const args = process.argv.slice(2);
const command = args[0];

const HELP = `
InferLane CLI — Multi-provider LLM proxy

Usage:
  inferlane <command> [options]

Commands:
  init              Interactive setup — configure API key and install SDK
  mcp-install       Install MCP server for Claude Code
  estimate <model> [input_tokens] [output_tokens]
                    Quick cost estimate from terminal
  status            Check API key, current spend, and active promotions
  help              Show this help message

Examples:
  inferlane init
  inferlane mcp-install
  inferlane estimate claude-sonnet-4 1000 500
  inferlane status

Environment:
  INFERLANE_API_KEY    Your InferLane API key (il_xxx)
  INFERLANE_BASE_URL   Custom base URL (default: https://inferlane.com)
`;

async function main() {
  switch (command) {
    case 'init':
      await init();
      break;
    case 'mcp-install':
      await mcpInstall();
      break;
    case 'estimate': {
      const model = args[1];
      if (!model) {
        console.error('Usage: inferlane estimate <model> [input_tokens] [output_tokens]');
        process.exit(1);
      }
      const inputTokens = parseInt(args[2] || '1000', 10);
      const outputTokens = parseInt(args[3] || '500', 10);
      await estimate(model, inputTokens, outputTokens);
      break;
    }
    case 'status':
      await status();
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

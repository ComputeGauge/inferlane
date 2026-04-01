import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { prompt, success, info, warn, error as logError } from '../utils.js';

export async function mcpInstall(existingApiKey?: string): Promise<void> {
  console.log('\n🔧 MCP Server Installation\n');

  const apiKey = existingApiKey || await prompt('Enter your InferLane API key (il_xxx): ');

  if (!apiKey.startsWith('il_')) {
    logError('Invalid API key format. Keys start with "il_"');
    process.exit(1);
  }

  // Claude Code MCP config path
  const claudeDir = path.join(os.homedir(), '.claude');
  const mcpConfigPath = path.join(claudeDir, 'mcp.json');

  // Ensure .claude directory exists
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  // Read existing config or create new
  let config: any = { mcpServers: {} };
  if (fs.existsSync(mcpConfigPath)) {
    try {
      config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      warn('Could not parse existing mcp.json. Creating new one.');
      config = { mcpServers: {} };
    }
  }

  // Add InferLane server
  config.mcpServers.inferlane = {
    command: 'npx',
    args: ['@inferlane/mcp-server'],
    env: {
      INFERLANE_API_KEY: apiKey,
    },
  };

  // Write config
  fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2) + '\n');
  success(`MCP server configured in ${mcpConfigPath}`);

  console.log('\n📋 Configuration added:');
  console.log(JSON.stringify({ inferlane: config.mcpServers.inferlane }, null, 2));

  console.log('\n🔄 Restart Claude Code to activate the MCP server.');
  info('Once active, Claude will have access to cost estimation, model comparison, and smart routing tools.');
}

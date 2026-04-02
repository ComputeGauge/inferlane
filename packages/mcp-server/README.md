# @inferlane/mcp-server

MCP server for InferLane with multi-provider LLM cost optimization tools for AI agents.

## Install

```bash
npm install @inferlane/mcp-server
```

## Usage

```typescript
import { InferLaneSkill } from '@inferlane/mcp-server';

const skill = new InferLaneSkill({
  apiKey: process.env.INFERLANE_API_KEY,
});

// Register with your MCP framework
server.registerSkill(skill);
```

Or run standalone:

```bash
npx @inferlane/mcp-server
```

## License

Apache-2.0

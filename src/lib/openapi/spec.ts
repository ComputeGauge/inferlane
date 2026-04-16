// OpenAPI 3.1 spec for the InferLane public API.
//
// ASVS V13.2.1 (versioning) + V14.5.1 (API documented). This is the
// source of truth; it's served from /api/openapi.json and rendered
// into docs at /docs/api.
//
// We write the spec by hand rather than generating from code
// annotations because:
//   1. The spec acts as the contract — the reviewer is a human, not
//      a generator, and we want them to read it end-to-end.
//   2. Type-level generation in Next.js App Router routes is
//      fragile; hand-authored specs are version-controllable and
//      easier to diff.
//
// This file exports the document. Routes that want to serve it
// import from here and call JSON.stringify. Keep the shape
// alphabetical inside each object so diffs remain readable.

export const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'InferLane API',
    version: '1.0.0',
    description:
      'Public HTTP API for InferLane. Covers the proxy / dispatch / ' +
      'scheduler / sessions / fleet / compute-marketplace surfaces. ' +
      'All endpoints use Bearer token authentication unless noted.',
    contact: {
      name: 'InferLane Support',
      url: 'https://inferlane.dev',
      email: 'support@inferlane.dev',
    },
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers: [
    { url: 'https://inferlane.dev', description: 'Production' },
    { url: 'https://staging.inferlane.dev', description: 'Staging' },
    { url: 'http://localhost:3000', description: 'Local dev' },
  ],
  security: [{ BearerAuth: [] }],
  tags: [
    { name: 'Proxy', description: 'LLM routing proxy endpoints' },
    { name: 'Dispatch', description: 'Async / batch / chain dispatch' },
    { name: 'Fleet', description: 'Agent fleet observability' },
    { name: 'Marketplace', description: 'Compute marketplace — buyer + operator surfaces' },
    { name: 'Attestation', description: 'TEE attestation submission + nonce issuance' },
    { name: 'Disputes', description: 'Dispute workflow for marketplace workloads' },
    { name: 'Wallet', description: 'Buyer wallet deposits + balance' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description:
          'API keys are prefixed with `il_live_` or `il_test_`. Get one at ' +
          'https://inferlane.dev/dashboard/settings',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
          details: { type: 'object', additionalProperties: true },
        },
      },
      RateLimitError: {
        allOf: [
          { $ref: '#/components/schemas/ErrorResponse' },
          {
            type: 'object',
            properties: {
              route: { type: 'string' },
              limit: { type: 'integer' },
              windowSeconds: { type: 'integer' },
            },
          },
        ],
      },
      FleetEvent: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'SESSION_START', 'SESSION_END', 'STATUS_ACTIVE', 'STATUS_IDLE',
              'AGENT_MESSAGE', 'USER_MESSAGE', 'TOOL_USE', 'TOOL_RESULT',
              'WEB_SEARCH', 'MODEL_CALL', 'ERROR', 'CUSTOM',
            ],
          },
          payload: { type: 'object', additionalProperties: true },
          model: { type: 'string' },
          inputTokens: { type: 'integer' },
          outputTokens: { type: 'integer' },
          cachedTokens: { type: 'integer' },
          activeRuntimeMs: { type: 'integer' },
          idleRuntimeMs: { type: 'integer' },
          webSearchCount: { type: 'integer' },
        },
      },
      AttestationBundle: {
        type: 'object',
        required: ['nodeOperatorId', 'type', 'evidence', 'nonce', 'collectedAt'],
        properties: {
          nodeOperatorId: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'AZURE_CONFIDENTIAL_VM',
              'GCP_CONFIDENTIAL_SPACE',
              'INTEL_TDX',
              'AMD_SEV_SNP',
              'NVIDIA_CC',
              'MOCK',
            ],
          },
          evidence: { type: 'string', description: 'Vendor-specific evidence blob (JWT or base64 quote)' },
          endorsements: { type: 'string', description: 'Optional PEM cert chain for DIY paths' },
          claimedMeasurement: { type: 'string' },
          nonce: { type: 'string' },
          collectedAt: { type: 'string', format: 'date-time' },
        },
      },
      AttestationVerdict: {
        type: 'object',
        required: ['id', 'outcome', 'summary'],
        properties: {
          id: { type: 'string' },
          outcome: {
            type: 'string',
            enum: [
              'VERIFIED', 'STALE', 'BAD_SIGNATURE', 'POLICY_VIOLATION',
              'NONCE_MISMATCH', 'UNSUPPORTED', 'ERROR',
            ],
          },
          measurement: { type: 'string', nullable: true },
          summary: { type: 'string' },
          validUntil: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
  paths: {
    '/api/fleet/sessions': {
      post: {
        tags: ['Fleet'],
        summary: 'Start a new fleet session',
        description: 'Registers a new agent session for observability.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['runtime'],
                properties: {
                  runtime: {
                    type: 'string',
                    enum: ['ANTHROPIC_MANAGED', 'CLAUDE_AGENT_SDK', 'CLAUDE_CODE', 'GOOSE', 'SWARMCLAW', 'CUSTOM'],
                  },
                  fleetId: { type: 'string' },
                  externalId: { type: 'string' },
                  agentName: { type: 'string' },
                  agentVersion: { type: 'string' },
                  model: { type: 'string' },
                  title: { type: 'string' },
                  metadata: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Session created' },
          '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Rate limited', content: { 'application/json': { schema: { $ref: '#/components/schemas/RateLimitError' } } } },
        },
      },
      get: {
        tags: ['Fleet'],
        summary: 'List recent fleet sessions',
        parameters: [
          { name: 'fleetId', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['RUNNING', 'IDLE', 'COMPLETED', 'FAILED', 'CANCELLED'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200 } },
        ],
        responses: { '200': { description: 'Sessions list' } },
      },
    },
    '/api/fleet/sessions/{sessionId}/events': {
      post: {
        tags: ['Fleet'],
        summary: 'Record fleet event(s)',
        description: 'Hot path for agent runtimes. Supports single event or { events: [...] } batches.',
        parameters: [
          { name: 'sessionId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/FleetEvent' },
                  {
                    type: 'object',
                    properties: { events: { type: 'array', items: { $ref: '#/components/schemas/FleetEvent' } } },
                  },
                ],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Event(s) recorded' },
          '400': { description: 'Bad request' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Session not found' },
          '429': { description: 'Rate limited' },
        },
      },
    },
    '/api/nodes/attestation': {
      post: {
        tags: ['Attestation'],
        summary: 'Submit a TEE attestation bundle',
        description:
          'Node daemons call this after collecting vendor-specific attestation evidence. ' +
          'The server dispatches to the appropriate verifier and records the verdict.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AttestationBundle' } },
          },
        },
        responses: {
          '201': {
            description: 'Attestation recorded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    record: { $ref: '#/components/schemas/AttestationVerdict' },
                    routingEnabled: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '400': { description: 'Bad request' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Node operator not found' },
          '429': { description: 'Rate limited' },
        },
      },
    },
    '/api/nodes/attestation/nonce': {
      get: {
        tags: ['Attestation'],
        summary: 'Issue a fresh attestation nonce',
        parameters: [
          { name: 'nodeOperatorId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Nonce issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    nonce: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

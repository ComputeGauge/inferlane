// /docs/api — renders the OpenAPI spec as Swagger UI via a CDN.
//
// We deliberately do not bundle Swagger UI in the Next.js build —
// it's 2MB of JS and the spec is static. Instead we load it from
// their CDN, configured to pull our spec from /api/openapi.json.
//
// The client-side init (with its onLoad callback) lives in
// ./swagger-loader.tsx so this file can stay a Server Component and
// still export `metadata` for SEO. Next.js cannot serialize function
// props across the Server/Client boundary.
//
// Security notes:
//   - Swagger UI is served from the official unpkg CDN pinned to a
//     specific version.
//   - The spec endpoint is same-origin so no CORS dance.

import { SwaggerLoader } from './swagger-loader';

export const metadata = {
  title: 'API Reference — InferLane',
  description:
    'Interactive OpenAPI 3.1 reference for the InferLane public API.',
};

const SWAGGER_VERSION = '5.17.14';
const SWAGGER_CSS_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;

export default function ApiDocsPage() {
  return (
    <>
      <link rel="stylesheet" href={SWAGGER_CSS_URL} />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <strong>InferLane API Reference.</strong> OpenAPI 3.1
            specification is served live from{' '}
            <a
              href="/api/openapi.json"
              className="underline text-indigo-600 hover:text-indigo-800"
            >
              /api/openapi.json
            </a>
            . For versioning policy see{' '}
            <a
              href="https://github.com/ComputeGauge/inferlane/blob/main/commercial/API_VERSIONING.md"
              className="underline text-indigo-600 hover:text-indigo-800"
              rel="noopener"
            >
              API_VERSIONING.md
            </a>
            .
          </div>
          <div id="swagger-ui" />
        </div>
      </div>
      <SwaggerLoader />
    </>
  );
}

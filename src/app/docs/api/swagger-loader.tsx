'use client';

// Client-side Swagger UI initializer for /docs/api.
//
// This file exists because <Script onLoad={...}> can't be rendered
// from a Server Component — Next.js can't serialize function props
// across the Server/Client boundary. We split the init out here so
// the parent page can stay a Server Component and still export
// `metadata` for SEO.

import Script from 'next/script';

const SWAGGER_VERSION = '5.17.14';
const SWAGGER_BUNDLE_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;

export function SwaggerLoader() {
  return (
    <Script
      src={SWAGGER_BUNDLE_URL}
      strategy="afterInteractive"
      onLoad={() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as unknown as { SwaggerUIBundle?: any };
        if (!w.SwaggerUIBundle) return;
        w.SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [w.SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout',
          docExpansion: 'list',
          defaultModelsExpandDepth: 1,
          displayRequestDuration: true,
        });
      }}
    />
  );
}

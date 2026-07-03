import 'dotenv/config';
import Lore from '@loredotlink/sdk';
import { performance } from 'node:perf_hooks';

async function main() {
  const sessionId = process.argv[2]?.trim();
  if (!sessionId) {
    throw new Error('usage: npm run trace:upload -- <claude-session-id>');
  }

  const key = process.env.LORE_UPLOAD_API_KEY?.trim();
  if (!key) {
    throw new Error('Missing LORE_UPLOAD_API_KEY. Copy .env.example to .env and set it.');
  }

  const t0 = performance.now();
  const elapsedSinceStart = () => `${(performance.now() - t0).toFixed(1)}ms`;

  const mark = (label: string, detail?: string) => {
    console.log(`${elapsedSinceStart()} ${label}${detail ? ` ${detail}` : ''}`);
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const start = performance.now();
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const url = input instanceof Request ? input.url : String(input);
    const redactedUrl = url
      .replace(/([?&]X-Amz-[^=]+)=([^&]+)/g, '$1=<redacted>')
      .replace(/([?&]Authorization=)[^&]+/gi, '$1<redacted>');

    const res = await originalFetch(input, init);
    const fetchMs = performance.now() - start;

    console.log(
      `${elapsedSinceStart()} fetch ${method} ${res.status} ${fetchMs.toFixed(1)}ms ${redactedUrl.slice(0, 260)}`
    );

    return res;
  }) as typeof fetch;

  mark('before constructor');
  const upload = new Lore.Upload(key, {
    apiHostname: process.env.LORE_API_HOSTNAME,
  });
  mark('after constructor');

  const result = await upload.uploadSessionSnapshot('claude_code', sessionId, {
    metadata: {
      source: 'lore-sdk-example-trace-upload',
    },
  });

  mark('after uploadSessionSnapshot', JSON.stringify(result));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});

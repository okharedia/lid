// Upload the built data artifacts to Vercel Blob at STABLE pathnames (no random
// suffix) so the app can fetch fixed URLs and a future pipeline can overwrite
// them in place. Uses the @vercel/blob SDK (the CLI ignores --add-random-suffix).
//
// Requires BLOB_READ_WRITE_TOKEN in the environment.
// Run: node scripts/upload-blob.mjs   (after node scripts/build-blob-data.js)

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '../ai/node_modules/@vercel/blob/dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const OUT = resolve(root, 'build/blob');

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('Missing BLOB_READ_WRITE_TOKEN. Run: vercel env pull then export it.');
  process.exit(1);
}

const FILES = [
  'lid-berlin-source-of-truth.json',
  'lid-berlin-learner-data.json',
  'lid-berlin-i18n-en.json',
];

// 60s browser cache; Vercel's CDN purges on overwrite, so a fresh publish is
// visible within ~a minute without any deploy.
const CACHE_MAX_AGE = 60;

for (const name of FILES) {
  const body = readFileSync(resolve(OUT, name));
  const result = await put(name, body, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: CACHE_MAX_AGE,
    contentType: 'application/json',
    token,
  });
  console.log(`${name} -> ${result.url}`);
}

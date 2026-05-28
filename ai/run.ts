import { config as loadEnv } from 'dotenv';

// Load .env BEFORE pipeline.ts is imported (it imports llm.ts which reads the
// env at module-load time when constructing the Anthropic client).
loadEnv({ override: true, quiet: true });

function parseLimit(argv: string[]): number | null {
  const flag = argv.find((a) => a.startsWith('--limit'));
  if (!flag) return 5;
  const eq = flag.indexOf('=');
  const raw = eq >= 0 ? flag.slice(eq + 1) : argv[argv.indexOf(flag) + 1];
  if (raw === 'all') return null;
  return Number(raw);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY (set it in ai/.env). Aborting.');
    process.exit(1);
  }
  const limit = parseLimit(process.argv.slice(2));
  if (limit !== null && (!Number.isFinite(limit) || limit <= 0)) {
    console.error(`Invalid --limit: ${limit}`);
    process.exit(1);
  }
  const { runPipeline } = await import('./pipeline.js');
  await runPipeline(limit);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

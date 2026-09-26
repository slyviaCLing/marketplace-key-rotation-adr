import { readFile } from 'node:fs/promises';
import { marketplaceRotationRequestSchema } from './rotation_request';
import { rotateMarketplaceKey } from './marketplace_rotation';

function parseArgs(argv: string[]): { input: string } {
  const inputIndex = argv.indexOf('--input');
  if (inputIndex === -1 || !argv[inputIndex + 1]) {
    throw new Error('Usage: npm run rotate -- --input ./examples/rotation-request.json');
  }
  return { input: argv[inputIndex + 1] };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const raw = await readFile(args.input, 'utf8');
  const parsed = marketplaceRotationRequestSchema.parse(JSON.parse(raw));
  const result = await rotateMarketplaceKey(parsed);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

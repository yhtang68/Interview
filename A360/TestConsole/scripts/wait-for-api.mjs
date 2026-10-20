import console from 'node:console';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const endpoint = process.env.TEST_CONSOLE_API_URL || 'http://127.0.0.1:4310/api/catalog/version';
const timeoutMs = Number(process.env.TEST_CONSOLE_API_TIMEOUT_MS || 30_000);
const deadline = Date.now() + timeoutMs;

console.log('Waiting for Test Console API...');
while (true) {
  try {
    const response = await globalThis.fetch(endpoint, { cache: 'no-store' });
    if (response.ok) {
      console.log(`API ready; starting UI: ${endpoint}`);
      break;
    }
  } catch {
    // The API process is still starting.
  }
  if (Date.now() >= deadline) {
    console.error(`Test Console API did not become ready within ${timeoutMs} ms: ${endpoint}`);
    process.exit(1);
  }
  await delay(100);
}
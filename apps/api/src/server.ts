// Local dev entry point — not used on Vercel (see handler-entry.ts)
import { buildApp } from './app.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const app = await buildApp();

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Rolvium API running on port ${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

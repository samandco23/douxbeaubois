import { initializeSite } from '../store.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Copy it from your Neon project.');
  process.exit(1);
}

await initializeSite();
console.log('Neon schema is ready and the initial site content is present.');

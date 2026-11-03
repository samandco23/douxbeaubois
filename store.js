import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import session from 'express-session';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, 'data');
const storeFile = path.join(dataDir, 'site.json');
const seedFile = path.join(dataDir, 'demo-seed.json');
let writeQueue = Promise.resolve();
const localRateLimits = new Map();
let sql = null;
if (process.env.DATABASE_URL) {
  const { neon } = await import('@neondatabase/serverless');
  sql = neon(process.env.DATABASE_URL);
}
let schemaReady;

function rewriteLegacyImagePaths(site) {
  const replacements = new Map([
    ['/hero-interior.png', '/hero-interior.webp'],
    ['/demo-table.png', '/demo-table.webp'],
    ['/demo-bed.png', '/demo-bed.webp'],
    ['/demo-desk.png', '/demo-desk.webp'],
  ]);
  const rewrite = (value) => typeof value === 'string' ? replacements.get(value) || value : value;
  if (site?.brand) site.brand.heroImage = rewrite(site.brand.heroImage);
  if (Array.isArray(site?.products)) site.products = site.products.map((product) => ({ ...product, image: rewrite(product.image) }));
  return site;
}

async function ensureSchema() {
  if (!sql) return;
  if (!schemaReady) schemaReady = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS site_state (id smallint PRIMARY KEY CHECK (id = 1), data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS project_quotes (id text PRIMARY KEY, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS admin_sessions (sid text PRIMARY KEY, sess jsonb NOT NULL, expire timestamptz NOT NULL)`;
    await sql`CREATE INDEX IF NOT EXISTS admin_sessions_expire_idx ON admin_sessions (expire)`;
    await sql`CREATE TABLE IF NOT EXISTS rate_limits (rate_key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_started timestamptz NOT NULL DEFAULT now())`;
    await sql`DELETE FROM admin_sessions WHERE expire < now()`;
    await sql`DELETE FROM rate_limits WHERE window_started < now() - interval '2 days'`;
    const rows = await sql`SELECT id FROM site_state WHERE id = 1`;
    if (!rows.length) {
      const seed = JSON.parse(await fs.readFile(seedFile, 'utf8'));
      const { quotes, ...site } = seed;
      await sql`INSERT INTO site_state (id, data) VALUES (1, ${JSON.stringify(site)}::jsonb) ON CONFLICT (id) DO NOTHING`;
    }
  })().catch(error => { schemaReady = null; throw error; });
  await schemaReady;
}

export class NeonSessionStore extends session.Store {
  async get(sid, callback) {
    try { await ensureSchema(); const rows = await sql`SELECT sess FROM admin_sessions WHERE sid = ${sid} AND expire > now()`; callback(null, rows[0]?.sess || null); }
    catch (error) { callback(error); }
  }
  async set(sid, sess, callback = () => {}) {
    try {
      await ensureSchema();
      const expiry = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000);
      await sql`INSERT INTO admin_sessions (sid, sess, expire) VALUES (${sid}, ${JSON.stringify(sess)}::jsonb, ${expiry}) ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`;
      callback();
    } catch (error) { callback(error); }
  }
  async destroy(sid, callback = () => {}) { try { await ensureSchema(); await sql`DELETE FROM admin_sessions WHERE sid = ${sid}`; callback(); } catch (error) { callback(error); } }
  async touch(sid, sess, callback = () => {}) { try { await ensureSchema(); const expiry = sess.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 8 * 60 * 60 * 1000); await sql`UPDATE admin_sessions SET expire = ${expiry}, sess = ${JSON.stringify(sess)}::jsonb WHERE sid = ${sid}`; callback(); } catch (error) { callback(error); } }
}

export async function readSite() {
  if (sql) {
    await ensureSchema();
    const [rows, quoteRows] = await Promise.all([
      sql`SELECT data FROM site_state WHERE id = 1`,
      sql`SELECT payload FROM project_quotes ORDER BY created_at DESC LIMIT 1000`,
    ]);
    const current = rows[0]?.data || {};
    const seed = JSON.parse(await fs.readFile(seedFile, 'utf8'));
    return rewriteLegacyImagePaths({ ...seed, ...current, brand: { ...seed.brand, ...current.brand }, hero: { ...seed.hero, ...current.hero }, contact: { ...seed.contact, ...current.contact }, pages: { ...seed.pages, ...current.pages }, home: { ...seed.home, ...current.home }, socials: Array.isArray(current.socials) ? current.socials : seed.socials || [], products: Array.isArray(current.products) ? current.products : seed.products || [], quotes: quoteRows.map(row => row.payload) });
  }
  let current;
  try { current = JSON.parse(await fs.readFile(storeFile, 'utf8')); }
  catch { try { current = JSON.parse(await fs.readFile(seedFile, 'utf8')); } catch { return null; } }
  let seed = {};
  try { seed = JSON.parse(await fs.readFile(seedFile, 'utf8')); } catch {}
  return rewriteLegacyImagePaths({
    ...seed, ...current,
    brand: { ...seed.brand, ...current.brand },
    hero: { ...seed.hero, ...current.hero },
    contact: { ...seed.contact, ...current.contact },
    pages: { ...seed.pages, ...current.pages },
    home: { ...seed.home, ...current.home },
    socials: Array.isArray(current.socials) ? current.socials : seed.socials || [],
    products: Array.isArray(current.products) ? current.products : seed.products || [],
    quotes: Array.isArray(current.quotes) ? current.quotes : [],
  });
}

export async function writeSite(data) {
  if (sql) {
    await ensureSchema();
    const { quotes, ...site } = data;
    await sql`INSERT INTO site_state (id, data, updated_at) VALUES (1, ${JSON.stringify(site)}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    return;
  }
  const operation = writeQueue.then(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const temp = `${storeFile}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(data, null, 2));
    await fs.rename(temp, storeFile);
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

export async function initializeSite() {
  if (sql) { await ensureSchema(); return; }
  await fs.mkdir(dataDir, { recursive: true });
  try { await fs.access(storeFile); }
  catch { const seed = await readSite(); if (seed) await writeSite(seed); }
}

export async function addQuote(quote) {
  if (sql) {
    await ensureSchema();
    await sql`INSERT INTO project_quotes (id, payload, created_at) VALUES (${String(quote.id)}, ${JSON.stringify(quote)}::jsonb, ${quote.createdAt})`;
    await sql`DELETE FROM project_quotes WHERE id IN (SELECT id FROM project_quotes ORDER BY created_at DESC OFFSET 1000)`;
    return;
  }
  const data = await readSite(); data.quotes = [quote, ...(data.quotes || [])].slice(0, 1000); await writeSite(data);
}

export async function updateQuote(id, status) {
  if (sql) { await ensureSchema(); await sql`UPDATE project_quotes SET payload = jsonb_set(payload, '{status}', to_jsonb(${status}::text)) WHERE id = ${String(id)}`; return; }
  const data = await readSite(); data.quotes = (data.quotes || []).map(item => String(item.id) === String(id) ? { ...item, status } : item); await writeSite(data);
}

export async function consumeRateLimit(key, maximum, windowMs) {
  if (sql) {
    await ensureSchema();
    const rows = await sql`INSERT INTO rate_limits (rate_key, attempts, window_started)
      VALUES (${key}, 1, now())
      ON CONFLICT (rate_key) DO UPDATE SET
        attempts = CASE WHEN rate_limits.window_started <= now() - (${windowMs} * interval '1 millisecond') THEN 1 ELSE rate_limits.attempts + 1 END,
        window_started = CASE WHEN rate_limits.window_started <= now() - (${windowMs} * interval '1 millisecond') THEN now() ELSE rate_limits.window_started END
      RETURNING attempts, window_started`;
    const row = rows[0];
    const elapsed = Date.now() - new Date(row.window_started).getTime();
    return { allowed: row.attempts <= maximum, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)) };
  }
  const now = Date.now();
  const previous = localRateLimits.get(key);
  const bucket = !previous || now - previous.startedAt >= windowMs ? { startedAt: now, attempts: 0 } : previous;
  bucket.attempts += 1;
  localRateLimits.set(key, bucket);
  return { allowed: bucket.attempts <= maximum, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - bucket.startedAt)) / 1000)) };
}

export async function resetRateLimit(key) {
  if (sql) { await ensureSchema(); await sql`DELETE FROM rate_limits WHERE rate_key = ${key}`; return; }
  localRateLimits.delete(key);
}

export async function checkDatabase() {
  if (sql) { await ensureSchema(); await sql`SELECT 1`; }
  else { await fs.access(seedFile); }
  return true;
}

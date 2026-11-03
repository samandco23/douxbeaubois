import express from 'express';
import session from 'express-session';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  addQuote, checkDatabase, consumeRateLimit, initializeSite, NeonSessionStore,
  readSite, resetRateLimit, updateQuote, writeSite,
} from './store.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const sessionSecret = process.env.SESSION_SECRET || 'local-development-session-secret';

if (production && (!process.env.DATABASE_URL || !process.env.ADMIN_USER || !process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET || !process.env.BLOB_READ_WRITE_TOKEN)) {
  throw new Error('Configure DATABASE_URL, ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET et BLOB_READ_WRITE_TOKEN dans Vercel.');
}
if (production && (process.env.ADMIN_PASSWORD.length < 12 || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('ADMIN_PASSWORD doit faire au moins 12 caractères et SESSION_SECRET au moins 32 caractères.');
}

const app = express();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
app.disable('x-powered-by');
if (production) app.set('trust proxy', 1);

app.use((req, res, next) => {
  req.requestId = randomUUID();
  const startedAt = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api/') && (res.statusCode >= 400 || req.path === '/api/health')) {
      console.info(JSON.stringify({ event: 'http_request', requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt }));
    }
  });
  res.setHeader('X-Request-Id', req.requestId);
  next();
});
app.use(express.json({ limit: '4mb', type: 'application/json' }));
if (!production) app.use('/uploads', express.static(path.join(root, 'uploads'), { maxAge: '1y', immutable: true }));
app.use(session({
  name: 'dbb.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: process.env.DATABASE_URL ? new NeonSessionStore() : undefined,
  cookie: { httpOnly: true, sameSite: 'strict', secure: production, maxAge: 8 * 60 * 60 * 1000 },
}));

const adminUser = process.env.ADMIN_USER || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'BoisAdmin2026!';

function safeEqual(left, right) {
  const a = createHash('sha256').update(String(left ?? '')).digest();
  const b = createHash('sha256').update(String(right ?? '')).digest();
  return timingSafeEqual(a, b);
}

function rateKey(scope, req) {
  return createHash('sha256').update(`${scope}:${req.ip || req.socket.remoteAddress || 'unknown'}:${sessionSecret}`).digest('hex');
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return production ? res.status(403).json({ error: 'Origine de requête manquante.' }) : next();
  try {
    const expectedOrigin = `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;
    if (new URL(origin).origin !== expectedOrigin) return res.status(403).json({ error: 'Origine de requête refusée.' });
  } catch { return res.status(403).json({ error: 'Origine de requête invalide.' }); }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.admin) return res.status(401).json({ error: 'Session administrateur requise.' });
  next();
}

function isSafeWebUrl(value, allowRelative = false) {
  if (typeof value !== 'string' || !value.trim()) return true;
  if (allowRelative && value.startsWith('/') && !value.startsWith('//')) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}

function validateSite(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Contenu du site invalide.';
  if (Buffer.byteLength(JSON.stringify(data)) > 1_000_000) return 'Le contenu du site dépasse la taille maximale autorisée.';
  if (!Array.isArray(data.products) || data.products.length > 120) return 'Le catalogue doit contenir au maximum 120 créations.';
  if (!Array.isArray(data.socials) || data.socials.length > 20) return 'La liste des réseaux est invalide.';
  for (const key of ['primary', 'secondary', 'background', 'text', 'accent']) {
    if (data.brand?.[key] !== undefined && !/^#[0-9a-f]{6}$/i.test(data.brand[key])) return `La couleur « ${key} » est invalide.`;
  }
  for (const social of data.socials) {
    if (!isSafeWebUrl(social?.url)) return 'Un lien de réseau social doit commencer par http ou https.';
  }
  for (const image of [data.brand?.logo, data.brand?.heroImage, ...data.products.map((product) => product?.image)]) {
    if (typeof image !== 'string' || !image) continue;
    if ((production || process.env.DATABASE_URL) && image.startsWith('data:')) return 'Les images doivent être téléversées dans le stockage média avant d’enregistrer le site.';
    if (!image.startsWith('data:') && !isSafeWebUrl(image, true)) return 'Une adresse d’image est invalide.';
  }
  if (data.contact?.whatsapp && !isSafeWebUrl(data.contact.whatsapp)) return 'Le lien WhatsApp est invalide.';
  return null;
}

function blobHeaders(token, requestId, attempt = '0') {
  const storeId = token.split('_')[3];
  if (!storeId) throw Error('Invalid Vercel Blob token.');
  return {
    authorization: `Bearer ${token}`,
    'x-api-blob-request-id': `${storeId}:${Date.now()}:${requestId}`,
    'x-vercel-blob-store-id': storeId,
    'x-api-blob-request-attempt': attempt,
    'x-api-version': '13',
  };
}

async function uploadPublicBlob(pathname, bytes, contentType, requestId) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const response = await fetch(`https://vercel.com/api/blob/?${new URLSearchParams({ pathname })}`, {
    method: 'PUT',
    headers: {
      ...blobHeaders(token, requestId),
      'x-vercel-blob-access': 'public',
      'x-content-type': contentType,
      'x-add-random-suffix': '1',
      'x-cache-control-max-age': String(60 * 60 * 24 * 365),
    },
    body: bytes,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.url !== 'string') throw Error(`Vercel Blob returned ${response.status}.`);
  return result.url;
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await checkDatabase();
  res.json({ status: 'ok', database: process.env.DATABASE_URL ? 'connected' : 'local' });
}));

app.get('/api/site', asyncRoute(async (_req, res) => {
  const site = await readSite();
  if (!site) return res.status(503).json({ error: 'Le contenu du site est indisponible.' });
  res.set('Cache-Control', 'no-store');
  res.json(site);
}));

app.post('/api/quotes', requireSameOrigin, asyncRoute(async (req, res) => {
  const { name, phone, email, project, budget, message, company } = req.body || {};
  if (company) return res.status(400).json({ error: 'Demande invalide.' });
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || typeof phone !== 'string' || !phone.trim() || phone.length > 50 || typeof project !== 'string' || !project.trim() || project.length > 120 || typeof message !== 'string' || !message.trim() || message.length > 3000) {
    return res.status(400).json({ error: 'Vérifiez le nom, le téléphone, le type de projet et le message.' });
  }
  if (email && (typeof email !== 'string' || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  const limit = await consumeRateLimit(rateKey('quote', req), 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfterSeconds));
    return res.status(429).json({ error: 'Trop de demandes envoyées. Réessayez plus tard.' });
  }
  await addQuote({ id: randomUUID(), name: name.trim(), phone: phone.trim(), email: String(email || '').trim(), project: project.trim(), budget: String(budget || '').slice(0, 80), message: message.trim(), createdAt: new Date().toISOString(), status: 'Nouveau' });
  res.status(201).json({ ok: true });
}));

app.post('/api/admin/login', requireSameOrigin, asyncRoute(async (req, res) => {
  const limit = await consumeRateLimit(rateKey('admin-login', req), 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfterSeconds));
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
  }
  const { username, password } = req.body || {};
  const valid = safeEqual(username, adminUser) && safeEqual(password, adminPassword);
  if (!valid) return res.status(401).json({ error: 'Identifiants incorrects.' });
  await resetRateLimit(rateKey('admin-login', req));
  req.session.regenerate((error) => {
    if (error) return res.status(500).json({ error: 'Connexion impossible.', requestId: req.requestId });
    req.session.admin = true;
    req.session.save((saveError) => saveError ? res.status(500).json({ error: 'Session impossible à enregistrer.', requestId: req.requestId }) : res.json({ ok: true }));
  });
}));

app.get('/api/admin/session', (req, res) => res.set('Cache-Control', 'no-store').json({ authenticated: !!req.session?.admin }));
app.post('/api/admin/logout', requireSameOrigin, requireAdmin, (req, res) => req.session.destroy((error) => error ? res.status(500).json({ error: 'Déconnexion impossible.' }) : res.clearCookie('dbb.sid', { httpOnly: true, sameSite: 'strict', secure: production }).json({ ok: true })));

app.put('/api/admin/site', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
  const validationError = validateSite(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  await writeSite(req.body);
  res.json({ ok: true });
}));

app.put('/api/admin/quote/:id', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
  const { status } = req.body || {};
  if (!['Nouveau', 'En cours', 'Terminé'].includes(status)) return res.status(400).json({ error: 'Statut de demande invalide.' });
  await updateQuote(req.params.id, status);
  res.json({ ok: true });
}));

app.post('/api/admin/media', requireSameOrigin, requireAdmin, asyncRoute(async (req, res) => {
  const match = typeof req.body?.data === 'string' && req.body.data.match(/^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return res.status(400).json({ error: 'Image invalide. Choisissez un fichier PNG, JPEG ou WebP.' });
  const contentType = match[1];
  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > 2_500_000) return res.status(413).json({ error: 'Image trop volumineuse après optimisation (maximum 2,5 Mo).' });
  const isValidImage = contentType === 'image/png' ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : contentType === 'image/jpeg' ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
      : image.toString('ascii', 0, 4) === 'RIFF' && image.toString('ascii', 8, 12) === 'WEBP';
  if (!isValidImage) return res.status(400).json({ error: 'Le fichier ne contient pas une image valide.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (production || process.env.DATABASE_URL) return res.status(503).json({ error: 'Configurez Vercel Blob pour téléverser les images avec Neon.' });
    const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp';
    const filename = `${randomUUID()}.${extension}`;
    const uploadDir = path.join(root, 'uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), image, { flag: 'wx' });
    return res.status(201).json({ url: `/uploads/${filename}`, local: true });
  }
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp';
  const pathname = `doux-beau-bois/${randomUUID()}.${extension}`;
  try {
    const url = await uploadPublicBlob(pathname, image, contentType, req.requestId);
    res.status(201).json({ url });
  } catch (error) {
    const status = Number(error.status) || 502;
    console.error(JSON.stringify({ event: 'blob_upload_failed', requestId: req.requestId, status, message: error.message }));
    return res.status(502).json({ error: 'Le stockage des images a refusé le téléversement.', requestId: req.requestId });
  }
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route API introuvable.' }));
app.use((error, req, res, _next) => {
  const status = Number(error.status || error.statusCode) || 500;
  console.error(JSON.stringify({ event: 'application_error', requestId: req.requestId, method: req.method, path: req.path, status, message: status >= 500 ? 'Internal server error' : error.message }));
  if (res.headersSent) return;
  res.status(status >= 400 && status < 500 ? status : 500).json({ error: status === 413 ? 'Requête trop volumineuse.' : 'Une erreur est survenue. Réessayez plus tard.', requestId: req.requestId });
});

export default app;

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 4179);
  await initializeSite();
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(root, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  }
  app.listen(port, () => console.log(`Doux Beau Bois API: http://localhost:${port}`));
}

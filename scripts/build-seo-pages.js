import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('dist');
const baseHtml = await fs.readFile(path.join(output, 'index.html'), 'utf8');
const baseUrl = (process.env.PUBLIC_SITE_URL || 'https://douxbeaubois.com').replace(/\/$/, '');
const pages = [
  { path: '/', title: 'Doux Beau Bois — Le bois travaillé, l’élégance révélée', description: 'Mobilier, menuiserie et aménagements en bois façonnés sur mesure avec soin au Cameroun.' },
  { path: '/catalogue', title: 'Nos créations — Doux Beau Bois', description: 'Découvrez le mobilier et les aménagements en bois réalisés par Doux Beau Bois.' },
  { path: '/a-propos', title: 'À propos — Doux Beau Bois', description: 'Découvrez l’approche, le savoir-faire et les créations de Doux Beau Bois.' },
  { path: '/contact', title: 'Contact — Doux Beau Bois', description: 'Contactez Doux Beau Bois pour votre projet de mobilier ou d’aménagement sur mesure.' },
  { path: '/devis', title: 'Demander un devis — Doux Beau Bois', description: 'Présentez votre projet de mobilier, menuiserie ou aménagement à Doux Beau Bois.' },
];

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

for (const page of pages) {
  const canonical = `${baseUrl}${page.path === '/' ? '/' : page.path}`;
  let html = baseHtml.replaceAll('https://douxbeaubois.com', baseUrl)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(page.description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(page.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*("\s*\/?>)/, `$1${escapeHtml(page.description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*("\s*\/?>)/, `$1${canonical}$2`);
  if (!/<link rel="canonical"/.test(html)) html = html.replace('</head>', `  <link rel="canonical" href="${canonical}" />\n  </head>`);
  else html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
  if (page.path !== '/') {
    const dir = path.join(output, page.path.slice(1));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), html);
  }
}

const urls = pages.map(({ path: route }) => `  <url><loc>${baseUrl}${route === '/' ? '/' : route}</loc><changefreq>monthly</changefreq><priority>${route === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n');
await fs.writeFile(path.join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
await fs.writeFile(path.join(output, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${baseUrl}/sitemap.xml\n`);

// Builds the website: every page in src/pages gets the shared head, header and footer
// (src/partials), then Tailwind compiles assets/site.css from src/site.css.
//   node build.mjs   (or npm run site)   build once
// Edit the files in src/ — the .html files in the root are generated.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
// Windows line endings are turned into plain ones first (the front matter is read line by line).
const plain = (s) => s.replace(/\r\n?/g, '\n');
const part = (n) => plain(readFileSync(join(ROOT, 'src/partials', n + '.html'), 'utf8'));
const VERSION = Date.now().toString(36);

for (const file of readdirSync(join(ROOT, 'src/pages')).filter((f) => f.endsWith('.html'))) {
  let src = plain(readFileSync(join(ROOT, 'src/pages', file), 'utf8'));
  // Front matter: <!--meta key: value ... -->
  const meta = {};
  src = src.replace(/^<!--meta([\s\S]*?)-->\s*/, (_, body) => {
    for (const line of body.split('\n')) {
      const m = line.match(/^\s*([a-z_]+):\s?(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
    return '';
  });
  const extraHead = (src.match(/<!--head([\s\S]*?)-->/) || [, ''])[1].trim();
  src = src.replace(/<!--head[\s\S]*?-->\s*/, '');
  const scripts = (src.match(/<!--scripts([\s\S]*?)-->/) || [, ''])[1].trim();
  src = src.replace(/<!--scripts[\s\S]*?-->\s*/, '');
  const fill = (html) => html
    .replace(/\{\{nav:([a-z]+)\}\}/g, (_, k) => (meta.nav === k ? 'active' : ''))
    .replace(/\{\{title\}\}/g, meta.title || 'BAH Transporters')
    .replace(/\{\{description\}\}/g, meta.description || '')
    .replace(/\{\{path\}\}/g, meta.path || '/')
    .replace(/\{\{body_class\}\}/g, meta.body_class || '')
    .replace(/\{\{version\}\}/g, VERSION)
    .replace(/\{\{extra_head\}\}/g, extraHead)
    .replace(/\{\{mobile_cta\}\}/g, meta.mobile_cta === 'no' ? '' : part('mobile-cta'));
  // layout: bare = a document page (the invoice) without the site header and footer.
  const bare = meta.layout === 'bare';
  const html = [
    fill(part('head')),
    bare ? '' : fill(part('header')),
    src.trim(),
    bare ? '' : fill(part('footer')),
    `  <script src="/assets/config.js?v=${VERSION}"></script>`,
    `  <script src="/assets/site.js?v=${VERSION}" defer></script>`,
    scripts.replace(/\{\{version\}\}/g, VERSION),
    '</body>\n</html>\n',
  ].filter(Boolean).join('\n');
  writeFileSync(join(ROOT, file), html.replace(/\r\n/g, '\n'));
  console.log('page', file);
}

// Tailwind (the copy installed in the admin app; nothing extra to install here).
const candidates = [
  join(ROOT, 'node_modules/tailwindcss/lib/cli.js'),
  join(ROOT, '../BAH Transporters Admin App/node_modules/tailwindcss/lib/cli.js'),
];
const cli = candidates.find(existsSync);
if (!cli) throw new Error('Tailwind not found — run npm install in the admin app folder');
execFileSync(process.execPath, [cli, '-c', join(ROOT, 'tailwind.config.js'), '-i', join(ROOT, 'src/site.css'), '-o', join(ROOT, 'assets/site.css'), '--minify'], { stdio: 'inherit', cwd: ROOT });
console.log('css assets/site.css');

import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

export function pageTitle(md, fallback) {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1] : fallback;
}

// The ONLY markup template. Restyle here in a later /frontend-design pass.
export function renderPage({ title, bodyHtml, homeHref }) {
  const nav = homeHref ? `<nav><a href="${homeHref}">&larr; all</a></nav>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  /* PLACEHOLDER styling — replaced via /frontend-design. Keep readable on mobile. */
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 1rem 1.1rem 4rem; max-width: 46rem; }
  h1 { font-size: 1.6rem; } h2 { margin-top: 1.6rem; }
  nav { margin-bottom: 1rem; } a { color: #06c; }
  ul { padding-left: 1.2rem; } li { margin: .2rem 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 2rem 0; }
</style>
</head>
<body>
${nav}
<main>
${bodyHtml}
</main>
</body>
</html>`;
}

function readDocs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = basename(f, '.md');
      const md = readFileSync(join(dir, f), 'utf8');
      return { slug, title: pageTitle(md, slug), md };
    });
}

export function buildSite({ recipesDir, cooksDir, outDir }) {
  const recipes = readDocs(recipesDir).sort((a, b) => a.title.localeCompare(b.title));
  const cooks = readDocs(cooksDir).sort((a, b) => b.slug.localeCompare(a.slug)); // newest first

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const r of recipes) {
    writeFileSync(
      join(outDir, `recipe-${r.slug}.html`),
      renderPage({ title: r.title, bodyHtml: marked.parse(r.md), homeHref: 'index.html' }),
    );
  }
  for (const c of cooks) {
    writeFileSync(
      join(outDir, `cook-${c.slug}.html`),
      renderPage({ title: c.title, bodyHtml: marked.parse(c.md), homeHref: 'index.html' }),
    );
  }

  const latest = cooks[0];
  const pastCooks = cooks.slice(1);
  const body = [
    '<h1>Cook</h1>',
    latest
      ? `<h2>Latest cook</h2>\n<p><a href="cook-${latest.slug}.html">${latest.title}</a></p>\n${marked.parse(latest.md)}`
      : '<p>No cooks yet.</p>',
    '<hr>',
    '<h2>Recipes</h2>',
    recipes.length
      ? `<ul>${recipes.map((r) => `<li><a href="recipe-${r.slug}.html">${r.title}</a></li>`).join('')}</ul>`
      : '<p>No recipes yet.</p>',
    pastCooks.length
      ? `<h2>Past cooks</h2>\n<ul>${pastCooks.map((c) => `<li><a href="cook-${c.slug}.html">${c.title}</a></li>`).join('')}</ul>`
      : '',
  ].join('\n');

  writeFileSync(join(outDir, 'index.html'), renderPage({ title: 'Cook', bodyHtml: body }));

  return {
    recipes: recipes.map(({ slug, title }) => ({ slug, title })),
    cooks: cooks.map(({ slug, title }) => ({ slug, title })),
  };
}

// Run directly: build the real repo (bin/.. is the repo root).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = buildSite({
    recipesDir: join(root, 'recipes'),
    cooksDir: join(root, 'cooks'),
    outDir: join(root, 'site'),
  });
  console.log(`Built ${manifest.recipes.length} recipes, ${manifest.cooks.length} cooks → site/`);
}

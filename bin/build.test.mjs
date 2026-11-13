import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pageTitle, renderPage, buildSite } from './build.mjs';

test('pageTitle extracts the first h1', () => {
  assert.equal(pageTitle('# Thai Red Curry\n\nbody', 'fallback'), 'Thai Red Curry');
});

test('pageTitle uses fallback when no h1', () => {
  assert.equal(pageTitle('no heading here', 'my-slug'), 'my-slug');
});

test('renderPage embeds title and body in a full document', () => {
  const html = renderPage({ title: 'Beef Stew', bodyHtml: '<p>hi</p>', homeHref: 'index.html' });
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<title>Beef Stew<\/title>/);
  assert.match(html, /<p>hi<\/p>/);
  assert.match(html, /href="index.html"/);
});

test('buildSite renders recipes, cooks, and an index', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cook-'));
  const recipesDir = join(root, 'recipes');
  const cooksDir = join(root, 'cooks');
  const outDir = join(root, 'site');
  await mkdir(recipesDir); await mkdir(cooksDir);
  await writeFile(join(recipesDir, 'thai.md'), '# Thai Curry\n\nyum');
  await writeFile(join(cooksDir, '2026-07-01.md'), '# Cook 2026-07-01\n\nold');
  await writeFile(join(cooksDir, '2026-07-20.md'), '# Cook 2026-07-20\n\nnew');

  const manifest = buildSite({ recipesDir, cooksDir, outDir });

  assert.deepEqual(manifest.recipes, [{ slug: 'thai', title: 'Thai Curry' }]);
  // newest cook first
  assert.equal(manifest.cooks[0].slug, '2026-07-20');

  const files = await readdir(outDir);
  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('recipe-thai.html'));
  assert.ok(files.includes('cook-2026-07-20.html'));

  const index = await readFile(join(outDir, 'index.html'), 'utf8');
  assert.match(index, /Thai Curry/);        // recipe listed
  assert.match(index, /Cook 2026-07-20/);    // latest cook featured
  const recipe = await readFile(join(outDir, 'recipe-thai.html'), 'utf8');
  assert.match(recipe, /<h1>Thai Curry<\/h1>/);
});

test('buildSite lists side-* recipes in their own Sides section', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cook-'));
  const recipesDir = join(root, 'recipes');
  const cooksDir = join(root, 'cooks');
  const outDir = join(root, 'site');
  await mkdir(recipesDir); await mkdir(cooksDir);
  await writeFile(join(recipesDir, 'thai.md'), '# Thai Curry\n\nyum');
  await writeFile(join(recipesDir, 'side-mash.md'), '# Side — Mash\n\nsoft');

  buildSite({ recipesDir, cooksDir, outDir });

  const files = await readdir(outDir);
  assert.ok(files.includes('recipe-side-mash.html'));
  const index = await readFile(join(outDir, 'index.html'), 'utf8');
  const [mains, sides] = index.split('<h2>Sides</h2>');
  assert.ok(sides, 'index has a Sides section');
  assert.match(mains, /Thai Curry/);
  assert.doesNotMatch(mains, /Mash/);
  assert.match(sides, /Side — Mash/);
});

test('renderPage links the home-screen icon and runs standalone', () => {
  const html = renderPage({ title: 'X', bodyHtml: '' });
  assert.match(html, /<link rel="apple-touch-icon" href="apple-touch-icon.png">/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Cook">/);
});

test('buildSite copies static files into the site root', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cook-static-'));
  for (const d of ['recipes', 'cooks', 'static']) await mkdir(join(dir, d));
  await writeFile(join(dir, 'static', 'apple-touch-icon.png'), 'png');
  buildSite({
    recipesDir: join(dir, 'recipes'),
    cooksDir: join(dir, 'cooks'),
    staticDir: join(dir, 'static'),
    outDir: join(dir, 'site'),
  });
  assert.equal(await readFile(join(dir, 'site', 'apple-touch-icon.png'), 'utf8'), 'png');
});

test('renderPage has a keep-screen-on button, hidden until wake lock is supported', () => {
  const html = renderPage({ title: 'X', bodyHtml: '' });
  assert.match(html, /<button id="wake-btn"[^>]*hidden/);
  assert.match(html, /navigator\.wakeLock/);
  assert.match(html, /cook-wake-until/);
});

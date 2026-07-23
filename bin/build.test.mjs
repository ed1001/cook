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

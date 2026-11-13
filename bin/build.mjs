import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

export function pageTitle(md, fallback) {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1] : fallback;
}

// ── Sectioning ──────────────────────────────────────────────────────────────
// Cook & recipe pages are tabbed: markdown is split on h2 headings, each
// section classified into a tab. Content files are never modified — hidden
// sections (macros, reheat) are simply not rendered.

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function splitSections(md) {
  const lines = md.split('\n');
  const sections = [{ heading: null, lines: [] }];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^##\s+/.test(line)) {
      sections.push({ heading: line.replace(/^##\s+/, '').trim(), lines: [line] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }
  return sections.map((s) => ({ heading: s.heading, md: s.lines.join('\n') }));
}

function classifyCookSection(heading) {
  const t = heading.toLowerCase();
  if (/^shopping/.test(t)) return 'shop';
  if (/^mise|^prep/.test(t)) return 'prep';
  if (/^cook plan/.test(t)) return 'plan';
  if (/^freeze/.test(t)) return 'freeze';
  return 'dish';
}

function classifyRecipeSection(heading) {
  const t = heading.toLowerCase();
  if (/macro|^reheat/.test(t)) return 'hide';
  if (/^ingredient/.test(t)) return 'ingredients';
  return 'method';
}

const TAB_LABELS = { shop: 'Shop', prep: 'Prep', cook: 'Cook', ingredients: 'Ingredients', method: 'Method' };

function dishLabel(heading) {
  return heading.replace(/\s*\([^)]*\)/g, '').trim();
}

function tabBar(tabs) {
  return `<nav class="tabs" aria-label="Sections">${tabs
    .map((t) => `<button class="tab" type="button" data-go="${t}"><span class="tlabel">${TAB_LABELS[t]}</span><span class="badge"></span></button>`)
    .join('')}</nav>`;
}

function tabTail(tab) {
  return `<div class="sec sec-tail" data-tab="${tab}"><button class="clear" type="button" data-clear="${tab}">Clear ticks</button></div>`;
}

// Split a cook/recipe markdown doc into tabbed sections; falls back to a
// plain render when the doc has no h2 sections.
export function sectionedBody(md, kind) {
  const secs = splitSections(md);
  const rest = secs.slice(1);
  if (!rest.length) return marked.parse(md);

  const out = [marked.parse(secs[0].md)];
  let tabs = [];
  const seen = (t) => { if (!tabs.includes(t)) tabs.push(t); };

  if (kind === 'cook') {
    const early = []; // shop/prep panes, doc order
    const cookParts = []; // plan, dishes, freeze — doc order
    const dishes = [];
    for (const s of rest) {
      const c = classifyCookSection(s.heading);
      if (c === 'shop' || c === 'prep') {
        seen(c);
        early.push(`<section class="sec" data-tab="${c}">${marked.parse(s.md)}</section>`);
      } else {
        seen('cook');
        const role = c === 'dish' ? 'dish' : c;
        if (c === 'dish') dishes.push(s);
        cookParts.push(`<section class="sec" data-tab="cook" data-role="${role}">${marked.parse(s.md)}</section>`);
      }
    }
    tabs = ['shop', 'prep', 'cook'].filter((t) => tabs.includes(t));
    out.push(...early);
    if (dishes.length) {
      const chips = dishes
        .map((d) => `<button class="chip" type="button">${escapeHtml(dishLabel(d.heading))}</button>`)
        .join('');
      out.push(`<div class="sec cook-controls" data-tab="cook"><div class="seg"><button type="button" data-v="recipe">By recipe</button><button type="button" data-v="inter">Interleaved</button></div><div class="chips">${chips}</div></div>`);
    }
    out.push(...cookParts);
  } else {
    for (const s of rest) {
      const c = classifyRecipeSection(s.heading);
      if (c === 'hide') continue;
      seen(c);
      out.push(`<section class="sec" data-tab="${c}">${marked.parse(s.md)}</section>`);
    }
    tabs = ['ingredients', 'method'].filter((t) => tabs.includes(t));
  }

  if (!tabs.length) return marked.parse(md);
  out.push(...tabs.map(tabTail));
  out.push(tabBar(tabs));
  return out.join('\n');
}

// ── Presentation ────────────────────────────────────────────────────────────
// "Butcher-paper workshop" theme: warm kraft paper, heavy ink, oversized
// Fraunces step numerals, grease-pencil ticks, per-tab accent colors.
// Phone-first — bottom tab bar, tap-to-check lists, light/dark aware.
// This CSS + JS block is the whole design surface; edit here to restyle.

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,500&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

const STYLE = `<style>
:root{
  --paper:#eddfc9; --paper2:#e4d3b8; --card:#f7f0df; --ink:#241a10; --muted:#7d6b52;
  --line:rgba(36,26,16,.18); --line2:rgba(36,26,16,.09);
  --acc-shop:#357a4c; --acc-prep:#a8700f; --acc-cook:#bd3818;
  --accent:#bd3818; --accent-soft:#d99a2b;
  --shadow:0 1px 2px rgba(36,26,16,.06),0 10px 26px -14px rgba(36,26,16,.28);
  --done:#a3937c;
}
:root[data-theme="dark"]{
  --paper:#171009; --paper2:#1f150c; --card:#231a11; --ink:#f2e6d0; --muted:#a8977f;
  --line:rgba(242,230,208,.17); --line2:rgba(242,230,208,.08);
  --acc-shop:#5cb87c; --acc-prep:#dfa02e; --acc-cook:#f0684a;
  --accent:#f0684a; --accent-soft:#dfa02e;
  --shadow:0 1px 2px rgba(0,0,0,.35),0 12px 32px -14px rgba(0,0,0,.65);
  --done:#6d5f4b;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --paper:#171009; --paper2:#1f150c; --card:#231a11; --ink:#f2e6d0; --muted:#a8977f;
    --line:rgba(242,230,208,.17); --line2:rgba(242,230,208,.08);
    --acc-shop:#5cb87c; --acc-prep:#dfa02e; --acc-cook:#f0684a;
    --accent:#f0684a; --accent-soft:#dfa02e;
    --shadow:0 1px 2px rgba(0,0,0,.35),0 12px 32px -14px rgba(0,0,0,.65);
    --done:#6d5f4b;
  }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; font-family:"Hanken Grotesk",system-ui,sans-serif; font-size:18px; line-height:1.6;
  color:var(--ink); background:var(--paper);
  background-image:radial-gradient(120% 60% at 100% -10%,var(--paper2),transparent 60%),
    radial-gradient(90% 50% at -10% 110%,var(--paper2),transparent 55%);
  background-attachment:fixed;
  -webkit-tap-highlight-color:transparent;
}
/* butcher-paper grain */
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.55;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");}
:root[data-theme="dark"] body::before{mix-blend-mode:screen;opacity:.35}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) body::before{mix-blend-mode:screen;opacity:.35}}

/* per-tab accent scoping */
.sec[data-tab="shop"],.tab[data-go="shop"],.sec[data-tab="ingredients"],.tab[data-go="ingredients"]{--accent:var(--acc-shop)}
.sec[data-tab="prep"],.tab[data-go="prep"]{--accent:var(--acc-prep)}
.sec[data-tab="cook"],.tab[data-go="cook"],.sec[data-tab="method"],.tab[data-go="method"]{--accent:var(--acc-cook)}

.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;
  gap:.5rem;padding:.7rem 1.1rem;border-bottom:2px solid var(--ink);
  background:color-mix(in srgb,var(--paper) 86%,transparent);backdrop-filter:blur(10px) saturate(1.2);}
.brand{font-family:"Fraunces",serif;font-weight:900;font-size:1.3rem;letter-spacing:-.01em;color:var(--ink);
  text-decoration:none;display:inline-flex;align-items:center;gap:.45rem}
.brand .dot{width:.55rem;height:.55rem;border-radius:50%;background:var(--acc-cook);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc-cook) 22%,transparent)}
.bar-right{display:flex;align-items:center;gap:.4rem}
.back{font-size:.8rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ink);
  text-decoration:none;padding:.45rem .75rem;border:1.5px solid var(--ink);border-radius:999px}
.back:active{background:var(--line2)}
.theme{font-size:1rem;line-height:1;background:none;border:1.5px solid var(--ink);color:var(--ink);
  width:2.3rem;height:2.3rem;border-radius:50%;cursor:pointer}
.theme:active{background:var(--line2)}
.wake{font-size:.95rem}
.wake.on{background:var(--accent);border-color:var(--accent);color:#fff}
.wake.paused{border-style:dashed}

main{position:relative;z-index:1;max-width:44rem;margin:0 auto;padding:1.3rem 1.1rem 4.5rem;overflow-wrap:anywhere}
body.k-cook main,body.k-recipe main{padding-bottom:8rem}

/* headings */
h1{font-family:"Fraunces",serif;font-weight:900;font-size:clamp(2.1rem,9vw,3.1rem);line-height:1.02;
  letter-spacing:-.025em;margin:.2rem 0 .6rem}
h2{font-family:"Fraunces",serif;font-weight:700;font-size:1.6rem;letter-spacing:-.015em;line-height:1.15;
  margin:2.4rem 0 .8rem;padding-bottom:.4rem;position:relative}
h2::after{content:"";position:absolute;left:0;bottom:-1px;width:2.6rem;height:4px;border-radius:2px;background:var(--accent)}
.sec > h2:first-child{margin-top:.7rem}
h3{font-family:"Hanken Grotesk",sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:.8rem;
  font-weight:800;color:var(--accent);margin:1.7rem 0 .4rem;display:flex;align-items:center;gap:.6rem}
h3::after{content:"";flex:1;height:1px;background:var(--line);opacity:.7}
h4{font-family:"Fraunces",serif;font-weight:700;font-size:1.2rem;letter-spacing:-.01em;line-height:1.2;
  color:var(--ink);margin:1.5rem 0 .1rem}
h4 + ul{margin-top:.2rem}
p{margin:.6rem 0}
a{color:var(--accent);text-underline-offset:3px}
strong{font-weight:700}
em{font-style:italic;color:var(--muted)}
hr{border:none;border-top:1px dashed var(--line);margin:2.2rem 0}
blockquote{margin:1rem 0;padding:.6rem 1rem;border-left:3px solid var(--accent-soft);
  background:var(--card);border-radius:0 10px 10px 0;color:var(--muted);box-shadow:var(--shadow)}

/* recipe/cook meta line: "**2× each** — ..." renders as a leading <p><strong> */
main > p:first-of-type strong:first-child{color:var(--acc-cook)}

/* ── tab visibility ─────────────────────────────────────────────────── */
/* No JS → no data-tab on body → everything visible (graceful fallback). */
body[data-tab] main .sec{display:none}
body[data-tab="shop"] .sec[data-tab="shop"],
body[data-tab="prep"] .sec[data-tab="prep"],
body[data-tab="cook"] .sec[data-tab="cook"],
body[data-tab="ingredients"] .sec[data-tab="ingredients"],
body[data-tab="method"] .sec[data-tab="method"]{display:block}
/* cook views: by-recipe hides plan/freeze + non-active dishes; interleaved hides chips */
body[data-view="recipe"] .sec[data-role="plan"],
body[data-view="recipe"] .sec[data-role="freeze"]{display:none!important}
body[data-view="recipe"] .sec[data-role="dish"]:not(.dish-on){display:none!important}
body[data-view="inter"] .chips{display:none}

/* ── bottom tab bar ─────────────────────────────────────────────────── */
.tabs{position:fixed;left:0;right:0;bottom:0;z-index:20;display:flex;
  background:color-mix(in srgb,var(--card) 94%,transparent);backdrop-filter:blur(12px) saturate(1.2);
  border-top:2px solid var(--ink);padding:.3rem .4rem calc(.4rem + env(safe-area-inset-bottom))}
/* iOS Safari can leave the fixed bar hovering above the screen edge while its
   toolbar collapses mid-scroll — extend the bar's background down to fill the gap */
.tabs::after{content:"";position:absolute;left:0;right:0;top:100%;height:120px;
  background:color-mix(in srgb,var(--card) 94%,transparent)}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:.1rem;padding:.55rem 0 .35rem;
  background:none;border:none;cursor:pointer;color:var(--muted);position:relative;font-family:"Hanken Grotesk",sans-serif}
.tab .tlabel{font-size:.8rem;font-weight:800;text-transform:uppercase;letter-spacing:.13em}
.tab .badge{font-family:"Fraunces",serif;font-weight:700;font-size:.78rem;line-height:1.2;min-height:1rem;
  color:var(--muted);font-variant-numeric:tabular-nums;padding:0 .45rem;border-radius:999px}
.tab.on{color:var(--accent)}
.tab.on .badge{color:var(--accent)}
.tab.on::before{content:"";position:absolute;top:-.32rem;left:18%;right:18%;height:4px;border-radius:0 0 3px 3px;background:var(--accent)}
.tab .badge.full{background:var(--accent);color:var(--card)}

/* ── cook controls: view toggle + dish chips ────────────────────────── */
.cook-controls{margin:.9rem 0 .2rem}
.seg{display:flex;border:2px solid var(--ink);border-radius:999px;overflow:hidden;width:max-content;margin:0 0 .9rem}
.seg button{padding:.5rem 1.1rem;background:none;border:none;font-family:"Hanken Grotesk",sans-serif;
  font-weight:700;font-size:.9rem;color:var(--muted);cursor:pointer}
.seg button.on{background:var(--ink);color:var(--paper)}
.chips{display:flex;gap:.5rem;overflow-x:auto;margin:0 -1.1rem;padding:.15rem 1.1rem .6rem;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chip{flex:none;padding:.55rem 1rem;border-radius:999px;border:1.5px solid var(--line);background:var(--card);
  font-family:"Fraunces",serif;font-weight:600;font-size:.98rem;color:var(--ink);cursor:pointer;transition:transform .12s}
.chip:active{transform:scale(.96)}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}

/* clear-ticks (double-tap to confirm) */
.sec-tail{padding:1.4rem 0 .5rem}
.clear{padding:.6rem 1.2rem;border:1.5px dashed var(--line);border-radius:999px;background:none;
  color:var(--muted);font-family:"Hanken Grotesk",sans-serif;font-weight:700;font-size:.85rem;cursor:pointer}
.clear.armed{background:var(--acc-cook);border-color:var(--acc-cook);border-style:solid;color:#fff}

/* ── unordered lists — shopping / ingredients (tap to check) ────────── */
main ul{list-style:none;padding:0;margin:.6rem 0}
main ul li{position:relative;padding:.6rem .2rem .6rem 2.3rem;border-bottom:1px solid var(--line2);line-height:1.45}
body.k-cook main ul li, body.k-recipe main ul li{cursor:pointer}
body.k-cook main ul li::before, body.k-recipe main ul li::before{
  content:"";position:absolute;left:.1rem;top:.72rem;width:1.35rem;height:1.35rem;border-radius:.3rem;
  border:2.5px solid color-mix(in srgb,var(--ink) 55%,transparent);background:var(--card);transition:border-color .15s}
/* grease-pencil tick: oversized accent stroke, overflows the box */
body.k-cook main ul li.done::after, body.k-recipe main ul li.done::after{
  content:"";position:absolute;left:-.05rem;top:.42rem;width:1.8rem;height:1.8rem;background:var(--accent);
  -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='21 4 9 19 3 13'/%3E%3C/svg%3E") center/contain no-repeat;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='21 4 9 19 3 13'/%3E%3C/svg%3E") center/contain no-repeat}
/* index/page bullets: simple dot, no checkbox */
body.k-index main ul li, body.k-page main ul li{padding-left:1.3rem}
body.k-index main ul li::before, body.k-page main ul li::before{
  content:"";position:absolute;left:.2rem;top:1.15rem;width:.4rem;height:.4rem;border-radius:50%;background:var(--accent-soft)}

/* ── ordered lists — method steps, oversized ledger numerals ────────── */
main ol{list-style:none;counter-reset:step;padding:0;margin:.8rem 0}
main ol li{counter-increment:step;position:relative;padding:.85rem .2rem .95rem 3.3rem;
  border-bottom:1px dashed var(--line);line-height:1.5}
body.k-cook main ol li, body.k-recipe main ol li{cursor:pointer}
main ol li::before{content:counter(step,decimal-leading-zero);position:absolute;left:0;top:.75rem;
  font-family:"Fraunces",serif;font-weight:900;font-size:1.75rem;line-height:1;letter-spacing:-.04em;
  color:var(--accent);font-variant-numeric:tabular-nums;transition:color .15s}
main ol li.done::before{color:var(--done)}

/* checked text */
main li.done{color:var(--done)}
main ul li.done, main ol li.done{text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--accent) 55%,transparent);text-decoration-thickness:2px}

/* ── index ──────────────────────────────────────────────────────────── */
.hero{margin:.5rem 0 1.6rem}
.hero .tagline{color:var(--muted);font-size:1.05rem;margin-top:-.2rem}
.cook-feature{display:flex;flex-direction:column;gap:.15rem;text-decoration:none;color:var(--ink);
  padding:1.2rem 1.25rem 1.3rem;border-radius:18px;
  background:linear-gradient(135deg,var(--acc-cook),color-mix(in srgb,var(--acc-cook) 62%,var(--accent-soft)));
  box-shadow:var(--shadow);position:relative;overflow:hidden}
.cook-feature::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.14'/%3E%3C/svg%3E")}
.cook-feature .cf-label{font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.16em;color:rgba(255,255,255,.85)}
.cook-feature .cf-title{font-family:"Fraunces",serif;font-weight:900;font-size:1.6rem;color:#fff;line-height:1.08;letter-spacing:-.015em}
.cook-feature .cf-go{margin-top:.4rem;font-weight:700;font-size:.9rem;color:rgba(255,255,255,.94)}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-top:.4rem}
.rcard{display:flex;flex-direction:column;justify-content:space-between;gap:.6rem;min-height:6rem;
  padding:.8rem .9rem .9rem;border-radius:14px;background:var(--card);border:1.5px solid var(--line);
  box-shadow:var(--shadow);text-decoration:none;color:var(--ink);font-family:"Fraunces",serif;font-weight:600;
  font-size:1.08rem;line-height:1.15;letter-spacing:-.01em;transition:transform .12s}
.rcard:active{transform:scale(.97)}
.rcard .rnum{font-weight:900;font-size:.85rem;color:var(--accent-soft);letter-spacing:.05em}
.cook-list{list-style:none;padding:0;margin:.4rem 0}
.cook-list li{border-bottom:1px solid var(--line2)}
.cook-list li::before{display:none}
.cook-list a{display:block;padding:.8rem .2rem;color:var(--ink);text-decoration:none;font-weight:500}
.empty{color:var(--muted);font-style:italic}

/* ── motion ─────────────────────────────────────────────────────────── */
@media (prefers-reduced-motion:no-preference){
  body[data-tab] main .sec{animation:rise .3s both}
  body.k-index main > *, body.k-page main > *{animation:rise .5s both}
  body.k-index main > *:nth-child(2), body.k-page main > *:nth-child(2){animation-delay:.05s}
  body.k-index main > *:nth-child(3), body.k-page main > *:nth-child(3){animation-delay:.1s}
  body.k-index main > *:nth-child(4), body.k-page main > *:nth-child(4){animation-delay:.15s}
  @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
}
</style>`;

const SCRIPT = `<script>
(function(){
  var root=document.documentElement;
  var saved=localStorage.getItem('cook-theme');
  if(saved){root.setAttribute('data-theme',saved);}
  var btn=document.getElementById('theme-btn');
  if(btn){btn.addEventListener('click',function(){
    var cur=root.getAttribute('data-theme');
    if(!cur){cur=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
    var next=cur==='dark'?'light':'dark';
    root.setAttribute('data-theme',next);
    localStorage.setItem('cook-theme',next);
  });}

  // Keep screen on: wake lock for 2 h. The deadline lives in localStorage so it
  // survives page-to-page navigation; the lock itself drops whenever the page is
  // hidden or closed, so the phone always falls back to normal auto-lock.
  var wbtn=document.getElementById('wake-btn');
  if(wbtn && 'wakeLock' in navigator){
    var WAKE_KEY='cook-wake-until', WAKE_MS=2*60*60*1000, lock=null, timer=null;
    function until(){try{return parseInt(localStorage.getItem(WAKE_KEY)||'0',10);}catch(e){return 0;}}
    function setUntil(v){try{v?localStorage.setItem(WAKE_KEY,String(v)):localStorage.removeItem(WAKE_KEY);}catch(e){}}
    function left(){var m=Math.max(0,Math.round((until()-Date.now())/60000));return Math.floor(m/60)+':'+String(m%60).padStart(2,'0');}
    function paint(){
      var active=until()>Date.now();
      wbtn.classList.toggle('on',active&&!!lock);
      wbtn.classList.toggle('paused',active&&!lock);
      wbtn.setAttribute('aria-pressed',active?'true':'false');
      wbtn.title=active?(lock?'Screen stays on, '+left()+' left (tap to stop)':'Tap to resume keeping the screen on'):'Keep screen on for 2 hours';
    }
    function stop(){
      setUntil(0); clearTimeout(timer);
      if(lock){var l=lock;lock=null;l.release().catch(function(){});}
      paint();
    }
    function acquire(){
      var u=until();
      if(u<=Date.now()){stop();return;}
      if(lock){paint();return;}
      navigator.wakeLock.request('screen').then(function(l){
        lock=l;
        l.addEventListener('release',function(){if(lock===l){lock=null;paint();}});
        clearTimeout(timer); timer=setTimeout(stop,until()-Date.now());
        paint();
      }).catch(function(){lock=null;paint();});
    }
    wbtn.hidden=false;
    wbtn.addEventListener('click',function(){
      if(until()>Date.now()&&lock){stop();}
      else{if(until()<=Date.now())setUntil(Date.now()+WAKE_MS);acquire();}
    });
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')acquire();});
    // Re-take the lock on a new page; if the browser wants a tap first, the first tap anywhere does it.
    acquire();
    document.addEventListener('pointerdown',function(){if(until()>Date.now()&&!lock)acquire();},{passive:true});
    setInterval(paint,60000);
    paint();
  }

  var body=document.body, kind=body.dataset.kind, path=location.pathname;
  var checkable=kind==='cook'||kind==='recipe';

  // tap-to-check, persisted per page
  var items=[], done={}, checkKey='cook-check:'+path;
  if(checkable){
    items=[].slice.call(document.querySelectorAll('main li'));
    try{done=JSON.parse(localStorage.getItem(checkKey)||'{}');}catch(e){}
    items.forEach(function(li,i){
      if(done[i]){li.classList.add('done');}
      li.addEventListener('click',function(ev){
        if(ev.target.closest('a')){return;}
        var on=li.classList.toggle('done');
        done[i]=on;
        localStorage.setItem(checkKey,JSON.stringify(done));
        badges();
      });
    });
  }

  // bottom tab bar, persisted per page
  var tabs=[].slice.call(document.querySelectorAll('.tab'));
  if(tabs.length){
    var tabKey='cook-tab:'+path;
    var names=tabs.map(function(t){return t.dataset.go;});
    var setTab=function(n){
      body.dataset.tab=n;
      tabs.forEach(function(t){t.classList.toggle('on',t.dataset.go===n);});
      localStorage.setItem(tabKey,n);
    };
    tabs.forEach(function(t){t.addEventListener('click',function(){setTab(t.dataset.go);});});
    var savedTab=localStorage.getItem(tabKey);
    setTab(names.indexOf(savedTab)>-1?savedTab:names[0]);
  }

  // cook view toggle: by-recipe (default) vs interleaved
  var segs=[].slice.call(document.querySelectorAll('.seg button'));
  if(segs.length){
    var viewKey='cook-view:'+path;
    var setView=function(v){
      body.dataset.view=v;
      segs.forEach(function(s){s.classList.toggle('on',s.dataset.v===v);});
      localStorage.setItem(viewKey,v);
    };
    segs.forEach(function(s){s.addEventListener('click',function(){setView(s.dataset.v);});});
    setView(localStorage.getItem(viewKey)==='inter'?'inter':'recipe');
  }

  // dish chips (by-recipe view)
  var chips=[].slice.call(document.querySelectorAll('.chip'));
  var dishes=[].slice.call(document.querySelectorAll('.sec[data-role="dish"]'));
  if(chips.length){
    var dishKey='cook-dish:'+path;
    var setDish=function(i){
      chips.forEach(function(c,j){c.classList.toggle('on',j===i);});
      dishes.forEach(function(d,j){d.classList.toggle('dish-on',j===i);});
      localStorage.setItem(dishKey,String(i));
    };
    chips.forEach(function(c,i){c.addEventListener('click',function(){setDish(i);});});
    var di=parseInt(localStorage.getItem(dishKey)||'0',10);
    setDish(di>=0&&di<chips.length?di:0);
  }

  // per-tab progress badges (checked/total)
  function badges(){
    tabs.forEach(function(t){
      var lis=[].slice.call(document.querySelectorAll('.sec[data-tab="'+t.dataset.go+'"] li'));
      var b=t.querySelector('.badge');
      if(!b){return;}
      if(!lis.length){b.textContent='';return;}
      var d=lis.filter(function(l){return l.classList.contains('done');}).length;
      b.textContent=d+'/'+lis.length;
      b.classList.toggle('full',d===lis.length);
    });
  }
  if(checkable){badges();}

  // clear ticks per tab — double-tap to confirm
  [].slice.call(document.querySelectorAll('.clear')).forEach(function(cb){
    var timer;
    cb.addEventListener('click',function(){
      if(!cb.classList.contains('armed')){
        cb.classList.add('armed');
        cb.textContent='Tap again to clear';
        timer=setTimeout(function(){cb.classList.remove('armed');cb.textContent='Clear ticks';},2200);
        return;
      }
      clearTimeout(timer);
      cb.classList.remove('armed');
      cb.textContent='Clear ticks';
      [].slice.call(document.querySelectorAll('.sec[data-tab="'+cb.dataset.clear+'"] li'))
        .forEach(function(li){li.classList.remove('done');});
      items.forEach(function(li,i){done[i]=li.classList.contains('done');});
      localStorage.setItem(checkKey,JSON.stringify(done));
      badges();
    });
  });
})();
</script>`;

export function renderPage({ title, bodyHtml, homeHref, kind = 'page' }) {
  const back = homeHref ? `<a class="back" href="${homeHref}">All</a>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#bd3818">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Cook">
<title>${title}</title>
${FONTS}
${STYLE}
</head>
<body class="k-${kind}" data-kind="${kind}">
<header class="topbar">
  <a class="brand" href="index.html"><span class="dot"></span>Cook</a>
  <div class="bar-right">${back}<button id="wake-btn" class="theme wake" hidden aria-pressed="false" aria-label="Keep screen on for 2 hours" title="Keep screen on">☀</button><button id="theme-btn" class="theme" aria-label="Toggle light/dark">◐</button></div>
</header>
<main>
${bodyHtml}
</main>
${SCRIPT}
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

export function buildSite({ recipesDir, cooksDir, outDir, staticDir }) {
  const recipes = readDocs(recipesDir).sort((a, b) => a.title.localeCompare(b.title));
  const cooks = readDocs(cooksDir).sort((a, b) => b.slug.localeCompare(a.slug)); // newest first

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  if (staticDir && existsSync(staticDir)) cpSync(staticDir, outDir, { recursive: true });

  for (const r of recipes) {
    writeFileSync(
      join(outDir, `recipe-${r.slug}.html`),
      renderPage({ title: r.title, bodyHtml: sectionedBody(r.md, 'recipe'), homeHref: 'index.html', kind: 'recipe' }),
    );
  }
  for (const c of cooks) {
    writeFileSync(
      join(outDir, `cook-${c.slug}.html`),
      renderPage({ title: c.title, bodyHtml: sectionedBody(c.md, 'cook'), homeHref: 'index.html', kind: 'cook' }),
    );
  }

  const latest = cooks[0];
  const pastCooks = cooks.slice(1);
  const mains = recipes.filter((r) => !r.slug.startsWith('side-'));
  const sides = recipes.filter((r) => r.slug.startsWith('side-'));
  const cardGrid = (list) =>
    `<div class="card-grid">${list.map((r, i) => `<a class="rcard" href="recipe-${r.slug}.html"><span class="rnum">${String(i + 1).padStart(2, '0')}</span>${r.title}</a>`).join('')}</div>`;
  const body = [
    '<section class="hero"><h1>Cook</h1><p class="tagline">Batch kitchen — recipes &amp; cook days.</p></section>',
    latest
      ? `<section><a class="cook-feature" href="cook-${latest.slug}.html"><span class="cf-label">Cooking now</span><span class="cf-title">${latest.title}</span><span class="cf-go">Open shopping list &amp; steps →</span></a></section>`
      : '<p class="empty">No cooks yet — run <strong>/cook</strong> to plan one.</p>',
    mains.length
      ? `<section><h2>Recipes</h2>${cardGrid(mains)}</section>`
      : '<p class="empty">No recipes yet.</p>',
    sides.length ? `<section><h2>Sides</h2>${cardGrid(sides)}</section>` : '',
    pastCooks.length
      ? `<section><h2>Past cooks</h2><ul class="cook-list">${pastCooks.map((c) => `<li><a href="cook-${c.slug}.html">${c.title}</a></li>`).join('')}</ul></section>`
      : '',
  ].join('\n');

  writeFileSync(join(outDir, 'index.html'), renderPage({ title: 'Cook', bodyHtml: body, kind: 'index' }));

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
    staticDir: join(root, 'static'),
    outDir: join(root, 'site'),
  });
  console.log(`Built ${manifest.recipes.length} recipes, ${manifest.cooks.length} cooks → site/`);
}

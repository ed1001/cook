# cook

Personal batch-cook meal planner + Claude Code `/cook` skill data.

- `recipes/` — the recipe collection (one markdown file each).
- `cooks/` — generated cook packets (shopping list + mise en place + stepwise method), one per cook.
- `config.md` — diet rules, batch/freeze philosophy, portion sizing.
- `bin/` — `build.mjs` (markdown → static `site/`), `serve.sh` (serve `site/` on a fixed localtunnel URL).

Plan a cook, get recipes, or browse via the `/cook` skill. See `docs/` for the design + plan.

# Math Bridges

An interactive English/Italian atlas for finding the mathematical transformation that makes a problem easier. Based on [Atlante dei ponti matematici](docs/atlante_ponti_matematici-ITA.md).

The initial collection contains **38 curated bridges across all 12 functional families**, with conditions, guarantees, pitfalls, worked examples, related methods, and four learning paths. It is an extensible starting collection, not a transcription of every node in the founding document. Editorial status is recorded separately from symbolic verification of equation candidates.

## Generate and run

Requires Node.js 20 or newer.

```sh
npm ci
npm run build
npm run dev
```

Open **http://127.0.0.1:4173**. `npm run dev` (or `node serve.js`) builds the page on startup, watches `src/`, `docs/`, `generate.mjs`, and the package manifests, and reloads the browser after successful rebuilds. Rapid saves are debounced and builds run sequentially. If a source edit fails validation, the server logs the error and keeps serving the last successful build until the source is fixed.

Set `PORT` to use another port, for example `PORT=4174 node serve.js`. The server binds to loopback and serves an in-memory snapshot of only the generated page and `libs/`; source files are not exposed. Live reload is injected only into served HTML, leaving the generated deployment files unchanged. No extra development dependency is needed. Stop with Ctrl+C. Changes to `serve.js` itself require restarting the server; package manifest changes trigger a rebuild but do not install dependencies. `node serve.mjs` remains a compatibility entry point.

`node generate.mjs` generates **`index.html` and `libs/` at the repository root**, regardless of your current working directory. The generated outputs can be used without installing Node.js. Deploy or copy `index.html` together with `libs/` to any static host. All scripts, math fonts, styles, translations, and the original source atlas are local; no CDN or application backend is needed. The generated HTML also embeds the content so browsing does not require JSON fetches.

The equation engine runs in a dedicated Blob web worker, with a five-second timeout. This also supports browsers that permit Blob workers when opening `index.html` directly with `file://`. A local HTTP server is the recommended option; restrictive browser policies may disable workers for local files.

## Explore

- Browse expandable trees **by purpose** or **by discipline**.
- Search titles, descriptions, needs, IDs, and formula source. Filter by family or maximum level (L0–L6).
- Open a bridge to see **why to use it, when it is valid, and what it guarantees**. Every card includes an explained example.
- Pin bridges into a persistent tab strip, switch between them, or compare their conditions and guarantees side by side. Pins and language preference are saved in local storage when available.
- Use the **Markmap** view for the complete curated hierarchy or an individual family. Expand nodes, zoom/pan, fit the view, and follow internal links. The sidebar provides the equivalent keyboard-accessible hierarchy.
- Follow four learning paths, including complex numbers → Hermitian geometry → Hilbert → Fourier.
- Switch English/Italian at any time. Direct links support `?lang=it#bridge/B-05.03`, `#map?category=B-02`, and `#explore?category=B-02&level=2&q=square`.

## Equation lab

**Algebrite** performs symbolic simplification, factorization, root generation, and substitution. **KaTeX** renders formulas with MathML alternatives. Input is parsed using a restricted grammar, not passed to the CAS as a script.

Use one selected variable (`x`, `y`, `z`, or `t`), an equals sign, and explicit multiplication. Decimal inputs are converted to exact rational numbers.

```text
x^2 - 5*x + 6 = 0
(x^2 - 1)/(x - 1) = 0
sqrt(x + 2) = x
x^4 - 5*x^2 + 4 = 0
x^2 + 9 = 0
```

Guided solving supports polynomials of degree 1–4, rational equations with such numerators, and `sqrt(P(x)) = Q(x)` (or reversed), where P has degree at most 4 and Q at most 1. Integer input exponents are bounded to −8…8; input length and token count are bounded. Functions `sqrt`, `sin`, `cos`, `tan`, `exp`, and `log` are recognized, but general transcendental equations receive method suggestions rather than a claimed solution.

Choose **ℝ** or **ℂ** explicitly. The lab keeps original denominator and function restrictions even after cancellation. It verifies candidates in the original equation, rejects extraneous roots, and labels candidates as uncertified when the engine cannot establish their domain or exact residual. A small numerical residual is never labeled an exact verification. Cubic/quartic radical expressions may remain uncertified or reach the worker timeout. The lab is a guide for supported forms, not a general theorem prover or general equation solver.

## Source structure

```text
src/
  templates/index.html      HTML page shell and data insertion point
  content/atlas.json        Stable IDs, hierarchy, formulas, relations, routes
  locales/en.json           English UI text and bridge explanations
  locales/it.json           Italian UI text and bridge explanations
  scripts/app.js            Navigation, search, pins, views, rendering
  scripts/equation.mjs      Restricted parser and symbolic analysis
  scripts/solver-worker.js  Isolated Algebrite worker
  styles/app.css            Responsive page styles

generate.mjs                Root build script and content validation
serve.js                    Build, watch, snapshot server, and browser live reload
serve.mjs                   Compatibility entry point for serve.js
index.html                  Generated entry point
libs/                       Generated scripts, styles, fonts, content, licenses
```

To add a bridge, add its canonical record to `src/content/atlas.json`, then add the corresponding localized explanation to both language files. Keep formulas and relation IDs in the shared catalog. Add one explanation per worked-example step in each translation. Link prerequisites and related bridges by their canonical IDs; retain the source atlas IDs when applicable. Result types distinguish equivalence, one-way implication, domain extension, representation, approximation, bounds, existence, necessary conditions, and algorithms.

The generator validates unique IDs, parent/domain references, relation and route targets, translation-key parity, and worked-step counts. It generates localized Markmap trees at build time and bundles browser dependencies with esbuild. `libs/` is fully replaced on every successful build; edit `src/` instead of generated files.

## Verification

```sh
npm run build
npm test
```

Tests cover parser limits and rejected CAS commands, exact decimal handling, root preservation, original-domain exclusions, radical extraneous roots, real/complex domains, uncertified guards, unsupported forms, bilingual content completeness, internal links, and KaTeX rendering of all catalog formulas. DOM integration tests exercise search, filters, translation, saved comparison tabs, direct links, and the bundled Algebrite worker. Server integration tests use loopback HTTP and temporary source fixtures to check automatic rebuilding, live reload, file restrictions, and failure recovery. Visual browser verification is separate from these automated checks.

## Libraries and license

- [Algebrite](http://algebrite.org/) — computer algebra
- [KaTeX](https://katex.org/) — mathematics rendering
- [Markmap](https://markmap.js.org/) — interactive hierarchy

The project uses the repository’s [GPL-3.0 license](LICENSE). Bundled dependency licenses are included in `libs/THIRD_PARTY_LICENSES.txt`.

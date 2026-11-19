# Math Bridges — AI Agent Reference

This is the fast-access operational reference for agents working on **Math Bridges** (`mathbridges-atlas`), a static, bilingual learning atlas for choosing mathematical transformations. The working implementation provides a curated collection, navigable trees/maps, comparison pins, learning routes, and a bounded symbolic equation lab. The founding document describes a much broader mathematical ontology; its entire taxonomy and proposed theorem-checking machinery are **not** implemented. This is not a general equation solver or formal proof assistant.

## Read Order and Sources of Truth

1. [LICENSE](LICENSE) governs the project's GPL-3.0 licensing. Preserve dependency notices in generated distributions.
2. [The founding atlas](docs/atlante_ponti_matematici-ITA.md), especially §§1, 4, 8–10, governs mathematical vocabulary, result semantics, hypotheses, and editorial principles. Its proposed interface/ontology is design guidance, not evidence of shipped functionality.
3. [Equation tests](tests/equation.test.mjs), [content tests](tests/content.test.mjs), [app tests](tests/app.test.mjs), and [server tests](tests/serve.test.mjs) specify the behavior they actually assert. They do not establish untested mathematical completeness or visual quality.
4. Current [source](src/), [generator](generate.mjs), [server](serve.js), and [package manifest](package.json) establish implementation and executable workflows. Tests and source must be reconciled with the principles above if they conflict.
5. [README.md](README.md) owns user setup, syntax, limitations, and content-extension instructions. Update it when those facts change.
6. The founding atlas's §10 owns proposed editorial extensions. There is no separate roadmap, CI configuration, deployment manifest, contribution guide, or release protocol in the inspected tree. Historical commits do not prove present behavior.

Inspect disagreements and fix or report them within scope. Do not silently turn a design proposal, comment, approximate calculation, or passing test into a stronger guarantee. If a conflict cannot be resolved safely, record the gap and request direction.

## Collaboration and Maintenance Rules

- Read this file completely and locate any nested `AGENTS.md` before changing a subsystem. No nested instruction files exist in the inspected source tree; newly added ones must be linked here with their scope.
- Check `git status --short` first. Preserve unrelated user changes and new project files. Do not stage, commit, reset, or clean them merely to simplify a task; stage and commit the requested scope only when authorized.
- Keep this handbook synchronized **in the same edit batch** when paths, meaningful symbols, commands, interfaces, persistence, trust boundaries, tests, feature status, or durable failure-prevention rules change. Update the owning source subsection and the relevant feature/contract/test maps. Pure formatting changes need no cosmetic handbook edits.
- Before a commit, compare the complete diff with this handbook, remove stale owners and superseded workarounds, validate links and commands, and include the handbook with the change that makes it necessary. No repository-enforced branch, commit-message, or release naming convention is present; follow the user's task instructions.
- Edit canonical files under [src/](src/) and the [source atlas](docs/atlante_ponti_matematici-ITA.md), then regenerate. Do not implement behavior by editing `index.html` or `libs/`. These are version-controlled deployable generated outputs, not runtime caches. Keep generated deliverables consistent with source when handing off a source change.
- [`.gitignore`](.gitignore) excludes `node_modules/`, caches, logs, environment files, and common build-tool directories. Do not add downloaded dependencies, credentials, or local test fixtures to version control.
- Run focused tests for changed behavior and build before tests that read generated artifacts. Finish with relevant full checks; do not claim visual verification from DOM tests.
- Record new research/optimization/backlog items in an explicitly identified document when the task creates them, and link it here. Label proposals as planned; do not invent an existing roadmap or silently expand product scope.

## Essential Project Principles

### Mathematical meaning precedes convenience

Every bridge must explain why to use it, its hypotheses, and what it guarantees. Preserve the distinction between exact equivalence, one-way implication, domain extension, representation, approximation with error, existence/uniqueness, necessary conditions, bounds, and algorithms. A complex solution does not satisfy a real-only problem; a bound is not an exact value.

### Canonical identities, separate explanations

Stable IDs and formulas belong in [the shared catalog](src/content/atlas.json); translated UI and explanations belong in [English](src/locales/en.json) and [Italian](src/locales/it.json). A bridge may appear in several views while keeping one identity. Do not fork a method into language-specific or view-specific records.

### Local operation and accessible navigation

The generated page must use local scripts, fonts, styles, and embedded content. Do not introduce runtime CDN requirements or send equations to a service. Keep a usable tree alongside the graphical map, selectable mathematics with MathML alternatives, keyboard focus, responsive layouts, and storage-failure fallback.

### Development conveniences stay out of deployment artifacts

The development server may inject live reload into HTTP responses, but generated HTML and bundles must remain independently deployable. Serve only completed builds and loopback-only development endpoints; a failed edit must not replace the last working page with partial bundles.

## Critical Implementation Contracts

- **Validated symbolic input:** [`parseExpression`](src/scripts/equation.mjs) is the only input grammar. Keep allowed variables/functions, explicit multiplication, expression/token/numeric/exponent limits, and rejection of arbitrary CAS (computer algebra system) commands. Never bypass the parser by passing user text directly to Algebrite. [Regression tests](tests/equation.test.mjs) cover command rejection, precedence, and limits.
- **Original domain survives rewriting:** [`domainRestrictions`](src/scripts/equation.mjs) must run on both original abstract syntax trees before simplification. Track denominators, negative powers, real square roots, logarithms, and tangent poles. Division and squaring must not lose or invent accepted solutions. [Equation tests](tests/equation.test.mjs) cover zero roots, canceled holes, and extraneous radical roots.
- **Exact certification is conservative:** In [`analyzeEquation`](src/scripts/equation.mjs), `rationalSign`, `nonzeroProof`, and `checkRestriction` retain `unknown` when symbolic reductions do not establish a guard. Floating sign estimates must not certify a candidate; a small residual is not exact zero. [Equation tests](tests/equation.test.mjs) exercise uncertified algebraic guards and real/complex root distinctions.
- **Rendering must not change algebraic form:** `tex` in [`analyzeEquation`](src/scripts/equation.mjs) uses `printlatex(quote(...))` so rendering a factorization does not expand it again. Preserve this ordering. [The quadratic regression](tests/equation.test.mjs) checks visible factors.
- **Worker boundary:** [`runSolver`](src/scripts/app.js) creates a Blob worker from the bundled source, stops the previous worker, and enforces a five-second timeout. [`solver-worker.js`](src/scripts/solver-worker.js) returns `{result}` or `{error}`. Editing input discards old output. [App tests](tests/app.test.mjs) run the compiled worker through Node's worker-thread adapter.
- **Catalog integrity:** [`generate.mjs`](generate.mjs) checks unique bridge IDs, category/domain/relationship/route references, locale key parity, and per-language worked-step counts before writing output. A new bridge requires both locale entries and explanations matching the shared formula steps. [Content tests](tests/content.test.mjs) render every formula and check relationships.
- **HTML trust:** [`escape`](src/scripts/app.js) protects interpolated text; [`math`](src/scripts/app.js) uses KaTeX with `trust:false` and HTML/MathML output. The generator escapes `<`, U+2028, and U+2029 in embedded JSON. Do not concatenate raw input into HTML. Markmap content is generated from repository-authored text; it is not a general untrusted Markdown ingestion API.
- **Successful-build publication:** [`startDevServer`](serve.js) serializes `rebuild` calls, coalesces watch events, and swaps `snapshot` only after `runGenerator` and `loadSnapshot` succeed. Never serve directly from `libs/` during generation: the generator removes/recreates it. [Server tests](tests/serve.test.mjs) exercise partial output, failure recovery, and edits during builds.
- **Server exposure and cleanup:** [`loadSnapshot`](serve.js) includes only the entry page and regular files under generated `libs/`, without following symlinks. The server binds `127.0.0.1`, supports GET/HEAD only, and adds no-store headers. `close` releases watchers, generator subprocess, event clients, and HTTP connections. [Server tests](tests/serve.test.mjs) cover source/symlink exclusion, methods, events, and shutdown through teardown.

## Architecture and Data/Control Flow

Build: [catalog](src/content/atlas.json) + [locales](src/locales/) + [template](src/templates/index.html) + [scripts](src/scripts/) + [styles](src/styles/app.css) + [atlas document](docs/atlante_ponti_matematici-ITA.md) → [generator](generate.mjs) validates, builds localized Markmap trees, bundles scripts, and copies assets → `index.html` + `libs/`.

Browser: embedded `atlas-data` → [`app.js`](src/scripts/app.js) hash router → library/detail/map/paths/comparison/lab views. Local storage belongs to the browser. Equation input → restricted parser and Algebrite in [worker](src/scripts/solver-worker.js) → result/error message → localized KaTeX explanation.

Development: [`serve.js`](serve.js) watches source directories/manifests → debounced, serialized generator subprocess → complete in-memory snapshot → HTTP assets + Server-Sent Events (SSE) → development-only `EventSource` script reloads the current URL. Build errors keep the existing snapshot. Generated output changes do not trigger rebuilds.

There is one npm package, no workspace/submodule split, no database, no application backend, no accounts, and no external runtime service. The HTTP process is a development convenience, not a production hosting platform.

## Linked Source Tree and File Reference

The links below reference project files. Generated artifacts are identified explicitly rather than treated as edit points.

### [AGENTS.md](AGENTS.md)

Owns the operational map, principles, maintenance triggers, and known limitations. Update affected source/feature/interface/test sections together; do not append a chronological diary or copy the bootstrap protocol. Validate every local link when changing this handbook.

### [README.md](README.md)

Owns user-facing setup, development workflow, input syntax, supported forms, extension instructions, and distribution guidance. Its “Generate and run,” “Equation lab,” and “Source structure” sections must match the manifest, server, parser, and generator. Do not claim deployment has occurred without verification.

### [LICENSE](LICENSE)

Contains GPL version 3 terms. It is a legal source, not a configuration file. Preserve it and dependency notices when preparing distributions; do not infer dependency licenses from the project license.

### [.gitignore](.gitignore)

Owns exclusions for dependencies, local environment/runtime files, and tool caches. `node_modules/` and `.env*` (except `.env.example`) are ignored. Generated `index.html` and `libs/` are not ignored. Do not apply a broad cleanup based on another framework's defaults.

### [.gitattributes](.gitattributes)

Owns narrow whitespace-check exceptions for copied upstream content: `cr-at-eol` allows original CRLF line endings in generated license notices, and `-blank-at-eol` preserves Markdown hard-break spaces in the copied source atlas. These attributes change Git checks, not generated file bytes. Do not strip or rewrite upstream notices or meaningful Markdown whitespace merely to satisfy a diff check. Run `git diff --cached --check` after staging new files so first-time additions are included in validation.

### [package.json](package.json)

Owns npm identity, ESM (`type: module`), commands, runtime dependencies, and development tooling. `build` calls `generate.mjs`; `dev` calls `serve.js`; `test` discovers `tests/*.test.mjs` using Node's built-in test runner. Algebrite, KaTeX, and Markmap are application dependencies; esbuild and JSDOM are tooling. Keep command changes synchronized with [README](README.md), this handbook, and the lockfile where dependency metadata changes.

### [package-lock.json](package-lock.json)

Locks dependency resolution for `npm ci`. It is package-manager-maintained, not hand-authored application data. Update it through npm when dependencies change; a manifest watch only rebuilds and does not install dependencies. Installation contacts the npm registry unless dependencies are cached.

### [generate.mjs](generate.mjs)

Owns static generation, not HTTP handling or live reload.

- `root` resolves paths relative to the script, independent of the invoking working directory; `readJSON` loads canonical data.
- Validation checks IDs/references and translated example counts; `keys` compares recursively enumerated locale object keys.
- `Transformer` creates all-family and per-family Markmap roots for each locale. Formula/text content remains owned by JSON, not generated map nodes.
- The worker build precedes the app build; `__SOLVER_WORKER_SOURCE__` embeds the compiled worker in the app bundle for Blob execution.
- Output replacement removes/recreates `libs/`, copies KaTeX fonts/styles, content/locales, and the source atlas, and emits dependency notices. Final serialization replaces `{{DATA}}` in the template and writes `index.html`.
- Used by npm build, [the dev server](serve.js), and artifact-consuming tests. [Content](tests/content.test.mjs) and [app](tests/app.test.mjs) tests require generated files to be current.
- Do not add hand-maintained files to `libs/`; generation will delete them. A failed build can leave partial files **on disk** even though the development server continues serving its old in-memory snapshot. Always complete a successful standalone build before distribution.

### [serve.js](serve.js)

Owns build/watch/HTTP lifecycle and live reload; it does not implement algebra or mutate canonical content.

- `projectRoot` and `mimeTypes` establish script-relative location and response types. `inputFingerprint` hashes source/docs and generator/manifests so delayed, duplicate, or unchanged filesystem events do not trigger redundant builds.
- `loadSnapshot` recursively loads regular generated assets into memory, excluding symlinks; it is the publication boundary.
- `reloadScript` generates the development-only browser `EventSource` client. It compares revisions to avoid reconnect reload loops and closes on `pagehide`.
- Exported `startDevServer({root, port, debounceMs, logger})` supports normal CLI startup and isolated temporary-root integration tests. Defaults: repository root, `PORT` or 4173, 100 ms debounce, console logging. Port 0 permits an OS-assigned port; the returned object exposes `url`, `close`, and `rebuild`.
- Its `runGenerator` starts `process.execPath` on `generate.mjs` in the chosen root. `rebuild` serializes work and drains pending changes; `scheduleBuild` coalesces saves and requests non-forced rebuilds; `watchInputs` uses directory watches so atomic editor saves remain observable. Explicit `rebuild()` forces regeneration; watcher-driven rebuilds skip unchanged input fingerprints.
- The request handler serves the published snapshot and private development event/script endpoints, never arbitrary repository paths. It injects the reload reference into served HTML only.
- `close` stops watchers, pending timers, child process, clients, and HTTP connections. `runCLI` owns startup error reporting and SIGINT/SIGTERM cleanup; the direct-entry guard makes imports side-effect-free.
- [Server tests](tests/serve.test.mjs) own regression checks. Do not watch generated files, run concurrent generators, publish partially loaded assets, follow symlinks, or expose the project root. Restart after editing the server itself or after a watcher failure.

### [serve.mjs](serve.mjs)

Compatibility CLI entry point that imports and awaits `runCLI` from [serve.js](serve.js). It has no separate HTTP implementation or configuration. Preserve the alias unless a task explicitly changes compatibility; make server changes in `serve.js`.

### [src/templates/index.html](src/templates/index.html)

Owns the HTML shell, metadata, DOM anchors, local asset references, and `{{DATA}}` insertion point. `atlas-data`, `main`, `main-nav`, `sidebar-content`, `pin-tabs`, and form/view containers are contracts with [app.js](src/scripts/app.js). Do not remove anchors without updating consumers and [app tests](tests/app.test.mjs). It must not include development reload endpoints; [serve.js](serve.js) owns those.

### [src/content/atlas.json](src/content/atlas.json)

Owns shared structural data: `version`, `source`, `categories`, `domains`, `bridges`, and `routes`. Bridge landmarks include `id`, `parentId`, `domainIds`, `level`, `formulaLatex`, `resultKind`, `reversible`, `relatedIds`, `prerequisites`, shared example formulas, sources, and editorial `status`. Route `bridgeIds` refer to canonical bridges. Do not mistake editorial status for symbolic root certification. [Generator validation](generate.mjs) and [content tests](tests/content.test.mjs) enforce references and rendering.

### [src/locales/en.json](src/locales/en.json)

Owns English category/domain/route labels, bridge explanations, and `ui` strings, including `ui.types` and equation-step/error labels. Bridge `steps` are positional explanations of shared example formulas. Update [Italian](src/locales/it.json) in the same change. The generator checks matching keys and step counts; [content](tests/content.test.mjs) and [app](tests/app.test.mjs) tests cover content and switching. Do not move stable IDs or shared formulas into this file.

### [src/locales/it.json](src/locales/it.json)

Owns the corresponding Italian text with the same object-key structure and worked-step alignment as [English](src/locales/en.json). It is a localized source file, not an automatically regenerated translation of the founding Markdown. Translation changes must preserve mathematical meaning, inequalities, conditions, and result distinctions; key parity alone does not establish semantic parity.

### [src/scripts/app.js](src/scripts/app.js)

Owns browser state, routing, views, navigation, and presentation of worker output.

- Embedded `atlas`, `locales`, `maps`, and `byId` supply data. `t`/`text` select translations; `escape` and `math` render safely; `icon`, `card`, and `pinButton` build shared components.
- `storage` wraps `mathbridges.*` JSON local storage with failure fallback. Initialization validates language and filters persisted pins against known IDs. Query `lang` takes precedence over saved language, then navigator/default selection.
- `route`, `exploreLink`, and `bridgeLink` own fragment URLs. `filters`, `matchingBridges`, `libraryResults`, and `setFilter` implement search and family/domain/maximum-level filters; typing search replaces history without losing focus.
- `renderHeader` and `renderSidebar` own navigation, tree expansion, the persistent pin strip, and saved-pin links. `renderExplore`, `renderBridge`, `renderCompare`, `renderRoutes`, and `renderMap` own their respective screens. `art` draws the library illustration. `renderMap` creates Markmap; `render` destroys an old map before changing views.
- `renderSolver`, `solverOutput`, and `readLabDraft` preserve lab input and present translated steps/guards/candidate states. `runSolver` owns worker creation, cancellation, timeout, and completion. `toast` owns transient copy-link feedback.
- Delegated click/input/change/submit handlers and hashchange/keydown listeners own interactions. Update these with any new DOM contract. Do not leave a stale result visible after input changes or create a second pin state separate from `pins`.
- [App tests](tests/app.test.mjs) exercise generated code with JSDOM and a worker-thread adapter. Real map layout, mobile sizing, and browser-specific behavior require separate visual checks.

### [src/scripts/equation.mjs](src/scripts/equation.mjs)

Owns restricted parsing and pure symbolic-analysis orchestration, not DOM or worker lifecycle.

- `FUNCTIONS` is the callable-name allowlist. `parseExpression` uses `primary`, `power`, `unary`, `product`, and `sum` to build a limited AST (abstract syntax tree). Unary minus binds outside exponentiation; exponent chaining and arbitrary functions are rejected.
- `serialize` emits parenthesized CAS expressions and converts decimal tokens into exact rational values using `BigInt`.
- `domainRestrictions` walks the original AST and records `neq`, `gte`, or `gt` guards. Domain affects real square-root/log conditions.
- `splitRoots` separates CAS vectors without splitting commas inside nested expressions.
- `analyzeEquation(engine, {equation, variable, domain})` normalizes, recognizes supported polynomials/rational numerators/simple radicals, constructs explanatory steps, obtains roots, and checks original substitutions and restrictions. Its `polynomial` helper checks coefficients/reconstruction rather than trusting degree alone; `tex` preserves factorization with quotation; `rationalSign`, `nonzeroProof`, and `checkRestriction` implement conservative guard decisions.
- Supported-result states include `identity`, `contradiction`, `unsupported`, `partial`, `solved`, and `emptyRoots`; candidate states are `verified`, `rejected`, or `unknown`. UI labels live in locales, not in this module.
- Called by [the worker](src/scripts/solver-worker.js) and [equation tests](tests/equation.test.mjs). Do not broaden input syntax, completeness claims, or exact-certification rules without focused regressions and updated user guidance.

### [src/scripts/solver-worker.js](src/scripts/solver-worker.js)

Owns the isolated Algebrite import and `self.onmessage` dispatch into `analyzeEquation`. Posts `{result}` on success; preserves `invalid`/`tooComplex` errors and maps other exceptions to `workerError`. The app owns timeout/termination and localization. It is bundled by [generate.mjs](generate.mjs); [app tests](tests/app.test.mjs) exercise that bundle. Do not add DOM dependencies or pass raw script text into Algebrite.

### [src/styles/app.css](src/styles/app.css)

Owns design tokens, layout, responsive breakpoints, tree/pin/card/detail/map/lab styles, math overflow, skip-link/focus behavior, and reduced-motion overrides. The appended pin-strip/readability rules intentionally override earlier component values; inspect the cascade before adding another rule. DOM classes come from [the template](src/templates/index.html) and [app](src/scripts/app.js). There is no screenshot regression suite; verify visual changes in a real browser when available.

### [docs/atlante_ponti_matematici-ITA.md](docs/atlante_ponti_matematici-ITA.md)

Owns the founding mathematical/design reference: §2 knowledge domains, §3 bridge taxonomy, §4 operational conditions, §6 examples, §7 routes, §8 proposed data/relations/UI, §9 false shortcuts, and §10 editorial extensions. The generator copies it into the deployment's `libs/sources/atlas-ita.md`; it does **not** parse it into catalog entries or translate it. Adding Markdown alone does not add a UI bridge: update shared JSON and both locales explicitly.

### [tests/equation.test.mjs](tests/equation.test.mjs)

Owns mathematical/parser regressions using real Algebrite. Helpers `solve` and `accepted` invoke analysis and select certified candidates. Cases cover preserved zero roots/domain holes, radical squaring, identities/contradictions, variable/domain choices, exact decimals, unsupported forms, conservative guards, precedence, and rejected commands/limits. Add regressions here before strengthening solver guarantees.

### [tests/content.test.mjs](tests/content.test.mjs)

Owns bilingual card completeness, shared/translated step alignment, strict KaTeX formula rendering, canonical links/routes, and generated embedded-data/local-asset checks. It reads canonical JSON and the built HTML; build first. It does not prove every worked example or translation mathematically correct.

### [tests/app.test.mjs](tests/app.test.mjs)

Owns DOM-level interaction regressions against generated HTML/app/worker bundles. `launch` constructs JSDOM, seeds storage, installs a Node worker-thread adapter, and tears down workers/window; `tick` allows route events to settle. Checks cover search/filters, Italian switching, tabs/comparison, canonical links/trees/paths, radical analysis, stale-result clearing, and file-mode storage failure. Collection-size assertions are tied to the current fixture-like catalog and need intentional updates if its size changes. This is not a real browser layout test.

### [tests/serve.test.mjs](tests/serve.test.mjs)

Owns HTTP/watch/build lifecycle regressions using real loopback sockets and disposable temporary roots. `fixture` writes a controlled generator and nested source; `start` registers cleanup; `eventually` waits for observable publication. Tests cover initial build, response-only injection, file/method restrictions, symlink exclusion, atomic saves/debounce, unchanged-input suppression, SSE revisions, failed/partial builds, edits during generation, startup failure, and reload-client revision/cleanup logic through `vm`. Fixtures deliberately write partial assets before finishing; do not replace those assertions with checks against only final disk output. No production source is mutated.

### [index.html](index.html)

Generated deployment entry point embedding JSON and the static shell. [generate.mjs](generate.mjs) is authoritative; [content](tests/content.test.mjs) and [app](tests/app.test.mjs) tests read this artifact. Do not hand-edit it or copy the dev server's injected HTML into the deployment.

### [libs/](libs/)

Generated libraries and copied assets, not implementation owners. `libs/app.js` and `libs/solver-worker.js` are bundles; `libs/styles.css`, `libs/katex/`, `libs/content/`, `libs/locales/`, `libs/sources/`, and `libs/THIRD_PARTY_LICENSES.txt` are derived/copied assets and notices. Repetitive vendor fonts and generated files are grouped here because they share [generator](generate.mjs) ownership and must not be individually edited. Content/app tests read these artifacts. Regeneration replaces the entire directory.

## Features and Recurring Development Pitfalls

### Library, tree, and localized cards — Shipped

`#explore`/`#bridge/<id>` → `route`/`render` → filters/tree/cards in [app.js](src/scripts/app.js), backed by [catalog](src/content/atlas.json) and [locales](src/locales/). Search includes localized needs/text, IDs, and formula source; level is an upper bound. `lang` query and local storage persist language selection. [App tests](tests/app.test.mjs) cover interaction; [content tests](tests/content.test.mjs) cover structural integrity. Semantic translation and full atlas coverage remain editorial work.

### Persistent comparison tabs — Shipped

Pin controls update one `pins` array, `mathbridges.pins`, the strip/sidebar, and `#compare` through [app.js](src/scripts/app.js)'s delegated click handler, `renderSidebar`, and `renderCompare`. Unknown persisted IDs are discarded; storage denial must not block browsing. [App tests](tests/app.test.mjs) cover saving/removing/comparing and local-file fallback. Pins are browser-origin-local, not synchronized accounts.

### Graphical hierarchy and guided paths — Shipped

[generate.mjs](generate.mjs) produces localized Markmap trees; `#map` and its category scope use `renderMap`. `#routes` uses `renderRoutes` with ordered canonical `bridgeIds`. The tree supplies an accessible alternative. [Content](tests/content.test.mjs) and [app](tests/app.test.mjs) tests cover data/route structure; actual map layout/zoom/link interaction lacks real-browser automated coverage. This is a hierarchy, not the full typed directed graph proposed by the atlas.

### Equation guidance and certification — Shipped, bounded

`#solver` → `runSolver` → [worker](src/scripts/solver-worker.js) → [`analyzeEquation`](src/scripts/equation.mjs) → `solverOutput`. Supported guided forms are single-variable polynomials up to degree four, rational equations with such numerators, and supported simple square-root equations. Other forms receive suggestions; unresolved candidates remain uncertified. [Equation tests](tests/equation.test.mjs) own mathematical regressions; [app tests](tests/app.test.mjs) exercise the browser bundle boundary. Blob-worker restrictions and CAS complexity can prevent completion.

### Build-on-start, watch, and browser reload — Shipped

`npm run dev`/`node serve.js` → `runCLI`/`startDevServer` → generator → snapshot → HTTP/SSE. Recursive directory watches cover source/docs; root watches filter generator and package manifests. Watch failures log a restart instruction; server-source changes require restart; dependency changes still require installation when needed. [Server tests](tests/serve.test.mjs) cover publication, recovery, and reload-client logic. The SSE channel is development-only and does not belong in static output.

### Lost or invented roots — Fixed regression risk

Canceling an unknown factor can lose zero; denominator cancellation can restore forbidden values; squaring can invent solutions. Retain original AST guards and check original substitutions in [equation.mjs](src/scripts/equation.mjs). Keep case-split/verification explanations in both locales. Run [equation regressions](tests/equation.test.mjs); checking only the transformed equation is insufficient.

### A degree result or decimal residual is not proof — Deliberate limitation

CAS degree alone can misclassify a transcendental expression, and floating arithmetic can hide errors. `polynomial` reconstructs expressions from coefficients; `serialize` makes decimals rational; `rationalSign`/`nonzeroProof` avoid promoting approximate signs to exact guards. These live in [equation.mjs](src/scripts/equation.mjs) with [focused tests](tests/equation.test.mjs). Preserve `unsupported`/`unknown` rather than guessing.

### Generated edits disappear or tests see stale output — Fixed workflow risk

[generate.mjs](generate.mjs) replaces generated assets; [app](tests/app.test.mjs) and [content](tests/content.test.mjs) tests consume them. Edit source, then build before running artifact tests. The development snapshot can remain healthy while disk output from a failed build is partial; run a successful standalone build before packaging.

### Overlapping builds, atomic saves, and reload loops — Fixed regression risk

Concurrent generators race with `libs/` replacement, individual-file watchers can detach after editor renames, and reloading on every SSE connection can loop. Delayed/duplicate filesystem events can also trigger unnecessary startup rebuilds. [serve.js](serve.js) uses one build queue, directory watches, `inputFingerprint` to skip unchanged watch input, complete snapshot publication, and revision comparison in `reloadScript`. Preserve these patterns and run [server tests](tests/serve.test.mjs).

## Interface Ownership Map

The command registry is [package.json](package.json); fragment dispatch/parameters are owned by `route` and `render` in [app.js](src/scripts/app.js); HTTP handling is owned by [serve.js](serve.js).

| Surface | Owner and contract |
| --- | --- |
| `npm run build`, `node generate.mjs` | Generator; replaces deployable outputs. |
| `npm run dev`, `node serve.js` | Build/watch/server CLI; `PORT` defaults to 4173. |
| `node serve.mjs` | Compatibility alias to `runCLI`. |
| `npm test` | Node test runner over `tests/*.test.mjs`. |
| `GET /`, `GET /index.html`, `GET /libs/*`; asset `HEAD` | Complete generated snapshot, no-store; source is not public. Other methods return 405. |
| `GET /__dev/events` | SSE `build` with `{revision}` and `build-error` with `{message}`. |
| `GET /__dev/reload.js?revision=<integer>` | Development client script; injected into served entry HTML. |
| `#explore?q=...&category=...&domain=...&level=...` | Search and family/domain/maximum-level library filters. |
| `#bridge/<canonical ID>`, `#compare` | Bridge detail and saved-pin comparison. |
| `#map?category=...`, `#routes`, `#solver` | Hierarchy, learning routes, and equation lab. |
| `?lang=en` / `?lang=it` before the fragment | Explicit language preference. |
| Worker request `{equation, variable, domain}` | `solver-worker.js` dispatches parser/analysis; reply `{result}` or `{error}`. |
| `startDevServer(options)` → `{url, close, rebuild}` | Programmatic test/dev lifecycle; importing the module does not start a server. |

## Build, Run, Test, Debug, and Release

Prerequisite: Node.js 20+ per [README](README.md), with npm. The implementation uses ESM, built-in recursive filesystem watchers, worker threads in tests, and current browser APIs. Node.js 24 on macOS is the inspected execution environment; other operating systems and minimum-version combinations have not been verified here. A browser must support Web Workers/Blob URLs for the lab and SSE for live reload.

```sh
npm ci
npm run build
npm run dev
```

The server prints `http://127.0.0.1:4173` by default; `PORT=4174 node serve.js` selects another port. Startup itself builds, so `node serve.js` is sufficient after dependencies are installed. Watcher errors and build failures appear in the terminal; reload-client build errors also appear in browser developer tools. Ctrl+C closes owned resources. Restart after editing the server implementation.

```sh
node --test tests/equation.test.mjs
node --test tests/content.test.mjs
node --test tests/app.test.mjs
node --test tests/serve.test.mjs
npm test
node --check serve.js
git diff --check
git diff --cached --check
```

Build before content/app/full tests. Server tests need permission to bind and fetch loopback sockets; in restricted environments, request the required execution permission rather than interpreting `listen EPERM` as a source regression. Tests create/delete fixtures under the OS temporary directory; production content is not edited. Installation changes `node_modules/` and can contact npm; build replaces `index.html`/`libs/`; development startup/watch rebuilds those same outputs. No workflow requires credentials or hardware.

There are no configured lint, formatting, typecheck, benchmark, seed, migration, or release commands. Do not invent them. To distribute, run a successful build and ship `index.html` with all of `libs/` and required license/source materials; use a static host. No automated deployment, hosting account, or publication is configured. Do not claim publication or change external hosting without task authorization.

## Test Ownership Map

| Contract/subsystem | Focused owner |
| --- | --- |
| Parser/limits/exact arithmetic/domain preservation/roots | [tests/equation.test.mjs](tests/equation.test.mjs), using real Algebrite. |
| Locale completeness, canonical links, worked formulas, embedded artifacts | [tests/content.test.mjs](tests/content.test.mjs), using strict KaTeX rendering. |
| Search, navigation, language, saved tabs, lab worker, stale-output clearing | [tests/app.test.mjs](tests/app.test.mjs), using `launch`/JSDOM and worker threads. |
| HTTP allowlist, source exclusion, build queue, watch/reload, failure recovery | [tests/serve.test.mjs](tests/serve.test.mjs), using temporary `fixture` roots and real loopback HTTP. |

There is no shared fixture directory or global test setup. Helpers live with their test files. Known coverage gaps: real-browser layout/mobile/map interaction, accessibility audits, minimum-version/platform matrix, general symbolic completeness, and mathematical/semantic review of all editorial content. Do not maintain a manual total test count in this handbook.

## Data, Security, Privacy, and Compatibility Boundaries

- Canonical editorial data is repository-local JSON/Markdown; templates/scripts/styles are canonical implementation. Generated HTML/bundles/copied JSON/fonts/atlas/notices are derived. `node_modules/` is an ignored installation artifact.
- Browser persistence uses JSON keys `mathbridges.language`, `mathbridges.pins`, and `mathbridges.treeMode`. Lab draft/results are in-memory; equations are not stored or transmitted by the application. A page reload clears the draft/results. Changing the origin/port changes the storage namespace; local-file storage may be denied.
- There are no user accounts, authentication/authorization roles, databases, retention jobs, synchronization, secret stores, schema migrations, or remote APIs. Do not introduce these as an incidental local refactor. No sensitive values belong in this handbook, fixtures, logs, or examples.
- Parser input is untrusted. Repository-authored catalog/locale Markdown and generator source are trusted development inputs. Keep sanitization, CAS grammar limits, worker termination, and source-serving exclusions at their owners; a loopback development server is not a hardened internet-facing service.
- SSE contains revisions and development build error messages, not submitted equations. Preserve loopback binding. Static distributions must have no `/__dev/*` dependency.
- Stable bridge IDs, relation targets, hash links, locale key parity, and storage fallback are compatibility contracts. Renames require coordinated references and persisted-pin handling; unknown old pin IDs are currently filtered rather than migrated. There is no broader published versioning/deprecation policy.
- Generated output is recoverable from canonical source and the lockfile. An in-memory snapshot survives a failed rebuild only while that server process runs; it is not a persistent backup. Starting from invalid source fails instead of silently serving stale disk output.

## Current Status, Known Gaps, and Roadmap Snapshot

### Shipped

The repository contains the bilingual curated atlas, purpose/discipline trees, filtered search, cards/examples, comparison tabs, hierarchy map, learning routes, bounded browser-local equation lab, static generator, and build/watch/reload development server. Feature ownership and focused checks are listed above. A local commit does not establish a published release or deployment.

### Experimental / Scaffold

No separate experimental package or feature-flag framework exists. General symbolic solving and automatic theorem/hypothesis proof must not be advertised based on the existing restricted lab.

### Known Gaps

- The curated catalog does not include every node, domain, example, or typed edge of the founding atlas. Editorial records currently carry `review`; rendering/structural tests are not independent mathematical review.
- The full directed-graph ontology, typed predicate verification, general route search, and learning-status system proposed in atlas §8 are not implemented. Markmap displays the curated hierarchy.
- Real-browser visual/map/mobile/accessibility verification and a supported-platform/minimum-version test matrix are absent. DOM and loopback checks do not fill those gaps.
- CAS limitations/complexity can leave roots uncertified or time out. Some irrational domain guards intentionally remain `unknown`; the lab is not a completeness guarantee.
- The generator replaces files on disk in place. Server snapshots protect HTTP consumers, but other processes reading the disk output during generation can observe partial output.
- Recursive watcher failures require a restart; changing server code does not self-restart; dependency installation is not automated by manifest watches.

### Planned

[The atlas §10](docs/atlante_ponti_matematici-ITA.md) describes editorial expansion and more advanced mathematics as future extensions. There is no separate implementation schedule or prioritized engineering backlog. Do not treat the full design ontology or an unrequested optimization as a committed next deliverable.

## Task Start and Handoff Checklist

1. Read applicable instructions, inspect Git status, identify owners/tests, and preserve existing work.
2. Check the relevant principle, contract, feature path, and actual current implementation before editing.
3. Keep canonical/generated, browser/server/worker, locale, and mathematical-domain boundaries intact.
4. Update linked file sections, symbols, feature/interface/test maps, README, and known gaps whenever the change makes a durable fact different. Do not leave documentation repair for a later task.
5. Build when sources change; run focused/full checks appropriate to the task, validate local Markdown links and `git diff --check`, and inspect the final diff. Run `git diff --cached --check` after staging to include new files. Before a commit, ensure this handbook describes the state immediately after that commit.
6. Hand off concrete behavior and validation, distinguish tests run from checks not performed, and state remaining limits without claiming deployment, visual QA, or formal proof that did not occur.

import katex from 'katex';
import { Markmap } from 'markmap-view';

const { atlas, locales, maps } = JSON.parse(document.getElementById('atlas-data').textContent);
const $ = selector => document.querySelector(selector);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(`mathbridges.${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`mathbridges.${key}`, JSON.stringify(value)); } catch { /* Browsing works without persistent storage. */ } }
};
const requestedLanguage = new URL(location.href).searchParams.get('lang');
let language = ['en','it'].includes(requestedLanguage) ? requestedLanguage : storage.get('language', navigator.language?.startsWith('it') ? 'it' : 'en');
if (!locales[language]) language = 'en';
let pins = storage.get('pins', []);
pins = Array.isArray(pins) ? [...new Set(pins.filter(id => atlas.bridges.some(b => b.id === id)))] : [];
let treeMode = storage.get('treeMode', 'families');
let map, worker, solveTimer, toastTimer, analysisResult, analysisInput, analysisError, solving = false;
let labDraft = { equation:'x^2 - 5*x + 6 = 0', variable:'x', domain:'real' };
const byId = Object.fromEntries(atlas.bridges.map(b => [b.id, b]));
const t = key => locales[language].ui[key] ?? key;
const text = bridge => locales[language].bridges[typeof bridge === 'string' ? bridge : bridge.id];
const icon = name => {
  const paths = { pin:'M9 3h6l-1 6 4 4v2h-5v6l-1-2-1 2v-6H6v-2l4-4-1-6Z', search:'m21 21-5.2-5.2M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15', spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z', check:'m5 12 4 4L19 6', link:'m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0' };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
};
function math(latex, display = false) {
  return `<span class="math">${katex.renderToString(latex, { displayMode:display, throwOnError:false, strict:'ignore', trust:false, output:'htmlAndMathml' })}</span>`;
}
function route() {
  const [path, query = ''] = location.hash.slice(1).split('?');
  return { path:path || 'explore', params:new URLSearchParams(query) };
}
function exploreLink(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([,v]) => v !== '' && v != null));
  return `#explore${query.size ? `?${query}` : ''}`;
}
const bridgeLink = id => `#bridge/${encodeURIComponent(id)}`;
function pinButton(id, full = false) {
  const selected = pins.includes(id), label = t(selected ? 'unpin' : 'pin');
  return `<button type="button" data-pin="${id}" class="${full ? 'button secondary' : 'pin-button'} ${selected ? 'selected' : ''}" aria-pressed="${selected}" aria-label="${escape(label)}: ${escape(text(id).title)}" title="${escape(label)}">${icon('pin')}${full ? `<span>${escape(label)}</span>` : ''}</button>`;
}
function card(id) {
  const b = byId[id], c = text(b);
  return `<article class="bridge-card"><div class="card-top"><span class="card-id">${b.id}</span>${pinButton(id)}</div><div class="card-body"><h3><a href="${bridgeLink(id)}">${escape(c.title)}</a></h3><p>${escape(c.summary)}</p><a class="formula-panel" href="${bridgeLink(id)}" aria-label="${escape(c.title)}">${math(b.formulaLatex,true)}</a></div><div class="card-footer"><span class="level-badge">L${b.level}</span><span>${escape(locales[language].categories[b.parentId].title)}</span><span class="type-label">${escape(t('types')[b.resultKind])}</span></div></article>`;
}
function renderHeader() {
  document.documentElement.lang = language;
  document.title = `${t('appName')} — ${t('subtitle')}`;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  const current = route().path;
  $('#main-nav').innerHTML = [['explore','explore'],['map','map'],['solver','solver'],['routes','routes']].map(([path,key]) => `<a href="#${path}" class="${current === path || path === 'explore' && current.startsWith('bridge/') ? 'active' : ''}" ${current === path ? 'aria-current="page"' : ''}>${escape(t(key))}</a>`).join('');
  document.querySelectorAll('[data-language]').forEach(button => { button.classList.toggle('active', button.dataset.language === language); button.setAttribute('aria-pressed', String(button.dataset.language === language)); });
  $('#mobile-menu').setAttribute('aria-label',t('menu'));
}
function renderSidebar() {
  const { path, params } = route();
  const selected = decodeURIComponent(path.split('/')[1] || '');
  const openIds = new Set([...document.querySelectorAll('.tree details[open]')].map(el => el.dataset.treeId));
  const groups = treeMode === 'disciplines' ? atlas.domains : atlas.categories;
  const groupText = treeMode === 'disciplines' ? locales[language].domains : locales[language].categories;
  $('#pin-tabs').hidden = pins.length === 0;
  $('#pin-tabs').setAttribute('aria-label', t('pinned'));
  $('#pin-tabs').innerHTML = `<span class="pin-tabs-label">${icon('pin')}${t('pinned')}</span>${pins.map(id => `<span class="pin-tab ${selected === id ? 'active' : ''}"><a href="${bridgeLink(id)}" ${selected === id ? 'aria-current="page"' : ''}>${escape(text(id).title)}</a><button data-pin="${id}" aria-label="${escape(t('remove'))}: ${escape(text(id).title)}">×</button></span>`).join('')}<a href="#compare" class="pin-compare">${t('compare')}</a>`;
  $('#sidebar-content').innerHTML = `<div class="sidebar-inner"><p class="eyebrow sidebar-heading">${t('browse')}</p><div class="tree-toggle"><button data-tree-mode="families" class="${treeMode === 'families' ? 'active' : ''}">${t('families')}</button><button data-tree-mode="disciplines" class="${treeMode === 'disciplines' ? 'active' : ''}">${t('disciplines')}</button></div><a href="#explore" class="button sidebar-all">${t('allBridges')}</a><nav class="tree" aria-label="${escape(t('browse'))}">${groups.map(group => {
    const children = atlas.bridges.filter(b => treeMode === 'disciplines' ? b.domainIds.includes(group.id) : b.parentId === group.id);
    const open = openIds.has(group.id) || children.some(b => b.id === selected) || params.get('category') === group.id;
    return `<details data-tree-id="${group.id}" ${open ? 'open' : ''}><summary><span>${escape(groupText[group.id].title)}</span><span class="tree-count">${children.length}</span></summary><a class="tree-link" href="${exploreLink(treeMode === 'disciplines' ? {domain:group.id} : {category:group.id})}">${t('overview')}</a>${children.map(b => `<a class="tree-link ${b.id === selected ? 'active' : ''}" href="${bridgeLink(b.id)}" ${b.id === selected ? 'aria-current="page"' : ''}>${escape(text(b).title)}</a>`).join('')}</details>`;
  }).join('')}</nav><section class="pin-box"><div class="pin-box-heading"><span>${icon('pin')} ${t('pinned')}</span><span>${pins.length}</span></div>${pins.length ? pins.map(id => `<div class="sidebar-pin"><a href="${bridgeLink(id)}">${escape(text(id).title)}</a><button data-pin="${id}" aria-label="${escape(t('remove'))}: ${escape(text(id).title)}">×</button></div>`).join('') : `<p>${t('emptyPins')}</p>`}<a href="#compare" class="small-link">${t('viewPins')}${pins.length ? ` (${pins.length})` : ''}</a></section><a class="source-link" href="libs/sources/atlas-ita.md">${t('source')}</a></div>`;
}
function art() {
  return `<div class="bridge-art" aria-hidden="true"><span class="art-formula">${math('x^2+1=0')}</span><svg viewBox="0 0 380 245" fill="none"><defs><pattern id="grid" width="21" height="21" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".75" fill="#9ebba2" opacity=".4"/></pattern></defs><rect width="380" height="245" fill="url(#grid)"/><path d="M28 196H352M59 185V89M319 185V89" stroke="#668e70" stroke-width="1.5"/><path d="M58 177C101 53 275 53 320 177" stroke="#315c43" stroke-width="2.5"/><path d="M58 185C103 76 274 76 320 185" stroke="#b4ce8c" stroke-width="9"/><path d="M91 125V187M124 98V187M157 84V187M190 80V187M223 84V187M256 98V187M289 125V187" stroke="#83a47f" stroke-width="1.2"/><path d="M24 189H356" stroke="#315c43" stroke-width="2"/><circle cx="58" cy="177" r="5" fill="#d8ed9a" stroke="#315c43"/><circle cx="320" cy="177" r="5" fill="#d8ed9a" stroke="#315c43"/><path d="M92 50C143 16 245 23 294 59" stroke="#93ac8f" stroke-dasharray="4 5"/><text x="47" y="219" font-family="Georgia,serif" font-size="21" fill="#47684e">ℝ</text><text x="307" y="219" font-family="Georgia,serif" font-size="21" fill="#47684e">ℂ</text><circle cx="190" cy="77" r="7" fill="#315c43"/><path d="M190 56V38" stroke="#315c43"/><circle cx="190" cy="33" r="4" fill="#d8ed9a" stroke="#315c43"/></svg><span class="art-formula bottom">${math('x=\\pm i')}</span></div>`;
}
function filters() {
  const { params } = route();
  return {q:params.get('q') || '',category:params.get('category') || '',domain:params.get('domain') || '',level:params.get('level') || ''};
}
function matchingBridges() {
  const f = filters();
  const normalize = s => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const query = normalize(f.q.trim());
  const preferred = ['B-02.01','B-02.03','B-02.07','B-01.04','B-05.03','B-04.05'];
  return atlas.bridges.filter(b => (!f.category || b.parentId === f.category) && (!f.domain || b.domainIds.includes(f.domain)) && (!f.level || b.level <= Number(f.level)) && (!query || normalize([b.id,b.formulaLatex,JSON.stringify(text(b)),locales[language].categories[b.parentId].title,...b.domainIds.map(id => locales[language].domains[id].title)].join(' ')).includes(query))).sort((a,b) => {
    const ai = preferred.indexOf(a.id), bi = preferred.indexOf(b.id);
    return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
  });
}
function libraryResults() {
  const matches = matchingBridges(), f = filters();
  const heading = locales[language].categories[f.category]?.title || locales[language].domains[f.domain]?.title || t('allBridges');
  return `<div class="section-heading"><h2>${escape(heading)}</h2><span role="status">${matches.length} ${t('results')}</span></div>${matches.length ? `<div class="cards">${matches.map(b=>card(b.id)).join('')}</div>` : `<div class="empty-state"><p>${t('noResults')}</p><a class="button secondary" href="#explore">${t('reset')}</a></div>`}<p class="catalog-note">${t('catalogNote')}</p>`;
}
function renderExplore() {
  const f = filters();
  $('#main').innerHTML = `<section class="hero"><div><div class="eyebrow">${t('introLabel')}</div><h1>${escape(t('introTitle'))}</h1><p>${t('introText')}</p><div class="hero-actions"><a class="button" href="#solver">${icon('spark')}${t('enterEquation')}</a><a class="button secondary" href="#map">${icon('map')}${t('map')}</a></div><div class="hero-stats"><span><strong>${atlas.bridges.length}</strong>${t('bridgeCount')}</span><span><strong>${atlas.categories.length}</strong>${t('familyCount')}</span><span><strong>2</strong>${t('languages')}</span></div></div>${art()}</section><section aria-label="${escape(t('allBridges'))}"><div class="toolbar"><div class="search-wrap">${icon('search')}<label class="sr-only" for="search">${t('searchLabel')}</label><input id="search" type="search" value="${escape(f.q)}" placeholder="${escape(t('search'))}" autocomplete="off">${f.q ? `<button class="clear-search" id="clear-search" aria-label="${t('clear')}">×</button>` : ''}</div><label class="sr-only" for="level-filter">${t('level')}</label><select id="level-filter"><option value="">${t('allLevels')}</option>${Array.from({length:7},(_,n)=>`<option value="${n}" ${f.level===String(n)?'selected':''}>≤ L${n}</option>`).join('')}</select><label class="sr-only" for="category-filter">${t('families')}</label><select id="category-filter"><option value="">${t('allFamilies')}</option>${atlas.categories.map(c=>`<option value="${c.id}" ${c.id===f.category?'selected':''}>${escape(locales[language].categories[c.id].title)}</option>`).join('')}</select></div><div class="category-chips"><a class="chip ${!f.category && !f.domain?'active':''}" href="${exploreLink({q:f.q,level:f.level})}">${t('allBridges')}</a>${['B-02','B-01','B-04','B-05'].map(id=>`<a class="chip ${f.category===id?'active':''}" href="${exploreLink({q:f.q,level:f.level,category:id})}">${escape(locales[language].categories[id].title)}</a>`).join('')}${f.domain || f.category || f.q || f.level ? `<a class="chip" href="#explore">${t('reset')}</a>` : ''}</div><div id="library-results">${libraryResults()}</div></section>`;
}
function renderBridge(id) {
  const b=byId[id];
  if(!b){location.hash='explore';return;}
  const c=text(b);
  $('#main').innerHTML=`<a class="back-link" href="${exploreLink({category:b.parentId})}">${t('back')}</a><div class="page-header"><div class="eyebrow">${b.id} · ${escape(locales[language].categories[b.parentId].title)}</div><div class="detail-title"><h1>${escape(c.title)}</h1>${pinButton(id,true)}</div><p>${escape(c.summary)}</p><div class="detail-meta"><span class="badge">${t('level')} ${b.level}</span><span class="badge ${b.resultKind==='EXACT_IMPLICATION'?'warm':''}">${t('types')[b.resultKind]}</span><span class="badge">${t(b.reversible===true?'yes':b.reversible==='conditional'?'conditional':'no')}</span><button class="icon-button" data-copy="${id}" aria-label="${t('copyLink')}" title="${t('copyLink')}">${icon('link')}</button></div></div><div class="detail-formula">${math(b.formulaLatex,true)}</div><div class="detail-grid"><section class="info-panel"><h2>${icon('spark')}${t('when')}</h2><p>${escape(c.when)}</p></section><section class="info-panel"><h2>${icon('check')}${t('guarantees')}</h2><p>${escape(c.guarantees)}</p></section><section class="info-panel"><h2>${t('hypotheses')}</h2><ul>${c.hypotheses.map(h=>`<li>${escape(h)}</li>`).join('')}</ul></section><section class="info-panel caution"><h2>${t('pitfalls')}</h2><p>${escape(c.pitfalls)}</p></section></div><section class="example"><div class="example-heading"><h2>${t('example')}</h2>${math(b.example.formulaLatex)}</div><ol>${b.example.steps.map((s,n)=>`<li><div class="step-formula">${math(s.formulaLatex)}</div><p class="step-reason">${escape(c.steps[n])}</p></li>`).join('')}</ol></section>${b.prerequisites.length?`<h2>${t('prerequisites')}</h2><div class="related-links">${b.prerequisites.map(id=>`<a href="${bridgeLink(id)}">${escape(text(id).title)}</a>`).join('')}</div>`:''}<h2>${t('related')}</h2><div class="related-links">${b.relatedIds.map(id=>`<a href="${bridgeLink(id)}">${escape(text(id).title)}</a>`).join('')}</div><a class="small-link" href="libs/sources/atlas-ita.md">${t('source')}</a><p class="review-note">${t('review')}</p>`;
}
function renderCompare() {
  $('#main').innerHTML=`<div class="page-header"><div class="eyebrow">${t('pinHint')}</div><h1>${t('compareTitle')}</h1><p>${t('compareText')}</p></div>${pins.length<2?`<div class="empty-state"><p>${t('compareEmpty')}</p><a class="button secondary" href="#explore">${t('browseAll')}</a></div>`:''}<div class="comparison">${pins.map(id=>{const b=byId[id],c=text(b);return `<article class="compare-card"><div class="card-top"><span class="card-id">${id} · L${b.level}</span>${pinButton(id)}</div><h2><a href="${bridgeLink(id)}">${escape(c.title)}</a></h2><p>${escape(c.summary)}</p><div class="formula-panel">${math(b.formulaLatex,true)}</div><h3>${t('resultType')}</h3><span class="badge">${t('types')[b.resultKind]}</span><h3>${t('when')}</h3><p>${escape(c.when)}</p><h3>${t('hypotheses')}</h3><ul>${c.hypotheses.map(h=>`<li>${escape(h)}</li>`).join('')}</ul><h3>${t('guarantees')}</h3><p>${escape(c.guarantees)}</p><h3>${t('pitfalls')}</h3><p>${escape(c.pitfalls)}</p><h3>${t('reversibility')}</h3><p>${t(b.reversible===true?'yes':b.reversible==='conditional'?'conditional':'no')}</p></article>`;}).join('')}</div>`;
}
function renderMap() {
  const scope=route().params.get('category')||'';
  $('#main').innerHTML=`<div class="page-header"><div class="eyebrow">${t('map')}</div><h1>${t('mapTitle')}</h1><p>${t('mapText')}</p></div><div class="map-controls"><label class="sr-only" for="map-scope">${t('mapScope')}</label><select id="map-scope"><option value="">${t('allFamilies')}</option>${atlas.categories.map(c=>`<option value="${c.id}" ${scope===c.id?'selected':''}>${escape(locales[language].categories[c.id].title)}</option>`).join('')}</select><button class="button secondary" id="map-fit">${t('fit')}</button></div><div class="map-canvas"><svg id="atlas-map" role="img" aria-label="${escape(t('mapTitle'))}"></svg></div><p class="map-note">${t('mapFallback')}</p>`;
  const tree=structuredClone(maps[language][scope]||maps[language].all);
  map=Markmap.create('#atlas-map',{autoFit:true,duration:0,maxWidth:220,initialExpandLevel:scope?3:2,paddingX:16,spacingVertical:12,color:()=> '#527e56'},tree);
  // SVG links are ordinary internal anchors, so browser history remains usable.
  requestAnimationFrame(()=>map?.fit());
}
function renderRoutes() {
  $('#main').innerHTML=`<div class="page-header"><div class="eyebrow">${t('routes')}</div><h1>${t('routesTitle')}</h1><p>${t('routesText')}</p></div>${atlas.routes.map((r,n)=>`<section class="route-card"><div><div class="eyebrow">${t('path')} ${String(n+1).padStart(2,'0')}</div><h2>${escape(locales[language].routes[r.id].title)}</h2><a class="small-link" href="${bridgeLink(r.bridgeIds[0])}">${t('startPath')}</a></div><div class="route-stops">${r.bridgeIds.map(id=>`<div class="route-stop"><a href="${bridgeLink(id)}">${escape(text(id).title)}</a><small class="card-id"> · L${byId[id].level}</small></div>`).join('')}</div></section>`).join('')}`;
}
const examples=['x^2 - 5*x + 6 = 0','(x^2-1)/(x-1) = 0','sqrt(x+2) = x','x^4 - 5*x^2 + 4 = 0','x^2 + 9 = 0'];
function renderSolver() {
  $('#main').innerHTML=`<div class="page-header"><div class="eyebrow">${t('solver')} · Algebrite</div><h1>${t('solverTitle')}</h1><p>${t('solverText')}</p></div><form id="equation-form" class="equation-form"><label for="equation">${t('equation')}</label><div class="equation-input-row"><input id="equation" name="equation" value="${escape(labDraft.equation)}" maxlength="361" spellcheck="false" autocomplete="off" required><button class="button" type="submit" ${solving?'disabled':''}>${icon('spark')}<span>${t(solving?'analyzing':'analyze')}</span></button></div><div class="equation-options"><div><label for="variable">${t('variable')}</label><select id="variable">${['x','y','z','t'].map(v=>`<option ${v===labDraft.variable?'selected':''}>${v}</option>`).join('')}</select></div><div><label for="domain">${t('domain')}</label><select id="domain"><option value="real" ${labDraft.domain==='real'?'selected':''}>${t('real')}</option><option value="complex" ${labDraft.domain==='complex'?'selected':''}>${t('complex')}</option></select></div></div><p class="syntax-hint">${t('syntax')}</p></form><div class="examples-row"><span>${t('try')}</span>${examples.map((e,n)=>`<button class="example-button" data-example="${n}">${escape(e)}</button>`).join('')}</div><div id="solver-output" aria-live="polite" aria-busy="${solving}">${solverOutput()}</div>`;
}
function solverOutput() {
  if(analysisError)return `<div class="alert" role="alert">${t(analysisError)}</div>`;
  if(solving)return `<div class="empty-state">${t('analyzing')}</div>`;
  if(!analysisResult)return `<section class="solver-idle"><h2>${t('suggestions')}</h2><div class="cards">${['B-02.01','B-02.03','B-02.07'].map(card).join('')}</div><p class="catalog-note">${t('limited')}</p></section>`;
  const r=analysisResult;
  const checks=r.restrictions.map(c=>`<div class="restriction">${math(`${c.latex || c.expression} ${c.relation==='neq'?'\\ne':c.relation==='gte'?'\\ge': '>'}0`)}</div>`).join('');
  const status=['identity','contradiction','unsupported','emptyRoots'].includes(r.status)?`<div class="alert">${t(r.status)}</div>`:'';
  return `${status}<div class="lab-layout"><section class="solution"><h2>${t('analysis')}</h2><div class="solution-note">${escape(analysisInput.equation)} · ${t(analysisInput.domain)}</div><ol class="solution-steps">${r.steps.map(s=>`<li><div class="step-formula">${math(s.latex)}</div><p class="step-reason">${t(s.key)}</p></li>`).join('')}</ol>${r.roots.length?`<table class="root-table"><thead><tr><th>${t('candidates')}</th><th>${t('verification')}</th></tr></thead><tbody>${r.roots.map(root=>`<tr><td>${math(`${analysisInput.variable}=${root.latex}`)}</td><td><span class="root-state ${root.state}">${root.state==='verified'?'✓ ':root.state==='rejected'?'× ':''}${t(root.state)}</span>${root.residualLatex!==null?`<div>${math(`L(r)-R(r)=${root.residualLatex}`)}</div>`:''}</td></tr>`).join('')}</tbody></table><p class="solution-note">${t('stepVerify')} ${t('rootNote')}</p>`:''}</section><aside class="lab-aside"><section class="info-panel"><h2>${t('conditions')}</h2>${checks||`<p>${t('noRestrictions')}</p>`}</section><section class="info-panel"><h2>${t('suggestions')}</h2>${r.suggestedIds.map(id=>`<a class="suggestion" href="${bridgeLink(id)}">${escape(text(id).title)}<small>${id}</small></a>`).join('')}</section></aside></div>`;
}
function readLabDraft() {
  if($('#equation'))labDraft={equation:$('#equation').value,variable:$('#variable').value,domain:$('#domain').value};
}
function runSolver() {
  readLabDraft(); worker?.terminate(); clearTimeout(solveTimer);
  analysisInput={...labDraft};analysisResult=null;analysisError=null;solving=true;renderSolver();
  try {
    // A bundled Blob worker also permits opening the generated index directly as a file.
    const url=URL.createObjectURL(new Blob([__SOLVER_WORKER_SOURCE__],{type:'text/javascript'}));
    worker=new Worker(url);URL.revokeObjectURL(url);
    const finish=data=>{clearTimeout(solveTimer);worker?.terminate();worker=null;solving=false;analysisResult=data.result||null;analysisError=data.error||null;if(route().path==='solver')renderSolver();};
    worker.onmessage=event=>finish(event.data);
    worker.onerror=event=>{event.preventDefault();finish({error:'workerError'});};
    solveTimer=setTimeout(()=>finish({error:'timeout'}),5000);
    worker.postMessage(analysisInput);
  }catch{worker?.terminate();worker=null;solving=false;analysisError='workerError';renderSolver();}
}
function render({ focus = false } = {}) {
  readLabDraft();
  if(map){map.destroy();map=null;}
  renderHeader();renderSidebar();
  const {path}=route();document.body.dataset.view=path.split('/')[0];
  if(path.startsWith('bridge/'))renderBridge(decodeURIComponent(path.split('/')[1]));
  else if(path==='map')renderMap();
  else if(path==='routes')renderRoutes();
  else if(path==='solver')renderSolver();
  else if(path==='compare')renderCompare();
  else renderExplore();
  if(focus){$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function toast(message) {$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,2200);}
function setFilter(key,value,{replace=false}={}) {
  const f=filters();f[key]=value;
  if(key==='category')f.domain='';
  const link=exploreLink(f);
  if(replace){history.replaceState(null,'',link);$('#library-results').innerHTML=libraryResults();}
  else location.hash=link;
}
document.addEventListener('click',async event=>{
  const pin=event.target.closest('[data-pin]');
  if(pin){
    const id=pin.dataset.pin;
    pins=pins.includes(id)?pins.filter(p=>p!==id):[...pins,id];storage.set('pins',pins);
    if(route().path==='compare'){renderCompare();}else{
      document.querySelectorAll(`[data-pin="${id}"]`).forEach(el=>{const full=el.classList.contains('button');el.outerHTML=pinButton(id,full);});
    }
    renderSidebar();return;
  }
  const lang=event.target.closest('[data-language]');
  if(lang){readLabDraft();language=lang.dataset.language;storage.set('language',language);const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);render();return;}
  const mode=event.target.closest('[data-tree-mode]');
  if(mode){treeMode=mode.dataset.treeMode;storage.set('treeMode',treeMode);renderSidebar();return;}
  if(event.target.closest('#mobile-menu')){const open=$('#sidebar').classList.toggle('open');$('#mobile-menu').setAttribute('aria-expanded',String(open));return;}
  if(event.target.closest('#clear-search')){setFilter('q','');return;}
  if(event.target.closest('#map-fit')){map?.fit();return;}
  const example=event.target.closest('[data-example]');
  if(example){worker?.terminate();clearTimeout(solveTimer);solving=false;analysisResult=null;analysisError=null;labDraft={equation:examples[Number(example.dataset.example)],variable:'x',domain:labDraft.domain};renderSolver();$('#equation').focus();return;}
  const copy=event.target.closest('[data-copy]');
  if(copy){try{await navigator.clipboard.writeText(location.href);toast(t('copied'));}catch{toast(t('copyFailed'));}return;}
  if(event.target.closest('a[href^="#"]')&&innerWidth<=850){$('#sidebar').classList.remove('open');$('#mobile-menu').setAttribute('aria-expanded','false');}
});
document.addEventListener('input',event=>{
  if(event.target.id==='search')setFilter('q',event.target.value,{replace:true});
  if(event.target.closest('#equation-form')){
    readLabDraft();analysisResult=null;analysisError=null;
    if(solving){worker?.terminate();clearTimeout(solveTimer);solving=false;const button=$('#equation-form button[type="submit"]');button.disabled=false;button.querySelector('span').textContent=t('analyze');}
    $('#solver-output').innerHTML=solverOutput();$('#solver-output').setAttribute('aria-busy','false');
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='level-filter')setFilter('level',event.target.value);
  if(event.target.id==='category-filter')setFilter('category',event.target.value);
  if(event.target.id==='map-scope')location.hash=`map${event.target.value?`?category=${event.target.value}`:''}`;
});
document.addEventListener('submit',event=>{if(event.target.id==='equation-form'){event.preventDefault();runSolver();}});
window.addEventListener('hashchange',()=>render({focus:true}));
window.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#sidebar').classList.remove('open');$('#mobile-menu').setAttribute('aria-expanded','false');}});
render();

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker as NodeWorker} from 'node:worker_threads';
import {JSDOM,VirtualConsole} from 'jsdom';
const [html,bundle,workerSource]=await Promise.all(['index.html','libs/app.js','libs/solver-worker.js'].map(file=>readFile(new URL(`../${file}`,import.meta.url),'utf8')));
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
function launch(t,{url='http://localhost/',saved={}}={}){
 const errors=[];const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
 const {window:w}=dom;w.scrollTo=()=>{};w.structuredClone=structuredClone;
 for(const [key,value] of Object.entries(saved))w.localStorage.setItem(`mathbridges.${key}`,JSON.stringify(value));
 const workers=[];
 w.URL.createObjectURL=()=> 'blob:mathbridges-test';w.URL.revokeObjectURL=()=>{};
 w.Worker=class{
  constructor(){
   this.worker=new NodeWorker(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:data=>parentPort.postMessage(data)};${workerSource};parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
   this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.({preventDefault(){},error}));workers.push(this.worker);
  }
  postMessage(data){this.worker.postMessage(data);}
  terminate(){this.worker.terminate();}
 };
 w.eval(bundle);
 t.after(async()=>{await Promise.all(workers.map(worker=>worker.terminate()));dom.window.close();assert.deepEqual(errors,[]);});
 return {w,doc:w.document,async goto(hash){w.location.hash=hash;await tick();}};
}
test('library search and level filters update the displayed collection',async t=>{
 const {w,doc,goto}=launch(t);assert.equal(doc.querySelectorAll('.bridge-card').length,38);
 const input=doc.querySelector('#search');input.value='denominator';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.ok(doc.querySelectorAll('.bridge-card').length>0);assert.ok(doc.querySelectorAll('.bridge-card').length<38);assert.match(w.location.hash,/q=denominator/);
 await goto('#explore?level=1');assert.ok([...doc.querySelectorAll('.level-badge')].every(el=>el.textContent==='L1'));
 await goto('#explore?q=unfindable-string');assert.equal(doc.querySelectorAll('.bridge-card').length,0);assert.match(doc.querySelector('.empty-state').textContent,/No bridges/);
});
test('language switching preserves the current bridge and translates worked steps',async t=>{
 const {doc,w,goto}=launch(t);await goto('#bridge/B-02.01');doc.querySelector('[data-language="it"]').click();
 assert.equal(doc.documentElement.lang,'it');assert.match(doc.querySelector('h1').textContent,/Fattorizzare/);assert.match(doc.querySelector('.example li').textContent,/Trova due numeri/);
 assert.equal(w.localStorage.getItem('mathbridges.language'),'"it"');assert.match(w.location.search,/lang=it/);assert.equal(w.location.hash,'#bridge/B-02.01');
});
test('pins behave as saved tabs and render side-by-side comparison',async t=>{
 const {doc,w,goto}=launch(t);doc.querySelector('[data-pin="B-02.01"]').click();doc.querySelector('[data-pin="B-02.03"]').click();
 assert.equal(doc.querySelector('#pin-tabs').hidden,false);assert.equal(doc.querySelectorAll('.pin-tab').length,2);
 assert.deepEqual(JSON.parse(w.localStorage.getItem('mathbridges.pins')),['B-02.01','B-02.03']);
 await goto('#compare');assert.equal(doc.querySelectorAll('.compare-card').length,2);
 doc.querySelector('.compare-card [data-pin]').click();assert.equal(doc.querySelectorAll('.compare-card').length,1);assert.equal(doc.querySelectorAll('.pin-tab').length,1);
});
test('direct links and discipline trees open their canonical content',async t=>{
 const {doc,goto}=launch(t,{saved:{pins:['bad-id','B-05.03'],treeMode:'disciplines'}});
 assert.equal(doc.querySelectorAll('.pin-tab').length,1);assert.equal(doc.querySelectorAll('.tree details').length,10);
 await goto('#bridge/B-05.03');assert.match(doc.querySelector('h1').textContent,/Hermitian/);assert.equal(doc.querySelectorAll('.example li').length,3);
 await goto('#routes');assert.equal(doc.querySelectorAll('.route-card').length,4);
});
test('browser bundle and isolated worker solve a radical equation end to end',async t=>{
 const {doc,w,goto}=launch(t);await goto('#solver');
 const input=doc.querySelector('#equation');input.value='sqrt(x+2)=x';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 doc.querySelector('#equation-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const deadline=Date.now()+6000;while(!doc.querySelector('.root-table')&&Date.now()<deadline)await tick();
 assert.ok(doc.querySelector('.root-table'),doc.querySelector('#solver-output').textContent);
 assert.equal(doc.querySelectorAll('.root-state.verified').length,1);assert.equal(doc.querySelectorAll('.root-state.rejected').length,1);
 // Editing the equation must immediately discard the old result.
 const edited=doc.querySelector('#equation');edited.value='x^2+9=0';edited.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(doc.querySelector('.root-table'),null);
});
test('local-file browsing works when localStorage is unavailable',t=>{
 const {doc}=launch(t,{url:'file:///tmp/mathbridges/index.html'});assert.equal(doc.querySelectorAll('.bridge-card').length,38);doc.querySelector('[data-pin="B-02.01"]').click();assert.equal(doc.querySelectorAll('.pin-tab').length,1);
});

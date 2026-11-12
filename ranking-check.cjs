'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const edge=fs.readFileSync('backend/ranking/index.ts','utf8');
const scoreCode=edge.slice(edge.indexOf('export function scoreForTicks'),edge.indexOf('Deno.serve')).replace('export ','').replace('ticks:number','ticks');
const scoreBox={Math};vm.createContext(scoreBox);vm.runInContext(scoreCode+';this.score=scoreForTicks;',scoreBox);
for(const {version,base,capSpeed} of [{version:1,base:259.2,capSpeed:900},{version:2,base:311.04,capSpeed:900},{version:3,base:466.56,capSpeed:4665.6}]){
 let distance=0,speed=base;
 for(let i=1;i<=432000;i++){distance+=speed/1500;speed=Math.min(capSpeed,base+distance*.0525);if([1,120,240,36000,100000,432000].includes(i))assert.equal(scoreBox.score(i,version),Math.floor(distance),`score v${version} matches fixed-step game scoring`)}
}
assert(scoreBox.score(432000,3)<2000000,'v2 score fits new table bound');
const nodes={},listeners={},storage=new Map();function element(){return {value:'',hidden:false,disabled:false,textContent:'',children:[],classList:{toggle(){}},setAttribute(){},append(...xs){this.children.push(...xs)},replaceChildren(){this.children=[]},addEventListener(name,fn){this[name]=fn},scrollIntoView(){},focus(){}}}
const doc={getElementById:id=>nodes[id]??=element(),createElement:()=>element()};
const responses=[],calls=[];const context={document:doc,window:{addEventListener:(name,fn)=>listeners[name]=fn},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},crypto:require('crypto').webcrypto,AbortController,setTimeout,clearTimeout,fetch:async(_url,request)=>{calls.push(JSON.parse(request.body));return {ok:true,json:async()=>responses.shift()||{leaders:[],mine:null,total:0}}},console};
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 vm.createContext(context);vm.runInContext(fs.readFileSync('dist/ranking.js','utf8'),context);await tick();
 assert.equal(nodes.rankingEmpty.hidden,false);assert.equal(calls[0].action,'top');assert.equal(calls[0].rankingVersion,4);assert.equal(calls[0].scoreVersion,3);
 nodes.rankV1.click();await tick();assert.equal(calls.at(-1).rankingVersion,1);assert.equal(nodes.rankingForm.hidden,true);
 nodes.rankV2.click();await tick();assert.equal(calls.at(-1).rankingVersion,2);assert.equal(nodes.rankingForm.hidden,true);
 nodes.rankV3.click();await tick();assert.equal(calls.at(-1).rankingVersion,3);assert.equal(nodes.rankingForm.hidden,true);
 nodes.rankV4.click();await tick();assert.equal(calls.at(-1).rankingVersion,4);assert.equal(nodes.rankingForm.hidden,false);
 const runId='11111111-1111-4111-8111-111111111111';
 for(const [score,isNew,bestDistance] of [[39,false,0],[40,false,0],[41,true,41],[42,true,41]]){
  responses.push({runId,bestDistance});listeners['chacha:run-start']();await tick();
  assert.equal(calls.at(-1).rankingVersion,4);
  await listeners['chacha:run-end']({detail:{score,ticks:240,isNew}});
  assert.equal(nodes.rankSubmit.disabled,score!==42);
  assert.equal(nodes.openRanking.disabled,score!==42);
  if(score!==42){
   await nodes.rankingForm.submit({preventDefault(){}});
   assert(!calls.some(c=>c.action==='submit'),'lower or equal local/online record cannot submit');
  }
 }
 nodes.rankNickname.value='<script>';await nodes.rankingForm.submit({preventDefault(){}});assert(!calls.some(c=>c.action==='submit'),'reject markup nickname');
 nodes.rankNickname.value='달리는차차';responses.push({leaders:[{rank:1,nickname:'<img src=x>',distance:42}],mine:{rank:1,distance:42,nickname:'달리는차차'},total:1});await nodes.rankingForm.submit({preventDefault(){}});
 assert.equal(calls.at(-1).ticks,240);assert.equal(calls.at(-1).rankingVersion,4);assert.equal(calls.at(-1).scoreVersion,3);assert.equal(nodes.rankSubmit.disabled,true);assert.equal(nodes.rankingRows.children[0].children[1].textContent,'<img src=x>','nickname rendered as text');
 const count=calls.length;await nodes.rankingForm.submit({preventDefault(){}});assert.equal(calls.length,count,'no duplicate submission');
 assert(edge.includes("rankingVersion===2?'chacha_ranking_v2':'chacha_ranking'"));assert(edge.includes("rankingVersion===2?'chacha_submit_score_v2':'chacha_submit_score'"));
 assert(edge.includes("rankingVersion===3?'chacha_start_run_v3'"));assert(edge.includes("rankingVersion===3?'chacha_submit_score_v3'"));
 for(const rpc of ['chacha_ranking_v4','chacha_start_run_v4','chacha_submit_score_v4'])assert(edge.includes("rankingVersion===4?'"+rpc+"'"));
 console.log('PASS: v4 and archived v1–v3 routes, scoring parity, strict record gating, nickname safety, duplicate protection');
})().catch(e=>{console.error(e);process.exitCode=1});

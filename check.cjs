'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const DT=1/120;
function sandbox(){
 const nodes={},storage={},gradient={addColorStop(){}};
 const drawingStats={blurs:0,shadows:0,images:0};
 const drawing=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(o,k)=>k==='drawImage'?(()=>drawingStats.images++):o[k]||(()=>{}),set:(o,k,v)=>{if(k==='filter'&&v.includes('blur'))drawingStats.blurs++;if(k==='shadowBlur'&&v>0)drawingStats.shadows++;o[k]=v;return true}});
 function element(id){return nodes[id]??={id,value:0,hidden:false,disabled:false,textContent:'',innerHTML:'',setAttribute(){},addEventListener(){},getBoundingClientRect:()=>({width:1000,height:392}),getContext:()=>drawing,scrollIntoView(){},focus(){}}}
 const box={drawingStats,document:{getElementById:element,createElement:()=>element('temp'),addEventListener(){}},window:{addEventListener(){},dispatchEvent(){}},Event:class{},CustomEvent:class{},devicePixelRatio:1,ResizeObserver:class{observe(){}},Image:class{decode(){return new Promise(()=>{})}},localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v},requestAnimationFrame(){},Math:Object.create(Math),console};
 box.Math.random=()=>.5;vm.createContext(box);
 vm.runInContext(fs.readFileSync('dist/chacha.js','utf8')+'\nthis.api={app,update,start,jump,pause,preview,legPose,gaitBody,groundContact,render,frame,makeObstacle,makeEncounter,smallSpacing,actorBox,obstacleBox,sweptCollision,recoveryTime,gameConfig,images,drawingStats,START_SPEED,MAX_SPEED,setWorld:(w,h)=>{W=w;H=h;ground=h*.78},setRandom:f=>{Math.random=f}};',box);
 return box.api;
}
function setup(multiplier=1){const a=sandbox();a.start();a.app.speed=a.START_SPEED*multiplier;a.app.distance=(a.app.speed-a.START_SPEED)/.0525;a.app.spawn=1e9;return a}
function step(a,seconds){for(let i=0;i<Math.ceil(seconds/DT);i++)a.update(DT)}
assert(Math.abs(sandbox().START_SPEED-466.56)<1e-9);assert(Math.abs(sandbox().MAX_SPEED-4665.6)<1e-9);
const a=setup();a.jump();assert.equal(a.app.jumpsUsed,1);step(a,.1);a.jump();assert.equal(a.app.jumpsUsed,2);const secondVy=a.app.vy;a.jump();assert.equal(a.app.vy,secondVy,'third jump ignored');step(a,2);assert.equal(a.app.jumpY,0);assert.equal(a.app.jumpsUsed,0);a.jump();assert.equal(a.app.jumpsUsed,1);
const single=setup();single.jump();let singleApex=0;for(let i=0;i<160;i++){single.update(DT);singleApex=Math.max(singleApex,single.app.jumpY)}
const twice=setup();twice.jump();let doubleApex=0;for(let i=0;i<200;i++){if(i===36)twice.jump();twice.update(DT);doubleApex=Math.max(doubleApex,twice.app.jumpY)}
assert(singleApex>115&&singleApex<122);assert(doubleApex>250&&doubleApex<270);console.log(`PASS: double jump, landing reset; apex ${singleApex.toFixed(1)} / ${doubleApex.toFixed(1)}`);
function encounter(kind,multiplier,second,width=1000){const x=setup(multiplier);x.setWorld(width,480);const actor=x.actorBox(),obstacle=x.makeObstacle(kind,actor.right+x.app.speed*.42-5);x.app.obstacles=[obstacle];x.jump();for(let i=0;i<200&&x.app.mode!=='over';i++){if(second&&i===36)x.jump();x.update(DT)}return x}
for(const width of [640,1000])for(const multiplier of [1,2,5,10])for(const kind of ['giant-radish','giant-cabbage']){assert.equal(encounter(kind,multiplier,false,width).app.mode,'over',kind+' blocks one jump');assert.equal(encounter(kind,multiplier,true,width).app.mode,'play',`${kind} cleared at ${multiplier}x / ${width}px`)}
assert(singleApex+9<176-6);console.log('PASS: both giant vegetables require and allow double jump at 1/2/5/10x');
for(const bottom of [78,112,150,188]){const o=a.makeObstacle('crow',300,{bottom});assert(o.bottom===bottom&&o.w>70);assert(o.bottom+o.h<=236)}
const crowGround=setup();crowGround.app.obstacles=[crowGround.makeObstacle('crow',crowGround.actorBox().right+10,{bottom:150})];step(crowGround,1.2);assert.equal(crowGround.app.mode,'play');const crowJump=encounter('crow',1,false);assert.equal(crowJump.app.mode,'over');
const swept=setup();assert(swept.sweptCollision({left:0,right:20,top:0,bottom:20},{left:0,right:20,top:0,bottom:20},{left:200,right:220,top:0,bottom:20},{left:-200,right:-180,top:0,bottom:20}));
const paused=setup();paused.pause();paused.jump();assert.equal(paused.app.jumpsUsed,0);const distance=paused.app.distance;step(paused,1);assert.equal(paused.app.distance,distance);paused.pause();paused.app.mode='over';paused.jump();assert.equal(paused.app.jumpsUsed,0);console.log('PASS: four crow lanes, ground/jump avoidance, swept collision, pause guards');
// Real generated encounters preserve large/crow isolation and safe small chains.
const mix=setup();let seed=12345;mix.setRandom(()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296});const counts=new Set();let giants=0,crows=0;
for(let i=0;i<3000;i++){
 const pattern=mix.makeEncounter(2000,mix.START_SPEED);counts.add(pattern.length);
 if(pattern[0].giant){giants++;assert.equal(pattern.length,1)}
 if(pattern[0].name==='crow'){crows++;assert.equal(pattern.length,1)}
 if(pattern.length>1)assert(pattern.every(o=>!o.giant&&o.bottom===0&&['radish','cabbage'].includes(o.name)));
}
assert.deepEqual([...counts].sort(),[1,2,3]);assert(giants>0&&crows>0);
for(const width of [640,1000])for(const multi of [1,2,5,10])for(const count of [2,3]){
 const x=setup(multi);x.setWorld(width,480);let last=null;
 const pattern=Array.from({length:count},(_,i)=>{const o=x.makeObstacle(i%2?'cabbage':'radish',0);o.x=last?last.x+x.smallSpacing(last,o,x.app.speed):x.actorBox().right+x.app.speed*.16-5;last=o;return o});
 x.app.obstacles=pattern;
 for(let i=0;i<120*5&&x.app.mode==='play';i++){
  const next=x.app.obstacles.find(o=>o.x+o.w>x.actorBox().left);
  if(next&&x.app.jumpY===0&&(next.x+5-x.actorBox().right)/x.app.speed<=.16)x.jump();
  x.update(DT);
 }
 assert.equal(x.app.mode,'play',count+' small jumps clearable at '+multi+'x / '+width);
 assert(pattern.every(o=>!o.hit),'all small obstacles cleared without collision');
}
// Exercise removal and cooldown with multiple members in an encounter.
for(const multi of [1,10]){
 const x=setup(multi);x.gameConfig.invincible=true;x.app.spawn=0;
 for(let i=0;i<120*90;i++){
  x.update(DT);assert(x.app.obstacles.length<=3);
  if(x.app.obstacles.some(o=>o.giant||o.name==='crow'))assert.equal(x.app.obstacles.length,1,'large/crow encounter stays isolated');
 }
}
console.log('PASS: small pairs/triples clearable at 1/2/5/10x and mobile/desktop; giants and crows stay isolated');
for(const hz of [30,60,120,144]){const x=setup();x.app.spawn=1e9;x.frame(100);for(let i=1;i<=hz*2;i++)x.frame(100+i*1000/hz);assert(x.app.distance>70&&x.app.distance<100);x.render()}
const cap=setup();cap.app.distance=1e9;cap.update(DT);assert.equal(cap.app.speed,cap.MAX_SPEED);cap.update(DT);assert.equal(cap.app.speed,cap.MAX_SPEED);console.log('PASS: fixed timestep and 10x speed cap');
const source=fs.readFileSync('dist/chacha.js','utf8'),html=fs.readFileSync('dist/index.html','utf8');assert(source.includes("dispatchEvent(new Event('chacha:run-start'))"));assert(source.includes("dispatchEvent(new CustomEvent('chacha:run-end'"));assert(!html.includes('testStart'));assert(html.includes('id="rankV1"')&&html.includes('id="rankV2"'));
console.log('PASS: production game hooks, v1/v2 tabs, no internal test controls');


const graphics=setup();graphics.images.radish={};graphics.app.obstacles=[graphics.makeObstacle('giant-radish',500)];graphics.render();
const warm={...graphics.drawingStats};
for(let i=0;i<100;i++)graphics.render();
assert.equal(graphics.drawingStats.blurs,warm.blurs,'background blur runs once, never during warmed frames');
assert.equal(graphics.drawingStats.shadows,warm.shadows,'obstacle shadow runs once, never during warmed frames');
assert.equal(graphics.drawingStats.images-warm.images,200,'one background and one obstacle image per frame');
graphics.setWorld(640,500);graphics.render();assert.equal(graphics.drawingStats.blurs,warm.blurs+1,'resize rebuilds background');
assert(!/id="(?:jump|jumpMobile)"/.test(html),'no jump buttons');assert(source.includes("canvas.addEventListener('pointerdown'"),'canvas touch jump retained');
console.log('PASS: 100 warmed frames use zero blur/shadow passes and two image draws per frame; resize invalidation and touch-only UI');

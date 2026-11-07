/* Based on the inspected Gemini HTML: Canvas 2D, radish/cabbage assets,
 * single jump (-12.5 / .65 per 60Hz frame), 4.32 starting speed, local best.
 * Rebuilt with a time-based simulation and an articulated continuous gait. */
'use strict';
const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d');
const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), mix=(a,b,t)=>a+(b-a)*t;
const START_SPEED=216*1.2;
const app={mode:'preview',time:0,phase:0,rate:1,slow:false,frozen:false,distance:0,speed:START_SPEED,scroll:0,spawn:1.5,obstacles:[],dust:[],jumpY:0,vy:0,land:0,buffer:0,best:0,sound:false};
let W=1000,H=392, ground=290, last=0, accumulator=0,audio;
try{const saved=Number(localStorage.getItem('chow_high_score'));app.best=Number.isFinite(saved)&&saved>=0?Math.floor(saved):0}catch{}
$('best').innerHTML=app.best+' <small>m</small>';
const images={};
async function loadImage(name){
 const im=new Image();im.src='assets/'+name+'.jpg';await im.decode();
 const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
 const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
 const d=g.getImageData(0,0,c.width,c.height),w=c.width,h=c.height;
 // Remove only background-connected white pixels, preserving pale fur/vegetables.
 const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 function visit(i){if(i<0||i>=w*h||seen[i])return;seen[i]=1;const j=i*4;if(Math.min(d.data[j],d.data[j+1],d.data[j+2])<225)return;queue[tail++]=i;d.data[j+3]=0}
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x)}for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1)}
 while(head<tail){const i=queue[head++];if(i%w>0)visit(i-1);if(i%w<w-1)visit(i+1);visit(i-w);visit(i+w)}
 g.putImageData(d,0,0);
 if(name==='chowRun'){images[name]=c;return}
 // Crop the known original sprite margins to align visible art and collision.
 const crop=name==='radish'?[320,130,380,750]:[110,110,810,810];
 const cut=document.createElement('canvas');cut.width=crop[2];cut.height=crop[3];cut.getContext('2d').drawImage(c,...crop,0,0,cut.width,cut.height);images[name]=cut;
}
Promise.all(['chowRun','radish','cabbage'].map(loadImage)).then(()=>{$('start').disabled=false;$('start').innerHTML='함께 달리기 <b>↗</b>'}).catch(()=>{$('hint').textContent='이미지 일부를 불러오지 못했어요. 새로고침해 주세요.'});
function resize(){const r=canvas.getBoundingClientRect();const d=Math.min(devicePixelRatio||1,2);W=r.width<600?640:1000;H=W*r.height/r.width;ground=H*.72;canvas.width=Math.round(W*d);canvas.height=Math.round(H*d);ctx.setTransform(d,0,0,d,0,0)}
new ResizeObserver(resize).observe(canvas);resize();
function ellipse(x,y,rx,ry,color,rotation=0){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,TAU);ctx.fill()}
function line(points,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.stroke()}
function fluff(x,y,rx,ry,color,n=14){ellipse(x,y,rx,ry,color);for(let i=0;i<n;i++){const a=i*TAU/n;ellipse(x+Math.cos(a)*rx*.86,y+Math.sin(a)*ry*.85,rx*.22,ry*.24,color,a*.2)}}
// Asymmetric gallop: hind push -> extended flight -> fore landing ->
// gathered flight. Near/far feet land slightly apart, never as diagonal pairs.
const STRIDE_DISTANCE=32/.28;
function cycleSample(keys,p){
 p=((p%1)+1)%1;let i=0;while(i<keys.length-2&&p>=keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],before=keys[i-1]||[keys[keys.length-2][0]-1,...keys[keys.length-2].slice(1)],after=keys[i+2]||[keys[1][0]+1,...keys[1].slice(1)];
 const span=b[0]-a[0],t=(p-a[0])/span,t2=t*t,t3=t2*t;
 return a.slice(1).map((v,k)=>{const j=k+1,m0=(b[j]-before[j])/(b[0]-before[0])*span,m1=(after[j]-a[j])/(after[0]-a[0])*span;return (2*t3-3*t2+1)*v+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b[j]+(t3-t2)*m1});
}
function gaitBody(phase){const [bob,stretch,pitch]=cycleSample([[0,1,.97,-.025],[.16,-2,1.04,-.06],[.32,-6,1.06,.015],[.43,1,1,.065],[.58,2,.96,.035],[.76,-7,.93,-.02],[.9,-4,.96,-.045],[1,1,.97,-.025]],phase);return {bob,stretch,pitch}}
function groundContact(phase){return [0,.045,.6,.645].some(offset=>(phase+offset)%1<.28)}
function legPose(phase,hipX,bob,air,front,far){
 const p=(phase+(front?.6:0)+(far?.045:0))%1,stance=.28;
 let footX,footY;
 if(p<stance){footX=mix(16,-16,p/stance);footY=0}
 else{const keys=front?[[0,16,0],[.28,-16,0],[.41,-20,-11],[.61,-6,-18],[.8,20,-13],[.93,22,-4],[1,16,0]]:[[0,16,0],[.28,-16,0],[.41,-22,-10],[.57,-6,-16],[.73,14,-13],[.9,20,-4],[1,16,0]];[footX,footY]=cycleSample(keys,p);footY=Math.min(0,footY)}
 footX=hipX+mix(footX,front?-7:8,air);footY=mix(footY,-14,air);
 const hipY=(front?-27:-25)+bob,target=front?[footX,footY-2]:[footX-4,footY-7];
 const dx=target[0]-hipX,dy=target[1]-hipY,l1=front?19:17,l2=l1;
 const distance=clamp(Math.hypot(dx,dy),.01,l1+l2-.01),angle=Math.atan2(dy,dx);
 const bend=Math.acos(clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1));
 const knee=[hipX+Math.cos(angle+(front?1:-1)*bend)*l1,hipY+Math.sin(angle+(front?1:-1)*bend)*l1];
 return {hip:[hipX,hipY],knee,hock:front?null:target,paw:[footX,footY],p,stance:p<stance&&air===0};
}
function drawLeg(l,far){
 const outline=far?'#62412a':'#784a2c',fur=far?'#b87e41':'#e9b16b';
 const chain=l.hock?[l.hip,l.knee,l.hock,[l.paw[0],l.paw[1]-3]]:[l.hip,l.knee,[l.paw[0],l.paw[1]-3]];
 // Continuous tapered limbs; no exposed circular knee caps or broad shoe shapes.
 line(chain,outline,10.5);line(chain,fur,8);
 ctx.fillStyle=outline;ctx.beginPath();ctx.ellipse(l.paw[0]+1.5,l.paw[1]-2.8,6.3,3.8,0,0,TAU);ctx.fill();
 ellipse(l.paw[0]+1.5,l.paw[1]-3.2,5.4,3.0,far?'#ca9656':'#f4c983');
 line([[l.paw[0]+3.8,l.paw[1]-3.4],[l.paw[0]+4.2,l.paw[1]-1.6]],outline,.65);
}
function drawDog(x,y,scale,phase,jump=0,vy=0,land=0){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const air=clamp(jump/22,0,1),gait=gaitBody(phase),bob=gait.bob*(1-air)+land*3;const lean=air?clamp(vy/2800,-.12,.12):gait.pitch;
 const hindFar=legPose(phase,-30,bob,air,false,true),frontFar=legPose(phase,18,bob,air,true,true),hindNear=legPose(phase,-31,bob,air,false,false),frontNear=legPose(phase,17,bob,air,true,false);
 drawLeg(hindFar,true);drawLeg(frontFar,true);drawLeg(hindNear,false);drawLeg(frontNear,false);
 ctx.save();ctx.translate(-36,-41+bob);ctx.rotate(-.25+Math.sin(phase*TAU-.7)*.1);
 function tailCurve(color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,6);ctx.bezierCurveTo(-29,-1,-34,-33,-14,-39);ctx.bezierCurveTo(9,-49,22,-20,3,-15);ctx.stroke()}
 tailCurve('#654126',22);tailCurve('#e9b972',18);tailCurve('#ffe3a7',10);ctx.restore();
 ctx.save();ctx.translate(-7,-35+bob);ctx.rotate(lean);ctx.scale(.85*mix(gait.stretch,1,air)*(1+land*.045),.85*mix(2-gait.stretch,1,air)*(1-land*.065));
 const coat=ctx.createLinearGradient(-10,-28,10,24);coat.addColorStop(0,'#f9d18a');coat.addColorStop(.55,'#e9ad5a');coat.addColorStop(1,'#bd793a');
 ctx.fillStyle=coat;ctx.strokeStyle='#6c4329';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(-37,2);ctx.bezierCurveTo(-44,-13,-34,-21,-25,-24);ctx.lineTo(-28,-28);ctx.lineTo(-18,-25);ctx.bezierCurveTo(-3,-29,17,-23,27,-16);ctx.bezierCurveTo(45,-1,32,20,20,23);ctx.lineTo(22,18);ctx.bezierCurveTo(2,28,-18,23,-26,18);ctx.lineTo(-32,20);ctx.lineTo(-30,15);ctx.bezierCurveTo(-37,12,-40,9,-37,2);ctx.closePath();ctx.fill();ctx.stroke();
 line([[-32,-10],[-28,-16],[-19,-19]],'#ffe0a1',2.4);line([[-17,18],[-10,21],[-2,20]],'#f4c47b',2);line([[12,12],[18,16],[22,12]],'#cf8c45',1.2);ctx.restore();
 // The body overlaps the upper limbs to keep their roots inside the coat.
 // Retain the original face and mane, independently pivoted above the rig.
 ctx.save();ctx.translate(22,-53+bob*.9+Math.sin(phase*TAU-.5)*.8);ctx.rotate(lean*.6+Math.sin(phase*TAU-.8)*.025);fluff(0,0,25,30,'#c28343');if(images.chowRun){ctx.save();ctx.beginPath();ctx.ellipse(0,-1,30,35,0,0,TAU);ctx.clip();ctx.drawImage(images.chowRun,465,175,455,520,-30,-37,65,75);ctx.restore()}else{fluff(0,0,28,30,'#efbb70');ellipse(14,4,17,13,'#fae4af');ellipse(10,-8,2.4,3,'#39241c');ellipse(25,0,5,3,'#39241c');ellipse(-10,-24,7,10,'#cb8947')}
 // Small ear tips and mane follow-through lag the body's weight shift.
 ctx.restore();ctx.restore()}
function shadow(x,y,size,jump){ellipse(x,y+3,size*(1-clamp(jump/300,0,.5)),size*.10,'#080d0870')}
function addDust(x,y,n=2){for(let i=0;i<n;i++)app.dust.push({x,y,vx:-25-Math.random()*35,vy:-15-Math.random()*25,life:.45,size:2+Math.random()*3})}
function beep(freq,duration,type='sine'){if(!app.sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.6,audio.currentTime+duration);g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
function jump(){if(app.mode==='over'||app.mode==='paused')return;app.buffer=.12;if(app.jumpY<=.01){app.vy=-750;app.jumpY=.1;app.buffer=0;beep(530,.16);addDust(actorX(),ground,5)}}
function actorX(){return app.mode==='preview'?W*.48:Math.min(100,W*.16)}
function start(){app.runTicks=0;window.dispatchEvent(new Event('chacha:run-start'));Object.assign(app,{mode:'play',distance:0,speed:START_SPEED,spawn:2.3,obstacles:[],dust:[],jumpY:0,vy:0,land:0,buffer:0});$('result').hidden=true;$('start').hidden=true;$('jump').hidden=true;$('pause').hidden=false;$('pause').textContent='잠깐 쉬기 Ⅱ';$('jumpMobile').hidden=false;$('hint').hidden=true;$('modeLabel').textContent='차차, 달리는 중!';for(const id of ['speed','slow','freeze','phase'])$(id).disabled=true;app.frozen=false;$('freeze').setAttribute('aria-pressed','false');$('freeze').textContent='동작 멈추기';$('instructions').innerHTML='<kbd>SPACE</kbd> 점프 · <kbd>P</kbd> 일시정지';beep(660,.1)}
function preview(){app.mode='preview';app.obstacles=[];app.jumpY=0;app.vy=0;app.land=0;$('result').hidden=true;$('start').hidden=false;$('jump').hidden=false;$('pause').hidden=true;$('jumpMobile').hidden=true;$('hint').hidden=false;$('modeLabel').textContent='차차의 러닝 타임';$('distance').textContent='READY TO RUN';$('pace').textContent='01 / WARM UP';for(const id of ['speed','slow','freeze','phase'])$(id).disabled=false;$('instructions').innerHTML='<kbd>SPACE</kbd> / <kbd>↑</kbd> / 화면 터치로 점프'}
function pause(){if(app.mode==='play'){app.mode='paused';$('pause').textContent='계속 달리기 ▷';$('modeLabel').textContent='차차, 쉬는 중'}else if(app.mode==='paused'){app.mode='play';$('pause').textContent='잠깐 쉬기 Ⅱ';$('modeLabel').textContent='차차, 달리는 중!'}}
function gameOver(){app.mode='over';beep(160,.35,'triangle');const score=Math.floor(app.distance),isNew=score>app.best;app.best=Math.max(score,app.best);try{localStorage.setItem('chow_high_score',String(app.best))}catch{}$('best').innerHTML=app.best+' <small>m</small>';$('final').textContent=score;$('resultNote').textContent=isNew?'새로운 최고 기록! 차차, 멋진데?':'다음에는 조금 더 멀리!';$('result').hidden=false;$('pause').hidden=true;$('jumpMobile').hidden=true;window.dispatchEvent(new CustomEvent('chacha:run-end',{detail:{score,ticks:app.runTicks}}))}
function update(dt){if(app.mode==='paused'||app.mode==='over')return;const previewing=app.mode==='preview';if(previewing&&app.frozen)return;const motionRate=previewing?app.rate*(app.slow?.25:1):1;const t=dt*motionRate;app.time+=t;app.buffer=Math.max(0,app.buffer-t);app.land*=Math.exp(-t*17);const speed=previewing?216*app.rate:app.speed;app.scroll+=speed*dt*(previewing?Math.min(2.85,(ground-90)/100):1)*(previewing&&app.slow?.25:1);if(app.jumpY<=.01){app.phase=(app.phase+speed*t/(STRIDE_DISTANCE*(previewing?app.rate:.92)))%1}else{app.vy+=2340*t;app.jumpY-=app.vy*t;if(app.jumpY<=0){app.jumpY=0;app.vy=0;app.land=1;addDust(actorX(),ground,6);if(app.buffer>0)jump()}}
 if(!previewing){app.runTicks=(app.runTicks||0)+1;app.distance+=app.speed*t*.08;app.speed=Math.min(900,START_SPEED+app.distance/400*21);app.spawn-=t;if(app.spawn<=0){const radish=Math.random()<.5;app.obstacles.push({x:W+40,w:radish?38:44,h:radish?46:42,name:radish?'radish':'cabbage'});app.spawn=Math.max(.85,1.8-app.speed/1100)+Math.random()*.6}for(const o of app.obstacles){o.x-=app.speed*t;const px=actorX();if(px+20>o.x+7&&px-19<o.x+o.w-7&&ground-app.jumpY-9>ground-o.h+7&&ground-app.jumpY-52<ground-6){gameOver();break}}app.obstacles=app.obstacles.filter(o=>o.x+o.w>-50);$('distance').textContent=Math.floor(app.distance)+' m';$('pace').textContent=(app.speed/START_SPEED).toFixed(1)+'× PACE'}
 for(const p of app.dust){p.x+=p.vx*t;p.y+=p.vy*t;p.life-=t}app.dust=app.dust.filter(p=>p.life>0);if(app.jumpY===0&&groundContact(app.phase)&&Math.random()<dt*12)addDust(actorX()-20,ground-1,1);if(previewing)$('phase').value=app.phase}
function render(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#1c241b';ctx.fillRect(0,0,W,H);const glow=ctx.createRadialGradient(W*.49,H*.52,5,W*.49,H*.52,W*.43);glow.addColorStop(0,'#c2d88c0c');glow.addColorStop(1,'#c2d88c00');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#303c2a';ctx.lineWidth=1;ctx.setLineDash([3,8]);ctx.beginPath();ctx.moveTo(0,ground-110);ctx.lineTo(W,ground-110);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#212d1d';ctx.fillRect(0,ground,W,H-ground);ctx.fillStyle='#7e985a';ctx.fillRect(0,ground,W,2);for(let x=-(app.scroll%80);x<W;x+=80){ctx.fillStyle='#35462b';ctx.fillRect(x,ground+24,31,2);ctx.fillStyle='#293923';ctx.fillRect(x+33,ground+45,17,1)}
 const previewing=app.mode==='preview',scale=previewing?Math.min(2.85,(ground-90)/100):.92,x=actorX();shadow(x,ground,previewing?110:36,app.jumpY);for(const o of app.obstacles){shadow(o.x+o.w/2,ground,24,0);if(images[o.name]){ctx.save();ctx.translate(o.x+o.w/2,ground);const wobble=Math.sin(app.time*7+o.x*.01)*.025;ctx.rotate(wobble);ctx.drawImage(images[o.name],-o.w/2,-o.h,o.w,o.h);ctx.restore()}else{ctx.font='35px sans-serif';ctx.fillText(o.name==='radish'?'🥕':'🥬',o.x,ground)}}
 for(const p of app.dust){ctx.globalAlpha=p.life*.7;ellipse(p.x,p.y,p.size,p.size*.65,'#a0b28d')}ctx.globalAlpha=1;drawDog(x,ground-app.jumpY,scale,app.phase,app.jumpY,app.vy,app.land);
 if(previewing){ctx.fillStyle='#8d9e7e';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('CHACHA',x,Math.max(70,ground-113*scale));ctx.textAlign='left'}
 if(app.mode==='paused'){ctx.fillStyle='#111811ad';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle='#d4ed8a';ctx.font='600 24px sans-serif';ctx.fillText('잠깐, 숨 고르기.',W/2,H/2);ctx.font='12px sans-serif';ctx.fillStyle='#a5b59a';ctx.fillText('P 또는 계속 달리기로 돌아와요',W/2,H/2+30);ctx.textAlign='left'}}
function frame(ms){const elapsed=last?Math.min((ms-last)/1000,.1):0;last=ms;accumulator+=elapsed;while(accumulator+1e-10>=1/120){update(1/120);accumulator-=1/120}render();requestAnimationFrame(frame)}
$('start').onclick=start;$('retry').onclick=start;$('back').onclick=preview;$('jump').onclick=jump;$('jumpMobile').onclick=jump;$('pause').onclick=pause;
$('sound').onclick=()=>{app.sound=!app.sound;$('sound').textContent=app.sound?'소리 ON':'소리 OFF';$('sound').setAttribute('aria-pressed',String(app.sound));$('sound').setAttribute('aria-label',app.sound?'사운드 끄기':'사운드 켜기');beep(660,.12)};
$('speed').oninput=e=>{app.rate=Number(e.target.value);$('speedValue').value=app.rate.toFixed(2)+'×'};
$('slow').onclick=()=>{app.slow=!app.slow;$('slow').setAttribute('aria-pressed',String(app.slow))};
$('freeze').onclick=()=>{app.frozen=!app.frozen;$('freeze').setAttribute('aria-pressed',String(app.frozen));$('freeze').textContent=app.frozen?'동작 재생하기':'동작 멈추기'};
$('phase').oninput=e=>{app.frozen=true;app.phase=Number(e.target.value);$('freeze').setAttribute('aria-pressed','true');$('freeze').textContent='동작 재생하기'};
canvas.addEventListener('pointerdown',e=>{e.preventDefault();jump()});window.addEventListener('keydown',e=>{if(['INPUT','BUTTON','A'].includes(e.target.tagName))return;if(['Space','ArrowUp'].includes(e.code)){e.preventDefault();if(!e.repeat)jump()}if(e.code==='KeyP'||e.code==='Escape')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&app.mode==='play')pause();last=0;accumulator=0});
requestAnimationFrame(frame);

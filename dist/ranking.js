'use strict';
(() => {
 const endpoint='https://andnqwjhnykppumeikgx.supabase.co/functions/v1/ranking';
 const publishableKey='sb_publishable_qaCv6LifqZqOreFiJ5EWzw_0zWVFyOp';
 const currentVersion=4;
 const el=id=>document.getElementById(id);
 let refreshSequence=0;
 let token,runPromise,currentResult,sequence=0,submitted=false,busy=false,selectedVersion=currentVersion;
 try{token=localStorage.getItem('chacha_player_token')}catch{}
 if(!/^[a-f0-9]{64}$/.test(token||'')){
  token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  try{localStorage.setItem('chacha_player_token',token)}catch{}
 }
 try{el('rankNickname').value=localStorage.getItem('chacha_nickname')||''}catch{}
 async function api(action,data={},version=selectedVersion){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','apikey':publishableKey},body:JSON.stringify({action,rankingVersion:version,gameVersion:currentVersion,scoreVersion:version>=2?3:2,playerToken:token,...data}),signal:controller.signal});
   const body=await response.json();if(!response.ok)throw Object.assign(new Error(body.error||'랭킹을 불러오지 못했어요.'),{code:body.code});return body;
  }finally{clearTimeout(timer)}
 }
 function render(data){
  const list=el('rankingRows');list.replaceChildren();
  for(const entry of data.leaders){const row=document.createElement('li');
   const rank=document.createElement('span'),name=document.createElement('span'),score=document.createElement('strong');
   rank.className='rank-number';rank.textContent=String(entry.rank).padStart(2,'0');name.textContent=entry.nickname;score.textContent=Number(entry.distance).toLocaleString()+' m';
   row.append(rank,name,score);list.append(row);
  }
  el('rankingEmpty').hidden=data.leaders.length>0;
  el('rankingTotal').textContent=Number(data.total).toLocaleString()+'명의 러너';
  el('myRanking').textContent=data.mine?'내 최고 순위 '+data.mine.rank+'위 · '+Number(data.mine.distance).toLocaleString()+' m':(selectedVersion===1?'v1 기록은 보존되어 있어요':'첫 기록을 남겨보세요!');
 }
 async function refresh(){const request=++refreshSequence,version=selectedVersion;el('rankRefresh').disabled=true;el('rankingStatus').textContent='순위를 불러오는 중…';
  try{const data=await api('top',{},version);if(request!==refreshSequence)return;render(data);el('rankingStatus').textContent='최고 기록순 · 동점이면 먼저 달성한 순서'}catch{el('rankingStatus').textContent='순위를 불러오지 못했어요. 잠시 후 새로고침해 주세요.'}finally{el('rankRefresh').disabled=false}
 }
 function selectVersion(version){
  selectedVersion=version;
  for(const [v,id] of [[4,'rankV4'],[3,'rankV3'],[2,'rankV2'],[1,'rankV1']]){el(id).classList.toggle('active',v===version);el(id).setAttribute('aria-selected',String(v===version))}
  el('rankVersionBadge').textContent='V'+version+' · TOP 20';
  el('rankingForm').hidden=version!==currentVersion;
  if(version!==currentVersion)el('myRanking').textContent='v'+version+' 기록은 보존되어 있어요';
  refresh();
 }
 function updateRegistration(){
  el('openRanking').disabled=!currentResult||submitted||busy;
  el('rankSubmit').disabled=el('openRanking').disabled;
 }
 function showForm(){
  if(el('openRanking').disabled)return;
  selectVersion(currentVersion);el('rankingPanel').scrollIntoView({behavior:'smooth',block:'center'});el('rankNickname').focus({preventScroll:true});
 }
 window.addEventListener('chacha:run-start',()=>{
  const seq=++sequence;currentResult=null;submitted=false;updateRegistration();
  el('rankSubmitStatus').textContent='최고 기록을 넘으면 랭킹에 등록할 수 있어요.';
  runPromise=api('start',{},currentVersion).then(value=>seq===sequence?value:null).catch(()=>null);
 });
 window.addEventListener('chacha:run-end',async event=>{
  const {score,ticks,isNew}=event.detail;
  const seq=sequence;
  currentResult=null;updateRegistration();
  if(!isNew){
   el('rankSubmitStatus').textContent='개인 최고 기록을 넘어야 랭킹에 등록할 수 있어요.';
   return;
  }
  el('rankSubmitStatus').textContent='랭킹 등록 가능 여부를 확인하는 중…';
  const run=await runPromise;
  if(seq!==sequence)return;
  if(!run?.runId){
   el('rankSubmitStatus').textContent='온라인 연결 후 새 게임으로 도전해 주세요.';
   return;
  }
  if(score<=run.bestDistance){
   el('rankSubmitStatus').textContent='랭킹 최고 기록 '+run.bestDistance+' m를 넘어야 등록할 수 있어요.';
   el('resultNote').textContent=el('rankSubmitStatus').textContent;
   return;
  }
  currentResult={score,ticks,runId:run.runId};
  updateRegistration();
  el('rankSubmitStatus').textContent='이번 기록 '+score+' m · 닉네임과 기록이 공개됩니다.';
 });
 el('rankingForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!currentResult||submitted||busy)return;
  const nickname=el('rankNickname').value.normalize('NFKC').trim();
  if(!/^[\p{L}\p{N} _-]{2,12}$/u.test(nickname)){el('rankSubmitStatus').textContent='닉네임은 한글·영문·숫자 등 2~12자로 입력해 주세요.';return}
  busy=true;updateRegistration();const seq=sequence,result={...currentResult};
  try{
   const data=await api('submit',{nickname,runId:result.runId,ticks:result.ticks},currentVersion);
   if(selectedVersion===currentVersion)render(data);try{localStorage.setItem('chacha_nickname',nickname)}catch{}
   if(seq===sequence){submitted=true;el('rankSubmitStatus').textContent='등록 완료! 이번 기기의 최고 기록만 순위에 표시됩니다.'}
  }catch(error){
   if(seq===sequence){
    el('rankSubmitStatus').textContent=error.name==='AbortError'?'연결이 지연되고 있어요. 다시 등록해 주세요.':error.message;
    if(error.code==='SCORE_NOT_IMPROVED'){
     currentResult=null;el('resultNote').textContent=error.message;
    }
   }
  }finally{busy=false;updateRegistration()}
 });
 el('rankRefresh').addEventListener('click',refresh);el('openRanking').addEventListener('click',showForm);el('rankV4').addEventListener('click',()=>selectVersion(currentVersion));el('rankV3').addEventListener('click',()=>selectVersion(3));el('rankV2').addEventListener('click',()=>selectVersion(2));el('rankV1').addEventListener('click',()=>selectVersion(1));
 refresh();
})();

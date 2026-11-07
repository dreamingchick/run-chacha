// Database access stays in this server function. The browser only gets a publishable key.
const allowedOrigin = 'https://dreamingchick.github.io';
const headers = {'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers})}
function envKeys(name:string){try{return JSON.parse(Deno.env.get(name)||'{}')}catch{return {}}}
async function rpc(name:string,body:unknown){
 const key=envKeys('SUPABASE_SECRET_KEYS').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const auth:Record<string,string>={'Content-Type':'application/json','apikey':key};
 if(key?.startsWith('eyJ'))auth.Authorization='Bearer '+key;
 const response=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/'+name,{method:'POST',headers:auth,body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw new Error(data.message||'DATABASE_UNAVAILABLE');return data;
}
export function scoreForTicks(ticks:number){
 const base=259.2,increment=.0525,growth=1+increment/1500;
 const cap=Math.ceil(Math.log(900/base)/Math.log(growth)),n=Math.min(ticks,cap);
 return Math.floor(base/increment*Math.expm1(n*Math.log(growth))+Math.max(0,ticks-cap)*.6);
}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 const origin=request.headers.get('origin');if(origin&&origin!==allowedOrigin)return reply({error:'허용되지 않은 사이트입니다.'},403);
 // Publishable keys are not JWTs; validate them here rather than using verify_jwt.
 const publicKeys=Object.values(envKeys('SUPABASE_PUBLISHABLE_KEYS'));
 if(!publicKeys.includes(request.headers.get('apikey')))return reply({error:'게임 연결 인증을 확인해 주세요.'},401);
 try{
  const raw=await request.text();if(raw.length>2048)return reply({error:'요청이 너무 큽니다.'},413);
  const body=JSON.parse(raw),token=body.playerToken;
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return reply({error:'플레이어 정보를 확인할 수 없습니다.'},400);
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const playerHash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  if(body.action==='top')return reply(await rpc('chacha_ranking',{p_player_hash:playerHash}));
  if(body.action==='start')return reply(await rpc('chacha_start_run',{p_player_hash:playerHash}));
  if(body.action==='submit'){
   const nickname=typeof body.nickname==='string'?body.nickname.normalize('NFKC').trim():'';
   if(!/^[\p{L}\p{N} _-]{2,12}$/u.test(nickname))return reply({error:'닉네임은 한글·영문·숫자 등 2~12자로 입력해 주세요.'},400);
   if(!Number.isSafeInteger(body.ticks)||body.ticks<1||body.ticks>432000||typeof body.runId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.runId))return reply({error:'유효하지 않은 게임 기록입니다.'},400);
   return reply(await rpc('chacha_submit_score',{p_player_hash:playerHash,p_run_id:body.runId,p_nickname:nickname,p_ticks:body.ticks,p_distance:scoreForTicks(body.ticks)}));
  }
  return reply({error:'알 수 없는 요청입니다.'},400);
 }catch(error){
  const message=String(error);
  if(message.includes('RUN_RATE_LIMIT'))return reply({error:'잠깐 쉬었다가 다시 달려 주세요.'},429);
  if(/INVALID_RUN|INVALID_DURATION|INVALID_SCORE/.test(message))return reply({error:'이미 등록했거나 유효하지 않은 기록입니다. 새 게임으로 도전해 주세요.'},400);
  console.error('Ranking request failed');return reply({error:'랭킹 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
 }
});

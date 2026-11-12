'use strict';
(() => {
  const button = document.getElementById('install');
  const message = document.getElementById('appMessage');
  let messageTimer;
  function tell(text) {
    clearTimeout(messageTimer);
    message.textContent = text;
    message.hidden = false;
    messageTimer = setTimeout(() => { message.hidden = true; }, 6000);
  }
  function cameFromArcade() {
    let entered = new URLSearchParams(location.search).get('from') === 'garu-arcade';
    try { entered = entered || (document.referrer && new URL(document.referrer).origin === 'https://garu-arcade-hub.snugbrink3.chatgpt.site'); } catch {}
    try {
      if (entered) sessionStorage.setItem('garu-arcade-entry', '1');
      return Boolean(entered || sessionStorage.getItem('garu-arcade-entry') === '1');
    } catch { return Boolean(entered); }
  }
  const fromArcade = cameFromArcade();
  if (fromArcade) {
    button.innerHTML = '<span>대문</span><span>홈</span>';
    button.setAttribute('aria-label', '가루 오락실 대문 홈으로 돌아가기');
    button.title = '대문 홈으로';
  }
  button.addEventListener('click', () => {
    if (fromArcade) window.location.assign('https://garu-arcade-hub.snugbrink3.chatgpt.site/');
    else window.open('https://garu-arcade-hub.snugbrink3.chatgpt.site/#install-guide', '_blank', 'noopener,noreferrer');
  });
  // Real same-origin service worker, scoped to the deployment subdirectory.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    window.addEventListener('load', () => {
      let updating=false;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload()});
      navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>{
        function offerUpdate(){if(!registration.waiting)return;clearTimeout(messageTimer);message.textContent='새 버전이 준비됐어요. ';message.hidden=false;const update=document.createElement('button');update.className='chip';update.textContent='업데이트';update.onclick=()=>{updating=true;registration.waiting?.postMessage({type:'SKIP_WAITING'})};message.append(update)}
        registration.update().catch(()=>{});offerUpdate();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate()})});
      }).catch(() => {
        tell('오프라인 저장을 완료하지 못했어요. 온라인에서는 계속 플레이할 수 있어요.');
      });
    });
  }
})();

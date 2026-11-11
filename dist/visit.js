(() => {
  const game = document.currentScript?.dataset.garuGame;
  if (!game || navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;
  const key = 'garu-visit-v1:' + game;
  const endpoint = 'https://garu-arcade-hub.snugbrink3.chatgpt.site/analytics/visit';
  const koreaDate = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'});
  let lastSent = '';
  let busy = false;

  async function send() {
    if (busy || document.visibilityState !== 'visible') return;
    const day = koreaDate.format(new Date());
    if (lastSent === day) return;
    busy = true;
    try {
      let record;
      try { record = JSON.parse(localStorage.getItem(key)); } catch {}
      if (record?.day !== day || !/^[a-f0-9]{32}$/.test(record?.browser ?? '')) {
        const browser = Array.from(crypto.getRandomValues(new Uint8Array(16)),
          byte => byte.toString(16).padStart(2, '0')).join('');
        record = {day, browser};
        localStorage.setItem(key, JSON.stringify(record));
      }
      const response = await fetch(endpoint, {
        method:'POST', credentials:'omit', keepalive:true, referrerPolicy:'no-referrer',
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({game, day, browser:record.browser}),
      });
      if (response.ok) lastSent = day;
    } catch {
      // The game remains playable when analytics or browser storage is unavailable.
    } finally {
      busy = false;
    }
  }
  function schedule() {
    if (navigator.locks) {
      navigator.locks.request(key, send).catch(() => {});
    } else {
      void send();
    }
  }
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('online', schedule);
  schedule();
})();

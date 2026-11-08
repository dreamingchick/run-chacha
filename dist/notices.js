'use strict';
(() => {
 const queue=[
  ['chacha_patchnote_v300_seen','patchNotice'],
  ['chacha_ranking_v3_notice_seen','rankingNotice']
 ];
 async function showFirstVisitNotices(){
  for(const [key,id] of queue){
   let seen=false;try{seen=localStorage.getItem(key)==='1'}catch{seen=true}
   if(seen)continue;
   const dialog=document.getElementById(id);if(!dialog)continue;
   await new Promise(resolve=>{
    const done=()=>{try{localStorage.setItem(key,'1')}catch{}resolve()};
    dialog.addEventListener('close',done,{once:true});dialog.showModal();
   });
  }
 }
 showFirstVisitNotices();
})();

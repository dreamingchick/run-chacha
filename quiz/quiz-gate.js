'use strict';
(() => {
 const bank = window.CHACHA_QUIZ_BANK;
 if (!Array.isArray(bank) || bank.length !== 100) throw new Error('퀴즈 100문항을 불러오지 못했습니다.');
 const dialog = document.getElementById('quizDialog');
 const title = document.getElementById('quizQuestion');
 const choices = document.getElementById('quizChoices');
 const status = document.getElementById('quizFeedback');
 const category = document.getElementById('quizCategory');
 let pending = null;
 let answerIndex = -1;
 let busy = false;
 let lastId = null;
 const random = n => Math.floor(Math.random() * n);
 const shuffle = values => {
   const copy = values.map((value, index) => ({value, index}));
   for (let i=copy.length-1;i>0;i--) {
     const j=random(i+1);
     [copy[i],copy[j]]=[copy[j],copy[i]];
   }
   return copy;
 };
 function request(startGame) {
   if (busy || dialog.open || typeof startGame !== 'function') return;
   busy = true;
   pending = startGame;
   let question = bank[random(bank.length)];
   if (bank.length > 1) {
     while (question.id === lastId) question = bank[random(bank.length)];
   }
   lastId = question.id;
   const options = shuffle(question.options);
   answerIndex = options.findIndex(option => option.index === question.answer);
   category.textContent = question.category + ' · 초등학교 1~2학년';
   title.textContent = question.question;
   status.textContent = '정답을 고르면 챠챠가 달리기 시작해요!';
   choices.replaceChildren();
   options.forEach(({value}, index) => {
     const button = document.createElement('button');
     button.type='button';
     button.className='quiz-choice';
     button.textContent = (index+1) + '. ' + value;
     button.addEventListener('click', () => {
       if (index !== answerIndex) {
         status.textContent = '아쉬워요! 다시 생각해서 골라 보세요.';
         button.classList.add('quiz-wrong');
         return;
       }
       status.textContent = '정답이에요! 달리기를 시작합니다.';
       dialog.close();
       const run = pending;
       pending = null;
       busy = false;
       run();
     });
     choices.append(button);
   });
   dialog.showModal();
   choices.firstElementChild?.focus();
 }
 dialog.addEventListener('cancel', event => event.preventDefault());
 window.chachaQuizGate = Object.freeze({request});
})();

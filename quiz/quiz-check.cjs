'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = 'dist/alternate/';
const read = name => fs.readFileSync(dir+name,'utf8');
const elements = {};
function node(id=''){
 return elements[id] ||= {
  id, textContent:'', className:'', open:false, children:[], disabled:false,
  classList:{add(label){this.current=label}}, handlers:{},
  addEventListener(type,fn){this.handlers[type]=fn},
  replaceChildren(){this.children=[];this.firstElementChild=null},
  append(child){this.children.push(child);if(!this.firstElementChild)this.firstElementChild=child},
  focus(){},showModal(){this.open=true},close(){this.open=false}
 };
}
const doc={
 getElementById: id=>node(id),
 createElement:()=>({textContent:'',className:'',disabled:false,classList:{add(){}},focus(){},addEventListener(type,fn){this[type]=fn}})
};
const ctx={window:{},document:doc,Math,console};
vm.createContext(ctx);
vm.runInContext(read('quiz-bank.js'),ctx);
const bank=ctx.window.CHACHA_QUIZ_BANK;
assert.equal(bank.length,100,'exactly 100 questions');
assert.equal(new Set(bank.map(q=>q.id)).size,100,'unique ids');
for(const q of bank){
 assert.equal(q.options.length,4);
 assert.equal(new Set(q.options).size,4,'all 4 options unique');
 assert(q.question.length>=8 && q.category);
 assert(Number.isInteger(q.answer) && q.answer>=0 && q.answer<4);
}
vm.runInContext(read('quiz-gate.js'),ctx);
let started=0;
ctx.window.chachaQuizGate.request(()=>started++);
assert.equal(node('quizDialog').open,true);
assert.equal(node('quizChoices').children.length,4);
assert.equal(started,0,'start blocked before answer');
function currentQuestion(){return bank.find(q=>q.question===node('quizQuestion').textContent)}
function answerButton(q){return node('quizChoices').children.find(c=>c.textContent.replace(/^\d+\. /,'')===q.options[q.answer])}
function wrongButtons(q){return node('quizChoices').children.filter(c=>c!==answerButton(q))}
const q=currentQuestion(), wrong=wrongButtons(q);
wrong[0].click();
assert.equal(started,0,'first wrong choice must not start');
assert.equal(currentQuestion().id,q.id,'first wrong choice keeps question');
assert.equal(wrong[0].disabled,true,'wrong option is disabled');
wrong[0].click();
assert.equal(currentQuestion().id,q.id,'repeated click on disabled option does not count');
wrong[1].click();
assert.equal(started,0,'second wrong choice must not start');
assert.equal(node('quizDialog').open,true);
const replacement=currentQuestion();
assert.notEqual(replacement.id,q.id,'second wrong choice replaces question');
wrong[2].click();
assert.equal(currentQuestion().id,replacement.id,'stale button cannot affect replacement');
wrongButtons(replacement)[0].click();
assert.equal(currentQuestion().id,replacement.id,'wrong count resets on replacement');
answerButton(replacement).click();
assert.equal(started,1,'right choice starts');
assert.equal(node('quizDialog').open,false);
ctx.window.chachaQuizGate.request(()=>started++);
assert.equal(started,1,'retry blocked until a second correct answer');
const q2=currentQuestion();
assert.notEqual(q2.id,replacement.id,'avoid immediate repeat');
answerButton(q2).click();
assert.equal(started,2,'restart requires a new correct answer');
const game=read('chacha.js'),html=read('index.html'),sw=read('sw.js'),rank=read('ranking.js');
assert(game.includes("'start').onclick=()=>window.chachaQuizGate.request(start)"));
assert(game.includes("'retry').onclick=()=>window.chachaQuizGate.request(start)"));
assert(html.includes('quiz-bank.js?v=1.0.0') && html.includes('quiz-gate.js?v=1.1.0'));
assert(sw.includes('quiz-bank.js?v=1.0.0') && sw.includes('quiz-gate.js?v=1.1.0'));
assert(rank.includes('/functions/v1/ranking-alternate'));
assert(!read('pwa.js').includes('garu-arcade-hub'));
console.log('PASS: 100 questions, 4 unique answers, two-error replacement, reset, stale-button protection, start/retry gate, PWA cache and ranking isolation');

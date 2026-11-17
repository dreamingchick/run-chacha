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
  replaceChildren(){this.children=[]},
  append(child){this.children.push(child);if(!this.firstElementChild)this.firstElementChild=child},
  focus(){},showModal(){this.open=true},close(){this.open=false}
 };
}
const doc={
 getElementById: id=>node(id),
 createElement:()=>({textContent:'',className:'',classList:{add(){}},addEventListener(type,fn){this[type]=fn}})
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
const choices=node('quizChoices').children;
const q=bank.find(q=>q.question===node('quizQuestion').textContent);
const wrong=choices.find(c=>!c.textContent.endsWith(q.options[q.answer]));
wrong.click();
assert.equal(started,0,'wrong choice must not start');
const right=choices.find(c=>c.textContent.endsWith(q.options[q.answer]));
right.click();
assert.equal(started,1,'right choice starts');
assert.equal(node('quizDialog').open,false);
ctx.window.chachaQuizGate.request(()=>started++);
assert.equal(started,1,'retry blocked until a second correct answer');
assert.notEqual(node('quizQuestion').textContent,q.question,'avoid immediate repeat');
const q2=bank.find(q=>q.question===node('quizQuestion').textContent);
node('quizChoices').children.find(c=>c.textContent.endsWith(q2.options[q2.answer])).click();
assert.equal(started,2,'restart requires a new correct answer');
const game=read('chacha.js'),html=read('index.html'),sw=read('sw.js'),rank=read('ranking.js');
assert(game.includes("'start').onclick=()=>window.chachaQuizGate.request(start)"));
assert(game.includes("'retry').onclick=()=>window.chachaQuizGate.request(start)"));
assert(html.includes('quiz-bank.js?v=1.0.0') && html.includes('quiz-gate.js?v=1.0.0'));
assert(sw.includes('quiz-bank.js?v=1.0.0') && sw.includes('quiz-gate.js?v=1.0.0'));
assert(rank.includes('/functions/v1/ranking-alternate'));
assert(!read('pwa.js').includes('garu-arcade-hub'));
console.log('PASS: 100 questions, 4 unique answers, wrong-answer blocking, start/retry gate, PWA cache and ranking isolation');

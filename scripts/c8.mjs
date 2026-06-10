import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const session = JSON.parse(fs.readFileSync('/tmp/session.json','utf8'));
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:'new',args:['--no-sandbox']});
const p = await b.newPage(); await p.setViewport({width:1280,height:900});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
await p.evaluate(([k,v])=>localStorage.setItem(k,v),['sb-rogvgrnkjvxdulkcunuo-auth-token',JSON.stringify(session)]);
await p.goto('http://localhost:5173/escolas',{waitUntil:'networkidle2'});
await new Promise(x=>setTimeout(x,1000));
// abre modal Nova escola
await p.evaluate(()=>{const btn=[...document.querySelectorAll('button')].find(b=>/Nova escola/.test(b.textContent)); btn&&btn.click();});
await new Promise(x=>setTimeout(x,600));
const modal = await p.evaluate(()=>{
  const panel=document.querySelector('[role=dialog]');
  if(!panel) return 'sem modal';
  const title=document.querySelector('[role=dialog] h2,[id^=headlessui-dialog-title]')?.textContent||'';
  const hasForm=!!document.querySelector('[role=dialog] form');
  const r=panel.getBoundingClientRect();
  return `title='${title}' form=${hasForm} visible=${r.width>0&&r.height>0}`;
});
console.log('modal:', modal);
console.log('erros:', errs.length?errs.slice(0,6).join(' | '):'NENHUM');
await b.close();

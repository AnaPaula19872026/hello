import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const session = JSON.parse(fs.readFileSync('/tmp/session.json','utf8'));
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:'new',args:['--no-sandbox']});
const p = await b.newPage(); await p.setViewport({width:1280,height:900});
await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
await p.evaluate(([k,v])=>localStorage.setItem(k,v),['sb-rogvgrnkjvxdulkcunuo-auth-token',JSON.stringify(session)]);
async function importar(){
  await p.goto('http://localhost:5173/alunos',{waitUntil:'networkidle2'});
  await new Promise(x=>setTimeout(x,1200));
  await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Importar')); b&&b.click();});
  await new Promise(x=>setTimeout(x,500));
  const inp=await p.$('input[type=file]'); await inp.uploadFile('/tmp/imp.xlsx');
  await new Promise(x=>setTimeout(x,1200));
  // clica botao Importar N (o de submit dentro do modal)
  await p.evaluate(()=>{const b=[...document.querySelectorAll('[role=dialog] button, button')].find(x=>/^Importar\s*\d/.test(x.textContent.trim())); b&&b.click();});
  await new Promise(x=>setTimeout(x,2500));
  return await p.evaluate(()=>{const d=document.querySelector('[role=dialog]'); return d?d.innerText.replace(/\n+/g,' | '):'sem modal';});
}
console.log('1a IMPORTACAO:', (await importar()).slice(0,300));
console.log('2a IMPORTACAO (deve acusar dup):', (await importar()).slice(0,300));
await b.close();

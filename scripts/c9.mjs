import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const session = JSON.parse(fs.readFileSync('/tmp/session.json','utf8'));
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:'new',args:['--no-sandbox']});
const p = await b.newPage(); await p.setViewport({width:1280,height:900});
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
await p.goto('http://localhost:5173/',{waitUntil:'domcontentloaded'});
await p.evaluate(([k,v])=>localStorage.setItem(k,v),['sb-rogvgrnkjvxdulkcunuo-auth-token',JSON.stringify(session)]);
for(const route of ['/escolas','/alunos']){
  await p.goto('http://localhost:5173'+route,{waitUntil:'networkidle2'});
  await new Promise(x=>setTimeout(x,900));
  await p.evaluate(()=>{const btn=[...document.querySelectorAll('button')].find(b=>/Importar/.test(b.textContent)); btn&&btn.click();});
  await new Promise(x=>setTimeout(x,600));
  const info=await p.evaluate(()=>{
    const dlg=document.querySelector('[role=dialog]');
    const title=document.querySelector('[id^=headlessui-dialog-title]')?.textContent||'';
    const hasTpl=!!([...document.querySelectorAll('button,label')].find(e=>/Baixar planilha modelo/.test(e.textContent)));
    const hasUpload=!!([...document.querySelectorAll('label')].find(e=>/arraste a planilha/.test(e.textContent)));
    const hasSelect=!!document.querySelector('[role=dialog] select');
    return `title='${title}' template=${hasTpl} upload=${hasUpload} selectorPresente=${hasSelect}`;
  });
  console.log(route, '->', info);
  await p.keyboard.press('Escape');
}
console.log('erros:', errs.length?errs.slice(0,6).join(' | '):'NENHUM');
await b.close();

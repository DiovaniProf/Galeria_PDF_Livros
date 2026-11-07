/* Biblioteca Digital Imersiva V4 — camada de leitura e anotações.
   Mantém PDF original intacto; marcações são retângulos em coordenadas relativas de cada página. */
'use strict';
const MODES = [
  {id:'flip',icon:'📖',name:'Livro realista',desc:'Páginas duplas e animação de virada'},
  {id:'standard',icon:'📑',name:'Leitor interativo',desc:'Páginas, zoom e navegação objetiva'},
  {id:'presentation',icon:'▣',name:'Apresentação imersiva',desc:'Uma página ampliada por vez'},
  {id:'continuous',icon:'↟',name:'Leitura contínua',desc:'Páginas em rolagem vertical'},
  {id:'night',icon:'☾',name:'Modo noturno',desc:'Fundo escuro e leitura sem animação'},
  {id:'thumbnails',icon:'▦',name:'Visão panorâmica',desc:'Miniaturas de todas as páginas'}
];
const reading = {mode:'flip',pendingId:null,notesOpen:false,marking:false,color:'#ffe26b',record:null,db:null,dbPromise:null,saveTimer:null,extraToken:0};
const baseOpenReader=openReader;
const baseCloseReader=closeReader;
const baseRenderPage=renderPage;
const baseRenderSpread=renderSpread;
const baseNavigate=navigate;
const baseSinglePage=singlePageMode;
const baseDownloadBook=downloadBook;

// A versão 1 da IndexedDB já tem o store de livros. Incrementar cria o store de anotações sem apagar livros.
function openReadingDB(){
  if(reading.dbPromise)return reading.dbPromise;
  reading.dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,2);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('anotacoes'))db.createObjectStore('anotacoes',{keyPath:'id'});if(!db.objectStoreNames.contains('livros'))db.createObjectStore('livros',{keyPath:'id'});};
    req.onsuccess=()=>{reading.db=req.result;resolve(req.result)};
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(Error('Banco de dados bloqueado por outra guia. Feche outras guias do site.'));
  });return reading.dbPromise;
}
async function notesRead(id){const db=await openReadingDB();return new Promise((ok,no)=>{const r=db.transaction('anotacoes','readonly').objectStore('anotacoes').get(id);r.onsuccess=()=>ok(r.result||{id,entries:[],marks:[],lastPage:1,preferredMode:'flip'});r.onerror=()=>no(r.error)})}
async function notesPersist(){if(!reading.record)return;reading.record.lastPage=state.page;reading.record.preferredMode=reading.mode;const db=await openReadingDB();const data=structuredClone(reading.record);return new Promise((ok,no)=>{const t=db.transaction('anotacoes','readwrite');t.objectStore('anotacoes').put(data);t.oncomplete=ok;t.onerror=()=>no(t.error)})}
function notesSchedule(){clearTimeout(reading.saveTimer);reading.saveTimer=setTimeout(()=>notesPersist().catch(e=>toast('Falha ao salvar anotações: '+e.message,true)),450)}
function modePicker(id=null){reading.pendingId=id;const grid=$('modeGrid');grid.replaceChildren();for(const mode of MODES){const b=document.createElement('button');b.type='button';b.className='mode-option'+(reading.mode===mode.id?' selected':'');b.innerHTML=`<span class="mode-icon">${mode.icon}</span><b>${mode.name}</b><small>${mode.desc}</small>`;b.onclick=()=>{reading.mode=mode.id;$('modeDialog').hidden=true;const openId=reading.pendingId;reading.pendingId=null;if(openId)loadV4Reader(openId);else if(state.pdf){if(reading.record)notesSchedule();state.zoom=1;state.page=Math.min(state.page,state.pdf.numPages);renderSpread()}};grid.append(b)}$('modeDialog').hidden=false;}
function closeModePicker(){$('modeDialog').hidden=true;reading.pendingId=null}
openReader=function(id){modePicker(id)};
async function loadV4Reader(id){
  // Carregar as anotações do livro antes da renderização.
  try{reading.record=await notesRead(id)}catch(e){reading.record={id,entries:[],marks:[],lastPage:1};toast('Não foi possível carregar registros locais.',true)}
  reading.record.preferredMode=MODES.some(m=>m.id===reading.record.preferredMode)?reading.record.preferredMode:'flip';
  await baseOpenReader(id);
  if(state.readerId!==id)return;
  state.page=Math.min(Math.max(1,reading.record.lastPage||1),state.pdf.numPages);
  $('notesPage').max=state.pdf.numPages;$('notesBookLabel').textContent=state.readerBook.title;
  $('reader').classList.toggle('notes-open',reading.notesOpen);
  $('readingNotes').hidden=!reading.notesOpen;
  notesListRender();
  $('diaryTransferStatus').textContent='';
  await renderSpread();
}
closeReader=function(){clearTimeout(reading.saveTimer);if(reading.record)notesPersist().catch(()=>{});reading.extraToken++;reading.record=null;$('extraPages').hidden=true;$('extraPages').replaceChildren();$('highlightTools').hidden=true;reading.marking=false;updateToolbar();baseCloseReader()};
function isSingle(){return reading.mode==='presentation'||reading.mode==='night'||baseSinglePage()}
singlePageMode=function(){return isSingle()};
function updateToolbar(){
  $('modeChoiceBtn').textContent='▦ '+(MODES.find(m=>m.id===reading.mode)?.name||'Modos');
  $('noteToggle').classList.toggle('active-tool',reading.notesOpen);
  $('markToggle').classList.toggle('active-tool',reading.marking);
  $('highlightTools').hidden=!reading.marking||$('reader').hidden;
  $('reader').classList.toggle('highlight-active',reading.marking);
  $('reader').classList.toggle('reading-night',reading.mode==='night');
  $('reader').classList.toggle('reading-flat',reading.mode!=='flip');
  $('reader').classList.toggle('reading-extra',['continuous','thumbnails'].includes(reading.mode));
  $('reader').classList.toggle('notes-open',reading.notesOpen);
  $('readingNotes').hidden=!reading.notesOpen;
}
function makeLayer(pageNumber,canvas){
  const frame=document.createElement('div');frame.className='annotation-frame';frame.style.width=canvas.style.width;frame.style.height=canvas.style.height;
  frame.append(canvas);
  const layer=document.createElement('div');layer.className='annotation-overlay';layer.dataset.page=pageNumber;frame.append(layer);
  // Renderizar destaques SALVOS sem modificar o PDF.
  for(const m of reading.record?.marks||[]){if(m.page!==pageNumber)continue;const v=document.createElement('div');v.className='highlight-mark';v.style.cssText=`left:${m.x*100}%;top:${m.y*100}%;width:${m.w*100}%;height:${m.h*100}%;background:${m.color};`;v.title='Duplo clique para remover marcação';v.ondblclick=()=>{if(!confirm('Remover este destaque?'))return;reading.record.marks=reading.record.marks.filter(x=>x.id!==m.id);notesSchedule();renderSpread()};layer.append(v)}
  let down=null,preview=null;
  const point=e=>{const r=layer.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}};
  layer.addEventListener('pointerdown',e=>{if(!reading.marking||e.button!==0)return;e.preventDefault();e.stopPropagation();down=point(e);preview=document.createElement('div');preview.className='highlight-mark preview';preview.style.background=reading.color;layer.append(preview);layer.setPointerCapture(e.pointerId)});
  layer.addEventListener('pointermove',e=>{if(!down||!preview)return;const now=point(e),x=Math.min(down.x,now.x),y=Math.min(down.y,now.y);preview.style.left=x*100+'%';preview.style.top=y*100+'%';preview.style.width=Math.abs(down.x-now.x)*100+'%';preview.style.height=Math.abs(down.y-now.y)*100+'%'});
  layer.addEventListener('pointerup',e=>{if(!down)return;const now=point(e),m={id:uid(),page:pageNumber,x:Math.min(down.x,now.x),y:Math.min(down.y,now.y),w:Math.abs(down.x-now.x),h:Math.abs(down.y-now.y),color:reading.color};down=null;preview?.remove();preview=null;if(m.w<.006||m.h<.006)return;reading.record.marks.push(m);notesSchedule();renderSpread();toast('Destaque registrado na página '+pageNumber)});
  layer.addEventListener('pointercancel',()=>{down=null;preview?.remove();preview=null});return frame;
}
renderPage=async function(pageNumber,container,token){
  await baseRenderPage(pageNumber,container,token);
  if(token!==state.loadToken||!pageNumber||pageNumber>state.pdf.numPages)return;
  const canvas=container.querySelector('canvas');if(!canvas)return;
  canvas.replaceWith(makeLayer(pageNumber,canvas));
};
renderSpread=async function(){
  if(!state.pdf)return;
  updateToolbar();
  if(['continuous','thumbnails'].includes(reading.mode))return renderExtra();
  reading.extraToken++;$('extraPages').hidden=true;$('book').hidden=false;$('pageLeft').hidden=false;$('pageRight').hidden=false;
  await baseRenderSpread();
  $('notesPage').value=state.page;notesSchedule();
};
navigate=async function(delta){if(!state.pdf)return;
  if(reading.mode==='continuous'||reading.mode==='thumbnails'){
    state.page=Math.min(state.pdf.numPages,Math.max(1,state.page+delta));
    $('extraPages').querySelector(`[data-extra-page="${state.page}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});
    $('jumpPage').value=state.page;notesSchedule();return;
  }
  if(reading.mode!=='flip'){
    state.page=Math.min(state.pdf.numPages,Math.max(1,state.page+delta*(isSingle()?1:2)));
    await renderSpread();return;
  }
  await baseNavigate(delta);notesSchedule();
};
// Página única ou contínua: renderizar com PDF.js em resolução suficiente, sob demanda.
async function makeExtraPage(num,thumb,token){
  const box=document.createElement('div');box.className=thumb?'mini-page':'scroll-page';box.dataset.extraPage=num;const label=document.createElement('span');label.textContent='Página '+num;box.append(label);
  const area=document.createElement('div');area.className='extra-canvas';box.append(area);
  if(thumb)box.onclick=()=>{reading.mode='standard';state.page=num;renderSpread()};
  const page=await state.pdf.getPage(num);if(token!==reading.extraToken)return null;
  const natural=page.getViewport({scale:1});const maxWidth=thumb?190:880;
  const scale=maxWidth/natural.width, pixel=Math.min(devicePixelRatio||1,2);
  const vp=page.getViewport({scale:scale*pixel});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);c.style.width=(vp.width/pixel)+'px';c.style.height=(vp.height/pixel)+'px';
  await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;if(token!==reading.extraToken)return null;
  area.append(makeLayer(num,c));return box;
}
async function renderExtra(){
  const token=++reading.extraToken;state.loadToken++;
  $('book').hidden=true;$('extraPages').hidden=false;
  const area=$('extraPages');area.className='extra-pages '+(reading.mode==='thumbnails'?'thumbnails':'continuous');area.replaceChildren();
  $('loadingReader').hidden=false;$('jumpPage').value=state.page;
  try{
    // Pintura progressiva (1 página de cada vez) evita pico de memória em PDFs extensos.
    for(let i=1;i<=state.pdf.numPages;i++){
      if(token!==reading.extraToken||$('reader').hidden)return;
      const el=await makeExtraPage(i,reading.mode==='thumbnails',token);
      if(el)area.append(el);
      if(i===state.page)requestAnimationFrame(()=>el?.scrollIntoView({block:'start'}));
    }
  }catch(e){console.error(e);toast('Erro ao renderizar páginas: '+e.message,true)}finally{if(token===reading.extraToken)$('loadingReader').hidden=true}
  notesSchedule();
}
function notesListRender(){const area=$('notesList');area.replaceChildren();const items=(reading.record?.entries||[]).slice().sort((a,b)=>a.page-b.page);$('notesCount').textContent=items.length+' registro(s)';for(const n of items){const box=document.createElement('div');box.className='note-entry';const top=document.createElement('div');top.className='note-entry-top';const title=document.createElement('b');title.textContent='Página '+n.page;const actions=document.createElement('div');const go=document.createElement('button');go.type='button';go.textContent='Ir';go.onclick=()=>{state.page=n.page;renderSpread()};const del=document.createElement('button');del.type='button';del.textContent='Excluir';del.onclick=()=>{if(confirm('Excluir esta anotação?')){reading.record.entries=reading.record.entries.filter(x=>x.id!==n.id);notesSchedule();notesListRender()}};actions.append(go,del);top.append(title,actions);const text=document.createElement('p');text.textContent=n.text;box.append(top,text);area.append(box)}}
function saveNote(){const text=$('notesText').value.trim();if(!text){toast('Escreva sua anotação antes de salvar.',true);return;}const page=Math.max(1,Math.min(state.pdf.numPages,Math.floor(Number($('notesPage').value)||state.page)));reading.record.entries.push({id:uid(),page,text,date:new Date().toISOString()});$('notesText').value='';notesSchedule();notesListRender();toast('Anotação salva para a página '+page)}
function changeNotes(){reading.notesOpen=!reading.notesOpen;updateToolbar();if(state.pdf)renderSpread()}
function changeMarking(value){reading.marking=typeof value==='boolean'?value:!reading.marking;updateToolbar()}
function safePdfText(t){return String(t).replace(/[\u0000-\u001f]/g,' ').replace(/[\u{10000}-\u{10ffff}]/gu,'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[—–]/g,'-').replace(/[^\u0020-\u00ff]/g,'?')}
async function exportAnnotated(){
  if(!state.readerBook||!state.pdf)return;
  if(!window.PDFLib){toast('Biblioteca PDF-lib não carregou. Verifique sua conexão.',true);return}
  const btn=$('saveAnnotated');btn.disabled=true;btn.textContent='Exportando...';
  try{
    const bytes=await state.readerBook.pdf.arrayBuffer();const pdf=await PDFLib.PDFDocument.load(bytes);
    const pages=pdf.getPages();
    for(const m of reading.record?.marks||[]){
      const page=pages[m.page-1];if(!page)continue;
      const {width,height}=page.getSize();const rgb=hexRgb(m.color);
      // PDFs comuns com rotação 0. A camada normalizada é referida às bordas exibidas.
      const rotate=((page.getRotation().angle||0)%360+360)%360;
      let x,y,w,h;
      if(rotate===90){x=m.y*width;y=m.x*height;w=m.h*width;h=m.w*height}
      else if(rotate===180){x=(1-m.x-m.w)*width;y=m.y*height;w=m.w*width;h=m.h*height}
      else if(rotate===270){x=(1-m.y-m.h)*width;y=(1-m.x-m.w)*height;w=m.h*width;h=m.w*height}
      else{x=m.x*width;y=(1-m.y-m.h)*height;w=m.w*width;h=m.h*height}
      page.drawRectangle({x,y,width:w,height:h,color:PDFLib.rgb(...rgb),opacity:.38,borderOpacity:0});
    }
    const entries=reading.record?.entries||[];
    if(entries.length){
      const font=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
      const heading=await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const PW=595,PH=842,margin=52,line=17;
      let sheet=null,y=0;
      function newSheet(){sheet=pdf.addPage([PW,PH]);y=PH-55;sheet.drawText('DIARIO DE LEITURA - ANOTACOES',{x:margin,y,size:17,font:heading,color:PDFLib.rgb(.07,.22,.35)});y-=34;sheet.drawText(safePdfText(state.readerBook.title).slice(0,90),{x:margin,y,size:11,font});y-=28}
      newSheet();
      for(const entry of entries){
        const words=safePdfText(entry.text).split(/\s+/);const lines=[];let current='';
        for(const word of words){const trial=current?current+' '+word:word;if(font.widthOfTextAtSize(trial,11)>PW-margin*2&&current){lines.push(current);current=word}else current=trial;}if(current)lines.push(current);
        if(y<margin+45){newSheet()}
        sheet.drawText('PAGINA '+entry.page,{x:margin,y,size:12,font:heading,color:PDFLib.rgb(.13,.38,.56)});y-=22;
        for(const text of lines){if(y<margin+15)newSheet();sheet.drawText(text,{x:margin,y,size:11,font,color:PDFLib.rgb(.12,.15,.20)});y-=line}y-=17;
      }
    }
    const output=await pdf.save();const blob=new Blob([output],{type:'application/pdf'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(state.readerBook.title||'livro').replace(/[\\/:*?"<>|]/g,'_')+'_anotado.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('PDF com destaques e anotações exportado. Original preservado.');
  }catch(e){console.error(e);toast('Não foi possível exportar PDF: '+e.message,true)}finally{btn.disabled=false;btn.textContent='⇩ PDF anotado'}
}
function hexRgb(h){const t=h.replace('#','');return [parseInt(t.slice(0,2),16)/255,parseInt(t.slice(2,4),16)/255,parseInt(t.slice(4,6),16)/255]}
$('modeChoiceBtn').addEventListener('click',()=>modePicker());$('modeDialogClose').addEventListener('click',closeModePicker);
$('noteToggle').addEventListener('click',changeNotes);$('notesClose').addEventListener('click',changeNotes);
$('markToggle').addEventListener('click',()=>changeMarking());$('highlightStop').addEventListener('click',()=>changeMarking(false));
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{reading.color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(x=>x.classList.toggle('active',x===b))});
$('notesSave').addEventListener('click',saveNote);$('saveAnnotated').addEventListener('click',exportAnnotated);
$('modeDialog').addEventListener('click',e=>{if(e.target===$('modeDialog'))closeModePicker()});
// Atualizar página ativa e salvar última página depois de saltos via campo numérico.
$('jumpPage').addEventListener('change',()=>setTimeout(()=>{if(reading.record)notesSchedule()},120));
// Redefinir event handler do botão ESC sem interferir no fechamento anterior.
window.addEventListener('beforeunload',()=>{if(reading.record)notesPersist().catch(()=>{})});


// === V5: transferência manual de diários entre dispositivos ===
const DIARY_FORMAT='biblioteca-digital-diarios';
const DIARY_VERSION=1;
const MAX_DIARY_IMPORT_BYTES=12*1024*1024;
const MAX_ENTRIES_PER_BOOK=15000;
const MAX_MARKS_PER_BOOK=60000;
const MODE_IDS=new Set(MODES.map(m=>m.id));
const ALLOWED_MARK_COLORS=new Set(['#ffe26b','#9ef4ab','#83c5ff','#ff9ccc']);
const diaryNotice=(message,problem=false)=>{const el=$('diaryTransferStatus');el.textContent=message;toast(message,problem)};
const readableBookName=id=>state.books.find(b=>b.id===id)?.title||'Livro não presente neste dispositivo';
function bookSignature(book){if(!book)return null;return {title:String(book.title||''),author:String(book.author||''),pdfName:String(book.pdfName||''),pdfBytes:Number(book.pdf?.size||0)};}
function matchingLocalBook(imported){
  const sig=imported.signature;if(!sig||!sig.pdfBytes)return null;
  const matches=state.books.filter(b=>{const x=bookSignature(b);return x.pdfBytes===sig.pdfBytes&&x.title===sig.title&&x.author===sig.author&&x.pdfName===sig.pdfName;});
  return matches.length===1?matches[0]:null;
}
const safeName=s=>String(s||'diario').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,64);
const isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function validateDiaryRecord(raw){
  if(!isObj(raw)||typeof raw.id!=='string'||!raw.id||raw.id.length>200)throw Error('Diário sem identificador válido.');
  if(!Array.isArray(raw.entries)||!Array.isArray(raw.marks)||raw.entries.length>MAX_ENTRIES_PER_BOOK||raw.marks.length>MAX_MARKS_PER_BOOK)throw Error('Estrutura ou quantidade de registros inválida.');
  const idsE=new Set(),idsM=new Set();
  const entries=raw.entries.map(entry=>{
    if(!isObj(entry)||typeof entry.id!=='string'||!entry.id||entry.id.length>200||idsE.has(entry.id)||typeof entry.text!=='string'||entry.text.length>20000||!Number.isInteger(entry.page)||entry.page<1||entry.page>100000)throw Error('Anotação inválida ou repetida.');
    idsE.add(entry.id);
    return {id:entry.id,page:entry.page,text:entry.text,date:typeof entry.date==='string'&&entry.date.length<60?entry.date:''};
  });
  const marks=raw.marks.map(mark=>{
    if(!isObj(mark)||typeof mark.id!=='string'||!mark.id||mark.id.length>200||idsM.has(mark.id)||!Number.isInteger(mark.page)||mark.page<1||mark.page>100000)throw Error('Destaque inválido ou repetido.');
    if(![mark.x,mark.y,mark.w,mark.h].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)||mark.x+mark.w>1.001||mark.y+mark.h>1.001||!ALLOWED_MARK_COLORS.has(mark.color))throw Error('Coordenadas ou cor do destaque inválidas.');
    idsM.add(mark.id);return {id:mark.id,page:mark.page,x:mark.x,y:mark.y,w:mark.w,h:mark.h,color:mark.color};
  });
  return {id:raw.id,entries,marks,lastPage:Number.isInteger(raw.lastPage)?clamp(raw.lastPage,1,100000):1,preferredMode:MODE_IDS.has(raw.preferredMode)?raw.preferredMode:'flip'};
}
function mergeDiary(current,incoming){
  const result={...current,entries:[...current.entries],marks:[...current.marks]};
  const entryIds=new Set(result.entries.map(x=>x.id));const markIds=new Set(result.marks.map(x=>x.id));
  for(const n of incoming.entries)if(!entryIds.has(n.id)){result.entries.push(n);entryIds.add(n.id)}
  for(const m of incoming.marks)if(!markIds.has(m.id)){result.marks.push(m);markIds.add(m.id)}
  // Em mesclagem, mantém preferências e progresso locais existentes. Se não há diário, usa o importado.
  return result;
}
function downloadDiaryFile(data,name){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function listStoredDiaries(){
  const db=await openReadingDB();return new Promise((resolve,reject)=>{
    const request=db.transaction('anotacoes','readonly').objectStore('anotacoes').getAll();
    request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error);
  });
}
async function flushDiaryBeforeTransfer(){
  clearTimeout(reading.saveTimer);
  if(reading.record&&state.readerId){await notesPersist()}
}
function exportEnvelope(kind,records){return {
  format:DIARY_FORMAT,version:DIARY_VERSION,kind,exportedAt:new Date().toISOString(),
  books:records.map(r=>({bookId:r.id,title:readableBookName(r.id),signature:bookSignature(state.books.find(b=>b.id===r.id)),record:validateDiaryRecord(r)}))
}}
async function exportCurrentDiary(){
  if(!state.readerId||!reading.record)return;
  try{await flushDiaryBeforeTransfer();const data=exportEnvelope('single',[reading.record]);
    downloadDiaryFile(data,`diario_${safeName(state.readerBook?.title)}_${new Date().toISOString().slice(0,10)}.json`);
    diaryNotice('Diário deste livro exportado. Guarde o JSON para importar em outro dispositivo.');
  }catch(e){console.error(e);diaryNotice('Erro ao exportar o diário: '+e.message,true)}
}
async function exportAllDiaries(){
  try{await flushDiaryBeforeTransfer();const records=await listStoredDiaries();const data=exportEnvelope('all',records);
    downloadDiaryFile(data,`backup_diarios_${new Date().toISOString().slice(0,10)}.json`);
    diaryNotice(`Backup exportado com ${records.length} diário(s), sem arquivos PDF.`);
  }catch(e){console.error(e);diaryNotice('Erro ao criar backup: '+e.message,true)}
}
function validateImport(raw){
  if(!isObj(raw)||raw.format!==DIARY_FORMAT||raw.version!==DIARY_VERSION||!['single','all'].includes(raw.kind)||!Array.isArray(raw.books)||raw.books.length>10000)throw Error('Arquivo incompatível com o formato de backup da Biblioteca Digital V5.');
  const ids=new Set();return raw.books.map(b=>{
    if(!isObj(b)||typeof b.bookId!=='string'||b.bookId!==b.record?.id||ids.has(b.bookId))throw Error('Identificador do livro inválido ou duplicado.');
    ids.add(b.bookId);
    let signature=null;
    if(isObj(b.signature)&&typeof b.signature.title==='string'&&typeof b.signature.author==='string'&&typeof b.signature.pdfName==='string'&&Number.isInteger(b.signature.pdfBytes)&&b.signature.pdfBytes>=0){
      signature={title:b.signature.title.slice(0,500),author:b.signature.author.slice(0,500),pdfName:b.signature.pdfName.slice(0,500),pdfBytes:b.signature.pdfBytes};
    }
    return {bookId:b.bookId,title:typeof b.title==='string'?b.title.slice(0,200):'',signature,record:validateDiaryRecord(b.record)};
  });
}
function commitImportedRecords(records){
  return openReadingDB().then(db=>new Promise((resolve,reject)=>{
    const t=db.transaction('anotacoes','readwrite');const store=t.objectStore('anotacoes');
    for(const record of records)store.put(record);
    t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);
  }));
}
async function importDiaryFile(file){
  if(!file)return;
  try{
    if(file.size>MAX_DIARY_IMPORT_BYTES)throw Error('O arquivo JSON excede 12 MB.');
    const parsed=JSON.parse(await file.text());const incoming=validateImport(parsed);
    if(!incoming.length){diaryNotice('O arquivo de backup não contém diários.');return}
    const isSingle=parsed.kind==='single';
    // Evita aplicar diário individual a um livro diferente.
    if(isSingle&&incoming.length!==1)throw Error('Um diário individual deve conter um único livro.');
    if(isSingle&&incoming[0].bookId!==state.readerId){
      const match=matchingLocalBook(incoming[0]);
      if(!match||match.id!==state.readerId)throw Error('Este diário pertence a outro livro. Abra o livro correspondente antes de importar.');
    }
    const strategy=$('diaryImportStrategy').value;
    await flushDiaryBeforeTransfer();
    const current=await listStoredDiaries(),byId=new Map(current.map(r=>[r.id,validateDiaryRecord(r)]));
    const updated=[];let newItems=0,orphan=0,remapped=0;
    const targets=new Set();
    for(const item of incoming){
      const match=state.books.find(b=>b.id===item.bookId)||matchingLocalBook(item);
      const targetId=match?.id||item.bookId;
      if(targets.has(targetId))throw Error('Dois diários do backup correspondem ao mesmo livro deste dispositivo. Importe separadamente.');
      targets.add(targetId);
      if(targetId!==item.bookId)remapped++;
      const prev=byId.get(targetId),mappedRecord={...item.record,id:targetId};
      const next=prev&&strategy==='merge'?mergeDiary(prev,mappedRecord):mappedRecord;
      updated.push(next);
      if(!prev)newItems++;
      if(!match)orphan++;
    }
    const action=strategy==='replace'?'SUBSTITUIR':'MESCLAR';
    const notice=`${action} ${incoming.length} diário(s)? ${strategy==='replace'?'As notas e os destaques existentes desses livros serão substituídos.':'Registros distintos serão adicionados sem excluir os atuais.'}${remapped?' '+remapped+' livro(s) foram reconhecidos pelo título, autor, nome e tamanho do PDF, embora tenham IDs diferentes.':''}${orphan?' '+orphan+' livro(s) não estão neste dispositivo; os dados ficarão guardados até que haja um livro com o mesmo identificador.':''}`;
    if(!confirm(notice))return;
    await commitImportedRecords(updated);
    if(state.readerId&&updated.some(r=>r.id===state.readerId)){
      reading.record=await notesRead(state.readerId);
      state.page=clamp(reading.record.lastPage,1,state.pdf?.numPages||1);
      notesListRender();await renderSpread();
    }
    diaryNotice(`${incoming.length} diário(s) importado(s) com sucesso (${newItems} novo(s)).${remapped?' '+remapped+' livro(s) vinculado(s) por metadados.':''}${orphan?' Atenção: '+orphan+' livro(s) não encontrado(s) na galeria.':''}`);
  }catch(e){console.error(e);diaryNotice('Não foi possível importar: '+e.message,true)}
  finally{$('diaryImportFile').value=''}
}
$('exportDiary').addEventListener('click',exportCurrentDiary);
$('backupDiaries').addEventListener('click',exportAllDiaries);
$('importDiary').addEventListener('click',()=>$('diaryImportFile').click());
$('diaryImportFile').addEventListener('change',e=>importDiaryFile(e.target.files?.[0]));

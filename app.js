/* Wirtschaftsrecht – Karteikartenstudio
   Completely static, privacy-friendly study app. No trackers or cloud API.
   Initial decks are derived from the uploaded KG/AG learning materials.
   Progress and edits are saved in this browser only (localStorage).
*/
(() => {
'use strict';
const BASE = window.KG_AG_LIBRARY;
if (!BASE?.cards || !BASE?.decks) { document.getElementById('main').textContent = 'Die Lernkarten konnten nicht geladen werden.'; return; }
const KEY = 'wirtschaftsrecht-kg-ag-anki-v1';
const DEF = {
  again: {value: 3, unit:'minutes'},
  unsure: {value: 12, unit:'hours'},
  almost: {value: 3, unit:'days'},
  sure: {value: 7, unit:'days'},
  multiplier: 1.8,
  maxDays: 365,
};
const TYPES = {wissen:'Wissensfrage', definition:'Definition', recht:'Gesetzesanwendung', fall:'Fallanalyse', rechnung:'Rechenweg', vergleich:'Vergleich', prozess:'Ablauf', beurteilen:'Beurteilung', erklaeren:'Erklärung'};
const UNITS = {minutes:'Minuten',hours:'Stunden',days:'Tage',weeks:'Wochen'};
const UNIT_MS = {minutes:60000,hours:3600000,days:86400000,weeks:604800000};
const DAY = 86400000;
const root = document.getElementById('main');
let toastTimeout;
let page = 'dashboard';
let query = '';
let manageMode = 'all';
let study = null;
let state = load();

function clone(x) {return JSON.parse(JSON.stringify(x));}
function uid(prefix='usr') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`; }
function fresh() {return {version:1,decks:clone(BASE.decks),cards:BASE.cards.map(c=>({...clone(c),progress:blankProgress()})),settings:clone(DEF),activity:[],deletedBuiltIns:[],selectedDeckId:'all'};}
function blankProgress() {return {dueAt:null,intervalMs:0,repetitions:0,reviewCount:0,successCount:0,lastGrade:null,lastReviewedAt:null};}
function load(){
  let value;
  try{ value=JSON.parse(localStorage.getItem(KEY)||'null'); }catch { value=null; }
  if(!value || !Array.isArray(value.decks) || !Array.isArray(value.cards)) return fresh();
  value.settings = {...clone(DEF),...(value.settings||{})};
  value.deletedBuiltIns = Array.isArray(value.deletedBuiltIns)?value.deletedBuiltIns:[];
  value.activity=Array.isArray(value.activity)?value.activity:[];
  value.selectedDeckId=value.selectedDeckId||'all';
  const deckIds = new Set(value.decks.map(d=>d.id));
  for(const d of BASE.decks) if(!deckIds.has(d.id)&&!value.deletedBuiltIns.includes(d.id)) {value.decks.push(clone(d));deckIds.add(d.id);}
  const ids = new Set(value.cards.map(c=>c.id));
  for(const c of BASE.cards) if(!ids.has(c.id)&&!value.deletedBuiltIns.includes(c.id)&&deckIds.has(c.deckId)) value.cards.push({...clone(c),progress:blankProgress()});
  value.cards.forEach(c=>{c.progress={...blankProgress(),...(c.progress||{})};});
  value.decks=value.decks.filter(d=>typeof d.id==='string'&&typeof d.title==='string');
  value.cards=value.cards.filter(c=>deckIds.has(c.deckId)&&typeof c.front==='string'&&typeof c.answer==='string');
  return value;
}
function persist(){
  try{localStorage.setItem(KEY,JSON.stringify(state));}
  catch(e){notify('Der Browser-Speicher ist voll oder gesperrt. Bitte Daten exportieren.');console.error(e);}
}
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function byDeck(id){return id==='all'?state.cards:state.cards.filter(c=>c.deckId===id);}
function deckOf(id){return state.decks.find(d=>d.id===id);}
function isDue(c){return c.progress?.dueAt!==null && Number(c.progress.dueAt)<=Date.now();}
function isNew(c){return !c.progress?.reviewCount;}
function dueCards(id='all'){return byDeck(id).filter(c=>isNew(c)||isDue(c));}
function learned(c){return !!c.progress?.reviewCount;}
function mastered(c){const p=c.progress||{};return p.repetitions>=3 && ['almost','sure'].includes(p.lastGrade) && p.intervalMs>=7*DAY;}
function metrics(id='all'){
 const cards=byDeck(id);
 return {total:cards.length,new:cards.filter(isNew).length,due:cards.filter(c=>!isNew(c)&&isDue(c)).length,learned:cards.filter(learned).length,mastered:cards.filter(mastered).length};
}
function totalDue(id='all'){let m=metrics(id);return m.new+m.due;}
function percent(a,b){return b?Math.round(100*a/b):0;}
function fmtDate(ts){return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(ts));}
function duration(ms){
 if(ms<3600000)return `${Math.max(1,Math.round(ms/60000))} Min.`;
 if(ms<DAY)return `${Math.max(1,Math.round(ms/3600000))} Std.`;
 if(ms<DAY*14)return `${Math.round(ms/DAY)} Tag${Math.round(ms/DAY)!==1?'e':''}`;
 return `${Math.round(ms/(7*DAY))} Wochen`;
}
function gradeInterval(grade,progress){
 const cfg=state.settings[grade]||DEF[grade];
 const base=Math.max(60000,Number(cfg.value||1)*UNIT_MS[cfg.unit]||DAY);
 if (grade==='again')return base;
 const previous=Number(progress.intervalMs)||0;
 const multi=Math.max(1.1,Math.min(5,Number(state.settings.multiplier)||1.8));
 let target=base;
 if(previous>0){
  if(grade==='unsure')target=Math.max(base,previous*.65);
  if(grade==='almost')target=Math.max(base,previous*multi*.82);
  if(grade==='sure')target=Math.max(base,previous*multi*1.22);
 }
 return Math.min(target,Math.max(1,Number(state.settings.maxDays)||365)*DAY);
}
function notify(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),4500);}
function navTo(which,deckId){
 if(deckId!==undefined)state.selectedDeckId=deckId;
 page=which;query='';persist();render();window.scrollTo({top:0,behavior:'smooth'});
}
function titleIcon(d){const mapping={'kg-gruendung':'⌂','kg-haftung':'⚖','kg-innen':'§','kg-gewinn':'∑','ag-gruendung':'◇','ag-organe':'♟','ag-erhoehung':'↗','bezugsrecht':'€','ag-stimmen':'◕','ag-gewinn':'◉','klausur':'✓'};return mapping[d.id]||'▤';}
function renderSidebar(){
 document.querySelectorAll('[data-page]').forEach(b=>{const active=b.dataset.page===page;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
 const holder=document.getElementById('deckNav');
 holder.innerHTML=`<button type="button" data-action="select-deck" data-deck="all" class="${state.selectedDeckId==='all'?'active':''}"><span class="deck-circle" style="--clr:#eebc65"></span><span>Alle Stapel</span><small>${state.cards.length}</small></button>`+state.decks.map(d=>`<button type="button" data-action="select-deck" data-deck="${escapeHTML(d.id)}" class="${state.selectedDeckId===d.id?'active':''}"><span class="deck-circle" style="--clr:${escapeHTML(d.color||'#6faec1')}"></span><span>${escapeHTML(d.title)}</span><small>${byDeck(d.id).length}</small></button>`).join('');
 const breadcrumbs={dashboard:'Übersicht',study:'Lernen',manage:'Karten verwalten',progress:'Lernfortschritt',settings:'Einstellungen'};
 document.getElementById('crumb').innerHTML=`${breadcrumbs[page]||'Übersicht'} <span> / ${escapeHTML(deckOf(state.selectedDeckId)?.title||'Alle Stapel')}</span>`;
}
function deckOptions(selected='all',includeAll=true){return (includeAll?`<option value="all" ${selected==='all'?'selected':''}>Alle Stapel</option>`:'') + state.decks.map(d=>`<option value="${escapeHTML(d.id)}" ${selected===d.id?'selected':''}>${escapeHTML(d.title)}</option>`).join('');}
function render(){renderSidebar();if(page==='dashboard')renderDashboard();else if(page==='study')renderStudy();else if(page==='manage')renderManage();else if(page==='progress')renderProgress();else if(page==='settings')renderSettings();else renderDashboard();}
function deckCard(d){
 const m=metrics(d.id),pct=percent(m.learned,m.total);
 return `<article class="deck-card" style="--accent:${escapeHTML(d.color||'#168a8f')}"><div class="deck-card-top"><div class="deck-icon" aria-hidden="true">${titleIcon(d)}</div><span class="deck-badge">${m.total} Karten</span></div><div><h3>${escapeHTML(d.title)}</h3><p>${escapeHTML(d.description||'Eigene Lernkarten')}</p></div><div class="deck-metas"><span class="due">${m.new+m.due} fällig / neu</span><span>${m.learned} gelernt</span><span>${m.mastered} sicher</span></div><div class="progress-rail"><div class="progress-fill" style="--val:${pct}%"></div></div><div class="deck-actions"><button class="button primary small" data-action="start-study" data-deck="${escapeHTML(d.id)}">Lernen</button><button class="button ghost small" data-action="select-deck" data-deck="${escapeHTML(d.id)}">Karten ansehen</button></div></article>`;
}
function renderDashboard(){const m=metrics();root.innerHTML=`
<section class="hero"><div><p class="eyebrow" style="color:#8ce0d5">DEIN WISSEN · DEIN TEMPO</p><h1>Aus Stoff wird Sicherheit.</h1><p>Wiederhole KG- und AG-Recht mit ${BASE.cards.length} vorbereiteten Karten, praxisnahen Fällen und frei einstellbaren Wiederholungsabständen. Ergänze deine eigenen Fragen – ohne Anmeldung.</p><div class="hero-actions"><button class="button gold" data-action="start-study" data-deck="${escapeHTML(state.selectedDeckId)}">${totalDue(state.selectedDeckId)?'Jetzt fällige Karten lernen':'Alle Karten wiederholen'}</button><button class="button ghost" data-action="add-card">+ Eigene Karte</button></div></div><div class="hero-graphic" aria-hidden="true"><span>§</span></div></section>
<section class="stats" aria-label="Lernstand"><div class="stat-card"><div class="stat-label">Karten insgesamt</div><div class="stat-value">${m.total}</div><div class="stat-aux">in ${state.decks.length} Stapeln</div></div><div class="stat-card"><div class="stat-label">Heute / neu</div><div class="stat-value">${m.new+m.due}</div><div class="stat-aux">${m.new} neu · ${m.due} fällig</div></div><div class="stat-card"><div class="stat-label">Schon gelernt</div><div class="stat-value">${percent(m.learned,m.total)} %</div><div class="stat-aux">${m.learned} von ${m.total}</div></div><div class="stat-card"><div class="stat-label">Sicher beherrscht</div><div class="stat-value">${m.mastered}</div><div class="stat-aux">mit längeren Intervallen</div></div></section>
<div class="section-bar"><div><h2>Deine Themenstapel</h2><p>Ein Stapel pro Lernbereich – jederzeit erweiterbar und exportierbar.</p></div><button class="button outline small" data-action="new-deck">+ Stapel erstellen</button></div><div class="deck-grid">${state.decks.map(deckCard).join('')}</div><div class="tip-panel"><span class="tip-icon" aria-hidden="true">💡</span><div><strong>So funktioniert Spaced Repetition</strong><p>Frage lesen → Antwort aufdecken → Lernstand bewerten. Sichere Karten kommen später wieder, unsichere früher. Die Intervalle kannst du unter „Einstellungen“ selbst festlegen.</p></div></div>`;}
function startStudy(deckId='all',mode='due'){
 const target=deckOf(deckId)?deckId:'all';state.selectedDeckId=target;
 let cards=byDeck(target).filter(c=>mode==='all'||isNew(c)||isDue(c));
 cards.sort((a,b)=>(isDue(a)?-1:isNew(a)?0:1)-(isDue(b)?-1:isNew(b)?0:1) || String(a.front).localeCompare(String(b.front),'de'));
 if(!cards.length && mode==='due')cards=byDeck(target).slice();
 study={deckId:target,mode,queue:cards.map(c=>c.id),initial:cards.length,completedIds:new Set(),againCount:{},revealed:false,seen:0};
 navTo('study',target);
}
function renderStudy(){
 const deck=deckOf(state.selectedDeckId),selected=state.selectedDeckId;
 if(!study||study.deckId!==selected) {root.innerHTML=`<div class="section-intro"><p class="eyebrow">LERNMODUS</p><h1>Karteikarten lernen</h1><p>Stapel wählen, Fragen beantworten und deinen Lernstand nach jeder Karte einschätzen. Die Termine werden automatisch gespeichert.</p></div><div class="panel" style="max-width:820px"><div class="toolbar"><label for="studyDeckSelect">Stapel</label><select class="filter-select" id="studyDeckSelect">${deckOptions(selected)}</select></div><div class="stats" style="margin-top:14px;margin-bottom:22px"><div class="stat-card"><div class="stat-label">Fällig / neu</div><div class="stat-value">${totalDue(selected)}</div></div><div class="stat-card"><div class="stat-label">Alle Karten</div><div class="stat-value">${byDeck(selected).length}</div></div></div><div class="toolbar"><button class="button primary" data-action="start-study" data-deck="${escapeHTML(selected)}">Fällige Karten lernen</button><button class="button outline" data-action="start-cram" data-deck="${escapeHTML(selected)}">Alle Karten üben</button></div><p class="footnote">Tastatur: Leertaste zeigt die Lösung, danach bewerten mit 1, 2, 3 oder 4.</p></div>`;return;}
 if(!study.queue.length){root.innerHTML=`<div class="empty"><div class="glyph" aria-hidden="true">🏆</div><p class="eyebrow">LERNEINHEIT ABGESCHLOSSEN</p><h1>Runde geschafft.</h1><p>Du hast ${study.completedIds.size} verschiedene Karten bearbeitet. Die nächsten Wiederholungen erscheinen entsprechend deinen Bewertungen.</p><div class="toolbar" style="justify-content:center"><button class="button primary" data-action="start-cram" data-deck="${escapeHTML(selected)}">Noch einmal alle Karten üben</button><button class="button outline" data-action="end-session">Zur Übersicht</button></div></div>`;return;}
 let c=state.cards.find(c=>c.id===study.queue[0]);if(!c){study.queue.shift();renderStudy();return;}
 const current=1+study.completedIds.size,done=percent(study.completedIds.size,study.initial),other=study.queue.length-1;
 const source=c.source||deck?.source||'';
 root.innerHTML=`<div class="study-shell"><div class="section-bar" style="margin-top:0"><div><p class="eyebrow">AKTIVE LERNEINHEIT</p><h2>${escapeHTML(deck?.title||'Alle Themenstapel')}</h2></div><button class="button ghost small" data-action="end-session">Sitzung beenden ×</button></div><div class="study-topline"><span>${Math.min(current,study.initial)} / ${study.initial} Karten bearbeitet</span><span>${other} weitere im Stapel</span></div><div class="study-progress"><div style="width:${done}%"></div></div><article class="flashcard ${study.revealed?'back':'front'}"><div class="flashcard-head"><span class="kind-chip">${escapeHTML(TYPES[c.kind]||'Wissensfrage')}</span><span class="source-label">${escapeHTML(deckOf(c.deckId)?.title||'Eigener Stapel')}</span></div>${!study.revealed?`<div class="question-content"><h2>${escapeHTML(c.front)}</h2></div><div class="flashcard-foot"><button class="button primary" data-action="reveal">Antwort aufdecken <span aria-hidden="true">→</span></button></div>`:`<div class="flashcard-back"><div class="back-question">${escapeHTML(c.front)}</div><div class="answer-heading">DIE ANTWORT</div><div class="answer-body">${formatAnswer(c.answer)}</div>${c.example?`<div class="answer-example"><div class="answer-label">Praxisbeispiel / Rechenweg</div><p>${escapeHTML(c.example)}</p></div>`:''}${c.memory?`<div class="answer-memory"><div class="answer-label" style="color:#88631e">Merke</div><p>${escapeHTML(c.memory)}</p></div>`:''}${source?`<div class="source-box" style="margin-top:15px">Grundlage: ${escapeHTML(source)}</div>`:''}</div><div class="flashcard-foot"><span class="small muted">Wie sicher konntest du diese Karte beantworten?</span></div>`}</article>${study.revealed?`<div class="ratings"><button class="rate again" data-action="rate" data-grade="again"><strong>1 · Noch einmal</strong><small>${escapeHTML(duration(gradeInterval('again',c.progress)))}</small></button><button class="rate unsure" data-action="rate" data-grade="unsure"><strong>2 · Unsicher</strong><small>${escapeHTML(duration(gradeInterval('unsure',c.progress)))}</small></button><button class="rate almost" data-action="rate" data-grade="almost"><strong>3 · Fast sicher</strong><small>${escapeHTML(duration(gradeInterval('almost',c.progress)))}</small></button><button class="rate sure" data-action="rate" data-grade="sure"><strong>4 · Sicher</strong><small>${escapeHTML(duration(gradeInterval('sure',c.progress)))}</small></button></div>`:`<p class="study-hint">Versuche die Antwort erst selbst zu formulieren.</p>`}<div class="kb-row"><span><kbd class="kbd">Leertaste</kbd> Antwort</span><span><kbd class="kbd">1–4</kbd> Bewertung</span></div></div>`;
}
function formatAnswer(s){const lines=String(s||'').split(/\n/);let inList=false;let html='';for(const line of lines){if(/^\s*[-•] /.test(line)){if(!inList){html+='<ul>';inList=true;}html+=`<li>${escapeHTML(line.replace(/^\s*[-•] /,''))}</li>`;}else {if(inList){html+='</ul>';inList=false;}if(line.trim())html+=`<p>${escapeHTML(line)}</p>`;}}if(inList)html+='</ul>';return html;}
function rate(grade){if(!study||!study.revealed)return;const id=study.queue.shift(),c=state.cards.find(c=>c.id===id);if(!c)return;const prog=c.progress||blankProgress();const delay=gradeInterval(grade,prog);prog.intervalMs=Math.round(delay);prog.dueAt=Date.now()+prog.intervalMs;prog.lastReviewedAt=Date.now();prog.lastGrade=grade;prog.reviewCount=(prog.reviewCount||0)+1;prog.successCount=(prog.successCount||0)+(grade==='again'?0:1);prog.repetitions=grade==='again'?0:(prog.repetitions||0)+1;c.progress=prog;study.completedIds.add(id);study.seen++;if(grade==='again'){const count=(study.againCount[id]||0)+1;study.againCount[id]=count;if(count<=2)study.queue.push(id);}state.activity.push({ts:Date.now(),deckId:c.deckId,cardId:id,grade});if(state.activity.length>15000)state.activity=state.activity.slice(-14000);study.revealed=false;persist();renderStudy();}
function renderManage(){const selected=state.selectedDeckId;root.innerHTML=`<div class="section-intro"><p class="eyebrow">DEINE KARTEN</p><h1>Verwalten & gestalten</h1><p>Vorgefertigte Karten sind vollständig bearbeitbar. Du kannst eigene Stapel anlegen, Karten verschieben, entfernen und exportieren.</p></div><div class="toolbar"><select id="manageDeckSelect" class="filter-select" aria-label="Stapel wählen">${deckOptions(selected)}</select><input type="search" id="cardSearch" class="search-input" placeholder="Karten suchen: Begriff, Gesetz, Beispiel …" value="${escapeHTML(query)}"><button class="button outline" data-action="new-deck">+ Stapel</button><button class="button primary" data-action="add-card">+ Karte</button></div><div class="toolbar"><button class="filter-pill ${manageMode==='all'?'active':''}" data-action="manage-mode" data-mode="all">Alle</button><button class="filter-pill ${manageMode==='new'?'active':''}" data-action="manage-mode" data-mode="new">Neu</button><button class="filter-pill ${manageMode==='due'?'active':''}" data-action="manage-mode" data-mode="due">Fällig</button><button class="filter-pill ${manageMode==='custom'?'active':''}" data-action="manage-mode" data-mode="custom">Selbst erstellt</button><span class="push"></span><button class="button ghost small" data-action="export-deck" data-deck="${escapeHTML(selected)}">Ausgewählten Stapel exportieren</button></div><div id="manageList"></div>`;renderManageList();}
function renderManageList(){const holder=document.getElementById('manageList');if(!holder)return;let cards=byDeck(state.selectedDeckId);if(manageMode==='new')cards=cards.filter(isNew);if(manageMode==='due')cards=cards.filter(c=>isNew(c)||isDue(c));if(manageMode==='custom')cards=cards.filter(c=>!c.builtIn);const q=query.toLocaleLowerCase('de-DE').trim();if(q)cards=cards.filter(c=>[c.front,c.answer,c.example,c.memory,(c.tags||[]).join(' ')].some(s=>String(s||'').toLocaleLowerCase('de-DE').includes(q)));cards=cards.slice().sort((a,b)=>a.front.localeCompare(b.front,'de'));holder.innerHTML=`<div class="panel-header"><div><h3>${cards.length} Karten</h3><p>${escapeHTML(deckOf(state.selectedDeckId)?.title||'Alle Themenstapel')}</p></div>${state.selectedDeckId!=='all'?`<div class="deck-manage"><button class="button ghost small" data-action="edit-deck" data-deck="${escapeHTML(state.selectedDeckId)}">Stapel bearbeiten</button><button class="button danger small" data-action="delete-deck" data-deck="${escapeHTML(state.selectedDeckId)}">Löschen</button></div>`:''}</div>${!cards.length?`<div class="empty"><div class="glyph">⌕</div><h2>Keine passenden Karten</h2><p>Suchbegriff ändern oder eigene Karten anlegen.</p></div>`:`<div class="card-list">${cards.map(c=>{const d=deckOf(c.deckId);return `<article class="card-row"><div><div class="badges" style="margin-bottom:7px"><span class="chip">${escapeHTML(d?.title||'')}</span><span class="chip ${isNew(c)?'info':isDue(c)?'warning':mastered(c)?'success':''}">${isNew(c)?'Neu':isDue(c)?'Fällig':mastered(c)?'Sicher':`Wiederholung ${fmtDate(c.progress.dueAt)}`}</span>${!c.builtIn?'<span class="chip success">Eigene Karte</span>':''}</div><h3>${escapeHTML(c.front)}</h3><p>${escapeHTML(c.answer).slice(0,145)}${c.answer.length>145?' …':''}</p></div><div class="card-row-tools"><button class="button outline small" data-action="card-edit" data-card="${escapeHTML(c.id)}">Bearbeiten</button><button class="button danger small" data-action="card-delete" data-card="${escapeHTML(c.id)}">Löschen</button></div></article>`;}).join('')}</div>`}`;}
function renderProgress(){const m=metrics(),today=Date.now();const dayStats=[];for(let i=6;i>=0;i--){const day=new Date(today-i*DAY);const dateKey=day.toLocaleDateString('sv-SE');dayStats.push({day:day.toLocaleDateString('de-DE',{weekday:'short'}),reviews:state.activity.filter(a=>new Date(a.ts).toLocaleDateString('sv-SE')===dateKey).length});}const max=Math.max(1,...dayStats.map(s=>s.reviews));root.innerHTML=`<div class="section-intro"><p class="eyebrow">DEIN LERNFORTSCHRITT</p><h1>Was sitzt schon sicher?</h1><p>Hier siehst du, welche Themen bereits geübt wurden und welche Karten als Nächstes wiederholt werden sollten.</p></div><section class="stats"><div class="stat-card"><div class="stat-label">Bewertungen insgesamt</div><div class="stat-value">${state.activity.length}</div><div class="stat-aux">alle Lerneinheiten</div></div><div class="stat-card"><div class="stat-label">Schon gelernt</div><div class="stat-value">${m.learned}</div><div class="stat-aux">verschiedene Karten</div></div><div class="stat-card"><div class="stat-label">Sicher</div><div class="stat-value">${m.mastered}</div><div class="stat-aux">längerer Abstand</div></div><div class="stat-card"><div class="stat-label">Jetzt fällig / neu</div><div class="stat-value">${m.due+m.new}</div><div class="stat-aux">nächste Lerneinheit</div></div></section><div class="two-col"><section class="panel"><div class="panel-header"><div><h2>Wiederholungen</h2><p>Aktivität der vergangenen 7 Tage</p></div></div><div class="weekly-bars">${dayStats.map(d=>`<div class="bar-wrap"><b>${d.reviews}</b><div class="bar" style="height:${Math.max(3,d.reviews/max*85)}%" title="${d.reviews} Wiederholungen"></div><span>${escapeHTML(d.day)}</span></div>`).join('')}</div></section><section class="panel"><div class="panel-header"><div><h2>Kartenstatus</h2><p>Einordnung anhand deiner Antworten</p></div></div><div class="progress-block"><div class="progress-metric"><span>Schon gelernt</span><strong>${m.learned} / ${m.total}</strong></div><div class="progress-rail"><div class="progress-fill" style="--val:${percent(m.learned,m.total)}%"></div></div></div><div class="progress-block"><div class="progress-metric"><span>Sicher beherrscht</span><strong>${m.mastered} / ${m.total}</strong></div><div class="progress-rail"><div class="progress-fill" style="--val:${percent(m.mastered,m.total)}%;background:#3287ac"></div></div></div><div class="notice">Sicher bedeutet: mindestens drei erfolgreiche Wiederholungen und ein Intervall von mindestens sieben Tagen.</div></section></div><div class="section-bar"><h2>Fortschritt nach Themenstapel</h2></div><section class="panel" style="overflow:auto"><table class="data-table"><thead><tr><th>Stapel</th><th>Karten</th><th>Gelernt</th><th>Sicher</th><th>Fällig / neu</th><th>Fortschritt</th></tr></thead><tbody>${state.decks.map(d=>{const s=metrics(d.id);return `<tr><td><strong>${escapeHTML(d.title)}</strong></td><td>${s.total}</td><td>${s.learned}</td><td>${s.mastered}</td><td>${s.due+s.new}</td><td style="min-width:100px"><div class="progress-rail"><div class="progress-fill" style="--val:${percent(s.learned,s.total)}%"></div></div></td></tr>`;}).join('')}</tbody></table></section>`;}
function renderSettings(){root.innerHTML=`<div class="section-intro"><p class="eyebrow">LERNEINSTELLUNGEN</p><h1>Deine Wiederholungsintervalle</h1><p>Lege fest, wie schnell die nächste Wiederholung nach jeder Bewertung geplant wird. Bei mehrfach erfolgreich gelernten Karten wächst der Abstand zusätzlich.</p></div><form class="panel" id="settingsForm" style="max-width:880px"><div class="panel-header"><div><h2>Bewertungen & Intervalle</h2><p>Ausgangsabstand für neue Karten; spätere Intervalle passen sich an.</p></div></div>${[['again','Noch einmal','Kurze Wiederholung und Zurücksetzen der Serie'],['unsure','Unsicher','Früher wiederholen'],['almost','Fast sicher','Mittleres Wiederholungsintervall'],['sure','Sicher','Längeres Wiederholungsintervall']].map(([k,title,sub])=>`<div class="setting-row"><div><strong>${title}</strong><small>${sub}</small></div><input name="${k}-value" type="number" min="1" max="9999" step="1" value="${escapeHTML(state.settings[k]?.value??DEF[k].value)}" aria-label="${title} Anzahl"><select name="${k}-unit" aria-label="${title} Einheit">${Object.entries(UNITS).map(([id,label])=>`<option value="${id}" ${(state.settings[k]?.unit||DEF[k].unit)===id?'selected':''}>${label}</option>`).join('')}</select></div>`).join('')}<div class="divider"></div><div class="setting-row"><div><strong>Wachstumsfaktor</strong><small>Faktor für Karten, die du bereits öfter beantwortet hast</small></div><input name="multiplier" type="number" min="1.1" max="5" step="0.1" value="${escapeHTML(state.settings.multiplier)}"><div class="small muted">z. B. 1,8</div></div><div class="setting-row"><div><strong>Maximalabstand in Tagen</strong><small>Begrenzt sehr lange Wiederholungsintervalle</small></div><input name="maxDays" type="number" min="1" max="3650" step="1" value="${escapeHTML(state.settings.maxDays)}"><div class="small muted">Tage</div></div><div class="toolbar" style="margin-bottom:0"><button class="button primary" type="submit">Intervalle speichern</button><button type="button" class="button ghost" data-action="default-settings">Standardwerte</button></div></form><section class="panel" style="max-width:880px"><div class="panel-header"><div><h2>Datenschutz & Sicherung</h2><p>Es gibt kein Konto und keinen zentralen Server für Lernstände.</p></div></div><p>Alle Kartenänderungen, Bewertungen und Termine liegen im <strong>lokalen Browser-Speicher dieses Geräts</strong>. Ein anderer Browser oder ein anderes Smartphone hat nicht automatisch denselben Stand. Verwende regelmäßig den JSON-Gesamtexport als Sicherung.</p><div class="toolbar"><button class="button outline" type="button" data-action="export-deck" data-deck="all">Backup exportieren</button><button class="button outline" type="button" data-action="open-import">Backup importieren</button><button class="button danger" type="button" data-action="reset-progress">Nur Lernstände zurücksetzen</button><button class="button danger" type="button" data-action="restore-base">Originalkarten wiederherstellen</button></div></section>`;}
function openCardEditor(id){const f=document.getElementById('cardForm'),card=state.cards.find(c=>c.id===id);f.reset();f.elements.cardId.value=card?.id||'';document.getElementById('cardDeck').innerHTML=deckOptions(card?.deckId||(state.selectedDeckId!=='all'?state.selectedDeckId:state.decks[0]?.id),false);f.elements.kind.value=card?.kind||'wissen';for(const field of ['front','answer','example','memory'])f.elements[field].value=card?.[field]||'';f.elements.tags.value=(card?.tags||[]).join(', ');document.getElementById('cardDialogTitle').textContent=card?'Karte bearbeiten':'Karte hinzufügen';document.getElementById('cardDialog').showModal();}
function saveCard(e){e.preventDefault();const f=e.currentTarget,fd=new FormData(f),id=String(fd.get('cardId')||''),front=String(fd.get('front')||'').trim(),answer=String(fd.get('answer')||'').trim(),deckId=String(fd.get('deckId')||'');if(!front||!answer||!deckOf(deckId)){notify('Bitte Vorderseite, Rückseite und Stapel angeben.');return;}const fields={front,answer,deckId,kind:String(fd.get('kind')||'wissen'),example:String(fd.get('example')||'').trim(),memory:String(fd.get('memory')||'').trim(),tags:String(fd.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,20)};const existing=state.cards.find(c=>c.id===id);if(existing){Object.assign(existing,fields,{updatedAt:Date.now()});notify('Karte aktualisiert.');}else{state.cards.push({id:uid('card'),...fields,source:'Eigene Karte',builtIn:false,progress:blankProgress(),createdAt:Date.now()});notify('Neue Karte angelegt.');}persist();f.closest('dialog').close();render();}
function openDeckEditor(id){const f=document.getElementById('deckForm'),d=deckOf(id);f.reset();f.elements.deckId.value=d?.id||'';f.elements.title.value=d?.title||'';f.elements.description.value=d?.description||'';f.elements.color.value=d?.color||'#168a8f';document.getElementById('deckDialogTitle').textContent=d?'Stapel bearbeiten':'Neuen Stapel anlegen';document.getElementById('deckDialog').showModal();}
function saveDeck(e){e.preventDefault();const fd=new FormData(e.currentTarget),id=String(fd.get('deckId')||''),title=String(fd.get('title')||'').trim();if(!title){notify('Bitte einen Stapelnamen angeben.');return;}const update={title,description:String(fd.get('description')||'').trim(),color:String(fd.get('color')||'#168a8f')};if(id){Object.assign(deckOf(id),update);notify('Stapel aktualisiert.');}else{const newId=uid('deck');state.decks.push({id:newId,...update,source:'Eigener Themenstapel',builtIn:false});state.selectedDeckId=newId;notify('Stapel angelegt.');}persist();e.currentTarget.closest('dialog').close();render();}
function download(name,content,mime){const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function openExport(deck='all'){document.getElementById('exportDeck').innerHTML=deckOptions(deck,true);document.getElementById('exportFormat').value='json';document.getElementById('exportDialog').showModal();}
function exportData(){const deckId=document.getElementById('exportDeck').value,fmt=document.getElementById('exportFormat').value,cards=byDeck(deckId),decks=deckId==='all'?state.decks:state.decks.filter(d=>d.id===deckId),name=(deckOf(deckId)?.title||'gesamter-lernstand').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(fmt==='json'){const payload={app:'wirtschaftsrecht-kg-ag',schemaVersion:1,exportedAt:new Date().toISOString(),decks:clone(decks),cards:clone(cards)};if(deckId==='all')Object.assign(payload,{settings:clone(state.settings),activity:clone(state.activity),deletedBuiltIns:clone(state.deletedBuiltIns)});download(name+'.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');}else if(fmt==='csv'){const cols=['Karten-ID','Stapel-ID','Stapel','Vorderseite','Rückseite','Beispiel','Merksatz','Schlagwörter'];const rows=[cols,...cards.map(c=>[c.id,c.deckId,deckOf(c.deckId)?.title||'',c.front,c.answer,c.example||'',c.memory||'',(c.tags||[]).join(', ')])];const csv='\ufeff'+rows.map(row=>row.map(x=>'"'+String(x||'').replace(/"/g,'""')+'"').join(';')).join('\r\n');download(name+'.csv',csv,'text/csv;charset=utf-8');}else{const html=s=>escapeHTML(s).replace(/\n/g,'<br>');const tsv=cards.map(c=>[html(c.front),html([c.answer,c.example?'Beispiel: '+c.example:'',c.memory?'Merke: '+c.memory:''].filter(Boolean).join('\n\n'))].join('\t')).join('\n');download(name+'-anki.tsv',tsv,'text/tab-separated-values;charset=utf-8');}document.getElementById('exportDialog').close();notify(`${cards.length} Karten exportiert.`);}
function openImport(){document.getElementById('importFile').value='';document.getElementById('importDeck').innerHTML=deckOptions(state.decks[0]?.id,false);document.getElementById('importMode').value='merge';document.getElementById('importDialog').showModal();}
function parseCSV(content){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<content.length;i++){
  const ch=content[i];
  if(ch==='"') {if(quoted&&content[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(ch===';'&&!quoted){row.push(cell);cell='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&content[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
  else cell+=ch;
 }
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
function normalizeDeck(raw){if(!raw||typeof raw.title!=='string')return null;return {id:String(raw.id||uid('import-deck')).slice(0,160),title:raw.title.slice(0,100),description:String(raw.description||'').slice(0,220),icon:'▤',color:/^#[0-9a-f]{6}$/i.test(String(raw.color))?raw.color:'#168a8f',source:String(raw.source||'Import').slice(0,170),builtIn:!!raw.builtIn};}
function normalizeCard(raw,deckIDs){if(!raw||typeof raw.front!=='string'||typeof raw.answer!=='string'||!deckIDs.has(raw.deckId))return null;const progress={...blankProgress(),...(raw.progress||{})};for(const key of ['dueAt','lastReviewedAt'])if(progress[key]!=null && !Number.isFinite(Number(progress[key])))progress[key]=null;return {id:String(raw.id||uid('import-card')).slice(0,160),deckId:String(raw.deckId),front:raw.front.slice(0,800),answer:raw.answer.slice(0,7000),example:String(raw.example||'').slice(0,2500),memory:String(raw.memory||'').slice(0,1000),kind:TYPES[raw.kind]?raw.kind:'wissen',tags:Array.isArray(raw.tags)?raw.tags.slice(0,20).map(x=>String(x).slice(0,50)):[],source:String(raw.source||'Import').slice(0,170),builtIn:!!raw.builtIn,progress};}
async function importData(){const file=document.getElementById('importFile').files?.[0];if(!file){notify('Bitte zuerst eine Datei auswählen.');return;}if(file.size>12*1024*1024){notify('Datei zu groß (maximal 12 MB).');return;}const mode=document.getElementById('importMode').value;let content;try{content=await file.text();}catch{notify('Datei konnte nicht gelesen werden.');return;}if(file.name.toLowerCase().endsWith('.json')){let data;try{data=JSON.parse(content);}catch{notify('JSON-Datei ist ungültig.');return;}if(!Array.isArray(data.decks)||!Array.isArray(data.cards)){notify('Die JSON-Datei enthält keine gültigen Stapel und Karten.');return;}const decks=data.decks.map(normalizeDeck).filter(Boolean);const deckIds=new Set([...state.decks.map(d=>d.id),...decks.map(d=>d.id)]);const cards=data.cards.map(c=>normalizeCard(c,deckIds)).filter(Boolean);if(!cards.length){notify('Keine lesbaren Karteikarten im Import.');return;}if(mode==='replace'){if(!confirm('Wirklich alle bisherigen Karten und Lernstände durch die Datei ersetzen? Vorher ein Backup exportieren!'))return;state={...fresh(),decks,cards,settings:{...clone(DEF),...(data.settings||{})},activity:Array.isArray(data.activity)?data.activity.slice(-15000):[],deletedBuiltIns:Array.isArray(data.deletedBuiltIns)?data.deletedBuiltIns:BASE.cards.map(c=>c.id).filter(id=>!cards.some(x=>x.id===id)).concat(BASE.decks.map(d=>d.id).filter(id=>!decks.some(x=>x.id===id))),selectedDeckId:'all'};}else{const savedDecks=new Map(state.decks.map(d=>[d.id,d]));decks.forEach(d=>savedDecks.set(d.id,d));state.decks=[...savedDecks.values()];const savedCards=new Map(state.cards.map(c=>[c.id,c]));cards.forEach(c=>savedCards.set(c.id,c));state.cards=[...savedCards.values()];if(data.settings)state.settings={...clone(DEF),...data.settings};if(Array.isArray(data.activity))state.activity=state.activity.concat(data.activity).slice(-15000);}
 notify(`${cards.length} Karten aus JSON importiert.`);
 }else if(/\.csv$/i.test(file.name)){
  if(mode==='replace'){notify('Ersetzen ist nur mit einem JSON-Backup möglich.');return;}
  const rows=parseCSV(content.replace(/^\ufeff/,''));
  if(rows.length<2){notify('Keine Karten in der CSV-Datei gefunden.');return;}
  const header=rows.shift().map(h=>h.trim().toLowerCase());
  const idx=n=>header.indexOf(n.toLowerCase());
  if(idx('Vorderseite')<0||idx('Rückseite')<0){notify('CSV benötigt die Spalten „Vorderseite“ und „Rückseite“.');return;}
  let count=0;
  for(const r of rows.slice(0,10000)){
   const v=name=>String(r[idx(name)]||'').trim();
   const front=v('Vorderseite'),answer=v('Rückseite');if(!front||!answer)continue;
   let deckId=v('Stapel-ID'),target=deckOf(deckId);
   if(!target){target=state.decks.find(d=>d.title===v('Stapel'));deckId=target?.id||'';}
   if(!target){deckId=uid('csv-deck');state.decks.push({id:deckId,title:v('Stapel')||'CSV-Import',description:'Importierte Karteikarten',color:'#168a8f',source:'CSV-Import',builtIn:false});}
   const id=v('Karten-ID')||uid('csv-card'),existing=state.cards.find(c=>c.id===id);
   const fields={deckId,front:front.slice(0,800),answer:answer.slice(0,7000),example:v('Beispiel').slice(0,2500),memory:v('Merksatz').slice(0,1000),tags:v('Schlagwörter').split(',').map(x=>x.trim()).filter(Boolean),kind:existing?.kind||'wissen'};
   if(existing)Object.assign(existing,fields);else state.cards.push({id,...fields,source:'CSV-Import',builtIn:false,progress:blankProgress()});
   count++;
  }
  if(!count){notify('Keine gültigen Karten importiert.');return;}
  notify(`${count} CSV-Karten übernommen.`);
 }else if(/\.(tsv|txt)$/i.test(file.name)){if(mode==='replace'){notify('Ersetzen ist nur mit einem JSON-Backup möglich.');return;}const d=document.getElementById('importDeck').value;if(!deckOf(d)){notify('Zielstapel fehlt.');return;}const rows=content.replace(/^\ufeff/,'').split(/\r?\n/).filter(Boolean);let count=0;for(const row of rows.slice(0,10000)){const cols=row.split('\t');if(cols.length<2)continue;const plain=x=>String(x||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');const front=plain(cols[0]).trim(),answer=plain(cols[1]).trim();if(!front||!answer)continue;state.cards.push({id:uid('tsv-card'),deckId:d,front:front.slice(0,800),answer:answer.slice(0,7000),example:'',memory:'',tags:[],kind:'wissen',source:'Importierte Karte',builtIn:false,progress:blankProgress()});count++;}if(!count){notify('Keine gültigen TSV-Zeilen gefunden.');return;}notify(`${count} TSV-Karten importiert.`);
 }else{notify('Unterstützte Formate: JSON, CSV und TSV.');return;}persist();document.getElementById('importDialog').close();study=null;render();}
function resetProgress(){if(!confirm('Sollen sämtliche Wiederholungsstände und Bewertungen gelöscht werden? Karten bleiben erhalten.'))return;state.cards.forEach(c=>{c.progress=blankProgress();});state.activity=[];study=null;persist();render();notify('Lernstände zurückgesetzt.');}
function restoreOriginals(){if(!confirm('Alle vorgefertigten Karten und Stapel auf den Ausgangsstand setzen? Eigene Karten bleiben, aber Änderungen an Originalkarten gehen verloren.'))return;const baseDeckIds=new Set(BASE.decks.map(d=>d.id)),baseIds=new Set(BASE.cards.map(c=>c.id));state.decks=state.decks.filter(d=>!baseDeckIds.has(d.id)).concat(clone(BASE.decks));state.cards=state.cards.filter(c=>!baseIds.has(c.id)).concat(BASE.cards.map(c=>({...clone(c),progress:blankProgress()})));state.deletedBuiltIns=[];state.activity=state.activity.filter(a=>!baseIds.has(a.cardId));persist();render();notify('Originalkarten wiederhergestellt.');}
// Global delegated UI events. No event handlers in user-entered strings.
document.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const action=btn.dataset.action;const deck=btn.dataset.deck||state.selectedDeckId;const id=btn.dataset.card;
 if(action==='select-deck'){study=null;navTo('manage',deck);}
 else if(action==='start-study'){startStudy(deck,'due');}
 else if(action==='start-cram'){startStudy(deck,'all');}
 else if(action==='reveal'){if(study){study.revealed=true;renderStudy();}}
 else if(action==='rate')rate(btn.dataset.grade);
 else if(action==='end-session'){study=null;navTo('dashboard');}
 else if(action==='new-deck')openDeckEditor();
 else if(action==='edit-deck')openDeckEditor(deck);
 else if(action==='delete-deck'){const d=deckOf(deck),cards=byDeck(deck);if(d&&confirm(`Stapel „${d.title}“ und ${cards.length} zugehörige Karten löschen?`)){state.cards=state.cards.filter(c=>c.deckId!==deck);state.decks=state.decks.filter(x=>x.id!==deck);if(d.builtIn)state.deletedBuiltIns.push(deck);cards.filter(c=>c.builtIn).forEach(c=>state.deletedBuiltIns.push(c.id));state.selectedDeckId='all';persist();render();notify('Stapel gelöscht.');}}
 else if(action==='add-card')openCardEditor();
 else if(action==='card-edit')openCardEditor(id);
 else if(action==='card-delete'){const c=state.cards.find(c=>c.id===id);if(c&&confirm(`Karte wirklich löschen?\n\n${c.front}`)){state.cards=state.cards.filter(x=>x.id!==id);if(c.builtIn)state.deletedBuiltIns.push(c.id);persist();renderManageList();notify('Karte gelöscht.');}}
 else if(action==='manage-mode'){manageMode=btn.dataset.mode||'all';renderManage();}
 else if(action==='export-deck')openExport(deck);
 else if(action==='open-import')openImport();
 else if(action==='reset-progress')resetProgress();
 else if(action==='restore-base')restoreOriginals();
 else if(action==='default-settings'){state.settings=clone(DEF);persist();renderSettings();notify('Standardintervalle wiederhergestellt.');}
});
document.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{study=null;navTo(btn.dataset.page);}));
document.getElementById('sidebarNewDeck').addEventListener('click',()=>openDeckEditor());
document.getElementById('topExport').addEventListener('click',()=>openExport(state.selectedDeckId));
document.getElementById('topImport').addEventListener('click',openImport);
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.closeDialog).close()));
document.getElementById('cardForm').addEventListener('submit',saveCard);
document.getElementById('deckForm').addEventListener('submit',saveDeck);
document.getElementById('downloadExport').addEventListener('click',exportData);
document.getElementById('runImport').addEventListener('click',importData);
document.addEventListener('change',e=>{
 if(e.target.id==='studyDeckSelect'){study=null;state.selectedDeckId=e.target.value;persist();renderStudy();}
 if(e.target.id==='manageDeckSelect'){state.selectedDeckId=e.target.value;persist();renderSidebar();renderManageList();}
});
document.addEventListener('input',e=>{if(e.target.id==='cardSearch'){query=e.target.value;renderManageList();}});
document.addEventListener('submit',e=>{if(e.target.id!=='settingsForm')return;e.preventDefault();const fd=new FormData(e.target);for(const key of ['again','unsure','almost','sure'])state.settings[key]={value:Math.min(9999,Math.max(1,Number(fd.get(key+'-value'))||DEF[key].value)),unit:Object.hasOwn(UNITS,fd.get(key+'-unit'))?fd.get(key+'-unit'):DEF[key].unit};state.settings.multiplier=Math.min(5,Math.max(1.1,Number(fd.get('multiplier'))||1.8));state.settings.maxDays=Math.min(3650,Math.max(1,Number(fd.get('maxDays'))||365));persist();notify('Wiederholungsintervalle gespeichert.');renderSettings();});
document.addEventListener('keydown',e=>{if(!study||page!=='study'||document.querySelector('dialog[open]'))return;if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable)return;if(e.code==='Space'&&!study.revealed){e.preventDefault();study.revealed=true;renderStudy();}else if(study.revealed&&['Digit1','Digit2','Digit3','Digit4','Numpad1','Numpad2','Numpad3','Numpad4'].includes(e.code)){e.preventDefault();rate(['again','unsure','almost','sure'][Number(e.code.slice(-1))-1]);}});
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
render();
})();

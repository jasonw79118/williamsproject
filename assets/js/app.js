let DATA=null;
let state={selectedPersonId:null, peopleById:{}, familiesById:{}, localKey:'williamsproject-data-v0.1.0'};

const $=sel=>document.querySelector(sel);
const $$=sel=>Array.from(document.querySelectorAll(sel));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function init(){
  const base=await fetch('assets/data/project-data.json').then(r=>r.json());
  const local=localStorage.getItem(state.localKey);
  DATA=local?JSON.parse(local):base;
  hydrate();
  wire();
  renderAll();
}
function saveLocal(){ localStorage.setItem(state.localKey, JSON.stringify(DATA)); hydrate(); renderAll(); }
function hydrate(){
  state.peopleById=Object.fromEntries(DATA.people.map(p=>[p.id,p]));
  state.familiesById=Object.fromEntries(DATA.families.map(f=>[f.id,f]));
  if(!state.selectedPersonId) state.selectedPersonId=DATA.meta.rootPersonId;
}
function wire(){
  $$('.tabs button').forEach(btn=>btn.addEventListener('click',()=>{ $$('.tabs button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); $$('.tab-panel').forEach(p=>p.classList.remove('active')); $('#'+btn.dataset.tab).classList.add('active'); if(btn.dataset.tab==='edit') renderEditForm(); }));
  $('#exportBtn').addEventListener('click',exportData);
  $('#importFile').addEventListener('change',importData);
  $('#resetBtn').addEventListener('click',()=>{ if(confirm('Remove local browser edits and reload the packaged data?')){ localStorage.removeItem(state.localKey); location.reload(); }});
  $('#lineSelect').addEventListener('change',renderLineStory);
  $('#treeSearch').addEventListener('input',renderTreeResults);
  $('#peopleSearch').addEventListener('input',renderPeopleTable);
  $('#confidenceFilter').addEventListener('change',renderPeopleTable);
  $('#lineFilter').addEventListener('change',renderPeopleTable);
  $('#sourceSearch').addEventListener('input',renderSources);
  $('#addPersonForm').addEventListener('submit',addPerson);
  $('#addTargetForm').addEventListener('submit',addTarget);
}
function renderAll(){
  $('#versionBadge').textContent='v'+DATA.meta.version;
  $('#footerVersion').textContent='v'+DATA.meta.version;
  renderLineSelects(); renderLineStory(); renderOldestLines(); renderProjectSummary(); renderTreeResults(); selectPerson(state.selectedPersonId, false); renderPeopleTable(); renderDNA(); renderResearch(); renderSources(); renderEditForm();
}
function years(p){let b=p.birth?.date||'', d=p.death?.date||''; return [b,d].filter(Boolean).join(' – ')}
function place(p){return p.birth?.place||p.death?.place||''}
function confidenceChip(conf){let cls='chip'; if(/Hypothesis|Conflicting/.test(conf))cls+=' danger'; else if(/Candidate/.test(conf))cls+=' warn'; return `<span class="${cls}">${esc(conf||'Unrated')}</span>`}
function personName(id){return state.peopleById[id]?.name||'Unknown person'}
function personLine(p){return `${esc(p.name)} ${p.living?'<span class="chip">Living masked</span>':''}`}

function renderLineSelects(){
 const lines=DATA.lineSummaries.map(l=>l.name).sort();
 $('#lineSelect').innerHTML=lines.map(l=>`<option>${esc(l)}</option>`).join('');
 $('#lineFilter').innerHTML='<option value="">All lines</option>'+lines.map(l=>`<option>${esc(l)}</option>`).join('');
 if($('#addLineTag')) $('#addLineTag').innerHTML='<option value="">No line tag</option>'+lines.map(l=>`<option>${esc(l)}</option>`).join('');
 const options=DATA.confidenceLevels.map(c=>`<option>${esc(c)}</option>`).join('');
 $('#confidenceFilter').innerHTML='<option value="">All confidence levels</option>'+options;
 $('#addConfidence').innerHTML=options;
}
function renderLineStory(){
 const line=$('#lineSelect').value || DATA.lineSummaries[0]?.name;
 const summary=DATA.lineSummaries.find(l=>l.name===line);
 if(!summary){ $('#lineStory').innerHTML='No line selected.'; return; }
 const ids=summary.ancestorIds||[];
 const ancestors=ids.map(id=>state.peopleById[id]).filter(Boolean).sort((a,b)=>(b.generationFromRoot??0)-(a.generationFromRoot??0));
 const narrative=DATA.narratives?.[line]||'';
 let html=`<p>${esc(narrative)}</p>`;
 if(ancestors.length){
   html+=`<h3>Current direct-line chain, oldest to newest</h3><ol>`+ancestors.map(p=>`<li><button onclick="selectPerson('${p.id}')">${esc(p.name)}</button> <span class="muted">${esc(years(p))}</span> ${confidenceChip(p.confidence)}</li>`).join('')+`</ol>`;
 }
 const warnings=ancestors.filter(p=>/Candidate|Hypothesis|Conflicting/.test(p.confidence||''));
 if(warnings.length){ html+=`<h3>Disclaimers for this line</h3><ul>`+warnings.slice(0,12).map(p=>`<li><strong>${esc(p.name)}</strong>: ${esc(p.researchStatus||p.confidence)}</li>`).join('')+`</ul>`; }
 $('#lineStory').innerHTML=html;
}
function renderOldestLines(){
 $('#oldestLines').innerHTML=DATA.lineSummaries.sort((a,b)=>a.name.localeCompare(b.name)).map(l=>{
  const p=state.peopleById[l.oldest.id]||l.oldest;
  return `<div class="mini-card"><h3>${esc(l.name)}</h3><p><button onclick="selectPerson('${p.id}')">${esc(p.name)}</button></p><p class="muted">Generation ${esc(p.generationFromRoot??'')}; ${esc(years(p))}; ${esc(place(p))}</p>${confidenceChip(p.confidence)}</div>`
 }).join('');
}
function renderProjectSummary(){
 const m=DATA.meta.importSummary;
 $('#projectSummary').innerHTML=`<p>This first Williamsproject build imports <strong>${m.people}</strong> people, <strong>${m.families}</strong> families, and <strong>${m.sources}</strong> GEDCOM source records. The direct ancestor chain currently reaches generation <strong>${m.maxGeneration}</strong>.</p><p><strong>Source policy:</strong> ${esc(DATA.meta.sourcePolicy)}</p><p><strong>Privacy:</strong> ${esc(DATA.meta.privacyMode)}</p>`;
}
function searchPeople(q){
 q=(q||'').toLowerCase().trim();
 let arr=DATA.people.filter(p=>!q || [p.name,p.surn,p.birth?.place,p.death?.place,p.confidence,(p.lineTags||[]).join(' ')].join(' ').toLowerCase().includes(q));
 return arr.sort((a,b)=>(a.generationFromRoot??999)-(b.generationFromRoot??999)||a.name.localeCompare(b.name));
}
function renderTreeResults(){
 const q=$('#treeSearch').value;
 const arr=searchPeople(q).slice(0,120);
 $('#treeResults').innerHTML=arr.map(p=>`<div class="result ${p.id===state.selectedPersonId?'active':''}" onclick="selectPerson('${p.id}')"><strong>${esc(p.name)}</strong><br><span class="muted">${esc(years(p))} ${esc(place(p))}</span></div>`).join('');
}
function selectPerson(id, switchTab=true){
 state.selectedPersonId=id;
 renderTreeResults(); renderPersonDetail(); renderFamilyPanel(); renderPedigree(); renderEditForm();
 if(switchTab){ $$('.tab-panel').forEach(p=>p.classList.remove('active')); $('#tree').classList.add('active'); $$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='tree')); }
}
window.selectPerson=selectPerson;
function renderPersonDetail(){
 const p=state.peopleById[state.selectedPersonId]; if(!p)return;
 $('#personDetail').innerHTML=`<div class="person-title"><div><h2>${personLine(p)}</h2><p class="muted">${esc(p.id)} · ${esc((p.lineTags||[]).join(', ')||'No line tag')}</p></div>${confidenceChip(p.confidence)}</div><div class="facts"><div class="fact"><strong>Birth</strong><br>${esc(p.birth?.date||'')}<br><span class="muted">${esc(p.birth?.place||'')}</span></div><div class="fact"><strong>Death</strong><br>${esc(p.death?.date||'')}<br><span class="muted">${esc(p.death?.place||'')}</span></div></div><p><strong>Status:</strong> ${esc(p.researchStatus||'')}</p>${(p.notes||[]).length?`<h3>Notes</h3><div class="source-card">${esc((p.notes||[]).join('\n\n')).replace(/\n/g,'<br>')}</div>`:''}`;
 renderAncestorPath();
}
function getParents(pid){
 const p=state.peopleById[pid]; if(!p)return [];
 let out=[]; (p.famc||[]).forEach(fid=>{const f=state.familiesById[fid]; if(f){ if(f.husband)out.push(f.husband); if(f.wife)out.push(f.wife); }}); return out.filter(Boolean);
}
function getFamiliesAsSpouse(pid){return DATA.families.filter(f=>f.husband===pid||f.wife===pid)}
function renderAncestorPath(){
 const p=state.peopleById[state.selectedPersonId];
 let current=p, path=[];
 while(current){ path.push(current); const parents=getParents(current.id); current=parents[0]?state.peopleById[parents[0]]:null; if(path.length>20)break; }
 $('#ancestorPath').innerHTML=path.map(p=>`<button onclick="selectPerson('${p.id}')">${esc(p.name)}</button>`).join(' › ');
}
function renderFamilyPanel(){
 const pid=state.selectedPersonId; const parents=getParents(pid);
 const fams=getFamiliesAsSpouse(pid);
 let html='<div class="family-list">';
 html+=`<div class="mini-card"><h3>Parents</h3>${parents.length?parents.map(id=>`<p><button onclick="selectPerson('${id}')">${esc(personName(id))}</button></p>`).join(''):'<p class="muted">No parents listed.</p>'}</div>`;
 html+=`<div class="mini-card"><h3>Spouses</h3>${fams.length?fams.map(f=>{const sid=f.husband===pid?f.wife:f.husband; return `<p><button onclick="selectPerson('${sid}')">${esc(personName(sid))}</button><br><span class="muted">${esc(f.marriage?.date||'')} ${esc(f.marriage?.place||'')}</span></p>`}).join(''):'<p class="muted">No spouses listed.</p>'}</div>`;
 let kids=[]; fams.forEach(f=>kids.push(...(f.children||[])));
 html+=`<div class="mini-card"><h3>Children</h3>${kids.length?kids.map(id=>`<p><button onclick="selectPerson('${id}')">${esc(personName(id))}</button></p>`).join(''):'<p class="muted">No children listed.</p>'}</div>`;
 html+='</div>'; $('#familyPanel').innerHTML=html;
}
function renderPedigree(){
 function node(pid,depth){
   if(!pid||depth>6)return '';
   const p=state.peopleById[pid]; if(!p)return '';
   const parents=getParents(pid);
   return `<li><button onclick="selectPerson('${pid}')">${esc(p.name)}</button> <span class="muted">${esc(years(p))}</span>${parents.length?`<ul>${parents.map(id=>node(id,depth+1)).join('')}</ul>`:''}</li>`;
 }
 $('#pedigree').innerHTML=`<ul>${node(state.selectedPersonId,0)}</ul>`;
}
function renderPeopleTable(){
 const q=$('#peopleSearch').value||'', conf=$('#confidenceFilter').value||'', line=$('#lineFilter').value||'';
 let arr=searchPeople(q).filter(p=>(!conf||p.confidence===conf)&&(!line||(p.lineTags||[]).includes(line)));
 $('#peopleTable').innerHTML=`<thead><tr><th>Name</th><th>Birth</th><th>Death</th><th>Line</th><th>Confidence</th><th>Status</th></tr></thead><tbody>`+arr.map(p=>`<tr><td><button onclick="selectPerson('${p.id}')">${esc(p.name)}</button></td><td>${esc(p.birth?.date||'')}<br><span class="muted">${esc(p.birth?.place||'')}</span></td><td>${esc(p.death?.date||'')}<br><span class="muted">${esc(p.death?.place||'')}</span></td><td>${esc((p.lineTags||[]).join(', '))}</td><td>${confidenceChip(p.confidence)}</td><td>${esc(p.researchStatus||'')}</td></tr>`).join('')+`</tbody>`;
}
function renderDNA(){
 $('#dnaList').innerHTML=DATA.dnaClusters.map(c=>`<div class="mini-card"><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><div class="chips"><span class="chip">Chr ${esc(c.chromosome)}</span><span class="chip">${esc(c.start)}–${esc(c.end)}</span><span class="chip warn">${esc(c.status)}</span></div></div>`).join('');
}
function renderResearch(){
 $('#researchList').innerHTML=DATA.researchTargets.map(t=>`<div class="mini-card"><h3>${esc(t.title)}</h3><div class="chips"><span class="chip warn">${esc(t.priority)}</span><span class="chip">${esc(t.status)}</span></div><p>${esc(t.summary)}</p></div>`).join('');
}
function renderSources(){
 const q=($('#sourceSearch').value||'').toLowerCase();
 const arr=DATA.sources.filter(s=>!q||[s.title,s.author,s.publication,(s.notes||[]).join(' ')].join(' ').toLowerCase().includes(q));
 $('#sourceList').innerHTML=arr.slice(0,250).map(s=>`<div class="source-card"><h3>${esc(s.title||s.id)}</h3><p class="muted">${esc(s.author||'')} ${esc(s.publication||'')}</p>${(s.notes||[]).length?`<p>${esc(s.notes.join(' '))}</p>`:''}</div>`).join('');
}
function renderEditForm(){
 const p=state.peopleById[state.selectedPersonId]; if(!p||!$('#editForm'))return;
 $('#editForm').innerHTML=`<label>Name<input name="name" value="${esc(p.name)}"></label><label>Surname<input name="surn" value="${esc(p.surn||'')}"></label><label>Birth date<input name="birthDate" value="${esc(p.birth?.date||'')}"></label><label>Birth place<input name="birthPlace" value="${esc(p.birth?.place||'')}"></label><label>Death date<input name="deathDate" value="${esc(p.death?.date||'')}"></label><label>Death place<input name="deathPlace" value="${esc(p.death?.place||'')}"></label><label>Confidence<select name="confidence">${DATA.confidenceLevels.map(c=>`<option ${p.confidence===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Research status<textarea name="researchStatus" rows="3">${esc(p.researchStatus||'')}</textarea></label><label>Notes<textarea name="notes" rows="7">${esc((p.notes||[]).join('\n\n'))}</textarea></label><button type="submit">Save selected person</button>`;
 $('#editForm').onsubmit=e=>{e.preventDefault(); const fd=new FormData(e.target); p.name=fd.get('name'); p.surn=fd.get('surn'); p.birth=p.birth||{}; p.death=p.death||{}; p.birth.date=fd.get('birthDate'); p.birth.place=fd.get('birthPlace'); p.death.date=fd.get('deathDate'); p.death.place=fd.get('deathPlace'); p.confidence=fd.get('confidence'); p.researchStatus=fd.get('researchStatus'); p.notes=String(fd.get('notes')||'').split(/\n\s*\n/).filter(Boolean); saveLocal(); alert('Saved in this browser. Export JSON to publish.'); };
}
function ensureFamily(fid){ return state.familiesById[fid] || DATA.families.find(f=>f.id===fid); }
function newFamily(){ const fid='@NEWF'+Date.now()+Math.floor(Math.random()*1000)+'@'; const fam={id:fid,husband:null,wife:null,children:[],marriage:{},notes:[],sources:[]}; DATA.families.push(fam); return fam; }
function attachLineSummary(p){
  (p.lineTags||[]).forEach(line=>{
    let ls=DATA.lineSummaries.find(x=>x.name===line);
    if(!ls){ ls={name:line,ancestorIds:[],oldest:{id:p.id,name:p.name,generation:p.generationFromRoot,birth:p.birth,death:p.death,confidence:p.confidence}}; DATA.lineSummaries.push(ls); }
    if(!ls.ancestorIds.includes(p.id)) ls.ancestorIds.push(p.id);
    const old=state.peopleById[ls.oldest?.id]||ls.oldest||{};
    if((p.generationFromRoot??-1) > (old.generationFromRoot??old.generation??-1)) ls.oldest={id:p.id,name:p.name,generation:p.generationFromRoot,birth:p.birth,death:p.death,confidence:p.confidence};
  });
}
function addPerson(e){
 e.preventDefault(); const fd=new FormData(e.target); const id='@NEW'+Date.now()+'@'; const selected=state.peopleById[state.selectedPersonId];
 const p={id,name:fd.get('name'),givn:'',surn:fd.get('surn'),sex:fd.get('sex'),birth:{date:fd.get('birthDate'),place:fd.get('birthPlace')},death:{date:fd.get('deathDate'),place:''},burial:{},famc:[],fams:[],notes:[fd.get('note')].filter(Boolean),sources:[],facts:[],media:[],generationFromRoot:null,isDirectAncestor:false,living:false,confidence:fd.get('confidence'),researchStatus:'Added manually',lineTags:fd.get('lineTag')?[fd.get('lineTag')]:[]};
 DATA.people.push(p); hydrate();
 const rel=fd.get('relationship');
 if(rel==='parent' && selected){
   let famId=(selected.famc||[])[0]; let fam=famId?ensureFamily(famId):null; if(!fam){ fam=newFamily(); selected.famc=selected.famc||[]; selected.famc.push(fam.id); fam.children.push(selected.id); }
   if(p.sex==='F') fam.wife=p.id; else fam.husband=p.id; p.fams.push(fam.id);
   if(selected.generationFromRoot!==null && selected.generationFromRoot!==undefined){ p.generationFromRoot=selected.generationFromRoot+1; p.isDirectAncestor=!!selected.isDirectAncestor; }
   if(p.isDirectAncestor) attachLineSummary(p);
 } else if(rel==='child' && selected){
   let fam=getFamiliesAsSpouse(selected.id)[0]; if(!fam){ fam=newFamily(); if(selected.sex==='F') fam.wife=selected.id; else fam.husband=selected.id; selected.fams=selected.fams||[]; selected.fams.push(fam.id); }
   fam.children=fam.children||[]; fam.children.push(p.id); p.famc.push(fam.id);
   if(selected.generationFromRoot!==null && selected.generationFromRoot!==undefined){ p.generationFromRoot=Math.max(0,selected.generationFromRoot-1); }
 } else if(rel==='spouse' && selected){
   let fam=newFamily(); if(selected.sex==='F'){ fam.wife=selected.id; fam.husband=p.id; } else { fam.husband=selected.id; fam.wife=p.id; } selected.fams=selected.fams||[]; p.fams=p.fams||[]; selected.fams.push(fam.id); p.fams.push(fam.id);
 }
 state.selectedPersonId=id; saveLocal(); e.target.reset();
}
function addTarget(e){
 e.preventDefault(); const fd=new FormData(e.target); DATA.researchTargets.push({id:'RT_'+Date.now(),title:fd.get('title'),priority:fd.get('priority'),status:fd.get('status'),summary:fd.get('summary')}); saveLocal(); e.target.reset();
}
function exportData(){
 const blob=new Blob([JSON.stringify(DATA,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='williamsproject-data.json'; a.click(); URL.revokeObjectURL(a.href);
}
function importData(e){
 const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{DATA=JSON.parse(reader.result); saveLocal(); alert('Imported and saved to this browser.');}catch(err){alert('Import failed: '+err.message)}}; reader.readAsText(file);
}
init();

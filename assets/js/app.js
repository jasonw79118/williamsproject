let DATA=null;
let state={selectedPersonId:null, peopleById:{}, familiesById:{}, localKey:'williamsproject-data-v0.2.4', themeKey:'williamsproject-theme-v0.2.4'};

const $=sel=>document.querySelector(sel);
const $$=sel=>Array.from(document.querySelectorAll(sel));
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slug=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

async function init(){
  const base=await fetch('assets/data/project-data.json').then(r=>r.json());
  const local=localStorage.getItem(state.localKey);
  DATA=local?JSON.parse(local):base;
  applyTheme(localStorage.getItem(state.themeKey)||'light');
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
function applyTheme(theme){
  document.documentElement.dataset.theme=theme==='dark'?'dark':'light';
  const btn=$('#themeToggle'); if(btn) btn.textContent=theme==='dark'?'Light mode':'Dark mode';
  localStorage.setItem(state.themeKey, document.documentElement.dataset.theme);
}
function wire(){
  $$('.tabs button').forEach(btn=>btn.addEventListener('click',()=>showTab(btn.dataset.tab)));
  $('#themeToggle')?.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
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
  $('#familySubmissionForm')?.addEventListener('submit',downloadFamilySubmission);
}
function showTab(tab){
  $$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $$('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===tab));
  if(tab==='edit') renderEditForm();
}
function renderAll(){
  $('#versionBadge').textContent='v'+DATA.meta.version;
  $('#footerVersion').textContent='v'+DATA.meta.version;
  renderLineSelects(); renderLineStory(); renderOldestLines(); renderProjectSummary(); renderTreeResults(); selectPerson(state.selectedPersonId, false); renderPeopleTable(); renderDNA(); renderResearch(); renderSources(); renderEditForm();
}
function years(p){let b=safeBirth(p)?.date||'', d=p.death?.date||''; return [b,d].filter(Boolean).join(' – ')}
function place(p){return safeBirth(p)?.place||p.death?.place||''}
function isLivingPrivate(p){ return !!p?.living && !p?.publicPermission; }
function safeBirth(p){ return isLivingPrivate(p)?{}:(p.birth||{}); }
function displayName(p){ return isLivingPrivate(p)?(p.publicLabel||`Living ${p.surn||'person'}`):(p?.name||'Unknown person'); }
function confidenceChip(conf){let cls='chip'; if(/Hypothesis|Conflicting|Research lead|Unconfirmed/.test(conf))cls+=' danger'; else if(/Candidate|Needs|Imported/.test(conf))cls+=' warn'; return `<span class="${cls}">${esc(conf||'Unrated')}</span>`}
function personName(id){return displayName(state.peopleById[id])}
function personLine(p){return `${esc(displayName(p))} ${p.living?'<span class="chip">Living/private</span>':''}`}

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
   html+=`<h3>Current direct-line chain, oldest to newest</h3><ol>`+ancestors.map(p=>`<li><button onclick="selectPerson('${p.id}')">${esc(displayName(p))}</button> <span class="muted">${esc(years(p))}</span> ${confidenceChip(p.confidence)}</li>`).join('')+`</ol>`;
 }
 const warnings=ancestors.filter(p=>/Candidate|Hypothesis|Conflicting/.test(p.confidence||''));
 if(warnings.length){ html+=`<h3>Disclaimers for this line</h3><ul>`+warnings.slice(0,12).map(p=>`<li><strong>${esc(displayName(p))}</strong>: ${esc(p.researchStatus||p.confidence)}</li>`).join('')+`</ul>`; }
 $('#lineStory').innerHTML=html;
}
function renderOldestLines(){
 $('#oldestLines').innerHTML=DATA.lineSummaries.sort((a,b)=>a.name.localeCompare(b.name)).map(l=>{
  const p=state.peopleById[l.oldest.id]||l.oldest;
  return `<div class="mini-card"><h3>${esc(l.name)}</h3><p><button onclick="selectPerson('${p.id}')">${esc(displayName(p))}</button></p><p class="muted">Generation ${esc(p.generationFromRoot??'')}; ${esc(years(p))}; ${esc(place(p))}</p>${confidenceChip(p.confidence)}</div>`
 }).join('');
}
function familyCard(familyId,title){
 const f=state.familiesById[familyId]; if(!f)return '';
 const husband=state.peopleById[f.husband], wife=state.peopleById[f.wife];
 const children=(f.children||[]).map(id=>state.peopleById[id]).filter(Boolean);
 return `<div class="mini-card featured-family"><h3>${esc(title)}</h3><p><strong>Husband:</strong> <button onclick="selectPerson('${f.husband}')">${esc(displayName(husband))}</button></p><p><strong>Wife:</strong> <button onclick="selectPerson('${f.wife}')">${esc(displayName(wife))}</button> <span class="muted">${esc(f.marriage?.date||'')} ${esc(f.marriage?.place||'')}</span></p><p><strong>Children:</strong></p><ol>${children.map(p=>`<li><button onclick="selectPerson('${p.id}')">${esc(displayName(p))}</button> <span class="muted">${esc(years(p))}</span></li>`).join('')}</ol><p class="muted">This known family group is intentionally shown on the front page so it does not get lost behind the Williams brick-wall research targets.</p></div>`;
}
function renderProjectSummary(){
 const m=DATA.meta.importSummary;
 $('#projectSummary').innerHTML=`<p>This Williamsproject build imports <strong>${m.people}</strong> people, <strong>${m.families}</strong> families, and <strong>${m.sources}</strong> GEDCOM source records. Confirmed paths stop where parentage becomes unknown or hypothetical; older branches remain available as research leads.</p><p><strong>Source policy:</strong> ${esc(DATA.meta.sourcePolicy)}</p><p><strong>Privacy:</strong> ${esc(DATA.meta.privacyMode)}</p><p><strong>Contribution workflow:</strong> Other Williams-connected relatives can use the <em>Add My Family</em> screen to download a review-ready submission file without editing GitHub.</p>${familyCard('@F66@','Known George Washington “G.W.” Williams family')}`;
}
function searchPeople(q){
 q=(q||'').toLowerCase().trim();
 let arr=DATA.people.filter(p=>!q || [p.name,p.publicLabel,p.surn,p.birth?.place,p.death?.place,p.confidence,(p.lineTags||[]).join(' ')].join(' ').toLowerCase().includes(q));
 return arr.sort((a,b)=>(a.generationFromRoot??999)-(b.generationFromRoot??999)||displayName(a).localeCompare(displayName(b)));
}
function renderTreeResults(){
 const q=$('#treeSearch').value;
 const arr=searchPeople(q).slice(0,120);
 $('#treeResults').innerHTML=arr.map(p=>`<div class="result ${p.id===state.selectedPersonId?'active':''}" onclick="selectPerson('${p.id}')"><strong>${esc(displayName(p))}</strong><br><span class="muted">${esc(years(p))} ${esc(place(p))}</span></div>`).join('');
}
function selectPerson(id, switchTab=true){
 state.selectedPersonId=id;
 renderTreeResults(); renderPersonDetail(); renderFamilyPanel(); renderPedigree(); renderEditForm();
 if(switchTab) showTab('tree');
}
window.selectPerson=selectPerson;
function renderPersonDetail(){
 const p=state.peopleById[state.selectedPersonId]; if(!p)return;
 const b=safeBirth(p);
 $('#personDetail').innerHTML=`<div class="person-title"><div><h2>${personLine(p)}</h2><p class="muted">${esc(p.id)} · ${esc((p.lineTags||[]).join(', ')||'No line tag')}</p></div>${confidenceChip(p.confidence)}</div><div class="facts"><div class="fact"><strong>Birth</strong><br>${esc(b?.date||'')}${isLivingPrivate(p)?'<span class="muted">Living details hidden</span>':''}<br><span class="muted">${esc(b?.place||'')}</span></div><div class="fact"><strong>Death</strong><br>${esc(p.death?.date||'')}<br><span class="muted">${esc(p.death?.place||'')}</span></div></div><p><strong>Status:</strong> ${esc(p.researchStatus||'')}</p>${(p.notes||[]).length?`<h3>Notes</h3><div class="source-card">${esc((p.notes||[]).join('\n\n')).replace(/\n/g,'<br>')}</div>`:''}`;
 renderAncestorPath();
}
function getParents(pid){
 const p=state.peopleById[pid]; if(!p)return [];
 let out=[]; (p.famc||[]).forEach(fid=>{const f=state.familiesById[fid]; if(f){ if(f.husband)out.push(f.husband); if(f.wife)out.push(f.wife); }}); return out.filter(Boolean);
}
function getFamiliesAsSpouse(pid){return DATA.families.filter(f=>f.husband===pid||f.wife===pid)}
function isUnconfirmedPerson(p){
 if(!p)return true;
 const conf=p.confidence||'', status=p.researchStatus||'', name=p.name||'';
 return /Unknown/i.test(name)||/Hypothesis|Candidate|Conflicting|Research lead|Unconfirmed/i.test(conf)||/not treat as proven|detached|research lead only|unknown parentage/i.test(status);
}
function getConfirmedParents(pid){ return getParents(pid).filter(id=>!isUnconfirmedPerson(state.peopleById[id])); }
function personResearchLeads(p){
 const leads=[...(p.researchLeads||[])];
 const parents=getParents(p.id).map(id=>state.peopleById[id]).filter(Boolean);
 parents.filter(isUnconfirmedPerson).forEach(parent=>{
   leads.push({title:`Possible parent or upstream lead: ${displayName(parent)}`,status:parent.confidence||'Unconfirmed',summary:parent.researchStatus||'This parent/ancestor is present in imported data but is not treated as confirmed.'});
 });
 if(!parents.length){ leads.push({title:'No confirmed parents attached',status:'Open',summary:'The confirmed ancestor path stops here. Add parents only when the evidence supports the relationship, or add them as research leads first.'}); }
 return leads;
}
function renderAncestorPath(){
 const p=state.peopleById[state.selectedPersonId]; if(!p)return;
 const leads=personResearchLeads(p);
 if(leads.length){
   $('#ancestorPathTitle').textContent='Research leads instead of ancestor path';
   $('#ancestorPath').innerHTML=`<div class="source-card"><p><strong>Confirmed path pauses here.</strong> One or more parent links are unknown, hypothetical, or detached. Use these leads until the relationship is supported.</p></div>`+leads.map(l=>`<div class="mini-card"><h3>${esc(l.title)}</h3><div class="chips"><span class="chip warn">${esc(l.status||'Open')}</span></div><p>${esc(l.summary||'')}</p></div>`).join('');
   return;
 }
 $('#ancestorPathTitle').textContent='Confirmed ancestor path';
 let current=p, path=[];
 while(current){ path.push(current); const parents=getConfirmedParents(current.id); current=parents[0]?state.peopleById[parents[0]]:null; if(path.length>20)break; }
 $('#ancestorPath').innerHTML=path.map(p=>`<button onclick="selectPerson('${p.id}')">${esc(displayName(p))}</button>`).join(' › ');
}
function renderFamilyPanel(){
 const pid=state.selectedPersonId; const parents=getParents(pid);
 const fams=getFamiliesAsSpouse(pid);
 let html='<div class="family-list">';
 html+=`<div class="mini-card"><h3>Parents</h3>${parents.length?parents.map(id=>`<p><button onclick="selectPerson('${id}')">${esc(personName(id))}</button></p>`).join(''):'<p class="muted">No parents listed.</p>'}</div>`;
 html+=`<div class="mini-card"><h3>Spouses</h3>${fams.length?fams.map(f=>{const sid=f.husband===pid?f.wife:f.husband; return `<p><button onclick="selectPerson('${sid}')">${esc(personName(sid))}</button><br><span class="muted">${esc(f.marriage?.date||'')} ${esc(f.marriage?.place||'')}</span></p>`}).join(''):'<p class="muted">No spouses listed.</p>'}</div>`;
 html+=`<div class="mini-card"><h3>Children by family</h3>${fams.length?fams.map(f=>{const sid=f.husband===pid?f.wife:f.husband; const kids=f.children||[]; return `<div class="family-child-group"><h4>With ${esc(personName(sid))}</h4>${kids.length?kids.map(id=>`<p><button onclick="selectPerson('${id}')">${esc(personName(id))}</button></p>`).join(''):'<p class="muted">No children listed for this family.</p>'}</div>`}).join(''):'<p class="muted">No children listed.</p>'}</div>`;
 html+='</div>'; $('#familyPanel').innerHTML=html;
}
function renderPedigree(){
 function node(pid,depth){
   if(!pid||depth>6)return '';
   const p=state.peopleById[pid]; if(!p)return '';
   const parents=getConfirmedParents(pid);
   return `<li><button onclick="selectPerson('${pid}')">${esc(displayName(p))}</button> <span class="muted">${esc(years(p))}</span>${parents.length?`<ul>${parents.map(id=>node(id,depth+1)).join('')}</ul>`:''}</li>`;
 }
 $('#pedigree').innerHTML=`<ul>${node(state.selectedPersonId,0)}</ul><p class="muted">Pedigree view shows confirmed/most-likely parent links only. Hypothetical or unknown upstream links are shown as research leads.</p>`;
}
function renderPeopleTable(){
 const q=$('#peopleSearch').value||'', conf=$('#confidenceFilter').value||'', line=$('#lineFilter').value||'';
 let arr=searchPeople(q).filter(p=>(!conf||p.confidence===conf)&&(!line||(p.lineTags||[]).includes(line)));
 $('#peopleTable').innerHTML=`<thead><tr><th>Name</th><th>Birth</th><th>Death</th><th>Line</th><th>Confidence</th><th>Status</th></tr></thead><tbody>`+arr.map(p=>{const b=safeBirth(p); return `<tr><td><button onclick="selectPerson('${p.id}')">${esc(displayName(p))}</button></td><td>${esc(b?.date||'')}${isLivingPrivate(p)?'<span class="muted">Living details hidden</span>':''}<br><span class="muted">${esc(b?.place||'')}</span></td><td>${esc(p.death?.date||'')}<br><span class="muted">${esc(p.death?.place||'')}</span></td><td>${esc((p.lineTags||[]).join(', '))}</td><td>${confidenceChip(p.confidence)}</td><td>${esc(p.researchStatus||'')}</td></tr>`}).join('')+`</tbody>`;
}
function renderDNA(){
 $('#dnaList').innerHTML=DATA.dnaClusters.map(c=>{
  const members=(c.members||[]).length?`<h4>Members</h4><ul>${c.members.map(m=>`<li><strong>${esc(m.name)}</strong>${m.kit?` — ${esc(m.kit)}`:''}${m.role?` <span class="muted">${esc(m.role)}</span>`:''}</li>`).join('')}</ul>`:'';
  const comparisons=(c.comparisons||[]).length?`<h4>Segment comparisons</h4><div class="table-wrap"><table><thead><tr><th>Pair</th><th>Chr</th><th>Start</th><th>End</th><th>cM</th><th>SNPs</th><th>Notes</th></tr></thead><tbody>${c.comparisons.map(x=>`<tr><td>${esc(x.pair)}</td><td>${esc(x.chromosome)}</td><td>${esc(x.start??'')}</td><td>${esc(x.end??'')}</td><td>${esc(x.centimorgans||x.totalHIR||'')}</td><td>${esc(x.snps||'')}</td><td>${esc(x.notes||'')}</td></tr>`).join('')}</tbody></table></div>`:'';
  const next=(c.nextSteps||[]).length?`<h4>Next steps</h4><ul>${c.nextSteps.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
  const span=(c.start&&c.end)?`${esc(c.start)}–${esc(c.end)}`:'unbounded / close-family comparison';
  return `<div class="mini-card dna-card"><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><div class="chips"><span class="chip">Chr ${esc(c.chromosome)}</span><span class="chip">${span}</span><span class="chip warn">${esc(c.status)}</span>${c.confidence?`<span class="chip">${esc(c.confidence)}</span>`:''}</div>${members}${comparisons}${c.interpretation?`<h4>Interpretation</h4><p>${esc(c.interpretation)}</p>`:''}${next}</div>`;
 }).join('');
}
function sourceLinksForTarget(t){
 const links=(t.sourceLinks||[]).map(l=>`<a class="source-link" target="_blank" rel="noopener" href="${esc(l.url)}">${esc(l.label||l.url)}</a>`).join('');
 return links || '<span class="muted">No source links yet.</span>';
}
function renderResearch(){
 $('#researchList').innerHTML=DATA.researchTargets.map(t=>`<div class="mini-card research-card" id="target-${esc(t.id)}"><h3>${esc(t.title)}</h3><div class="research-grid"><label>Priority<select onchange="updateTargetField('${t.id}','priority',this.value)">${['High','Medium','Low'].map(x=>`<option ${t.priority===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Status<input value="${esc(t.status||'Open')}" onchange="updateTargetField('${t.id}','status',this.value)"></label></div><p>${esc(t.summary)}</p><h4>Potential sources</h4><div class="source-links">${sourceLinksForTarget(t)}</div><h4>Work notes</h4><textarea rows="4" placeholder="Add latest search results, calls, document notes, or next action..." oninput="stageTargetNote('${t.id}',this.value)">${esc((t.workingNote||''))}</textarea><div class="row-actions"><button onclick="saveTargetNote('${t.id}')">Save note</button><button class="secondary" onclick="copyTarget('${t.id}')">Copy target summary</button></div>${(t.log||[]).length?`<h4>Saved log</h4><ul class="target-log">${t.log.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</div>`).join('');
}
window.updateTargetField=(id,field,value)=>{ const t=DATA.researchTargets.find(x=>x.id===id); if(!t)return; t[field]=value; saveLocal(); };
window.stageTargetNote=(id,value)=>{ const t=DATA.researchTargets.find(x=>x.id===id); if(t)t.workingNote=value; };
window.saveTargetNote=(id)=>{ const t=DATA.researchTargets.find(x=>x.id===id); if(!t)return; const note=(t.workingNote||'').trim(); if(note){ t.log=t.log||[]; t.log.unshift(new Date().toLocaleDateString()+': '+note); t.workingNote=''; saveLocal(); } };
window.copyTarget=(id)=>{ const t=DATA.researchTargets.find(x=>x.id===id); if(!t)return; const links=(t.sourceLinks||[]).map(l=>`${l.label}: ${l.url}`).join('\n'); navigator.clipboard?.writeText(`${t.title}\nPriority: ${t.priority}\nStatus: ${t.status}\n\n${t.summary}\n\nSources:\n${links}`); alert('Target summary copied.'); };
function renderSources(){
 const q=($('#sourceSearch').value||'').toLowerCase();
 const arr=DATA.sources.filter(s=>!q||[s.title,s.author,s.publication,(s.notes||[]).join(' ')].join(' ').toLowerCase().includes(q));
 $('#sourceList').innerHTML=arr.slice(0,250).map(s=>`<div class="source-card"><h3>${esc(s.title||s.id)}</h3><p class="muted">${esc(s.author||'')} ${esc(s.publication||'')}</p>${(s.notes||[]).length?`<p>${esc(s.notes.join(' '))}</p>`:''}</div>`).join('');
}
function renderEditForm(){
 const p=state.peopleById[state.selectedPersonId]; if(!p||!$('#editForm'))return;
 const b=p.birth||{};
 $('#editForm').innerHTML=`<label>Name<input name="name" value="${esc(p.name)}"></label><label>Public label for living/private display<input name="publicLabel" value="${esc(p.publicLabel||'')}"></label><label>Surname<input name="surn" value="${esc(p.surn||'')}"></label><label><input type="checkbox" name="living" ${p.living?'checked':''}> Living person</label><label><input type="checkbox" name="publicPermission" ${p.publicPermission?'checked':''}> Permission to show full name/details publicly</label><label>Birth date<input name="birthDate" value="${esc(b.date||'')}"></label><label>Birth place<input name="birthPlace" value="${esc(b.place||'')}"></label><label>Death date<input name="deathDate" value="${esc(p.death?.date||'')}"></label><label>Death place<input name="deathPlace" value="${esc(p.death?.place||'')}"></label><label>Confidence<select name="confidence">${DATA.confidenceLevels.map(c=>`<option ${p.confidence===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Research status<textarea name="researchStatus" rows="3">${esc(p.researchStatus||'')}</textarea></label><label>Notes<textarea name="notes" rows="7">${esc((p.notes||[]).join('\n\n'))}</textarea></label><button type="submit">Save selected person</button>`;
 $('#editForm').onsubmit=e=>{e.preventDefault(); const fd=new FormData(e.target); p.name=fd.get('name'); p.publicLabel=fd.get('publicLabel'); p.surn=fd.get('surn'); p.living=!!fd.get('living'); p.publicPermission=!!fd.get('publicPermission'); p.birth=p.birth||{}; p.death=p.death||{}; p.birth.date=fd.get('birthDate'); p.birth.place=fd.get('birthPlace'); p.death.date=fd.get('deathDate'); p.death.place=fd.get('deathPlace'); p.confidence=fd.get('confidence'); p.researchStatus=fd.get('researchStatus'); p.notes=String(fd.get('notes')||'').split(/\n\s*\n/).filter(Boolean); saveLocal(); alert('Saved in this browser. Export JSON to publish.'); };
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
 const p={id,name:fd.get('name'),publicLabel:fd.get('publicLabel')||'',givn:'',surn:fd.get('surn'),sex:fd.get('sex'),birth:{date:fd.get('birthDate'),place:fd.get('birthPlace')},death:{date:fd.get('deathDate'),place:''},burial:{},famc:[],fams:[],notes:[fd.get('note')].filter(Boolean),sources:[],facts:[],media:[],generationFromRoot:null,isDirectAncestor:false,living:!!fd.get('living'),publicPermission:!!fd.get('publicPermission'),confidence:fd.get('confidence'),researchStatus:'Added manually',lineTags:fd.get('lineTag')?[fd.get('lineTag')]:[]};
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
 e.preventDefault(); const fd=new FormData(e.target); const links=String(fd.get('links')||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{ const parts=line.split('|').map(x=>x.trim()); return {label:parts[0]||'Source',url:parts[1]||parts[0],why:parts[2]||''}; });
 DATA.researchTargets.push({id:'RT_'+Date.now(),title:fd.get('title'),priority:fd.get('priority'),status:fd.get('status'),summary:fd.get('summary'),sourceLinks:links,workingNote:'',log:[]}); saveLocal(); e.target.reset();
}
function downloadFamilySubmission(e){
 e.preventDefault(); const fd=new FormData(e.target);
 const submission={
   type:'WilliamsProject family contribution',
   submittedAt:new Date().toISOString(),
   submitter:{name:fd.get('submitterName'),email:fd.get('submitterEmail'),permissionToContact:!!fd.get('contactOk')},
   connection:{knownAncestor:fd.get('knownAncestor'),path:fd.get('connectionPath'),surnames:fd.get('surnames'),locations:fd.get('locations')},
   privacy:{livingDefault:'Living people must be reviewed before public display.',publicPermission:fd.get('publicPermission')},
   familyMembers:fd.get('familyMembers'),
   dna:fd.get('dna'),
   sources:fd.get('sources'),
   notes:fd.get('notes')
 };
 const blob=new Blob([JSON.stringify(submission,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='williamsproject-family-submission-'+slug(fd.get('submitterName')||'relative')+'.json'; a.click(); URL.revokeObjectURL(a.href);
}
function exportData(){ const blob=new Blob([JSON.stringify(DATA,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='williamsproject-data.json'; a.click(); URL.revokeObjectURL(a.href); }
function importData(e){ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{try{DATA=JSON.parse(reader.result); saveLocal(); alert('Imported and saved to this browser.');}catch(err){alert('Import failed: '+err.message)}}; reader.readAsText(file); }
init();

(() => {
  const section = document.getElementById('life-section');
  const databaseUrl='https://fitness-tracker-a10c9-default-rtdb.firebaseio.com/life-data';
  const now = new Date();
  let lifeView='tracker', statsPeriod='month';
  let year=now.getFullYear(), month=now.getMonth(), period='month', entries=[], storageError=false;
  let ready=false, busy=false, syncMessage='Loading saved data…';
  async function request(path, options={}) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(`${databaseUrl}${path}.json`,{...options,signal:controller.signal});
      if(!response.ok) throw Error(`Database request failed (${response.status})`);
      return await response.json();
    } finally {clearTimeout(timer);}
  }
  async function load() {
    try {
      const data=await request('/entries');
      entries=Object.entries(data||{}).map(([id,e])=>({...e,id}));
      ready=true;syncMessage='Saved to cloud';render();
    } catch(error) {ready=false;syncMessage='Could not load cloud data. Check your connection and retry.';render();}
  }
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthName = m => new Date(2026,m,1).toLocaleDateString('en-US',{month:'long'});
  const key = m => `${year}-${String(m+1).padStart(2,'0')}`;
  function bounds() { const count = period === 'month' ? 1 : period === 'quarter' ? 3 : 12; return {count, start:period === 'year' ? 0 : period === 'quarter' ? Math.floor(month/3)*3 : month}; }
  async function save(next) {
    if(!ready||busy) return false;
    const previous=new Map(entries.map(e=>[e.id,e]));
    const following=new Map(next.map(e=>[e.id,e]));
    const changes={};
    for(const [id,entry] of following) if(JSON.stringify(entry)!==JSON.stringify(previous.get(id))) changes[id]=entry;
    for(const id of previous.keys()) if(!following.has(id)) changes[id]=null;
    busy=true;setBusy();status('Saving…');
    try {
      // Only changed entry IDs are patched; no root or fitness writes.
      await request('/entries',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes)});
      entries=next;syncMessage='Saved to cloud';return true;
    } catch(error) {syncMessage='Could not confirm save. Your details remain here; retry when connected.';status(syncMessage);return false;}
    finally {busy=false;setBusy();}
  }
  function setBusy() {
    section.querySelectorAll('button, select, input, textarea').forEach(el=>{
      if(busy) {el.dataset.wasDisabled=String(el.disabled);el.disabled=true;}
      else if('wasDisabled' in el.dataset) {el.disabled=el.dataset.wasDisabled==='true';delete el.dataset.wasDisabled;}
    });
  }
  function status(text) {document.getElementById('life-status').textContent=text;}
  function detailsEditor(type, items) {
    const label=type==='people'?'Interaction':'Experience';
    return `<form class="life-note-form life-form"><label>Choose ${label.toLowerCase()}<select name="entry">${items.map((e,i)=>`<option value="${esc(e.id)}">${label} ${i+1}${e.title?' · '+esc(e.title):''}</option>`).join('')}</select></label><label>${type==='people'?'Who did you see?':'What did you try?'}<input name="title" maxlength="160" placeholder="Optional" value="${esc(items[0].title||'')}"></label><label>A note<textarea name="notes" rows="2" maxlength="2000" placeholder="Anything to remember (optional)">${esc(items[0].notes||'')}</textarea></label><button class="life-button" type="submit">Save details</button></form>`;
  }
  function render() {
    const tracking=lifeView==='tracker';
    period=tracking?'month':statsPeriod;
    const {count,start}=bounds();
    const months=Array.from({length:count},(_,i)=>key(start+i));
    const selected=entries.filter(e=>months.includes(e.month));
    const total=type=>selected.filter(e=>e.type===type).length;
    const title=period==='month'?`${monthName(month)} ${year}`:period==='quarter'?`Q${Math.floor(month/3)+1} · ${year}`:`${year}`;
    section.innerHTML=`<p class="life-intro">Make room for your people.<br>Try something for the first time.</p>
      <div class="tabs" aria-label="People and experiences views">${['tracker','stats'].map(v=>`<button class="life-view-tab ${lifeView===v?'active':''}" data-life-view="${v}" aria-pressed="${lifeView===v}">${v==='tracker'?'Tracker':'Stats'}</button>`).join('')}</div>
      ${!tracking?`<div class="life-periods" aria-label="Summary period">${['month','quarter','year'].map(p=>`<button data-life-period="${p}" aria-pressed="${period===p}">${p==='month'?'Month':p==='quarter'?'Quarter':'Year'}</button>`).join('')}</div>`:''}
      <div class="week-selector"><button id="life-prev" aria-label="Previous period">←</button><div class="week-display-range" style="flex:1;text-align:center">${title}</div><button id="life-next" aria-label="Next period">→</button></div>
      ${[['people','Friends & family',4,'A conversation, a meal, or time together.'],['experience','New experiences',2,'Something you haven’t tried before.']].map(([type,label,goal,description])=>`<div class="card"><h2 class="life-heading">${label}</h2><p class="life-muted">${description}</p>
      <div class="life-counter">${tracking?`<button class="life-count-button" data-count="${type}" data-delta="-1" aria-label="Decrease ${label}" ${entries.filter(e=>e.type===type&&e.month===key(month)).length===0?'disabled':''}>−</button>`:''}<div class="life-goal">${total(type)} <small>/ ${goal*count} ${count===1?'this month':period==='quarter'?'this quarter':'this year'}</small></div>${tracking?`<button class="life-count-button life-plus" data-count="${type}" data-delta="1" aria-label="Increase ${label}">+</button>`:''}</div>
      <div class="progress-bar-container"><div class="progress-bar" style="width:${Math.min(100,total(type)/(goal*count)*100)}%"></div></div><p class="life-muted">${Math.max(0,goal*count-total(type))===0?'Goal reached ✦':`${Math.max(0,goal*count-total(type))} more to reach your goal`} · ${goal} each month</p>
      ${tracking&&total(type)>0?`<details class="life-details" data-details="${type}"><summary>Optional details${selected.some(e=>e.type===type&&(e.title||e.notes))?' · '+selected.filter(e=>e.type===type&&(e.title||e.notes)).length+' noted':''}</summary><p class="life-muted">Add context to any count, whenever you like.</p>${detailsEditor(type, selected.filter(e=>e.type===type))}</details>`:''}</div>`).join('')}
      ${count>1?`<div class="card"><h2 class="section-title">Month by month</h2>${months.map((m,i)=>`<div class="life-summary"><button class="life-month-link" data-open-month="${start+i}">${monthName(start+i)}</button><span>${entries.filter(e=>e.month===m&&e.type==='people').length}/4 people · ${entries.filter(e=>e.month===m&&e.type==='experience').length}/2 experiences</span></div>`).join('')}</div>`:''}
      <p class="life-status" id="life-status" role="status">${esc(syncMessage)}</p>
      ${!ready?'<button class="life-button" id="life-retry">Retry connection</button>':''}`;
    const retry=document.getElementById('life-retry');if(retry) retry.onclick=load;
    if(!ready) section.querySelectorAll('[data-count]').forEach(b=>b.disabled=true);
    section.querySelectorAll('[data-life-view]').forEach(b=>b.onclick=()=>{lifeView=b.dataset.lifeView;render();});
    section.querySelectorAll('[data-open-month]').forEach(b=>b.onclick=()=>{month=Number(b.dataset.openMonth);lifeView='tracker';render();});
    section.querySelectorAll('[data-life-period]').forEach(b=>b.onclick=()=>{statsPeriod=b.dataset.lifePeriod;render();});
    const navigate=direction=>{const d=new Date(year,month+direction*count,1);year=d.getFullYear();month=d.getMonth();render();};
    document.getElementById('life-prev').onclick=()=>navigate(-1);
    document.getElementById('life-next').onclick=()=>navigate(1);
    section.querySelectorAll('[data-count]').forEach(button=>button.onclick=async()=>{
      const type=button.dataset.count, delta=Number(button.dataset.delta);
      if(delta===1) {
        if(await save([...entries,{id:crypto.randomUUID(),type,month:key(month),title:'',notes:''}])) {render();status('Saved to cloud. Details are optional.');}
      } else {
        const matching=entries.filter(e=>e.type===type&&e.month===key(month));
        // Remove an unannotated count first to preserve recorded memories.
        const removed=matching.filter(e=>!e.title&&!e.notes).at(-1)||matching.at(-1);
        if(!removed) return;
        const index=entries.indexOf(removed);
        if(await save(entries.filter(e=>e.id!==removed.id))) {
          render(); const out=document.getElementById('life-status'); out.textContent='Count removed. ';
          const undo=document.createElement('button'); undo.className='life-button';undo.textContent='Undo';
          undo.onclick=async()=>{ const next=[...entries];next.splice(index,0,removed);if(await save(next))render(); };out.append(undo);
        }
      }
    });
    section.querySelectorAll('.life-note-form').forEach(form=>{
      const picker=form.elements.entry, titleInput=form.elements.title, notesInput=form.elements.notes;
      let activeId=picker.value;
      const drafts=new Map();
      picker.onchange=()=>{
        drafts.set(activeId,{title:titleInput.value,notes:notesInput.value});
        activeId=picker.value;
        const entry=drafts.get(activeId)||entries.find(e=>e.id===activeId);
        titleInput.value=entry.title||'';notesInput.value=entry.notes||'';
      };
      form.onsubmit=async e=>{
        e.preventDefault();
        if(await save(entries.map(entry=>entry.id===activeId?{...entry,title:titleInput.value.trim(),notes:notesInput.value.trim()}:entry))) {
          drafts.delete(activeId);
          const type=form.closest('details').dataset.details;
          const matching=entries.filter(entry=>entry.type===type&&entry.month===key(month));
          Array.from(picker.options).forEach((option,i)=>{option.textContent=`${type==='people'?'Interaction':'Experience'} ${i+1}${matching[i].title?' · '+matching[i].title:''}`;});
          const noted=matching.filter(entry=>entry.title||entry.notes).length;
          form.closest('details').querySelector('summary').textContent='Optional details'+(noted?` · ${noted} noted`:'');
          status('Details saved to cloud. Count unchanged.');
        }
      };
    });
  }
  document.getElementById('nav-life').onclick=()=>switchSection(true);
  document.getElementById('nav-fitness').onclick=()=>switchSection(false);
  function switchSection(life) { document.getElementById('fitness-section').hidden=life;section.hidden=!life;document.getElementById('nav-life').setAttribute('aria-pressed',String(life));document.getElementById('nav-fitness').setAttribute('aria-pressed',String(!life));document.querySelector('header h1').innerHTML=life?'Connect.<br><em>Stay curious.</em>':'Move.<br><em>Feel alive.</em>';window.scrollTo(0,0); }
  render();
  load();
})();

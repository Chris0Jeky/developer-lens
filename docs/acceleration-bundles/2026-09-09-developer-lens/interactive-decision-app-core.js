const DATA = window.DEVELOPER_LENS_DECK_DATA
const KEY = 'developer-lens-decision-deck-v1'
const recommended = Object.fromEntries(DATA.decisions.map(d => [d.id, d.options.find(o=>o.recommended)?.id ?? null]))
let state = loadState()

function initialState(){
  return Object.fromEntries(DATA.decisions.map(d=>[d.id,{
    selected: recommended[d.id], status:'proposed-default', confirmed:false, notes:''
  }]))
}
function loadState(){
  try{
    const parsed = JSON.parse(localStorage.getItem(KEY))
    return parsed && typeof parsed==='object' ? {...initialState(),...parsed} : initialState()
  }catch{return initialState()}
}
function save(){ localStorage.setItem(KEY,JSON.stringify(state)); updateProgress(); updateHandoff() }
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function slugClass(s){return String(s).replace(/[^a-z0-9_-]/gi,'-')}

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b))
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===b.dataset.view))
  history.replaceState(null,'','#'+b.dataset.view)
}))
const initialView = location.hash.slice(1)
if(initialView && document.getElementById(initialView)) document.querySelector(`.tab[data-view="${initialView}"]`)?.click()

function renderMetrics(){
  const s=DATA.snapshot
  const cards=[
    [s.pullRequestCounts.merged,'Merged PRs',''],
    [s.issueCounts.open,'Open issues',''],
    [s.openIssuePortfolio.withoutMilestone,'Without milestones','alert'],
    [s.openIssuePortfolio.withoutLabels,'Unlabelled','alert'],
    [s.releaseCount,'Releases','alert'],
    [s.pullRequestCounts.open,'Open PR','']
  ]
  document.getElementById('metrics').innerHTML=cards.map(([n,l,c])=>`<div class="metric ${c}"><div class="num">${n}</div><div class="label">${l}</div></div>`).join('')
}

function fillSelect(id,values){
  const sel=document.getElementById(id)
  ;[...new Set(values)].sort().forEach(v=>sel.insertAdjacentHTML('beforeend',`<option value="${esc(v)}">${esc(v)}</option>`))
}
function renderIssues(){
  fillSelect('clusterFilter',DATA.issues.map(i=>i.cluster))
  fillSelect('milestoneFilter',DATA.issues.map(i=>i.proposedMilestone))
  fillSelect('horizonFilter',DATA.issues.map(i=>i.proposedHorizon))
  ;['issueSearch','clusterFilter','milestoneFilter','horizonFilter'].forEach(id=>document.getElementById(id).addEventListener('input',filterIssues))
  filterIssues()
}
function filterIssues(){
  const q=document.getElementById('issueSearch').value.toLowerCase().trim()
  const c=document.getElementById('clusterFilter').value
  const m=document.getElementById('milestoneFilter').value
  const h=document.getElementById('horizonFilter').value
  const rows=DATA.issues.filter(i=>
    (!q || (`#${i.number} ${i.title}`).toLowerCase().includes(q)) &&
    (!c||i.cluster===c)&&(!m||i.proposedMilestone===m)&&(!h||i.proposedHorizon===h)
  )
  document.getElementById('issueRows').innerHTML=rows.map(i=>`<tr>
    <td><a href="${esc(i.url)}" target="_blank" rel="noreferrer">#${i.number}</a></td>
    <td class="title">${esc(i.title)}</td>
    <td><span class="pill">${esc(i.cluster)}</span></td>
    <td>${esc(i.proposedMilestone)}</td>
    <td><span class="pill ${slugClass(i.proposedHorizon)}">${esc(i.proposedHorizon)}</span></td>
    <td><span class="pill ${slugClass(i.severity)}">${esc(i.severity)}</span></td>
  </tr>`).join('')
  const counts={}
  rows.forEach(i=>counts[i.cluster]=(counts[i.cluster]||0)+1)
  document.getElementById('portfolioSummary').innerHTML=
    `<span class="pill">${rows.length} shown</span>`+
    Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="pill">${esc(k)} · ${v}</span>`).join('')
}

function renderDecisionFilters(){
  fillSelect('areaFilter',DATA.decisions.map(d=>d.area))
  ;['decisionSearch','areaFilter','statusFilter'].forEach(id=>document.getElementById(id).addEventListener('input',renderDecisions))
}
function visibleDecisions(){
  const q=document.getElementById('decisionSearch').value.toLowerCase().trim()
  const area=document.getElementById('areaFilter').value
  const status=document.getElementById('statusFilter').value
  return DATA.decisions.filter(d=>{
    const st=state[d.id]||initialState()[d.id]
    return (!q||(`${d.id} ${d.area} ${d.title} ${d.context}`).toLowerCase().includes(q)) &&
      (!area||d.area===area)&&(!status||st.status===status)
  })
}
function renderDecisions(){
  const root=document.getElementById('decisionCards')
  root.innerHTML=visibleDecisions().map(d=>{
    const st=state[d.id]
    return `<article class="decision ${esc(st.status)}" data-id="${esc(d.id)}">
      <div class="decision-top"><div><div class="decision-id">${esc(d.id)} · ${esc(d.area)}</div><h3>${esc(d.title)}</h3></div><div class="status">${esc(st.status)}</div></div>
      <div class="context">${esc(d.context)}</div>
      <div class="rec"><b>Recommendation:</b> ${esc(d.recommendation)}</div>
      <div class="options">${d.options.map(o=>`<label class="option"><input type="radio" name="${esc(d.id)}" value="${esc(o.id)}" ${st.selected===o.id?'checked':''}><span><b>${esc(o.label)}${o.recommended?' · recommended':''}</b><span>${esc(o.description)}</span></span></label>`).join('')}</div>
      <input class="note" type="text" value="${esc(st.notes)}" placeholder="Optional owner note or condition…" aria-label="Notes for ${esc(d.id)}">
      <div class="decision-actions">
        <button class="btn primary confirm">Confirm selection</button>
        <button class="btn defer">Defer</button>
        <button class="btn reset">Reset</button>
      </div>
    </article>`
  }).join('')
  root.querySelectorAll('.decision').forEach(card=>{
    const id=card.dataset.id
    card.querySelectorAll('input[type=radio]').forEach(r=>r.addEventListener('change',()=>{
      state[id].selected=r.value
      state[id].confirmed=false
      state[id].status=r.value===recommended[id]?'proposed-default':'changed-unconfirmed'
      save();renderDecisions()
    }))
    card.querySelector('.note').addEventListener('input',e=>{state[id].notes=e.target.value;save()})
    card.querySelector('.confirm').addEventListener('click',()=>{state[id].confirmed=true;state[id].status='confirmed';save();renderDecisions()})
    card.querySelector('.defer').addEventListener('click',()=>{state[id].confirmed=false;state[id].status='deferred';save();renderDecisions()})
    card.querySelector('.reset').addEventListener('click',()=>{state[id]={selected:recommended[id],status:'proposed-default',confirmed:false,notes:''};save();renderDecisions()})
  })
  updateProgress()
}

function updateProgress(){
  const confirmed=Object.values(state).filter(s=>s.status==='confirmed').length
  const pct=Math.round(confirmed/DATA.decisions.length*100)
  document.getElementById('decisionProgress').style.width=pct+'%'
  document.getElementById('progressLabel').textContent=`${confirmed} of ${DATA.decisions.length} decisions confirmed · ${pct}%`
}
function decisionExport(){
  return {
    schemaVersion:'DeveloperLensDecisionExport.v1',
    project:DATA.snapshot.repository,
    generatedAt:new Date().toISOString(),
    sourceSnapshot:DATA.snapshot.observedAt,
    decisions:DATA.decisions.map(d=>{
      const st=state[d.id]
      const opt=d.options.find(o=>o.id===st.selected)
      return {
        decisionId:d.id, area:d.area, title:d.title,
        selectedOptionId:st.status==='deferred'?null:st.selected,
        selectedOptionLabel:st.status==='deferred'?null:(opt?.label??null),
        status:st.status,
        rationale:st.notes || (st.status==='proposed-default'
          ? d.recommendation
          : st.status==='deferred'
            ? 'Deferred without additional rationale.'
            : opt?.description || ''),
        confirmedByOwner:st.status==='confirmed',
        notes:st.notes||''
      }
    })
  }
}
function markdownExport(){
  const x=decisionExport()
  let out=`# Developer Lens decision export\n\nGenerated: ${x.generatedAt}\nProject: \`${x.project}\`\nSnapshot: ${x.sourceSnapshot}\n\n`
  for(const d of x.decisions){
    out+=`## ${d.decisionId} — ${d.title}\n\n- Status: \`${d.status}\`\n- Selection: ${d.selectedOptionLabel??'Deferred'}\n- Confirmed by owner: ${d.confirmedByOwner?'yes':'no'}\n- Rationale: ${d.rationale}\n`
    if(d.notes) out+=`- Notes: ${d.notes}\n`
    out+='\n'
  }
  return out
}
function download(name,text,type){
  const blob=new Blob([text],{type})
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
async function copyText(text,button){
  try{await navigator.clipboard.writeText(text);const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1100)}
  catch{window.prompt('Copy this text:',text)}
}

document.getElementById('confirmVisible').addEventListener('click',()=>{
  visibleDecisions().forEach(d=>{state[d.id].confirmed=true;state[d.id].status='confirmed'})
  save();renderDecisions()
})
document.getElementById('exportJson').addEventListener('click',()=>download('developer-lens-decisions.json',JSON.stringify(decisionExport(),null,2),'application/json'))
document.getElementById('exportMd').addEventListener('click',()=>download('developer-lens-decisions.md',markdownExport(),'text/markdown'))
document.getElementById('copyJson').addEventListener('click',e=>copyText(JSON.stringify(decisionExport(),null,2),e.currentTarget))
document.getElementById('resetAll').addEventListener('click',()=>{if(confirm('Reset every decision to the unconfirmed recommended default?')){state=initialState();save();renderDecisions()}})

function renderQueue(){
  document.getElementById('queue').innerHTML=DATA.workQueue.map(t=>`<div class="queue-item">
    <div class="queue-id">${esc(t.phase)}<br>${esc(t.id)}</div>
    <div><b>${esc(t.title)}</b><span>${esc(t.output)}</span></div>
    <span class="pill">${t.humanGate?'human gate':'agent'}</span>
  </div>`).join('')
}
function updateHandoff(){
  const exp=decisionExport()
  const confirmed=exp.decisions.filter(d=>d.status==='confirmed')
  const proposed=exp.decisions.filter(d=>d.status==='proposed-default')
  const changed=exp.decisions.filter(d=>d.status==='changed-unconfirmed')
  const deferred=exp.decisions.filter(d=>d.status==='deferred')
  const handoff={
    schemaVersion:'DeveloperLensAgentHandoff.v1',
    generatedAt:new Date().toISOString(),
    repository:DATA.snapshot.repository,
    sourceSnapshot:DATA.snapshot,
    decisionSummary:{
      confirmed:confirmed.map(d=>d.decisionId),
      proposedDefaults:proposed.map(d=>d.decisionId),
      changedUnconfirmed:changed.map(d=>d.decisionId),
      deferred:deferred.map(d=>d.decisionId)
    },
    decisions:exp.decisions,
    queue:DATA.workQueue,
    hardStops:[
      'No real/private activation before #201 and #202',
      'No release tag before Chris0Jeky/developer-lens::HUMAN_TODO.md::q-10(c)',
      'No public non-C0 output',
      'No individual ranking/person inference',
      'No Taskdeck write without exact integration authority'
    ],
    firstInstruction:'Refresh live state before applying this snapshot. Treat only confirmed decisions as owner authority.'
  }
  document.getElementById('handoffPreview').value=JSON.stringify(handoff,null,2)
  return handoff
}
document.getElementById('downloadHandoff').addEventListener('click',()=>download('developer-lens-agent-handoff.json',JSON.stringify(updateHandoff(),null,2),'application/json'))
document.getElementById('copyHandoff').addEventListener('click',e=>copyText(JSON.stringify(updateHandoff(),null,2),e.currentTarget))
document.getElementById('printDeck').addEventListener('click',()=>window.print())

renderMetrics();renderIssues();renderDecisionFilters();renderDecisions();renderQueue();updateHandoff()

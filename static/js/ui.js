// ── Expiry dropdown ────────────────────────────────────────────────────
function buildExpiryDropdown(){
  const sel=document.getElementById('i-expiry');
  sel.innerHTML='';
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOW2=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today=new Date(); today.setHours(0,0,0,0);
  let d=new Date(today);
  const expDay=symCfg().expiryDay;
  while(d.getDay()!==expDay) d.setDate(d.getDate()+1);
  for(let i=0;i<12;i++){
    const opt=document.createElement('option');
    const yy=d.getFullYear(),mm=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
    opt.value=`${yy}-${mm}-${dd}`;
    opt.textContent=`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} (${DOW2[d.getDay()]})`;
    sel.appendChild(opt);
    d.setDate(d.getDate()+7);
  }
  st.expiry=sel.value;
  buildDateRangeSlider();
}

function buildPosExpiryDropdown(){
  const sel=document.getElementById('pos-expiry');
  if(!sel) return;
  const cur=sel.value;
  sel.innerHTML='';
  const main=document.getElementById('i-expiry');
  if(main) Array.from(main.options).forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.value; opt.textContent=o.textContent;
    sel.appendChild(opt);
  });
  if(cur) sel.value=cur;
}

// ── Strike pills ──────────────────────────────────────────────────────
function buildStrikePills(){
  const atm=Math.round((st.strike||st.spot)/st.step)*st.step;
  const cands=[-3,-2,-1,0,1,2,3].map(i=>atm+i*st.step);
  activeStrikes=new Set(cands);
  const c=document.getElementById('strike-pills');
  c.innerHTML='';
  cands.forEach(s=>{
    const b=document.createElement('button');
    b.className='spill on'+(s===atm?' atm':'');
    b.textContent='₹'+s.toLocaleString('en-IN');
    b.onclick=()=>{
      if(activeStrikes.has(s)){if(activeStrikes.size>1)activeStrikes.delete(s);}
      else activeStrikes.add(s);
      b.classList.toggle('on',activeStrikes.has(s));
      refresh();
    };
    c.appendChild(b);
  });
}

function strikeColor(K){
  const atm=Math.round((st.strike||st.spot)/st.step)*st.step;
  const allStrikes=[-3,-2,-1,0,1,2,3].map(i=>atm+i*st.step);
  const idx=allStrikes.indexOf(K);
  return PALETTE[idx>=0?idx:0];
}

// ── Tab switching ──────────────────────────────────────────────────────
function switchTab(t){
  currentTab=t;
  const tabs=['selector','decay','positions'];
  document.querySelectorAll('.tab-btn').forEach((b,i)=>b.classList.toggle('on',i===tabs.indexOf(t)));
  tabs.forEach(id=>document.getElementById('tab-'+id).classList.toggle('on',id===t));
  if(t==='decay') buildDecayCharts();
  if(t==='positions'){
    buildPositionsTab();
    if(positions.length) fetchAllPositionChains();
  }
}

function setType(t){
  liveStrikes={};
  liveIV={};
  st.type=t;
  document.getElementById('btn-call').classList.toggle('on',t==='call');
  document.getElementById('btn-put').classList.toggle('on',t==='put');
  buildTargetSlider(); refresh();
}

function setSymbol(sym){
  st.symbol=sym;
  document.getElementById('btn-nifty').classList.toggle('on',sym==='NIFTY');
  document.getElementById('btn-banknifty').classList.toggle('on',sym==='BANKNIFTY');
  document.getElementById('lot-size-label').textContent=symCfg().lotSize;
  st.step=symCfg().step;
  document.getElementById('i-step').value=st.step;
  liveStrikes={}; liveIV={}; liveStrikesByExpiry={}; liveIVByExpiry={};
  st.strike=null;
  buildExpiryDropdown();
  fetchLive(true);
}

// ── Positions state ───────────────────────────────────────────────────
function setPosType(t){
  posType=t;
  document.getElementById('pos-call-btn').classList.toggle('on',t==='call');
  document.getElementById('pos-put-btn').classList.toggle('on',t==='put');
}

function setPosSide(s){
  posSide=s;
  document.getElementById('pos-buy-btn').classList.toggle('on',s==='buy');
  document.getElementById('pos-sell-btn').classList.toggle('on',s==='sell');
}

// ── Auto-fill targets ─────────────────────────────────────────────────
function buildTargetSlider(){
  const spot=st.spot||24300, step=st.step||50;
  const rng=Math.round(spot*0.12/step)*step;
  const min=Math.round((spot-rng)/step)*step;
  const max=Math.round((spot+rng)/step)*step;
  const loEl=document.getElementById('sl-tp-low');
  const hiEl=document.getElementById('sl-tp-high');
  loEl.min=hiEl.min=min; loEl.max=hiEl.max=max;
  // Default: put → low=−3%, high=−1%; call → low=+1%, high=+3%
  loEl.value=st.type==='put'?Math.round(spot*0.97/step)*step:Math.round(spot*1.01/step)*step;
  hiEl.value=st.type==='put'?Math.round(spot*0.99/step)*step:Math.round(spot*1.03/step)*step;
  st.tp1=parseFloat(loEl.value); st.tp2=parseFloat(hiEl.value);
  updateRangeFill(); updateRangeLabels();
}

function updateRangeFill(){
  const lo=document.getElementById('sl-tp-low');
  const hi=document.getElementById('sl-tp-high');
  const fill=document.getElementById('range-fill');
  if(!lo||!hi||!fill) return;
  const min=parseFloat(lo.min),max=parseFloat(lo.max);
  const lp=(parseFloat(lo.value)-min)/(max-min)*100;
  const hp=(parseFloat(hi.value)-min)/(max-min)*100;
  fill.style.left=lp+'%'; fill.style.width=(hp-lp)+'%';
}

function updateRangeLabels(){
  const lo=st.tp1||0,hi=st.tp2||0;
  const isPut=st.type==='put';
  document.getElementById('tp-low-lbl').textContent='₹'+lo.toLocaleString('en-IN');
  document.getElementById('tp-high-lbl').textContent='₹'+hi.toLocaleString('en-IN');
  document.getElementById('tp-low-tag').innerHTML=isPut
    ?'<span class="rv-tag tag-agg">Aggressive</span>'
    :'<span class="rv-tag tag-con">Conservative</span>';
  document.getElementById('tp-high-tag').innerHTML=isPut
    ?'<span class="rv-tag tag-con">Conservative</span>'
    :'<span class="rv-tag tag-agg">Aggressive</span>';
  document.getElementById('range-hint').textContent=isPut
    ?'lower = aggressive · upper = conservative'
    :'upper = aggressive · lower = conservative';
}

function onTargetSlider(){
  const loEl=document.getElementById('sl-tp-low');
  const hiEl=document.getElementById('sl-tp-high');
  let lo=parseFloat(loEl.value),hi=parseFloat(hiEl.value);
  const step=st.step||50;
  if(lo>=hi){
    if(document.activeElement===loEl){lo=hi-step;loEl.value=lo;}
    else{hi=lo+step;hiEl.value=hi;}
  }
  st.tp1=lo; st.tp2=hi;
  updateRangeFill(); updateRangeLabels(); refresh();
}

function buildDateRangeSlider(){
  if(!st.expiry) return;
  const max=totalDays()*3+2;
  const loEl=document.getElementById('sl-date-low');
  const hiEl=document.getElementById('sl-date-high');
  if(!loEl||!hiEl) return;
  loEl.min=hiEl.min=0; loEl.max=hiEl.max=max;

  // Find first valid market slot (skip weekends from today)
  let firstSlot=0;
  for(let i=0;i<=max;i++){
    const d=sliderToDateTime(i);
    const day=d.getDay();
    if(day>=1&&day<=5){firstSlot=i;break;}
  }
  loEl.value=firstSlot;
  hiEl.value=max;
  st.earlyDays=firstSlot;
  st.lateDays=max;

  updateDateFill();
  document.getElementById('date-low-lbl').textContent=fmtDateTime(sliderToDateTime(firstSlot));
  document.getElementById('date-high-lbl').textContent=fmtDateTime(sliderToDateTime(max));
}

function onDateRangeSlider(){
  const loEl=document.getElementById('sl-date-low');
  const hiEl=document.getElementById('sl-date-high');
  let lo=parseInt(loEl.value),hi=parseInt(hiEl.value);
  if(lo>=hi){
    if(document.activeElement===loEl){lo=Math.max(0,hi-1);loEl.value=lo;}
    else{hi=Math.min(parseInt(hiEl.max),lo+1);hiEl.value=hi;}
  }
  st.earlyDays=lo; st.lateDays=hi;
  updateDateFill();
  document.getElementById('date-low-lbl').textContent=fmtDateTime(sliderToDateTime(lo));
  document.getElementById('date-high-lbl').textContent=fmtDateTime(sliderToDateTime(hi));
  refresh();
}

function updateDateFill(){
  const loEl=document.getElementById('sl-date-low');
  const hiEl=document.getElementById('sl-date-high');
  const fill=document.getElementById('date-fill');
  if(!loEl||!hiEl||!fill) return;
  const min=0,max=parseFloat(loEl.max);
  const lp=(parseFloat(loEl.value)-min)/max*100;
  const hp=(parseFloat(hiEl.value)-min)/max*100;
  fill.style.left=lp+'%'; fill.style.width=(hp-lp)+'%';
}

function flashSet(id,val,key){
  const el=document.getElementById(id);if(!el)return;
  el.value=val;st[key]=typeof val==='string'?val:parseFloat(val);
  el.classList.add('updated');setTimeout(()=>el.classList.remove('updated'),2000);
}

function toIST(d){return new Date(d.toLocaleString('en-US',{timeZone:'Asia/Kolkata'}))}

function isMktOpen(d){
  const ist=toIST(d),day=ist.getDay(),m=ist.getHours()*60+ist.getMinutes();
  return day>0&&day<6&&m>=555&&m<=930;
}

function parseMarketSamples(){
  const now=new Date();
  const expiryEnd=new Date(st.expiry+'T15:30:00+05:30');
  if(expiryEnd<=now) return{dates:[],labels:[],expiryEnd};
  const STEP=15*60*1000;
  const dates=[new Date(now)],labels=['Now'];
  const dfmt=new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
  const tfmt=new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata',hour12:false});
  let cur=new Date(Math.ceil(now.getTime()/STEP)*STEP);
  while(cur<=expiryEnd){
    if(isMktOpen(cur)){dates.push(new Date(cur));labels.push(dfmt.format(cur)+' '+tfmt.format(cur));}
    cur=new Date(cur.getTime()+STEP);
  }
  return{dates,labels,expiryEnd};
}

function totalDays(){
  const [ey,em,ed]=st.expiry.split('-').map(Number);
  const exp=new Date(ey,em-1,ed);
  const today=new Date(); today.setHours(0,0,0,0);
  return Math.max(Math.round((exp-today)/86400000),1);
}

function sliderToDateTime(val){
  const dayOff=Math.floor(val/3),slot=SLOTS[val%3];
  const d=new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate()+dayOff);
  d.setHours(slot.h,slot.m,0,0);
  return d;
}

function fmtDateTime(d){
  const slot=SLOTS.find(s=>s.h===d.getHours()&&s.m===d.getMinutes());
  return d.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' · '+DOW[d.getDay()]+(slot?' · '+slot.lbl:'');
}

// ── Inputs ────────────────────────────────────────────────────────────
function onInput(key,val){
  if(key==='expiry'){st[key]=val||null;buildDateRangeSlider();}
  else{const v=parseFloat(val);st[key]=(!isNaN(v)&&v>0)?v:null;}
  if(['spot','strike','step'].includes(key)){buildStrikePills();buildTargetSlider();}
  refresh();
}

function savePositions(){
  try{localStorage.setItem('nifty_positions',JSON.stringify(positions));}catch(e){}
}

function loadPositions(){
  try{const d=localStorage.getItem('nifty_positions');if(d)positions=JSON.parse(d);}
  catch(e){positions=[];}
}

function addPosition(){
  const strike=parseFloat(document.getElementById('pos-strike').value);
  const entry=parseFloat(document.getElementById('pos-entry').value);
  const lots=parseInt(document.getElementById('pos-lots').value)||1;
  const expiry=document.getElementById('pos-expiry').value;
  if(!strike||!entry||!expiry){alert('Please fill in all fields.');return;}
  positions.push({
    id:Date.now(), strike, type:posType, side:posSide,
    expiry, entryPrice:entry, lots
  });
  savePositions();
  buildPositionsTab();
  document.getElementById('pos-strike').value='';
  document.getElementById('pos-entry').value='';
}

function removePosition(id){
  positions=positions.filter(p=>p.id!==id);
  savePositions();
  buildPositionsTab();
}

function posCurrentValue(pos){
  const{strike,type,side,expiry,entryPrice,lots}=pos;
  const ivKey=strike+'_'+type;
  const sig=liveIVByExpiry[expiry]?.[ivKey]||liveIV[strike]||(st.iv||15)/100;
  const r=(st.rate||6.5)/100;
  const expiryEnd=new Date(expiry+'T15:30:00+05:30');
  const T=Math.max((expiryEnd-new Date())/(365*24*3600*1000),0);
  // Check global expiry liveStrikes first, then per-expiry store
  const globalLive=expiry===st.expiry?liveStrikes[strike]:null;
  const expiryLive=liveStrikesByExpiry[expiry]?.[strike];
  const liveData=globalLive||expiryLive;
  let cur,source;
  if(liveData){
    const bid=type==='put'?liveData.put_bid??liveData.bid:liveData.call_bid??liveData.bid;
    const ask=type==='put'?liveData.put_ask??liveData.ask:liveData.call_ask??liveData.ask;
    if(side==='buy'&&bid>0){cur=bid;source='BID';}
    else if(side==='sell'&&ask>0){cur=ask;source='ASK';}
    else{cur=r2(bs(st.spot,strike,T,r,sig,type));source='BS';}
  }else{cur=r2(bs(st.spot,strike,T,r,sig,type));source='BS';}
  const pnlUnit=side==='buy'?cur-entryPrice:entryPrice-cur;
  const lotSize=symCfg().lotSize;
  const pnl=r2(pnlUnit*lots*lotSize);
  const capital=r2(entryPrice*lots*lotSize);
  const pnlPct=entryPrice>0?r2(pnlUnit/entryPrice*100):0;
  return{cur:r2(cur),source,pnl,pnlPct,capital};
}

function countdownStr(expiry){
  const exp=new Date(expiry+'T15:30:00+05:30');
  const diff=exp-new Date();
  if(diff<=0) return{str:'Expired',urgent:true};
  const days=Math.floor(diff/(86400000));
  const hrs=Math.floor((diff%86400000)/3600000);
  const mins=Math.floor((diff%3600000)/60000);
  const urgent=days<2;
  const str=days>0?`${days}d ${hrs}h`:`${hrs}h ${mins}m`;
  return{str,urgent};
}
  
function buildPositionsTab(){
  buildPosExpiryDropdown();
  const tbody=document.getElementById('pos-body');
  if(!tbody) return;
  tbody.innerHTML='';
  let totalPnl=0,totalCapital=0;

  positions.forEach(pos=>{
    const{cur,source,pnl,pnlPct,capital}=posCurrentValue(pos);
    totalPnl+=pnl; totalCapital+=capital;
    const cl=pnl>0?'up':pnl<0?'dn':'neu';
    const srcCls=source==='BID'?'src-bid':source==='ASK'?'src-ask':'src-bs';
    const expiryLabel=pos.expiry; // ISO date
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><b>₹${pos.strike.toLocaleString('en-IN')}</b></td>
      <td>${pos.type==='put'?'▼ Put':'▲ Call'}</td>
      <td>${pos.side==='buy'?'<span class="up">Buy</span>':'<span class="dn">Sell</span>'}</td>
      <td style="font-size:11px">${expiryLabel}</td>
      <td>₹${pos.entryPrice.toFixed(2)}</td>
      <td>${pos.lots}</td>
      <td>₹${cur.toFixed(2)}</td>
      <td class="${cl}">${pnl>0?'+':''}₹${Math.abs(pnl).toLocaleString('en-IN')}</td>
      <td class="${cl}">${pnlPct>0?'+':''}${pnlPct.toFixed(1)}%</td>
      <td style="color:${countdownStr(pos.expiry).urgent?'var(--red)':'var(--text3)'}; font-weight:${countdownStr(pos.expiry).urgent?700:400}">${countdownStr(pos.expiry).str}</td>
      <td><span class="src-badge ${srcCls}">${source}</span></td>
      <td><button class="del-btn" onclick="removePosition(${pos.id})">×</button></td>`;
    tbody.appendChild(tr);
  });

    // Summary
  const rom=totalCapital>0?r2(totalPnl/totalCapital*100):0;
  const pnlEl=document.getElementById('sum-pnl');
  pnlEl.textContent=(totalPnl>0?'+':'')+'₹'+Math.abs(Math.round(totalPnl)).toLocaleString('en-IN');
  pnlEl.className='pval '+(totalPnl>0?'up':totalPnl<0?'dn':'neu');
  document.getElementById('sum-capital').textContent='₹'+Math.round(totalCapital).toLocaleString('en-IN');
  const romEl=document.getElementById('sum-rom');
  romEl.textContent=(rom>0?'+':'')+rom.toFixed(1)+'%';
  romEl.className='pval '+(rom>0?'up':rom<0?'dn':'neu');
  document.getElementById('sum-count').textContent=positions.length;
}

// ── Compute selector ──────────────────────────────────────────────────
function computeAll(){
  const{spot,iv,rate,type,step,strike,earlyDays,lateDays,tp1,tp2}=st;
  if(!spot||!st.expiry) return null;
  const sig=(iv||15)/100,r=(rate||6.5)/100;
  const atm=Math.round((strike||spot)/step)*step;
  const strikes=[...activeStrikes].sort((a,b)=>a-b);
  const expiry=new Date(st.expiry+'T15:30:00+05:30');
  const now=new Date();
  const T_full=Math.max((expiry-now)/(365*24*3600*1000),0);

  const optSpot=tp1||spot,conSpot=tp2||spot;
  const bestSpot=type==='put'?Math.min(optSpot,conSpot):Math.max(optSpot,conSpot);
  const worstSpot=type==='put'?Math.max(optSpot,conSpot):Math.min(optSpot,conSpot);
  const eDate=sliderToDateTime(earlyDays),lDate=sliderToDateTime(lateDays);
  const T_best=Math.max((expiry-eDate)/(365*24*3600*1000),0);
  const T_worst=Math.max((expiry-lDate)/(365*24*3600*1000),0);

  const datasets=strikes.map((K,i)=>{
    const kSig=strikeIV(K);
    const entry=entryPrice(K,kSig);
    const todayVal=entry.price;
    const entrySource=entry.source;
    const entrySpread=entry.spread;
    const bestVal =r2(bs(bestSpot, K,T_best, r,kSig,type));
    const worstVal=r2(bs(worstSpot,K,T_worst,r,kSig,type));
    const bestPnl=r2(bestVal-todayVal),worstPnl=r2(worstVal-todayVal);
    const bestPct=todayVal>0?r2(bestPnl/todayVal*100):0;
    const worstPct=todayVal>0?r2(worstPnl/todayVal*100):0;
    const breakeven=type==='put'?r2(K-todayVal):r2(K+todayVal);
    const prob=probProfit(spot,K,T_full,r,kSig,type);
    return{K,col:strikeColor(K),isATM:K===atm,
           todayVal,entrySource,entrySpread,
           bestPnl,worstPnl,bestPct,worstPct,breakeven,prob};
  });
  return{datasets,atm};
}

// ── Refresh (selector tab) ─────────────────────────────────────────────
function refresh(){
  document.getElementById('spot-label').textContent=Number(st.spot||24300).toLocaleString('en-IN');
  document.getElementById('spot-label2').textContent=Number(st.spot||24300).toLocaleString('en-IN');
  const res=computeAll();
  if(!res){if(selectorChart){selectorChart.destroy();selectorChart=null;}return;}
  const{datasets}=res;

  if(selectorChart) selectorChart.destroy();
  const ctx=document.getElementById('selector-chart').getContext('2d');
  selectorChart=new Chart(ctx,{
    type:'bar',
    data:{
      labels:datasets.map(d=>'₹'+d.K.toLocaleString('en-IN')),
      datasets:[
        {label:'Optimistic P&L %',
         data:datasets.map(d=>r2(d.bestPct)),
         backgroundColor:datasets.map(d=>d.bestPct>=0?'rgba(16,185,129,0.65)':'rgba(16,185,129,0.2)'),
         borderColor:'#10B981',borderWidth:1,borderRadius:4},
        {label:'Conservative P&L %',
         data:datasets.map(d=>r2(d.worstPct)),
         backgroundColor:datasets.map(d=>d.worstPct>=0?'rgba(96,165,250,0.65)':'rgba(96,165,250,0.2)'),
         borderColor:'#60A5FA',borderWidth:1,borderRadius:4},
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        annotation:{annotations:{zero:{type:'line',yMin:0,yMax:0,borderColor:'rgba(255,255,255,0.15)',borderWidth:1}}},
        legend:{labels:{color:'#F3F4F6',font:{size:11},usePointStyle:true,pointStyleWidth:10,boxHeight:6}},
        tooltip:{backgroundColor:'#1F2937',borderColor:'#374151',borderWidth:1,
          titleColor:'#9CA3AF',bodyColor:'#F9FAFB',
          callbacks:{label:ctx=>' '+ctx.dataset.label+': '+(ctx.parsed.y>0?'+':'')+ctx.parsed.y.toFixed(1)+'%'}}
      },
      scales:{
        x:{ticks:{color:'#D1D5DB',font:{size:11}},grid:{color:'rgba(55,65,81,0.5)'},border:{color:'#374151'}},
        y:{ticks:{color:'#D1D5DB',callback:v=>v+'%',font:{size:10}},grid:{color:'rgba(55,65,81,0.5)'},border:{color:'#374151'},
           title:{display:true,text:'P&L % of premium paid',color:'#9CA3AF',font:{size:10}}}
      }
    }
  });
  buildTable(res);
  if(currentTab==='decay') buildDecayCharts();
}

function strikeIV(K){
  return liveIV[K]||(st.iv||15)/100;
}

function entryPrice(K, sig){
  sig=sig||(st.iv||15)/100;
  const live=liveStrikes[K];
  if(live&&live.ask>0) return{price:live.ask,source:'ask',bid:live.bid,spread:r2(live.ask-live.bid)};
  const T=Math.max((new Date(st.expiry+'T15:30:00+05:30')-new Date())/(365*24*3600*1000),0);
  const p=r2(bs(st.spot,K,T,(st.rate||6.5)/100,sig,st.type));
  return{price:p,source:'bs',bid:null,spread:null};
}

// ── Table ─────────────────────────────────────────────────────────────
function buildTable({datasets,atm}){
  const maxBest=Math.max(...datasets.map(d=>d.bestPct));
  const tbody=document.getElementById('comp-body');
  tbody.innerHTML='';
  datasets.forEach(d=>{
    const isBest=d.bestPct===maxBest&&d.bestPct>0;
    const itmOtm=d.K===atm?'atm':(st.type==='put'?d.K>atm:d.K<atm)?'itm':'otm';
    const badge=`<span class="badge badge-${itmOtm}">${itmOtm.toUpperCase()}</span>`;
    const ivPct=(liveIV[d.K]?liveIV[d.K]*100:st.iv||15).toFixed(1);
    const ivSrc=liveIV[d.K]?'live':'manual';
    const fmtPnl=(pnl,pct)=>{
      const cl=pnl>0?'up':pnl<0?'dn':'neu';
      return`<span class="${cl}">${pnl>0?'+':''}₹${Math.abs(pnl).toFixed(2)}</span>
             <span style="font-size:10px;color:${pnl>0?'var(--green)':pnl<0?'var(--red)':'var(--text3)'};margin-left:4px">(${pct>0?'+':''}${pct.toFixed(0)}%)</span>`;
    };
    const tr=document.createElement('tr');
    if(isBest) tr.className='best-row';
    tr.innerHTML=`
      <td>
        <b>₹${d.K.toLocaleString('en-IN')}</b>${badge}${isBest?'<span class="best-tag">★ Best</span>':''}
        <div style="font-size:10px;color:var(--text4);margin-top:2px">IV ${ivPct}% <span style="color:${ivSrc==='live'?'var(--green)':'var(--text4)'}">(${ivSrc})</span></div>
      </td>
      <td>
        ₹${d.todayVal.toFixed(2)}
        ${d.entrySource==='ask'
          ?`<span class="badge badge-itm" style="font-size:8px">ASK</span>
            <div style="font-size:10px;color:var(--text4)">spread ₹${d.entrySpread?.toFixed(2)||'—'}</div>`
          :`<span class="badge badge-otm" style="font-size:8px">BS</span>`}
      </td>
      <td>₹${d.breakeven.toLocaleString('en-IN')}</td>
      <td>${fmtPnl(d.bestPnl,d.bestPct)}</td>
      <td>${fmtPnl(d.worstPnl,d.worstPct)}</td>
      <td class="${d.bestPct>100?'up':d.bestPct>0?'neu':'dn'}">${d.bestPct.toFixed(0)}%</td>
      <td class="${d.prob>40?'up':d.prob>20?'neu':'dn'}">${d.prob.toFixed(0)}%</td>`;
    tbody.appendChild(tr);
  });
}

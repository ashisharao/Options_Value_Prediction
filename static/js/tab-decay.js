// ── Decay charts ──────────────────────────────────────────────────────
function buildDecayCharts(){
  const{spot,iv,rate,type,step,strike}=st;
  if(!spot||!st.expiry) return;
  const sig=(iv||15)/100,r=(rate||6.5)/100;
  const atm=Math.round((strike||spot)/step)*step;
  const strikes=[...activeStrikes].sort((a,b)=>a-b);
  const{dates,labels,expiryEnd}=parseMarketSamples();
  if(!dates.length) return;

  // Build session boundary points from now to expiry
  const fmtD=d=>{const ist=toIST(d);return `${ist.getDate()} ${MNAMES[ist.getMonth()]} · ${DOW[ist.getDay()]}`;};
  const now2=new Date();
  const bndry=[];
  const tmp=new Date(now2); tmp.setHours(0,0,0,0);
  while(tmp<=expiryEnd){
    const day=tmp.getDay();
    if(day>=1&&day<=5){
      [[9,15,'open'],[12,0,'noon'],[15,30,'close']].forEach(([h,m,tp])=>{
        const t=new Date(tmp); t.setHours(h,m,0,0);
        if(t>=now2&&t<=expiryEnd) bndry.push({t,tp});
      });
    }
    tmp.setDate(tmp.getDate()+1);
  }

  // Build intervals between consecutive boundaries
  const sessionLabels=[],sessionDrops=strikes.map(()=>[]);
  for(let i=0;i<bndry.length-1;i++){
    const from=bndry[i],to=bndry[i+1];
    const fromD=fmtD(from.t),toD=fmtD(to.t);
    let lbl;
    if(from.tp==='open'&&to.tp==='noon')       lbl=`${fromD} · Open→Noon`;
    else if(from.tp==='noon'&&to.tp==='close') lbl=`${fromD} · Noon→Close`;
    else                                        lbl=`${fromD} Close → ${toD} Open`;
    sessionLabels.push(lbl);
    const T0=Math.max((expiryEnd-from.t)/(365*24*3600*1000),0);
    const T1=Math.max((expiryEnd-to.t) /(365*24*3600*1000),0);
    strikes.forEach((K,si)=>{
      const drop=r2(Math.max(timeVal(spot,K,T0,r,sig,type)-timeVal(spot,K,T1,r,sig,type),0));
      sessionDrops[si].push(drop);
    });
  }

  if(decayBarChart) decayBarChart.destroy();
  const ctx2=document.getElementById('decay-bar-chart').getContext('2d');
  decayBarChart=new Chart(ctx2,{
    type:'bar',
    data:{
      labels:sessionLabels,
      datasets:strikes.map((K,i)=>({
        label:'₹'+K.toLocaleString('en-IN'),
        data:sessionDrops[i],
        backgroundColor:strikeColor(K)+'99',
        borderColor:strikeColor(K),
        borderWidth:1,borderRadius:2,
      }))
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'#F3F4F6',font:{size:10},usePointStyle:true,pointStyleWidth:8,boxHeight:5}},
        tooltip:{backgroundColor:'#1F2937',borderColor:'#374151',borderWidth:1,
          titleColor:'#9CA3AF',bodyColor:'#F9FAFB',
          callbacks:{label:ctx=>' '+ctx.dataset.label+': −₹'+ctx.parsed.y.toFixed(2)}}
      },
      scales:{
        x:{ticks:{color:'#9CA3AF',maxTicksLimit:10,maxRotation:45,font:{size:9}},grid:{color:'rgba(55,65,81,0.3)'},border:{color:'#374151'}},
        y:{ticks:{color:'#D1D5DB',callback:v=>st.decayMode==='norm'?v:Number(v).toLocaleString('en-IN'),font:{size:10}},grid:{color:'rgba(55,65,81,0.5)'},border:{color:'#374151'},
           title:{display:true,text:'Time value lost (₹)',color:'#9CA3AF',font:{size:10}}}
      }
    }
  });

  // Breakeven spot path
  const bkDatasets=strikes.map(K=>{
    const T_now=Math.max((expiryEnd-new Date())/(365*24*3600*1000),0);
    const V0=r2(bs(spot,K,T_now,r,sig,type));
    let prevS=spot;
    const vals=dates.map(d=>{
      const T=Math.max((expiryEnd-d)/(365*24*3600*1000),0);
      const s=invertBS(V0,K,T,r,sig,type,prevS);
      if(s!==null) prevS=s;
      return s;
    });
    return{
      label:'₹'+K.toLocaleString('en-IN'),
      data:vals,
      borderColor:strikeColor(K),
      borderWidth:K===atm?3:1.5,
      pointRadius:0,pointHoverRadius:4,
      tension:0.3,fill:false,spanGaps:false,
    };
  });

  if(breakevenChart) breakevenChart.destroy();
  const ctx3=document.getElementById('breakeven-chart').getContext('2d');
  breakevenChart=new Chart(ctx3,{
    type:'line',
    data:{labels,datasets:bkDatasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        annotation:{annotations:{
          spotLine:{type:'line',yMin:spot,yMax:spot,
            borderColor:'rgba(255,255,255,0.25)',borderWidth:1,borderDash:[4,4],
            label:{display:true,content:'Current spot ₹'+Number(spot).toLocaleString('en-IN'),
              position:'start',color:'rgba(255,255,255,0.4)',font:{size:9},
              backgroundColor:'transparent'}}
        }},
        legend:{labels:{color:'#F3F4F6',font:{size:11},usePointStyle:true,pointStyleWidth:10,boxHeight:6}},
        tooltip:{backgroundColor:'#1F2937',borderColor:'#374151',borderWidth:1,
          titleColor:'#9CA3AF',bodyColor:'#F9FAFB',
          callbacks:{
            title:items=>labels[items[0].dataIndex],
            label:ctx=>' '+ctx.dataset.label+': ₹'+(ctx.parsed.y||0).toLocaleString('en-IN')
          }}
      },
      scales:{
        x:{ticks:{color:'#D1D5DB',maxTicksLimit:12,maxRotation:0,font:{size:10}},
           grid:{color:'rgba(55,65,81,0.5)'},border:{color:'#374151'}},
        y:{ticks:{color:'#D1D5DB',callback:v=>Number(v).toLocaleString('en-IN'),font:{size:10}},
           grid:{color:'rgba(55,65,81,0.5)'},border:{color:'#374151'},
           title:{display:true,text:'Spot price needed (₹)',color:'#9CA3AF',font:{size:10}}}
      }
    }
  });

  // Info cards — today's time value per strike
  const now=new Date();
  const T_now=Math.max((expiryEnd-now)/(365*24*3600*1000),0);
  const info=document.getElementById('decay-info');
  info.innerHTML=strikes.map((K,i)=>{
    const price=r2(bs(spot,K,T_now,r,sig,type));
    const intr=intrinsic(spot,K,type);
    const tv=r2(price-intr);
    const tvPct=price>0?r2(Math.abs(tv)/price*100):0;
    const tvCol=tv>=0?strikeColor(K):'var(--red)';
    const tvNote=tv<0?'deep ITM discount':`${tvPct}% of ₹${price.toFixed(2)}`;
    return`<div class="decay-card">
      <div class="dlbl" style="color:${strikeColor(K)}">₹${K.toLocaleString('en-IN')}</div>
      <div class="dval" style="color:${tvCol}">₹${tv.toFixed(2)}</div>
      <div class="dsub">time value · ${tvNote}</div>
      <div class="dsub">intrinsic: ₹${intr.toFixed(2)}</div>
    </div>`;
  }).join('');

  buildLineChart();
}

// ── Line charts ───────────────────────────────────────────────────────
function buildLineChart(){
  if(!st.expiry) return;
  const{spot,iv,rate,type,step,strike}=st;
  const sig=(iv||15)/100,r=(rate||6.5)/100;
  const atm=Math.round((strike||spot)/step)*step;
  const strikes=[...activeStrikes].sort((a,b)=>a-b);
  const{dates,labels,expiryEnd}=parseMarketSamples();
  if(!dates.length) return;

  const tvDatasets=strikes.map(K=>{
    const rawVals=dates.map(d=>{
      const T=Math.max((expiryEnd-d)/(365*24*3600*1000),0);
      return r2(bs(spot,K,T,r,sig,type));
    });
    const base=rawVals[0]||1;
    const vals=st.decayMode==='norm'
      ?rawVals.map(v=>base>0?r2(v/base*100):0)
      :rawVals;
    return{
      label:'₹'+K.toLocaleString('en-IN'),
      data:vals,
      borderColor:strikeColor(K),
      backgroundColor:strikeColor(K)+'15',
      borderWidth:K===atm?3:1.5,
      pointRadius:0,pointHoverRadius:4,
      tension:0.3,fill:false,
    };
  });

  if(decayChart) decayChart.destroy();
  const ctx1=document.getElementById('decay-chart').getContext('2d');
  decayChart=new Chart(ctx1,{
    type:'line',
    data:{labels,datasets:tvDatasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{labels:{color:'#F3F4F6',font:{size:11},usePointStyle:true,pointStyleWidth:10,boxHeight:6}},
        tooltip:{backgroundColor:'#1F2937',borderColor:'#374151',borderWidth:1,
          titleColor:'#9CA3AF',bodyColor:'#F9FAFB',
          callbacks:{
            title:items=>labels[items[0].dataIndex],
            label:ctx=>` ${ctx.dataset.label}: ${st.decayMode==='norm'?ctx.parsed.y.toFixed(1):Number(ctx.parsed.y).toLocaleString('en-IN')}`
          }}
      },
      scales:{
        x:{ticks:{color:'#D1D5DB',maxTicksLimit:12,maxRotation:0,font:{size:10}},
           grid:{color:'rgba(55,65,81,0.5)'},border:{color:'#374151'}},
        y:{ticks:{color:'#D1D5DB',callback:v=>st.decayMode==='norm'?v:Number(v).toLocaleString('en-IN'),font:{size:10}},
           grid:{color:'rgba(55,65,81,0.5)'},border:{color:'#374151'},
           title:{display:true,text:st.decayMode==='norm'?'Normalised value (100 = today)':'Option value (₹)',color:'#9CA3AF',font:{size:10}}}
      }
    }
  });
}

function setDecayMode(m){
  st.decayMode=m;
  document.getElementById('btn-decay-abs').classList.toggle('on',m==='abs');
  document.getElementById('btn-decay-norm').classList.toggle('on',m==='norm');
  buildLineChart();  // only rebuild this one
}

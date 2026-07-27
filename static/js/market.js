// ── Live data ─────────────────────────────────────────────────────────
async function fetchLive(silent=false){
  const btn=document.getElementById('btn-live');
  const errEl=document.getElementById('live-err');
  btn.disabled=true; btn.textContent='⟳ Fetching…';
  if(!silent) errEl.style.display='none';
  try{
    const[mkt,chain]=await Promise.all([
      fetch('/api/market').then(r=>r.json()),
      fetch(`/api/chain?symbol=${st.symbol}`).then(r=>r.json())
    ]);
    const dot=document.getElementById('dot');
    dot.className='dot '+(mkt.market_open?'open':'closed');
    const vs=document.getElementById('v-status');
    vs.textContent=mkt.market_open?'Open':'Closed';
    vs.style.color=mkt.market_open?'var(--green)':'var(--red)';
    if(mkt.spot) document.getElementById('v-spot').textContent='₹'+mkt.spot.toLocaleString('en-IN');
    if(mkt.vix)  document.getElementById('v-vix').textContent=mkt.vix.toFixed(1);
    const spot=chain.spot||(st.symbol==='BANKNIFTY'?mkt.banknifty_spot:mkt.nifty_spot)||mkt.spot;
    if(spot) flashSet('i-spot',spot,'spot');
    if(chain.atm_iv){document.getElementById('v-iv').textContent=chain.atm_iv.toFixed(1)+'%';flashSet('i-iv',chain.atm_iv,'iv');}
    const atmFromSpot=Math.round(spot/(st.step||100))*(st.step||100);
    flashSet('i-strike', chain.atm_strike||atmFromSpot, 'strike');
    if(chain.expiry){
      const p=new Date(chain.expiry.replace(/-/g,' '));
      if(!isNaN(p)){
        const sel=document.getElementById('i-expiry');
        const iso=p.toISOString().split('T')[0];
        let best=sel.options[0];
        for(const opt of sel.options){if(opt.value>=iso){best=opt;break;}}
        sel.value=best.value; st.expiry=best.value;
        document.getElementById('v-expiry').textContent=best.textContent;
        document.getElementById('pill-exp').style.display='flex';
        buildDateRangeSlider();
      }
    }
    if(chain.error&&!silent){errEl.textContent='⚠ '+chain.error;errEl.style.display='block';}
    document.getElementById('live-ts').textContent='Updated '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    liveStrikes={};
    if(chain.strikes&&chain.strikes.length){
      chain.strikes.forEach(s=>{
        const key=s.strike;
        liveStrikes[key]=st.type==='put'
          ?{bid:s.put_bid, ask:s.put_ask, ltp:s.put_ltp}
          :{bid:s.call_bid, ask:s.call_ask, ltp:s.call_ltp};
      });
    }
    if(chain.strikes&&chain.strikes.length){
      chain.strikes.forEach(s=>{
        const iv=st.type==='put'?s.put_iv:s.call_iv;
        if(iv>0) liveIV[s.strike]=iv/100; // NSE returns % e.g. 14.2 → 0.142
      });
    }
    buildStrikePills(); buildTargetSlider(); refresh();
    if(positions.length) fetchAllPositionChains();
  }catch(e){
    if(!silent){const errEl=document.getElementById('live-err');errEl.textContent='⚠ Could not reach server.';errEl.style.display='block';}
  }finally{btn.disabled=false;btn.textContent='⟳ Refresh';}
}

async function fetchChainForExpiry(expiry, symbol='NIFTY'){
  if(!expiry) return;
  try{
    const chain=await fetch(`/api/chain?symbol=${symbol}&expiry=${expiry}`).then(r=>r.json());
    if(chain.error||!chain.strikes?.length) return;
    liveStrikesByExpiry[expiry]={};
    liveIVByExpiry[expiry]={};
    chain.strikes.forEach(s=>{
      liveStrikesByExpiry[expiry][s.strike]={
        call_bid:s.call_bid, call_ask:s.call_ask, call_ltp:s.call_ltp,
        put_bid:s.put_bid,   put_ask:s.put_ask,   put_ltp:s.put_ltp,
      };
      if(s.call_iv>0) liveIVByExpiry[expiry][s.strike+'_call']=s.call_iv/100;
      if(s.put_iv>0)  liveIVByExpiry[expiry][s.strike+'_put'] =s.put_iv/100;
    });
  }catch(e){ console.log('Chain fetch failed for expiry',expiry,e); }
}

async function fetchAllPositionChains(){
  const expiries=[...new Set(positions.map(p=>p.expiry))];
  // Don't re-fetch the global expiry — already fetched by fetchLive()
  const others=expiries.filter(e=>e!==st.expiry);
  await Promise.all(others.map(e=>fetchChainForExpiry(e,st.symbol)));
  buildPositionsTab();
}

function setAutoRefresh(){
  if(_refreshTimer){clearInterval(_refreshTimer);_refreshTimer=null;}
  const mins=parseInt(document.getElementById('auto-interval').value);
  if(mins>0){
    _refreshTimer=setInterval(()=>{
      if(is_market_open()) fetchLive(true);
    }, mins*60*1000);
  }
}

function is_market_open(){
  const now=new Date();
  const ist=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Kolkata'}));
  const day=ist.getDay(),m=ist.getHours()*60+ist.getMinutes();
  return day>=1&&day<=5&&m>=555&&m<=930;
}

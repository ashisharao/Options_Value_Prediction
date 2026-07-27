const PALETTE=['#60A5FA','#34D399','#F59E0B','#F87171','#A78BFA','#38BDF8','#E879F9'];
const SYMBOL_CONFIG={
  NIFTY:    {lotSize:75, step:100, expiryDay:2, ticker:'^NSEI',    label:'Nifty 50'},
  BANKNIFTY:{lotSize:15, step:100, expiryDay:3, ticker:'^NSEBANK', label:'Bank Nifty'}
};
function symCfg(){return SYMBOL_CONFIG[st.symbol||'NIFTY'];}

let st={symbol:'NIFTY',spot:24300,strike:null,expiry:'',iv:15,step:100,rate:6.5,
        type:'put',tp1:null,tp2:null,earlyDays:14,lateDays:21,decayMode:'abs'};
let liveStrikes={};  // strike → {bid, ask} from NSE
let liveIV={};  // strike → IV as decimal e.g. 0.142
let liveStrikesByExpiry={};  // expiry → {strike → {bid,ask,ltp}}
let liveIVByExpiry={};       // expiry → {strike → IV decimal}

let positions=[];
let posType='put', posSide='buy';

let selectorChart=null, decayChart=null, decayBarChart=null, breakevenChart=null;
let currentTab='selector';

let _refreshTimer=null;

// ── Time slot helpers ──────────────────────────────────────────────────
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SLOTS=[{h:9,m:15,lbl:'Open'},{h:12,m:0,lbl:'Noon'},{h:15,m:30,lbl:'Close'}];


// ── Black-Scholes ──────────────────────────────────────────────────────
function ncdf(x){
  const a=[0.254829592,-0.284496736,1.421413741,-1.453152027,1.061405429],p=0.3275911;
  const s=x<0?-1:1; x=Math.abs(x)/Math.SQRT2;
  const t=1/(1+p*x);
  return .5*(1+s*(1-(((((a[4]*t+a[3])*t+a[2])*t+a[1])*t+a[0])*t)*Math.exp(-x*x)));
}
function bs(S,K,T,r,sig,type){
  if(T<=0) return Math.max(type==='call'?S-K:K-S,0);
  const sq=sig*Math.sqrt(T),d1=(Math.log(S/K)+(r+.5*sig*sig)*T)/sq,d2=d1-sq;
  return type==='call'?S*ncdf(d1)-K*Math.exp(-r*T)*ncdf(d2):K*Math.exp(-r*T)*ncdf(-d2)-S*ncdf(-d1);
}
function intrinsic(S,K,type){return Math.max(type==='call'?S-K:K-S,0)}
function timeVal(S,K,T,r,sig,type){return Math.max(r2(bs(S,K,T,r,sig,type)-intrinsic(S,K,type)),0)}
function probProfit(S,K,T,r,sig,type){
  if(T<=0) return type==='put'?(S<K?100:0):(S>K?100:0);
  const sq=sig*Math.sqrt(T),d2=(Math.log(S/K)+(r-.5*sig*sig)*T)/sq;
  return r2(type==='put'?ncdf(-d2)*100:ncdf(d2)*100);
}
function invertBS(V0,K,T,r,sig,type,guess){
  if(V0<=0) return K;
  if(T<=0){ const s=type==='put'?K-V0:K+V0; return s>0?r2(s):null; }
  if(type==='put'&&V0>=K*Math.exp(-r*T)*0.9999) return null;
  let S=guess||K;
  for(let i=0;i<50;i++){
    const price=bs(S,K,T,r,sig,type);
    const diff=price-V0;
    if(Math.abs(diff)<0.001) return r2(S);
    const sq=sig*Math.sqrt(T);
    const d1=(Math.log(S/K)+(r+.5*sig*sig)*T)/sq;
    const delta=type==='call'?ncdf(d1):ncdf(d1)-1;
    if(Math.abs(delta)<1e-10) break;
    let Sn=S-diff/delta;
    Sn=Math.max(Sn,1); Sn=Math.min(Sn,K*5);
    if(Math.abs(Sn-S)<0.001) return r2(Sn);
    S=Sn;
  }
  return r2(S);
}
function r2(v){return Math.round(v*100)/100}

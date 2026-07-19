"""
Option P&L Surface — app.py (Render.com)
Pure FastAPI, no Gradio. Serves frontend + live market data API.
"""

import time, logging, os
from datetime import datetime
import pytz
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_app = FastAPI(title="Option PnL Surface")

# ── Cache ──────────────────────────────────────────────────────────────
_cache: dict = {}
def _get(key, ttl):
    e = _cache.get(key)
    return e["data"] if e and time.time()-e["ts"] < ttl else None
def _set(key, data):
    _cache[key] = {"data": data, "ts": time.time()}

# ── Helpers ────────────────────────────────────────────────────────────
def ist_now():
    return datetime.now(pytz.timezone("Asia/Kolkata"))

def is_market_open():
    now = ist_now()
    if now.weekday() >= 5: return False
    o = now.replace(hour=9,  minute=15, second=0, microsecond=0)
    c = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return o <= now <= c

def find_col(df, names):
    for n in names:
        if n in df.columns: return n
    for col in df.columns:
        if any(n.lower() in col.lower() for n in names): return col
    return None

def safe_float(v, d=0.0):
    try:
        f = float(v)
        return d if f != f else f
    except: return d

# ── Routes ─────────────────────────────────────────────────────────────
@_app.get("/", response_class=HTMLResponse)
@_app.get("/app", response_class=HTMLResponse)
async def serve_frontend():
    with open("static/index.html") as f:
        return HTMLResponse(f.read())

@_app.get("/health")
async def health():
    return {"status": "ok", "time_ist": ist_now().isoformat()}

@_app.get("/api/market")
async def get_market():
    cached = _get("market", 30)
    if cached: return cached
    result = {"spot": None, "vix": None, "market_open": is_market_open(),
              "source": None, "timestamp": ist_now().isoformat(), "error": None}
    try:
        import yfinance as yf
        spot = yf.Ticker("^NSEI").fast_info.get("last_price")
        vix  = yf.Ticker("^INDIAVIX").fast_info.get("last_price")
        if spot: result["spot"] = round(float(spot), 2)
        if vix:  result["vix"]  = round(float(vix),  2)
        result["source"] = "yfinance"
        logger.info(f"Market: spot={result['spot']} vix={result['vix']}")
    except Exception as exc:
        logger.error(f"yfinance: {exc}")
        result["error"] = str(exc)
    _set("market", result)
    return result

@_app.get("/api/chain")
async def get_chain(symbol: str = "NIFTY"):
    key = f"chain_{symbol.upper()}"
    cached = _get(key, 60)
    if cached: return cached
    result = {"symbol": symbol.upper(), "spot": None, "atm_strike": None,
              "atm_iv": None, "expiry": None, "strikes": [],
              "source": "nselib", "timestamp": ist_now().isoformat(), "error": None}
    try:
        from nselib import derivatives
        df = derivatives.nse_live_option_chain(symbol=symbol.upper(), oi_mode="full")
        if df is None or df.empty:
            result["error"] = "NSE returned empty data — markets may be closed or IP blocked."
            _set(key, result); return result

        spot_col   = find_col(df, ["underlyingValue", "underlying_value"])
        exp_col    = find_col(df, ["expiryDate", "expiry_date", "expiry"])
        strike_col = find_col(df, ["strikePrice", "strike_price", "strike"])
        call_ltp   = find_col(df, ["CE.lastPrice",         "CE.ltp"])
        put_ltp    = find_col(df, ["PE.lastPrice",         "PE.ltp"])
        call_iv    = find_col(df, ["CE.impliedVolatility", "CE.IV"])
        put_iv     = find_col(df, ["PE.impliedVolatility", "PE.IV"])
        call_oi    = find_col(df, ["CE.openInterest",      "CE.OI"])
        put_oi     = find_col(df, ["PE.openInterest",      "PE.OI"])

        if spot_col: result["spot"]   = round(safe_float(df[spot_col].iloc[0]), 2)
        if exp_col:  result["expiry"] = str(df[exp_col].iloc[0])

        if not strike_col:
            result["error"] = f"Cannot find strike col. Got: {list(df.columns)[:8]}"
            _set(key, result); return result

        spot = result["spot"] or 24000
        atm  = round(spot / 50) * 50
        result["atm_strike"] = atm

        strikes = []
        for _, row in df.iterrows():
            try:
                s = int(safe_float(row[strike_col]))
                strikes.append({
                    "strike":   s,
                    "call_ltp": round(safe_float(row[call_ltp]) if call_ltp else 0, 2),
                    "put_ltp":  round(safe_float(row[put_ltp])  if put_ltp  else 0, 2),
                    "call_iv":  round(safe_float(row[call_iv])  if call_iv  else 0, 2),
                    "put_iv":   round(safe_float(row[put_iv])   if put_iv   else 0, 2),
                    "call_oi":  int(safe_float(row[call_oi])    if call_oi  else 0),
                    "put_oi":   int(safe_float(row[put_oi])     if put_oi   else 0),
                    "is_atm":   s == atm,
                })
            except: continue

        result["strikes"] = sorted(strikes, key=lambda x: x["strike"])
        atm_rows = [s for s in result["strikes"] if s["strike"] == atm]
        if atm_rows:
            ivs = [v for v in [atm_rows[0]["call_iv"], atm_rows[0]["put_iv"]] if v > 0]
            result["atm_iv"] = round(sum(ivs)/len(ivs), 2) if ivs else None
        logger.info(f"Chain OK: {len(strikes)} strikes ATM={atm} IV={result['atm_iv']}")

    except ImportError:
        result["error"] = "nselib not installed"
    except Exception as exc:
        logger.error(f"Chain: {exc}")
        result["error"] = f"NSE fetch failed: {exc}. App works with manual inputs."

    _set(key, result)
    return result

# ── Entry point ────────────────────────────────────────────────────────
app = _app   # uvicorn looks for 'app'

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))

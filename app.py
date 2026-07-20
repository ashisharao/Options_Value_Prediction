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
        spot = yf.Ticker("^NSEI").history(period="1d")["Close"].iloc[-1]
        vix  = yf.Ticker("^INDIAVIX").history(period="1d")["Close"].iloc[-1]
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
              "source": "nse_direct", "timestamp": ist_now().isoformat(), "error": None}
    try:
        import requests
        hdrs = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.nseindia.com/",
        }
        s = requests.Session()
        s.get("https://www.nseindia.com/", headers=hdrs, timeout=10)
        r = s.get(
            f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol.upper()}",
            headers=hdrs, timeout=10
        )
        data = r.json()
        records = data["records"]
        spot = float(records["underlyingValue"])
        result["spot"] = round(spot, 2)
        result["expiry"] = records["expiryDates"][0]

        atm = round(spot / 50) * 50
        result["atm_strike"] = atm

        strikes = []
        for row in records["data"]:
            if row.get("expiryDate") != result["expiry"]:
                continue
            s_price = int(row["strikePrice"])
            ce = row.get("CE", {})
            pe = row.get("PE", {})
            strikes.append({
                "strike":   s_price,
                "call_ltp": round(float(ce.get("lastPrice", 0)), 2),
                "put_ltp":  round(float(pe.get("lastPrice", 0)), 2),
                "call_iv":  round(float(ce.get("impliedVolatility", 0)), 2),
                "put_iv":   round(float(pe.get("impliedVolatility", 0)), 2),
                "call_oi":  int(ce.get("openInterest", 0)),
                "put_oi":   int(pe.get("openInterest", 0)),
                "is_atm":   s_price == atm,
            })

        result["strikes"] = sorted(strikes, key=lambda x: x["strike"])
        atm_rows = [s for s in result["strikes"] if s["strike"] == atm]
        if atm_rows:
            ivs = [v for v in [atm_rows[0]["call_iv"], atm_rows[0]["put_iv"]] if v > 0]
            result["atm_iv"] = round(sum(ivs)/len(ivs), 2) if ivs else None
        logger.info(f"Chain OK: {len(strikes)} strikes ATM={atm} IV={result['atm_iv']}")

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

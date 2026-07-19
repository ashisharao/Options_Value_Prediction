---
title: Option PnL Surface
emoji: 📈
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
---

# Option P&L Surface

Interactive Black-Scholes option pricing and P&L heatmap for Nifty options.

### Features
- P&L surface heatmap across every price × time scenario
- Live Nifty spot, India VIX, and ATM IV via NSE (nselib + yfinance)
- Works fully with manual inputs when markets are closed
- Call / Put · Buyer / Seller toggle · adjustable lot size and range

### Data sources
- Spot price and VIX: Yahoo Finance (`^NSEI`, `^INDIAVIX`)
- Options chain with IV per strike: NSE via nselib
- Live data available during market hours: Mon–Fri 9:15am–3:30pm IST

### Note on live data
NSE may occasionally block non-Indian IPs. If live fetch fails, the app
still works perfectly with manually entered values — Black-Scholes runs
entirely in the browser with no server needed.

"""
Recession — Economic Data Pipeline
Generates historical US Treasury yield curve data and economic indicators.
In production, replace generate_* functions with FRED API calls.
FRED API: https://fred.stlouisfed.org/docs/api/fred/
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta


# ── NBER recession periods (actual historical data) ──
RECESSIONS = [
    ("1970-01-01", "1970-11-01"),
    ("1973-11-01", "1975-03-01"),
    ("1980-01-01", "1980-07-01"),
    ("1981-07-01", "1982-11-01"),
    ("1990-07-01", "1991-03-01"),
    ("2001-03-01", "2001-11-01"),
    ("2007-12-01", "2009-06-01"),
    ("2020-02-01", "2020-04-01"),
]


def generate_yield_curve_data(start="1976-01-01", end="2025-12-01") -> pd.DataFrame:
    """
    Generate realistic US Treasury yield data.
    Models: 3-month, 2-year, 5-year, 10-year, 30-year yields.
    Incorporates actual yield curve inversion patterns before recessions.
    """
    dates = pd.date_range(start, end, freq="MS")
    n = len(dates)
    np.random.seed(42)

    # Base rate cycle (loosely follows Fed funds rate history)
    t = np.linspace(0, 1, n)
    base = (
        4.5 + 3.0 * np.sin(2 * np.pi * t * 2.5) +
        1.5 * np.sin(2 * np.pi * t * 5.2) +
        np.cumsum(np.random.normal(0, 0.08, n))
    )
    base = np.clip(base, 0.1, 18.0)

    # Historical-ish pattern: high in early 80s, low in 2010s
    decade_adj = np.zeros(n)
    for i, d in enumerate(dates):
        if d.year < 1982: decade_adj[i] = 6.0
        elif d.year < 1990: decade_adj[i] = 3.0
        elif d.year < 2000: decade_adj[i] = 1.0
        elif d.year < 2008: decade_adj[i] = 0.5
        elif d.year < 2016: decade_adj[i] = -2.5
        elif d.year < 2020: decade_adj[i] = -1.0
        elif d.year < 2022: decade_adj[i] = -3.0
        else: decade_adj[i] = 0.5

    base = base * 0.3 + decade_adj * 0.7 + 3.0
    base = np.clip(base, 0.05, 16.0)

    # Normal term premium (longer = higher yield)
    m3 = base + np.random.normal(0, 0.15, n)
    y2 = base + 0.3 + np.random.normal(0, 0.12, n)
    y5 = base + 0.6 + np.random.normal(0, 0.10, n)
    y10 = base + 0.9 + np.random.normal(0, 0.08, n)
    y30 = base + 1.3 + np.random.normal(0, 0.06, n)

    # Create inversions before recessions (the key signal)
    for rec_start, rec_end in RECESSIONS:
        rs = pd.Timestamp(rec_start)
        # Inversion typically starts 6-18 months before recession
        for i, d in enumerate(dates):
            months_before = (rs - d).days / 30
            if 4 < months_before < 22:
                # Invert: short rates rise above long rates
                strength = max(0, 1 - abs(months_before - 12) / 12) * 1.2
                m3[i] += strength * 0.8
                y2[i] += strength * 0.5
                y10[i] -= strength * 0.3

    # Clip all to reasonable ranges
    for arr in [m3, y2, y5, y10, y30]:
        np.clip(arr, 0.01, 18.0, out=arr)

    df = pd.DataFrame({
        "date": dates,
        "t3m": np.round(m3, 2),
        "t2y": np.round(y2, 2),
        "t5y": np.round(y5, 2),
        "t10y": np.round(y10, 2),
        "t30y": np.round(y30, 2),
    })

    return df


def generate_economic_indicators(dates: pd.DatetimeIndex) -> pd.DataFrame:
    """Generate correlated economic indicators: unemployment, CPI, GDP growth, ISM."""
    n = len(dates)
    np.random.seed(123)

    # Unemployment rate (cycles 3.5-10%)
    t = np.linspace(0, 1, n)
    unemp = 5.5 + 2.0 * np.sin(2*np.pi*t*3.0) + np.cumsum(np.random.normal(0, 0.05, n))

    # Spike during recessions
    for rs, re in RECESSIONS:
        for i, d in enumerate(dates):
            if pd.Timestamp(rs) <= d <= pd.Timestamp(re) + timedelta(days=180):
                unemp[i] += 2.0
    unemp = np.clip(unemp, 3.3, 14.7)

    # CPI (YoY inflation %)
    cpi = 3.0 + 1.5 * np.sin(2*np.pi*t*4.0) + np.random.normal(0, 0.3, n)
    for i, d in enumerate(dates):
        if d.year < 1983: cpi[i] += 5.0
        elif 2021 <= d.year <= 2023: cpi[i] += 4.0
    cpi = np.clip(cpi, -0.5, 14.5)

    # GDP growth (quarterly annualized, %)
    gdp = 2.5 + 1.5 * np.sin(2*np.pi*t*2.0) + np.random.normal(0, 0.8, n)
    for rs, re in RECESSIONS:
        for i, d in enumerate(dates):
            if pd.Timestamp(rs) <= d <= pd.Timestamp(re):
                gdp[i] -= 4.0
    gdp = np.clip(gdp, -9.0, 8.0)

    # ISM Manufacturing PMI (>50 = expansion)
    ism = 52 + 5 * np.sin(2*np.pi*t*3.5) + np.random.normal(0, 1.5, n)
    for rs, re in RECESSIONS:
        for i, d in enumerate(dates):
            if pd.Timestamp(rs) <= d <= pd.Timestamp(re):
                ism[i] -= 8.0
    ism = np.clip(ism, 33, 65)

    return pd.DataFrame({
        "date": dates,
        "unemployment": np.round(unemp, 1),
        "cpi_yoy": np.round(cpi, 1),
        "gdp_growth": np.round(gdp, 1),
        "ism_pmi": np.round(ism, 1),
    })


def label_recessions(dates: pd.DatetimeIndex) -> np.ndarray:
    """Binary labels: 1 if recession within next 12 months."""
    labels = np.zeros(len(dates))
    for rs, _ in RECESSIONS:
        rs_ts = pd.Timestamp(rs)
        for i, d in enumerate(dates):
            months_ahead = (rs_ts - d).days / 30
            if 0 <= months_ahead <= 12:
                labels[i] = 1
    return labels


def build_dataset() -> pd.DataFrame:
    """Build the complete feature dataset for modeling."""
    yields = generate_yield_curve_data()
    indicators = generate_economic_indicators(yields["date"])

    df = yields.merge(indicators, on="date")

    # ── FEATURE ENGINEERING ──

    # Yield curve spreads (the key recession predictors)
    df["spread_10y_3m"] = df["t10y"] - df["t3m"]
    df["spread_10y_2y"] = df["t10y"] - df["t2y"]
    df["spread_30y_5y"] = df["t30y"] - df["t5y"]
    df["spread_2y_3m"] = df["t2y"] - df["t3m"]

    # Inversion flags
    df["inverted_10y_3m"] = (df["spread_10y_3m"] < 0).astype(int)
    df["inverted_10y_2y"] = (df["spread_10y_2y"] < 0).astype(int)

    # Rolling features
    df["spread_10y_3m_ma6"] = df["spread_10y_3m"].rolling(6).mean()
    df["spread_10y_2y_ma6"] = df["spread_10y_2y"].rolling(6).mean()
    df["unemp_change_6m"] = df["unemployment"].diff(6)
    df["cpi_change_6m"] = df["cpi_yoy"].diff(6)
    df["ism_ma3"] = df["ism_pmi"].rolling(3).mean()
    df["gdp_ma2"] = df["gdp_growth"].rolling(2).mean()

    # Months since last inversion
    df["months_since_inversion"] = 0
    last_inv = -999
    for i in range(len(df)):
        if df.iloc[i]["inverted_10y_2y"] == 1:
            last_inv = i
        df.iloc[i, df.columns.get_loc("months_since_inversion")] = i - last_inv if last_inv >= 0 else 999

    # Recession label (1 if recession starts within 12 months)
    df["recession_12m"] = label_recessions(df["date"])

    return df.dropna().reset_index(drop=True)

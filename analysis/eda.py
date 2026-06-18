"""
Recession — Exploratory Data Analysis
Full statistical analysis of yield curve and recession relationships.
Generates summary statistics, correlations, and analysis insights.
"""

import numpy as np
import pandas as pd
from scipy import stats


def run_eda(df: pd.DataFrame) -> dict:
    """Complete EDA producing structured results for the dashboard."""

    # ── SUMMARY STATISTICS ──
    desc = df[["t3m","t2y","t5y","t10y","t30y","spread_10y_3m","spread_10y_2y",
               "unemployment","cpi_yoy","gdp_growth","ism_pmi"]].describe()
    summary = {col: {stat: round(val, 3) for stat, val in desc[col].items()} for col in desc.columns}

    # ── YIELD CURVE ANALYSIS ──
    # Current state
    latest = df.iloc[-1]
    yield_curve_current = {
        "3M": round(float(latest["t3m"]), 2),
        "2Y": round(float(latest["t2y"]), 2),
        "5Y": round(float(latest["t5y"]), 2),
        "10Y": round(float(latest["t10y"]), 2),
        "30Y": round(float(latest["t30y"]), 2),
    }
    is_inverted = float(latest["spread_10y_2y"]) < 0

    # Inversion history
    inversions = df[df["inverted_10y_2y"] == 1]
    total_months_inverted = len(inversions)
    pct_inverted = round(total_months_inverted / len(df) * 100, 1)

    # ── CORRELATION ANALYSIS ──
    corr_features = ["spread_10y_3m","spread_10y_2y","spread_30y_5y",
                     "unemployment","cpi_yoy","gdp_growth","ism_pmi","recession_12m"]
    corr_matrix = df[corr_features].corr().round(3)
    corr_with_recession = corr_matrix["recession_12m"].drop("recession_12m").to_dict()
    corr_with_recession = {k: round(v, 3) for k, v in sorted(corr_with_recession.items(), key=lambda x: abs(x[1]), reverse=True)}

    # Full correlation matrix for heatmap
    corr_heatmap = []
    for i, row_name in enumerate(corr_features[:-1]):
        for j, col_name in enumerate(corr_features[:-1]):
            corr_heatmap.append({
                "x": col_name, "y": row_name,
                "value": round(float(corr_matrix.iloc[i, j]), 3)
            })

    # ── SPREAD DISTRIBUTION ──
    spread_hist = {"bins": [], "counts": []}
    counts, edges = np.histogram(df["spread_10y_2y"].dropna(), bins=30)
    spread_hist["bins"] = [round(float(e), 2) for e in edges[:-1]]
    spread_hist["counts"] = counts.tolist()

    # ── YIELD TIME SERIES ──
    yield_ts = []
    for _, row in df.iterrows():
        yield_ts.append({
            "date": str(row["date"].date()),
            "t3m": round(float(row["t3m"]), 2),
            "t2y": round(float(row["t2y"]), 2),
            "t10y": round(float(row["t10y"]), 2),
            "t30y": round(float(row["t30y"]), 2),
            "spread_10y_2y": round(float(row["spread_10y_2y"]), 2),
            "spread_10y_3m": round(float(row["spread_10y_3m"]), 2),
            "recession": int(row["recession_12m"]),
        })

    # ── ECONOMIC INDICATOR TIME SERIES ──
    econ_ts = []
    for _, row in df.iterrows():
        econ_ts.append({
            "date": str(row["date"].date()),
            "unemployment": round(float(row["unemployment"]), 1),
            "cpi_yoy": round(float(row["cpi_yoy"]), 1),
            "gdp_growth": round(float(row["gdp_growth"]), 1),
            "ism_pmi": round(float(row["ism_pmi"]), 1),
        })

    # ── STATISTICAL TESTS ──
    # T-test: spread during pre-recession vs normal periods
    rec_spread = df[df["recession_12m"] == 1]["spread_10y_2y"]
    norm_spread = df[df["recession_12m"] == 0]["spread_10y_2y"]
    t_stat, t_pval = stats.ttest_ind(rec_spread, norm_spread)

    # Chi-square: inversion vs recession
    ct = pd.crosstab(df["inverted_10y_2y"], df["recession_12m"])
    chi2, chi_p, _, _ = stats.chi2_contingency(ct) if ct.shape == (2, 2) else (0, 1, 0, None)

    # ── LEAD TIME ANALYSIS ──
    # How many months before recession did the curve first invert?
    from analysis.data_pipeline import RECESSIONS
    lead_times = []
    for rs, _ in RECESSIONS:
        rs_ts = pd.Timestamp(rs)
        # Find first inversion in the 24 months before
        pre = df[(df["date"] < rs_ts) & (df["date"] >= rs_ts - pd.DateOffset(months=24))]
        inv = pre[pre["inverted_10y_2y"] == 1]
        if len(inv) > 0:
            first_inv = inv.iloc[0]["date"]
            lead = (rs_ts - first_inv).days / 30
            lead_times.append({"recession": rs, "lead_months": round(float(lead), 1)})

    return {
        "summary_statistics": summary,
        "yield_curve_current": yield_curve_current,
        "is_inverted": is_inverted,
        "inversion_stats": {
            "total_months_inverted": total_months_inverted,
            "pct_time_inverted": pct_inverted,
            "total_months": len(df),
        },
        "correlation_with_recession": corr_with_recession,
        "correlation_heatmap": corr_heatmap,
        "spread_distribution": spread_hist,
        "yield_time_series": yield_ts,
        "economic_time_series": econ_ts,
        "statistical_tests": {
            "spread_ttest": {"t_stat": round(float(t_stat), 3), "p_value": round(float(t_pval), 6)},
            "inversion_chi2": {"chi2": round(float(chi2), 3), "p_value": round(float(chi_p), 6)},
        },
        "inversion_lead_times": lead_times,
        "date_range": {"start": str(df["date"].min().date()), "end": str(df["date"].max().date())},
        "n_observations": len(df),
    }

"""
Recession — API
Serves yield curve analysis, recession probability, and EDA results.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from analysis.data_pipeline import build_dataset
from analysis.model import RecessionModel
from analysis.eda import run_eda

app = FastAPI(title="Recession", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Build dataset and fit model on startup
print("Building dataset...")
DATA = build_dataset()
print(f"Dataset: {len(DATA)} observations, {DATA['date'].min().date()} to {DATA['date'].max().date()}")

print("Running EDA...")
EDA_RESULTS = run_eda(DATA)

print("Training model...")
MODEL = RecessionModel()
MODEL_RESULTS = MODEL.fit(DATA)
CURRENT = MODEL.predict_current(DATA)
print(f"Current recession probability: {CURRENT['probability']*100:.1f}% ({CURRENT['assessment']})")
print("Ready.")


@app.get("/")
async def health():
    return {"status": "running", "observations": len(DATA), "current_probability": CURRENT["probability"]}


@app.get("/overview")
async def overview():
    """Dashboard overview: current state + key metrics."""
    latest = DATA.iloc[-1]
    return {
        "current": CURRENT,
        "yield_curve": EDA_RESULTS["yield_curve_current"],
        "is_inverted": EDA_RESULTS["is_inverted"],
        "latest_indicators": {
            "unemployment": round(float(latest["unemployment"]), 1),
            "cpi_yoy": round(float(latest["cpi_yoy"]), 1),
            "gdp_growth": round(float(latest["gdp_growth"]), 1),
            "ism_pmi": round(float(latest["ism_pmi"]), 1),
        },
        "model_performance": MODEL_RESULTS["cv_metrics"],
        "n_observations": len(DATA),
        "date_range": EDA_RESULTS["date_range"],
    }


@app.get("/yields")
async def yields():
    """Yield curve time series data."""
    return {
        "time_series": EDA_RESULTS["yield_time_series"],
        "current": EDA_RESULTS["yield_curve_current"],
        "inversion_stats": EDA_RESULTS["inversion_stats"],
    }


@app.get("/indicators")
async def indicators():
    """Economic indicator time series."""
    return {
        "time_series": EDA_RESULTS["economic_time_series"],
        "summary": EDA_RESULTS["summary_statistics"],
    }


@app.get("/model")
async def model():
    """Full model results: probabilities, feature importance, evaluation."""
    return {
        "probability_series": MODEL_RESULTS["probability_series"],
        "current": CURRENT,
        "cv_metrics": MODEL_RESULTS["cv_metrics"],
        "full_metrics": MODEL_RESULTS["full_metrics"],
        "feature_importance": MODEL_RESULTS["feature_importance_gb"],
        "lr_coefficients": MODEL_RESULTS["lr_coefficients"],
        "roc_curve": MODEL_RESULTS["roc_curve"],
        "pr_curve": MODEL_RESULTS["pr_curve"],
        "calibration_curve": MODEL_RESULTS["calibration_curve"],
    }


@app.get("/eda")
async def eda():
    """Exploratory data analysis results."""
    return {
        "correlations": EDA_RESULTS["correlation_with_recession"],
        "correlation_heatmap": EDA_RESULTS["correlation_heatmap"],
        "spread_distribution": EDA_RESULTS["spread_distribution"],
        "statistical_tests": EDA_RESULTS["statistical_tests"],
        "inversion_lead_times": EDA_RESULTS["inversion_lead_times"],
        "summary_statistics": EDA_RESULTS["summary_statistics"],
    }

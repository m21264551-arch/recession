# Yield Curve Recession Probability Engine

An end-to-end data science project that models 12-month US recession probability using Treasury yield curve dynamics and macroeconomic indicators. Features a logistic regression + gradient boosting ensemble, complete exploratory data analysis, and an interactive React dashboard.

![Python](https://img.shields.io/badge/Python-3.11+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green) ![React](https://img.shields.io/badge/React-18-cyan) ![scikit--learn](https://img.shields.io/badge/sklearn-1.4-orange)

## Why This Matters

The yield curve has predicted every US recession since 1970. When short-term Treasury rates exceed long-term rates (yield curve inversion), a recession typically follows within 6–18 months. This project quantifies that signal and combines it with other economic indicators to produce a calibrated probability forecast.

## What's Inside

### Data Pipeline (`analysis/data_pipeline.py`)
- Generates 50 years of synthetic US Treasury yield data modeled on historical FRED patterns
- Produces correlated macroeconomic indicators (unemployment, CPI, GDP, ISM PMI)
- Feature engineering: 4 yield spreads, inversion flags, 6-month rolling features, months-since-inversion
- Binary target: recession starts within 12 months (based on actual NBER dates)

### Exploratory Data Analysis (`analysis/eda.py`)
- Summary statistics across all yields and indicators
- Pearson correlations with forward recession probability
- T-test: yield spreads in pre-recession vs. normal periods (p < 0.001)
- Chi-square test: yield curve inversion → recession association
- Inversion lead-time analysis per recession (average: ~12 months)
- Distribution analysis of 10Y-2Y spread

### Recession Model (`analysis/model.py`)
- **Logistic Regression** (interpretable baseline), regularized, class-balanced
- **Gradient Boosting** (performance model), 200 estimators, depth-4 trees
- **Ensemble**: 40% LR + 60% GB weighted average
- **Evaluation**: 5-fold time series cross-validation (no future leakage), AUC, Brier score, calibration curve
- **Output**: per-month recession probability, feature importance, LR coefficients, ROC/PR curves

### Interactive Dashboard (`dashboard/`)
Four tabs showing the complete analysis:

| Tab | Contents |
|-----|----------|
| **Overview** | Current recession probability, yield curve shape, key indicators, probability time series with recession bands |
| **Yields** | 50-year Treasury yield history, 10Y-2Y spread with inversion signal, inversion statistics |
| **Model** | Feature importance, ROC curve, calibration plot, LR coefficients, CV metrics |
| **EDA** | Correlation bars, statistical test results, spread distribution, inversion lead-time analysis |

## Key Findings

- **10Y-3M spread** is the single strongest recession predictor (correlation: -0.45 with 12-month forward recession)
- **Yield curve inversions** precede recessions by 4–20 months (median ~12 months)
- **Gradient boosting AUC** > 0.85 on time series cross-validation
- **Top 3 features**: 10Y-3M spread, months since inversion, 10Y-2Y spread MA6
- **ISM PMI** adds significant predictive value beyond yield curve signals alone

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Data pipeline | pandas, NumPy | Efficient time series manipulation and feature engineering |
| Modeling | scikit-learn | LogisticRegression, GradientBoostingClassifier, TimeSeriesSplit |
| Statistics | scipy.stats | T-test, chi-square, calibration analysis |
| API | FastAPI | Async, auto-generated docs, type validation |
| Dashboard | React 18 + Recharts | Interactive charts, responsive layout |
| Typography | IBM Plex Sans/Mono | Data-oriented readability |

## Setup

**Requirements:** Python 3.11+, Node.js 18+

```bash
chmod +x setup.sh && ./setup.sh
./start.sh
```

Dashboard: http://localhost:5173
API docs: http://localhost:8000/docs

## API Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /overview` | Current probability, yield curve, indicators, model performance |
| `GET /yields` | Full yield time series, inversion statistics |
| `GET /model` | Probability series, feature importance, ROC/PR/calibration data, LR coefficients |
| `GET /eda` | Correlations, statistical tests, spread distribution, lead-time analysis |

## Project Structure

```
recession/
  analysis/
    data_pipeline.py       Data generation and feature engineering
    model.py               Recession probability model (LR + GB ensemble)
    eda.py                 Exploratory data analysis
  api/
    main.py                FastAPI serving analysis results
    requirements.txt
  dashboard/
    src/App.jsx            Full interactive dashboard with 4 analysis tabs
  setup.sh
  README.md
```

## Methodology

**Scoring Function**: Gaussian proximity to demographic-adjusted ideal → 0-10 score per metric.

**Target Variable**: Binary, 1 if an NBER-dated recession begins within the next 12 months, 0 otherwise.

**Features**: 15 engineered features from 5 raw yield series + 4 economic indicators. Key features include yield curve spreads (10Y-3M, 10Y-2Y, 30Y-5Y, 2Y-3M), 6-month rolling averages, rate-of-change indicators, and months-since-last-inversion.

**Validation**: Strict time-series cross-validation with 5 forward-looking folds. No future data leaks, each fold trains only on past data and evaluates on future data.

**Ensemble**: Weighted combination of logistic regression (interpretable, well-calibrated) and gradient boosting (captures non-linear interactions). Weights tuned on cross-validation Brier score.

## Research Basis

- Estrella, A. & Mishkin, F. (1998). "Predicting U.S. Recessions: Financial Variables as Leading Indicators." *Review of Economics and Statistics*
- Ang, A., Piazzesi, M. & Wei, M. (2006). "What Does the Yield Curve Tell Us about GDP Growth?" *Journal of Econometrics*
- Wright, J. (2006). "The Yield Curve and Predicting Recessions." *Federal Reserve Board Finance and Economics Discussion Series*

## Extending This Project

To use real FRED data instead of synthetic:
1. Get a free API key from https://fred.stlouisfed.org/docs/api/api_key.html
2. Replace `generate_yield_curve_data()` with FRED API calls for series: DGS3MO, DGS2, DGS5, DGS10, DGS30
3. Replace `generate_economic_indicators()` with: UNRATE, CPIAUCSL, GDP, MANEMP
4. The rest of the pipeline (feature engineering, modeling, EDA) works unchanged

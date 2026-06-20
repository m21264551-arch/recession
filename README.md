# Yield Curve Recession Probability Engine

This project models 12-month US recession risk from yield-curve and macroeconomic features, then serves the results through a FastAPI backend and React dashboard.

The dataset in this repo is synthetic. It is shaped around historical yield-curve behavior and NBER recession dates so the modeling and dashboard flow can be reviewed without needing a FRED API key.

## What is included

- Python data pipeline for yield spreads and macro indicators
- Logistic regression and gradient boosting models
- Time-series cross-validation
- Exploratory analysis scripts
- FastAPI endpoints for model and EDA results
- React dashboard with overview, yield, model, and EDA tabs

## Run locally

```bash
chmod +x setup.sh
./setup.sh
./start.sh
```

Dashboard:
`http://localhost:5173`

API docs:
`http://localhost:8000/docs`

## Repository map

```text
analysis/data_pipeline.py       Data generation and feature engineering
analysis/model.py               Model training and evaluation
analysis/eda.py                 Statistical checks and chart data
api/main.py                     FastAPI app
dashboard/                      React dashboard
setup.sh                        Local install helper
start.sh                        Starts API and dashboard
```

## Modeling notes

The target is whether a recession begins within the next 12 months. Features include yield spreads, inversion flags, rolling averages, and macro indicators. Validation uses forward-looking time-series folds so later periods are not used to train earlier predictions.

## Extending with real data

To adapt this to real FRED data:

1. Get a FRED API key.
2. Replace the synthetic yield generator with FRED series such as DGS3MO, DGS2, DGS5, DGS10, and DGS30.
3. Replace synthetic macro indicators with series such as UNRATE, CPIAUCSL, GDP, and MANEMP.
4. Keep the feature engineering, model, API, and dashboard flow.

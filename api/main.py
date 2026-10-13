"""Read-only artifact service. Acquisition and training are explicit offline commands."""

import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException

app = FastAPI(title="Yield Curve Recession Study", version="2.0.0")
BUNDLE = Path(
    os.environ.get(
        "STUDY_BUNDLE",
        Path(__file__).resolve().parents[1] / "data/snapshots/study-v1.json",
    )
)


def result_bundle():
    try:
        data = json.loads(BUNDLE.read_text())
        if (
            data.get("schemaVersion") != 1
            or not data.get("artifactId")
            or not data.get("folds")
        ):
            raise ValueError("Unsupported or incomplete artifact")
        return data
    except (OSError, ValueError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Study artifact unavailable. Run python -m analysis.export.",
        ) from exc


@app.get("/")
@app.get("/health")
def health():
    data = result_bundle()
    return {
        "status": "ready",
        "mode": "saved_historical_backtest",
        "schemaVersion": 1,
        "artifactId": data["artifactId"],
        "datasetId": data["datasetId"],
    }


@app.get("/v1/study")
@app.get("/overview")
@app.get("/yields")
@app.get("/model")
@app.get("/eda")
def study():
    return result_bundle()

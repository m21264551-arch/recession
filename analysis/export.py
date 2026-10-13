"""Generate the single versioned result used by the static site and FastAPI."""

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from analysis.data_pipeline import ROOT, load_snapshot, FEATURES
from analysis.model import MODEL_NAMES, MODEL_SETTINGS, backtest, summarize


def export():
    frame, manifest = load_snapshot()
    predictions, folds = backtest(frame)
    if not predictions:
        raise ValueError("No backtest predictions; refusing empty publication")
    overall, episodes, errors = summarize(frame, predictions)
    by_date = {p["date"]: p for p in predictions}
    rows = []
    for date, row in frame.loc[frame.GS10.first_valid_index() :].iterrows():
        stamp = date.strftime("%Y-%m-%d")
        values = {
            name: float(row[name]) if np.isfinite(row[name]) else None
            for name in ["GS10", "TB3MS", "USREC", "spread", "target"]
        }
        prediction = by_date.get(stamp)
        reason = (
            None
            if prediction
            else (
                "Incomplete future outcome window"
                if not np.isfinite(row.target)
                else "Missing yields or insufficient eligible training history"
            )
        )
        rows.append(
            {
                "date": stamp,
                **values,
                "prediction": prediction,
                "unavailableReason": reason,
            }
        )
    source_files = ["acquire.py", "data_pipeline.py", "model.py", "export.py"]
    payload = {
        "schemaVersion": 1,
        "title": "Yield Curve Recession Study",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "codeRevision": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "sourceChecksum": hashlib.sha256(
            b"".join((ROOT / "analysis" / p).read_bytes() for p in source_files)
        ).hexdigest(),
        "datasetId": f"fred-{manifest['sha256'][:16]}",
        "snapshot": manifest,
        "observationPeriod": {"start": rows[0]["date"], "end": rows[-1]["date"]},
        "protocol": {
            "target": "Transition from USREC=0 to USREC=1 in the next 12 calendar months, excluding the selected month",
            "horizonMonths": 12,
            "minimumTrainingMonths": 240,
            "refit": "Annual expanding window",
            "embargo": "Each training label window ends strictly before the January refit date",
            "predictionType": "out_of_sample",
            "vintageLimitation": "Retrospective downloaded vintage; revised yields and final recession chronology do not reproduce information or announcements available in real time. Monthly yields are treated as available at month end.",
            "spreadDefinition": "GS10 minus TB3MS, percentage points; the underlying series use investment and discount quoted bases respectively.",
        },
        "models": {
            name: {
                "name": title,
                "settings": MODEL_SETTINGS[name],
                "metrics": overall[name],
            }
            for name, title in MODEL_NAMES.items()
        },
        "rows": rows,
        "folds": folds,
        "episodes": episodes,
        "errors": errors,
        "missingObservations": {
            name: int(frame.loc[frame.GS10.first_valid_index() :, name].isna().sum())
            for name in ["GS10", "TB3MS", "USREC"]
        },
    }
    payload["artifactId"] = (
        "yield-study-v1-"
        + hashlib.sha256(
            json.dumps(payload, sort_keys=True, allow_nan=False).encode()
        ).hexdigest()[:16]
    )
    text = json.dumps(payload, separators=(",", ":"), allow_nan=False) + "\n"
    for path in [
        ROOT / "data/snapshots/study-v1.json",
        ROOT / "dashboard/public/api/study.json",
    ]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    # Existing static routes and API endpoints use the exact same v1 envelope.
    for route in ["overview", "yields", "model", "eda"]:
        (ROOT / "dashboard/public/api" / route).write_text(text)
    print(
        json.dumps(
            {
                "artifactId": payload["artifactId"],
                "period": payload["observationPeriod"],
                "predictions": len(predictions),
                "folds": len(folds),
                "results": {n: v["metrics"] for n, v in payload["models"].items()},
            },
            indent=2,
        )
    )
    return payload


if __name__ == "__main__":
    export()

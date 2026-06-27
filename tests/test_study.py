import json
from pathlib import Path
import numpy as np
import pandas as pd
from analysis.data_pipeline import construct_features, load_snapshot, ROOT, FEATURES
from analysis.model import eligible_training, metrics


def test_calendar_onset_target_excludes_present_and_incomplete_future():
    dates = pd.date_range("2000-01-01", periods=36, freq="MS")
    raw = pd.DataFrame({"GS10": 4.0, "TB3MS": 3.0, "USREC": 0.0}, index=dates)
    raw.loc["2001-02-01":"2001-04-01", "USREC"] = 1
    f = construct_features(raw)
    assert f.loc["2000-01-01", "target"] == 0
    assert f.loc["2000-02-01", "target"] == 1
    assert f.loc["2001-01-01", "target"] == 1
    assert f.loc["2001-02-01", "target"] == 0
    assert f.target.iloc[-12:].isna().all()
    missing = construct_features(raw.drop(pd.Timestamp("2000-08-01")))
    assert np.isnan(missing.loc["2000-01-01", "target"])
    assert len(missing) == 36


def test_snapshot_hash_and_calendar_features():
    f, m = load_snapshot()
    assert m["sha256"]
    available = f.dropna(subset=["spread", "spread_lag3"])
    assert np.allclose(available.spread, available.GS10 - available.TB3MS)
    assert np.allclose(
        available.spread_change3, available.spread - available.spread_lag3
    )


def test_every_forecast_is_oos_and_every_preprocessor_uses_eligible_training():
    frame, _ = load_snapshot()
    study = json.loads((ROOT / "data/snapshots/study-v1.json").read_text())
    for fold in study["folds"]:
        start = pd.Timestamp(fold["refitAt"])
        train = eligible_training(frame, start)
        assert (train.target_end < start).all()
        assert len(train) == fold["trainingMonths"] >= 240
        assert abs(train.spread.mean() - fold["scalerMean"]) < 1e-10
        assert fold["lastTrainingOutcome"] < fold["refitAt"] <= fold["evaluationStart"]
    folds = {f["id"]: f for f in study["folds"]}
    for row in study["rows"]:
        assert row["USREC"] == frame.loc[row["date"], "USREC"]
        if row["prediction"]:
            p = row["prediction"]
            f = folds[p["foldId"]]
            assert p["predictionType"] == "out_of_sample"
            assert f["evaluationStart"] <= row["date"] <= f["evaluationEnd"]
            assert row["target"] is not None
            assert set(p["scores"]) == set(study["models"])


def test_single_class_metrics_are_explicit():
    m = metrics([0, 0], [0.1, 0.2])
    assert m["rocAuc"] is None and m["averagePrecision"] is None
    assert abs(m["brier"] - 0.025) < 1e-10
    assert "one target class" in m["reason"]


def test_api_and_static_snapshots_are_identical():
    from api.main import study, health

    expected = study()
    for route in ["study.json", "overview", "yields", "model", "eda"]:
        assert (
            json.loads((ROOT / "dashboard/public/api" / route).read_text()) == expected
        )
    assert health()["artifactId"] == expected["artifactId"]
    from analysis.model import metrics

    rows = [r["prediction"] for r in expected["rows"] if r["prediction"]]
    for name in expected["models"]:
        assert (
            metrics([p["target"] for p in rows], [p["scores"][name] for p in rows])
            == expected["models"][name]["metrics"]
        )


def test_missing_bundle_does_not_train_or_invent_data(monkeypatch, tmp_path):
    import api.main as service
    from fastapi import HTTPException
    import pytest

    monkeypatch.setattr(service, "BUNDLE", tmp_path / "missing.json")
    with pytest.raises(HTTPException) as e:
        service.study()
    assert e.value.status_code == 503

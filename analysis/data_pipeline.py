"""Calendar-month features and forward-onset targets from a checked real snapshot."""

import hashlib
import json
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
FEATURES = ["spread", "spread_lag3", "spread_change3", "GS10", "TB3MS"]
HORIZON = 12


def construct_features(raw):
    """One row per calendar month. Never compress missing months or impute outcomes."""
    frame = raw.copy().sort_index()
    if frame.index.has_duplicates:
        raise ValueError("Duplicate calendar observations")
    if not (frame.index == frame.index.to_period("M").to_timestamp()).all():
        raise ValueError("Expected month-start dates")
    frame = frame.reindex(
        pd.date_range(frame.index.min(), frame.index.max(), freq="MS")
    )
    recession = frame["USREC"]
    onset = ((recession == 1) & (recession.shift(1) == 0)).astype(float)
    onset[recession.isna() | recession.shift(1).isna()] = np.nan
    # Month t does not count its own onset. Outcome windows are t+1 ... t+12.
    future = pd.concat(
        [onset.shift(-offset) for offset in range(1, HORIZON + 1)], axis=1
    )
    frame["target"] = future.max(axis=1).where(future.notna().all(axis=1))
    frame["onset"] = onset
    frame["target_end"] = frame.index + pd.DateOffset(months=HORIZON)
    frame["spread"] = frame.GS10 - frame.TB3MS
    frame["spread_lag3"] = frame.spread.shift(3)
    frame["spread_change3"] = frame.spread - frame.spread_lag3
    return frame


def load_snapshot(path=None):
    path = Path(path or ROOT / "data/raw/fred-monthly.csv")
    manifest = json.loads(path.with_suffix(".manifest.json").read_text())
    if hashlib.sha256(path.read_bytes()).hexdigest() != manifest["sha256"]:
        raise ValueError(
            "Snapshot checksum mismatch; acquire and record a new snapshot explicitly"
        )
    raw = pd.read_csv(
        path, parse_dates=["observation_date"], na_values=["."]
    ).set_index("observation_date")
    if not raw.USREC.dropna().isin([0, 1]).all():
        raise ValueError("USREC must contain 0, 1 or missing values")
    return construct_features(raw), manifest

"""Expanding annual out-of-sample backtest with an explicit outcome-window embargo."""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from analysis.data_pipeline import FEATURES

MODEL_NAMES = {
    "prevalence": "Historical prevalence",
    "logistic": "Spread-only logistic",
    "boosting": "Gradient boosting",
}
MODEL_SETTINGS = {
    "prevalence": {"prediction": "mean eligible training target"},
    "logistic": {
        "features": ["spread"],
        "scaler": "StandardScaler fitted on training data",
        "C": 1.0,
        "max_iter": 1000,
    },
    "boosting": {
        "features": FEATURES,
        "n_estimators": 100,
        "max_depth": 2,
        "learning_rate": 0.03,
        "random_state": 42,
    },
}


def eligible_training(frame, evaluation_start):
    return frame.loc[
        (frame.index < evaluation_start) & (frame.target_end < evaluation_start)
    ].dropna(subset=FEATURES + ["target"])


def metrics(y, scores):
    y, scores = np.asarray(y, dtype=float), np.asarray(scores, dtype=float)
    if not len(y):
        return {
            "n": 0,
            "positiveMonths": 0,
            "rocAuc": None,
            "averagePrecision": None,
            "brier": None,
            "reason": "No eligible observations",
            "calibration": [],
        }
    both = len(np.unique(y)) == 2
    bins = []
    for low in np.arange(0, 1, 0.1):
        mask = (scores >= low) & (scores < low + 0.1 if low < 0.89 else scores <= 1)
        if mask.any():
            bins.append(
                {
                    "meanPrediction": float(scores[mask].mean()),
                    "observedFrequency": float(y[mask].mean()),
                    "n": int(mask.sum()),
                }
            )
    return {
        "n": len(y),
        "positiveMonths": int(y.sum()),
        "rocAuc": float(roc_auc_score(y, scores)) if both else None,
        "averagePrecision": float(average_precision_score(y, scores)) if both else None,
        "brier": float(brier_score_loss(y, scores)),
        "reason": None if both else "Ranking metrics undefined: only one target class",
        "calibration": bins,
    }


def backtest(frame, minimum_months=240):
    predictions = []
    folds = []
    complete = frame.dropna(subset=FEATURES + ["target"])
    for year in sorted(set(complete.index.year)):
        start = pd.Timestamp(year, 1, 1)
        train = eligible_training(frame, start)
        test = complete.loc[
            (complete.index >= start) & (complete.index < pd.Timestamp(year + 1, 1, 1))
        ]
        if (
            len(train) < minimum_months
            or train.index.max() - train.index.min() < pd.Timedelta(days=365.25 * 19.9)
            or test.empty
            or train.target.nunique() < 2
        ):
            continue
        lr = make_pipeline(
            StandardScaler(), LogisticRegression(C=1, max_iter=1000, random_state=42)
        ).fit(train[["spread"]], train.target)
        gb = GradientBoostingClassifier(
            n_estimators=100, max_depth=2, learning_rate=0.03, random_state=42
        ).fit(train[FEATURES], train.target)
        scores = {
            "prevalence": np.full(len(test), train.target.mean()),
            "logistic": lr.predict_proba(test[["spread"]])[:, 1],
            "boosting": gb.predict_proba(test[FEATURES])[:, 1],
        }
        fold = {
            "id": str(year),
            "trainingStart": train.index.min().strftime("%Y-%m-%d"),
            "trainingEnd": train.index.max().strftime("%Y-%m-%d"),
            "lastTrainingOutcome": train.target_end.max().strftime("%Y-%m-%d"),
            "evaluationStart": test.index.min().strftime("%Y-%m-%d"),
            "evaluationEnd": test.index.max().strftime("%Y-%m-%d"),
            "refitAt": start.strftime("%Y-%m-%d"),
            "trainingMonths": len(train),
            "scalerMean": float(lr[0].mean_[0]),
            "metrics": {
                name: metrics(test.target, values) for name, values in scores.items()
            },
        }
        assert pd.Timestamp(fold["lastTrainingOutcome"]) < start
        folds.append(fold)
        for i, (date, row) in enumerate(test.iterrows()):
            predictions.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "target": int(row.target),
                    "foldId": str(year),
                    "predictionType": "out_of_sample",
                    "scores": {
                        name: float(values[i]) for name, values in scores.items()
                    },
                }
            )
    return predictions, folds


def summarize(frame, predictions):
    overall = {
        name: metrics(
            [p["target"] for p in predictions], [p["scores"][name] for p in predictions]
        )
        for name in MODEL_NAMES
    }
    episodes = []
    for date in frame.index[frame.onset == 1]:
        rows = [
            p
            for p in predictions
            if date - pd.DateOffset(months=12) <= pd.Timestamp(p["date"]) < date
        ]
        if not rows:
            continue
        episodes.append(
            {
                "onset": date.strftime("%Y-%m-%d"),
                "evaluatedMonths": len(rows),
                "completeWindow": len(rows) == 12,
                "models": {
                    name: {
                        "meanProbability": float(
                            np.mean([p["scores"][name] for p in rows])
                        ),
                        "maxProbability": max(p["scores"][name] for p in rows),
                        "monthsAboveHalf": sum(p["scores"][name] >= 0.5 for p in rows),
                        "metrics": metrics(
                            [p["target"] for p in rows],
                            [p["scores"][name] for p in rows],
                        ),
                    }
                    for name in MODEL_NAMES
                },
            }
        )
    errors = {
        name: {
            "threshold": 0.5,
            "falseAlarmMonths": [
                p["date"]
                for p in predictions
                if not p["target"] and p["scores"][name] >= 0.5
            ],
            "missedPositiveMonths": [
                p["date"]
                for p in predictions
                if p["target"] and p["scores"][name] < 0.5
            ],
        }
        for name in MODEL_NAMES
    }
    return overall, episodes, errors

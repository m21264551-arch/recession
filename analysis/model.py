"""
Recession — Recession Probability Model
Logistic regression + gradient boosting ensemble for 12-month recession forecasting.
Uses yield curve spreads + economic indicators as features.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    roc_auc_score, brier_score_loss, classification_report,
    precision_recall_curve, roc_curve, confusion_matrix
)
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import calibration_curve
import json


FEATURES = [
    "spread_10y_3m", "spread_10y_2y", "spread_30y_5y", "spread_2y_3m",
    "inverted_10y_3m", "inverted_10y_2y",
    "spread_10y_3m_ma6", "spread_10y_2y_ma6",
    "unemployment", "unemp_change_6m",
    "cpi_yoy", "cpi_change_6m",
    "ism_ma3", "gdp_ma2",
    "months_since_inversion",
]

TARGET = "recession_12m"


class RecessionModel:
    def __init__(self):
        self.scaler = StandardScaler()
        self.lr = LogisticRegression(C=0.5, max_iter=1000, class_weight="balanced")
        self.gb = GradientBoostingClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.8, min_samples_leaf=10, random_state=42
        )
        self.is_fitted = False

    def fit(self, df: pd.DataFrame) -> dict:
        """Train models and return evaluation metrics."""
        X = df[FEATURES].values
        y = df[TARGET].values
        dates = df["date"].values

        # Time series split — no future leakage
        tscv = TimeSeriesSplit(n_splits=5)
        cv_results = {"lr_aucs": [], "gb_aucs": [], "lr_briers": [], "gb_briers": []}

        for train_idx, test_idx in tscv.split(X):
            X_tr, X_te = X[train_idx], X[test_idx]
            y_tr, y_te = y[train_idx], y[test_idx]

            sc = StandardScaler().fit(X_tr)
            X_tr_s, X_te_s = sc.transform(X_tr), sc.transform(X_te)

            lr = LogisticRegression(C=0.5, max_iter=1000, class_weight="balanced").fit(X_tr_s, y_tr)
            gb = GradientBoostingClassifier(
                n_estimators=200, max_depth=4, learning_rate=0.05,
                subsample=0.8, min_samples_leaf=10, random_state=42
            ).fit(X_tr, y_tr)

            lr_prob = lr.predict_proba(X_te_s)[:, 1]
            gb_prob = gb.predict_proba(X_te)[:, 1]

            if len(np.unique(y_te)) > 1:
                cv_results["lr_aucs"].append(roc_auc_score(y_te, lr_prob))
                cv_results["gb_aucs"].append(roc_auc_score(y_te, gb_prob))
            cv_results["lr_briers"].append(brier_score_loss(y_te, lr_prob))
            cv_results["gb_briers"].append(brier_score_loss(y_te, gb_prob))

        # Final fit on all data
        X_scaled = self.scaler.fit_transform(X)
        self.lr.fit(X_scaled, y)
        self.gb.fit(X, y)
        self.is_fitted = True

        # Predictions on full dataset for visualization
        lr_probs = self.lr.predict_proba(X_scaled)[:, 1]
        gb_probs = self.gb.predict_proba(X)[:, 1]
        ensemble_probs = 0.4 * lr_probs + 0.6 * gb_probs

        # Feature importance (from gradient boosting)
        importance = dict(zip(FEATURES, self.gb.feature_importances_.round(4).tolist()))
        importance_sorted = dict(sorted(importance.items(), key=lambda x: -x[1]))

        # Logistic regression coefficients
        lr_coefs = dict(zip(FEATURES, self.lr.coef_[0].round(4).tolist()))

        # ROC curve data
        fpr, tpr, _ = roc_curve(y, ensemble_probs)
        roc_data = [{"fpr": round(f, 4), "tpr": round(t, 4)} for f, t in zip(fpr[::5], tpr[::5])]

        # Precision-recall curve
        prec, rec, _ = precision_recall_curve(y, ensemble_probs)
        pr_data = [{"precision": round(p, 4), "recall": round(r, 4)} for p, r in zip(prec[::5], rec[::5])]

        # Calibration curve
        prob_true, prob_pred = calibration_curve(y, ensemble_probs, n_bins=10, strategy="uniform")
        cal_data = [{"predicted": round(p, 4), "actual": round(a, 4)} for p, a in zip(prob_pred, prob_true)]

        # Confusion matrix at 0.5 threshold
        preds = (ensemble_probs > 0.5).astype(int)
        cm = confusion_matrix(y, preds)

        # Time series of probabilities
        prob_series = []
        for i, d in enumerate(dates):
            prob_series.append({
                "date": str(pd.Timestamp(d).date()),
                "lr_prob": round(float(lr_probs[i]), 4),
                "gb_prob": round(float(gb_probs[i]), 4),
                "ensemble_prob": round(float(ensemble_probs[i]), 4),
                "actual": int(y[i]),
            })

        return {
            "cv_metrics": {
                "lr_auc_mean": round(np.mean(cv_results["lr_aucs"]), 4) if cv_results["lr_aucs"] else 0,
                "gb_auc_mean": round(np.mean(cv_results["gb_aucs"]), 4) if cv_results["gb_aucs"] else 0,
                "lr_brier_mean": round(np.mean(cv_results["lr_briers"]), 4),
                "gb_brier_mean": round(np.mean(cv_results["gb_briers"]), 4),
            },
            "full_metrics": {
                "auc": round(roc_auc_score(y, ensemble_probs), 4),
                "brier": round(brier_score_loss(y, ensemble_probs), 4),
                "accuracy": round(np.mean(preds == y), 4),
                "confusion_matrix": cm.tolist(),
                "classification_report": classification_report(y, preds, output_dict=True, zero_division=0),
            },
            "feature_importance_gb": importance_sorted,
            "lr_coefficients": lr_coefs,
            "roc_curve": roc_data,
            "pr_curve": pr_data,
            "calibration_curve": cal_data,
            "probability_series": prob_series,
            "current_probability": round(float(ensemble_probs[-1]), 4),
            "current_assessment": _assess(float(ensemble_probs[-1])),
        }

    def predict_current(self, df: pd.DataFrame) -> dict:
        """Get current recession probability."""
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        row = df.iloc[-1:][FEATURES]
        X_scaled = self.scaler.transform(row.values)
        lr_p = self.lr.predict_proba(X_scaled)[0, 1]
        gb_p = self.gb.predict_proba(row.values)[0, 1]
        ens = 0.4 * lr_p + 0.6 * gb_p
        return {
            "probability": round(float(ens), 4),
            "lr_probability": round(float(lr_p), 4),
            "gb_probability": round(float(gb_p), 4),
            "assessment": _assess(float(ens)),
            "date": str(df.iloc[-1]["date"].date()),
        }


def _assess(prob):
    if prob > 0.7: return "High Risk"
    if prob > 0.4: return "Elevated"
    if prob > 0.2: return "Moderate"
    return "Low Risk"

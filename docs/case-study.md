# Yield-curve signals under a chronological backtest

**Question.** Does the 10-year minus 3-month Treasury spread contain information about a recession onset in the next 12 months, beyond historical prevalence?

**Approach.** Freeze the real monthly FRED GS10/TB3MS/USREC snapshot. Build calendar-month onset labels separately from recession-period shading. Refit annually on an expanding history, purge every training label whose future window reaches the refit, and fit preprocessing only on training observations.

**Result.** Across 609 evaluated months and six onset episodes, spread-only logistic regression has approximately 0.902 ROC-AUC and 0.088 Brier, compared with prevalence Brier 0.109. The downloadable bundle contains every prediction, eligibility boundary, annual metric, calibration bin and episode result. The UI derives its claims from that same bundle.

**Failure analysis.** A 50% threshold produces both missed positive months and false alarms. Monthly labels overlap, so a large row count disguises the small number of independent recessions. Final USREC labels and a downloaded yield vintage are not a reconstruction of historical release timing.

**Engineering decision.** Move acquisition, training and evaluation out of API startup. Serve an immutable versioned study to both FastAPI and the static dashboard. Unknown data stays unavailable; a missing artifact does not trigger synthetic generation.

**Next limitation.** An ALFRED vintage/release-timing reconstruction would be required for a stronger real-time forecasting claim. This project deliberately stops at a documented retrospective experiment.

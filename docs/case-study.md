# Yield Curve Study

[Demo](https://yieldcurve.m21264551.com/) · [Code](https://github.com/m21264551-arch/recession)

Across 609 evaluated months and six recession onsets, spread-only logistic regression achieved a Brier score of 0.088, compared with 0.109 for historical prevalence. Lower is better. The signal improved probability estimates over that baseline, but still produced false alarms and missed positive months.

## Read the same month two ways

The upper chart shows the 10-year Treasury yield minus the 3-month bill rate. The lower chart shows the estimated probability of a recession beginning within the following year. Select a month to inspect its baseline estimate, observed outcome and training window. Recession shading describes the historical period, not the forward-looking target.

## Keep future labels out of training

The study uses a frozen monthly FRED snapshot of GS10, TB3MS and USREC. Models refit annually on an expanding history. Every training label’s complete 12-month outcome window ends before the refit. Scaling also uses training data only. The dashboard and API read the same saved results.

## Six recessions, not 609 independent events

Adjacent targets overlap, and the data vintage includes historical revisions and final recession classifications. This is a retrospective backtest rather than a reconstruction of forecasts available at the time. The backtest does not account for when data revisions and recession announcements became available.

export default function HowToUse() { return (
<section id="how-to-use" className="learning-guide" aria-labelledby="guide-title" tabIndex={-1}>
<h2 id="guide-title">How to use Yield Curve Study</h2>
<p>This study asks whether the difference between long- and short-term interest rates helps anticipate recession onsets. The upper chart shows the 10-year Treasury yield minus the 3-month bill rate, in percentage points. A negative spread means the shorter-term rate was higher: an inversion.</p>
<ol className="guide-steps">
<li><h3>Select a historical month</h3><p>Click either chart, enter a month, or use the previous and next buttons. The shared marker keeps both charts aligned. Change Chart period to look more closely at a particular part of the record.</p></li>
<li><h3>Compare the estimate</h3><p>The lower chart estimates whether a recession will begin within the following 12 months. Compare the chosen model with historical prevalence, the baseline based on earlier training outcomes. The selected-month panel puts both estimates beside what actually happened.</p></li>
<li><h3>Inspect the errors</h3><p>Open Results to compare performance, calibration, false alarms, and missed positive months. Lower Brier scores mean smaller probability errors. Expand Training window on the main view to inspect the observations used for that month's model.</p></li>
</ol>
<p><strong>Reading the charts:</strong> grey bands mark months already in recession. They are different from the forward-looking onset target. Gaps indicate unavailable estimates; select the month to find the reason.</p>
<p>This is a retrospective backtest using a downloaded data vintage. Historical revisions and recession classifications prevent it from recreating exactly what an analyst knew at the time.</p>
<a href="#tool">Back to tool ↑</a></section>
); }

import HowToUse from "./components/HowToUse";
import React, { useEffect, useRef, useState } from "react";

const names = {
  prevalence: "Historical prevalence",
  logistic: "Spread-only logistic",
  boosting: "Gradient boosting",
};
const colours = {
  prevalence: "#68737b",
  logistic: "#254f91",
  boosting: "#a95028",
};
const format = (n, digits = 3) =>
  Number.isFinite(n) ? n.toFixed(digits) : "Undefined";
const percent = (n) =>
  Number.isFinite(n) ? `${(100 * n).toFixed(1)}%` : "Unavailable";
const month = (date) =>
  new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const shiftMonth = (date,delta) => { const d=new Date(`${date}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth()+delta); return d.toISOString().slice(0,10); };
function ErrorMonths({dates,onSelect}) {
  const groups=[];
  for(const date of dates) {
    const last=groups.at(-1);
    if(last && shiftMonth(last.at(-1),1)===date) last.push(date); else groups.push([date]);
  }
  return groups.length ? groups.map(group=><div className="error-episode" key={group[0]}>
    <button onClick={()=>onSelect(group[0])}>{month(group[0])}{group.length>1 ? ` – ${month(group.at(-1))}` : ""}</button>
    <span>{group.length} {group.length===1 ? "month" : "consecutive months"}</span>
    {group.length>1 && <details><summary>Choose a month</summary><div className="error-months">{group.map(date=><button key={date} onClick={()=>onSelect(date)}>{month(date)}</button>)}</div></details>}
  </div>) : "None at this threshold.";
}

function ResultsTable({ heads, rows, label = `${heads[0]} results` }) {
  return (
    <div className="table-scroll" tabIndex="0" role="region" aria-label={label}>
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryChart({ rows, model, selected, onSelect }) {
  const container = useRef(null);
  const gesture = useRef(null);
  const [width, setWidth] = useState(900);
  const [viewportHeight,setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(300, entry.contentRect.width)),
    );
    if (container.current) observer.observe(container.current);
    const resize=()=>setViewportHeight(window.innerHeight);
    window.addEventListener("resize",resize);
    return () => {observer.disconnect();window.removeEventListener("resize",resize);};
  }, []);
  const height = width < 500 ? 150 : Math.max(170,Math.min(310,(viewportHeight-370)/2)),
    left = 54,
    right = 24,
    top = 24,
    bottom = 40;
  const x = (i) =>
    left + (i * (width - left - right)) / Math.max(1, rows.length - 1);
  function selectPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (((event.clientX-rect.left)*width)/rect.width-left)/(width-left-right);
    onSelect(rows[Math.max(0,Math.min(rows.length-1,Math.round(fraction*(rows.length-1))))].date);
  }
  const chart = (probability) => {
    const min = probability
      ? 0
      : Math.floor(
          Math.min(-1, ...rows.map((r) => r.spread).filter(Number.isFinite)),
        );
    const max = probability
      ? 1
      : Math.ceil(
          Math.max(1, ...rows.map((r) => r.spread).filter(Number.isFinite)),
        );
    const y = (v) => top + ((max - v) / (max - min)) * (height - top - bottom);
    const path = (value) => {
      let pen = false;
      return rows
        .map((r, i) => {
          const v = value(r);
          if (!Number.isFinite(v)) {
            pen = false;
            return "";
          }
          const next = `${pen ? "L" : "M"}${x(i)},${y(v)}`;
          pen = true;
          return next;
        })
        .join(" ");
    };
    const chosen = rows.findIndex((r) => r.date === selected);
    const selectedValue = probability ? rows[chosen]?.prediction?.scores[model] : rows[chosen]?.spread;
    const labelX = Math.max(left+4, Math.min(width-right-92, x(chosen)+10));
    const labelY = top - 7;
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        tabIndex={0}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        onKeyDown={(event) => {
          const index = Math.max(0, rows.findIndex((r) => r.date === selected));
          const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "ArrowRight" ? index + 1 : null;
          if (next !== null) { event.preventDefault(); onSelect(rows[Math.max(0, Math.min(rows.length-1, next))].date); }
        }}
        onPointerDown={(event) => {
          gesture.current = { id:event.pointerId, x:event.clientX, y:event.clientY, horizontal:event.pointerType !== "touch", vertical:false };
          if (event.pointerType !== "touch") { event.currentTarget.setPointerCapture(event.pointerId); selectPointer(event); }
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId || g.vertical) return;
          const dx = Math.abs(event.clientX-g.x), dy = Math.abs(event.clientY-g.y);
          if (!g.horizontal && dy > 8 && dy > dx) { g.vertical=true; return; }
          if (!g.horizontal && dx > 8 && dx > dy) { g.horizontal=true; event.currentTarget.setPointerCapture(event.pointerId); }
          if (g.horizontal) selectPointer(event);
        }}
        onPointerUp={(event) => {
          const g=gesture.current;
          if (g && !g.vertical) selectPointer(event);
          if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          gesture.current=null;
        }}
        onPointerCancel={() => { gesture.current=null; }}
        aria-label={
          probability
            ? "Out-of-sample probability of recession onset in the next 12 months, with historical prevalence baseline"
            : "10-year minus 3-month yield spread in percentage points, grey bands show USREC recession months"
        }
      >
        {rows.map((r, i) =>
          r.USREC === 1 ? (
            <rect
              key={r.date}
              x={x(i) - (width - left - right) / rows.length / 2}
              y={top}
              width={(width - left - right) / rows.length + 1}
              height={height - top - bottom}
              fill="#e2e4e4"
            />
          ) : null,
        )}
        {[0, 1, 2, 3, 4].map((i) => {
          const v = min + ((max - min) * i) / 4;
          if (!probability && Math.abs(y(v) - y(0)) < 18) return null;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(v)}
                y2={y(v)}
                stroke="#d8dedf"
              />
              <text x={left - 9} y={y(v) + 4} textAnchor="end">
                {probability ? `${Math.round(v * 100)}%` : format(v, 1)}
              </text>
            </g>
          );
        })}
        <path
          d={path((r) =>
            probability ? r.prediction?.scores[model] : r.spread,
          )}
          fill="none"
          stroke={probability ? colours[model] : "#263c4b"}
          strokeWidth="2.5"
        />
        {probability && model !== "prevalence" && (
          <path
            d={path((r) => r.prediction?.scores.prevalence)}
            fill="none"
            stroke={colours.prevalence}
            strokeWidth="2"
            strokeDasharray="7 5"
          />
        )}
        {!probability && (
          <g><line
            x1={left}
            x2={width - right}
            y1={y(0)}
            y2={y(0)}
            stroke="#987557"
            strokeDasharray="5 5"
          /><text x={left-9} y={y(0)+4} textAnchor="end" className="zero-label">0</text></g>
        )}
        {chosen >= 0 && (
          <g className="date-marker"><line
            x1={x(chosen)}
            x2={x(chosen)}
            y1={top}
            y2={height - bottom}
            stroke="#a95028" strokeWidth="2"
          />
          {Number.isFinite(selectedValue) && <>
            <circle data-selected-point={probability ? "probability" : "spread"} cx={x(chosen)} cy={y(selectedValue)} r="4.5" fill={probability ? colours[model] : "#263c4b"} stroke="white" strokeWidth="2" />
            <rect x={labelX-3} y={labelY-15} width="90" height="21" rx="2" fill="white" />
            <text x={labelX} y={labelY} fontWeight="700">{probability ? percent(selectedValue) : `${format(selectedValue,2)} pp`}</text>
          </>}
          {probability && model !== "prevalence" && Number.isFinite(rows[chosen]?.prediction?.scores.prevalence) && <circle cx={x(chosen)} cy={y(rows[chosen].prediction.scores.prevalence)} r="3.5" fill="white" stroke={colours.prevalence} strokeWidth="2" />}
          </g>
        )}
        {chosen >= 0 && chosen < rows.length-1 && <g className="forecast-window" role="img" aria-label="Following twelve-month target window">
          <path d={`M${x(chosen+1)},${height-bottom-9}v6H${x(Math.min(rows.length-1,chosen+12))}v-6`} fill="none" stroke="#a95028" strokeWidth="2.5" />
        </g>}
        {Array.from(
          new Set([
            0,
            ...(width < 500 ? [] : [Math.floor(rows.length / 4)]),
            Math.floor(rows.length / 2),
            ...(width < 500 ? [] : [Math.floor((rows.length * 3) / 4)]),
            rows.length - 1,
          ]),
        ).map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 12}
            textAnchor={
              i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"
            }
          >
            {month(rows[i].date)}
          </text>
        ))}
      </svg>
    );
  };
  return (
    <section className="history" ref={container}>
      <h2>
        Yield spread <span>10-year − 3-month · percentage points · below zero: inverted</span>
      </h2>
      <p className="chart-key">Grey: months in recession. Amber bracket: the selected month’s next-year target.</p>
      {chart(false)}
      <h2>
        Recession onset probability{" "}
        <span>{names[model]} : solid · prevalence: dashed</span>
      </h2>
      {chart(true)}
      <p className="caption">
        Grey bands: recession months. Forecast target: an onset in the next 12
        months. Gaps show unavailable estimates. Select a month for the reason.
      </p>
      <label className="scrubber">
        Inspect historical month{" "}
        <input
          type="range"
          min="0"
          max={rows.length - 1}
          value={Math.max(
            0,
            rows.findIndex((r) => r.date === selected),
          )}
          onChange={(e) => onSelect(rows[+e.target.value].date)}
        />
      </label>
    </section>
  );
}

function Calibration({ points }) {
  return (
    <svg
      className="calibration"
      viewBox="0 0 380 310"
      role="img"
      aria-label="Calibration: predicted probability versus observed fraction, diagonal indicates perfect calibration"
    >
      <line
        x1="45"
        y1="265"
        x2="330"
        y2="20"
        stroke="#8996a0"
        strokeDasharray="5 5"
      />
      <line x1="45" y1="20" x2="45" y2="265" stroke="#66757e" />
      <line x1="45" y1="265" x2="330" y2="265" stroke="#66757e" />
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <text x={45 + 285 * v} y="286" textAnchor="middle">
            {v}
          </text>
          <text x="32" y={270 - 245 * v} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={45 + 285 * p.meanPrediction}
            cy={265 - 245 * p.observedFrequency}
            r={5 + Math.sqrt(p.n) / 4}
            fill="#254f91"
          />
          <title>{`${p.n} months: mean prediction ${percent(p.meanPrediction)}, observed ${percent(p.observedFrequency)}`}</title>
        </g>
      ))}
      <text x="185" y="307" textAnchor="middle">
        Predicted probability
      </text>
      <text transform="translate(12 150) rotate(-90)" textAnchor="middle">
        Observed fraction
      </text>
    </svg>
  );
}

export default function App() {
  const [study, setStudy] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [episodeOnset, setEpisodeOnset] = useState(""),
    [period, setPeriod] = useState("2000"),
    [model, setModel] = useState("logistic"),
    [selected, setSelected] = useState("2019-08-01");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/study.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (
          d.schemaVersion !== 1 ||
          !d.artifactId ||
          !d.rows?.length ||
          !d.folds?.length ||
          !d.models?.logistic
        )
          throw Error("Unsupported or incomplete study bundle");
        setStudy(d);
        if (retry > 0) requestAnimationFrame(()=>document.getElementById("selected-month")?.focus());
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);
  const selectFromResults = (date) => {
    setEpisodeOnset("");
    if (+date.slice(0,4) < +period) setPeriod("1953");
    setSelected(date);
    document.getElementById("history-section")?.scrollIntoView({block:"start"});
    document.getElementById("selected-month")?.focus({preventScroll:true});
  };
  const inspectError = selectFromResults;
  const inspectEpisode=(onset)=>{
    setEpisodeOnset(onset);
    if(onset) setSelected(shiftMonth(onset,-1));
    else if(+selected.slice(0,4)<+period) setPeriod("1953");
  };
  const rows = study?.rows.filter(r=>episodeOnset ? r.date >= shiftMonth(episodeOnset,-36) && r.date <= shiftMonth(episodeOnset,24) : +r.date.slice(0,4)>=+period) || [];
  const inspected = study?.rows.find((r) => r.date === selected),
    prediction = inspected?.prediction;
  const nextOnset = study?.rows.find((row, i) => row.USREC === 1 && study.rows[i - 1]?.USREC === 0 && row.date > selected && row.date <= shiftMonth(selected, 12));
  const fold = study?.folds.find((f) => f.id === prediction?.foldId);
  const pickPeriod = (value) => {
    if(value==="episode") return;
    setEpisodeOnset("");
    setPeriod(value);
    if (+selected.slice(0, 4) < +value) setSelected(`${value}-01-01`);
  };
  return (
    <>
      <header>
        <a className="brand" href="/">
          Yield Curve Study
        </a>
        <span className="mode">Historical backtest</span>
        <nav aria-label="Project links">
          <a href="#how-to-use">How to use</a>
          <a href="https://github.com/m21264551-arch/recession">Code ↗</a>
          <a href="https://m21264551.com">Portfolio ↗</a>
        </nav>
      </header>
      <main id="tool" tabIndex={-1}>
        <h1 className="sr-only">Compare yield-curve signals with subsequent recession onsets.</h1>
        {error ? (
          <div role="alert">
            <h2>Study unavailable</h2>
            <p>The saved historical study could not load. Try again to restore the charts.</p>
            <details><summary>Technical details</summary><p>{error}</p></details>
            <button onClick={() => setRetry((r) => r + 1)}>
              Retry snapshot
            </button>{" "}
            <a href="https://github.com/m21264551-arch/recession#reproduce">
              Reproduction instructions
            </a>
          </div>
        ) : !study ? (
          <p role="status">Loading the historical study…</p>
        ) : (
          <>
            <nav className="views" aria-label="Study sections">
              <a href="#history-section">History</a><a href="#results-section">Results</a><a href="#method-section">Data and method</a>
            </nav>
            <section id="history-section" aria-label="Historical signals">
                <div className="chart-controls">
                  <label>
                    Period or recession
                    <select value={episodeOnset ? `episode:${episodeOnset}` : period}
                      onChange={e=>e.target.value.startsWith("episode:") ? inspectEpisode(e.target.value.slice(8)) : pickPeriod(e.target.value)}>
                      <optgroup label="Historical periods">
                        <option value="1953">Full history</option><option value="1980">1980 onward</option>
                        <option value="2000">2000 onward</option><option value="2010">2010 onward</option>
                      </optgroup>
                      <optgroup label="Before and after a recession">
                        {study.episodes.map(e=><option key={e.onset} value={`episode:${e.onset}`}>{month(e.onset)} recession</option>)}
                      </optgroup>
                    </select>
                  </label>
                  <label>
                    Model
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      {Object.entries(names).map(([key, title]) => (
                        <option key={key} value={key}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="month-controls">
                    <label>
                      Selected month
                      <input
                        id="selected-month" type="month"
                        value={selected.slice(0, 7)}
                        min={study.rows[0].date.slice(0, 7)}
                        max={study.rows.at(-1).date.slice(0, 7)}
                        onChange={(e) => {
                          const date = `${e.target.value}-01`;
                          if (study.rows.some((r) => r.date === date)) {
                            setSelected(date);
                            if(episodeOnset && !rows.some(r=>r.date===date)) setEpisodeOnset("");
                            if (+date.slice(0, 4) < +period) setPeriod("1953");
                          }
                        }}
                      />
                    </label>
                    <button
                      aria-label="Previous month"
                      disabled={rows[0]?.date === selected}
                      onClick={() =>
                        setSelected(
                          rows[
                            Math.max(
                              0,
                              rows.findIndex((r) => r.date === selected) - 1,
                            )
                          ].date,
                        )
                      }
                    >
                      ←
                    </button>
                    <button
                      aria-label="Next month"
                      disabled={rows.at(-1)?.date === selected}
                      onClick={() =>
                        setSelected(
                          rows[
                            Math.min(
                              rows.length - 1,
                              rows.findIndex((r) => r.date === selected) + 1,
                            )
                          ].date,
                        )
                      }
                    >
                      →
                    </button>
                  </div>
                </div>
                <div className="signal-layout">
                  <section className="selected" aria-label="Selected month results">
                    <div className="estimate"><p className="selection-label">{month(selected)}</p>
                      <h2>{prediction ? percent(prediction.scores[model]) : "Estimate unavailable"}</h2>
                      <p>{prediction ? "Onset within 12 months" : inspected?.unavailableReason}</p>
                      <p className="target-period">{month(shiftMonth(selected,1))} – {month(shiftMonth(selected,12))}</p></div>
                    <dl className="selected-values"><div><dt>Baseline</dt><dd>{prediction ? percent(prediction.scores.prevalence) : "Unavailable"}</dd></div>
                      <div><dt>Spread</dt><dd>{format(inspected?.spread, 2)} pp</dd></div></dl>
                    <p className="observed-outcome"><strong>Observed:</strong> {inspected?.target === null ? "future window incomplete" : inspected?.target === 1 ? `recession onset in ${nextOnset ? month(nextOnset.date) : "the next 12 months"}` : "no recession began in the next 12 months"}.
                      <span>{inspected?.USREC === 1 ? "Selected month: in recession." : "Selected month: outside recession."}</span></p>

                  </section>
                  <HistoryChart
                    rows={rows}
                    model={model}
                    selected={selected}
                    onSelect={setSelected}
                  />

                </div>
                <div className="historical-examples"><span>Inspect a contrasting case:</span>
                  {study.errors[model].falseAlarmMonths.length>0 && <button onClick={()=>inspectError(study.errors[model].falseAlarmMonths.at(-1))}>False alarm</button>}
                  {study.errors[model].missedPositiveMonths.length>0 && <button onClick={()=>inspectError(study.errors[model].missedPositiveMonths[0])}>Missed month</button>}
                  <a href="#results-section">Check calibration ↓</a>
                </div>
                {nextOnset?.date === "2020-03-01" && <p className="caption">This window includes the pandemic recession. An earlier yield signal does not establish that it anticipated the pandemic’s cause.</p>}
                    {fold && <details className="training"><summary>About the {month(selected)} estimate</summary><p>Baseline is the recession-onset frequency in the eligible training history. The estimate concerns a new onset in the following 12 months.</p><p>Fit on {month(fold.trainingStart)} – {month(fold.trainingEnd)}. Training outcomes end {month(fold.lastTrainingOutcome)}. Refit January {fold.id}.</p></details>}
                <div className="note">
                  Full-backtest Brier score:{" "}
                  {format(study.models[model].metrics.brier)}, compared with{" "}
                  {format(study.models.prevalence.metrics.brier)} for prevalence
                  (lower is better). See Results for errors and calibration.
                </div>
              </section>
            <section id="results-section" aria-labelledby="results-title">
                <h2 id="results-title">Backtest results</h2>
                <p className="metric-reading">Ranking: ROC-AUC and average precision measure whether onset windows score above other months. Probability error: Brier measures squared error in the estimates. Lower is better. Neither a high AUC nor an exact percentage establishes calibration.</p>
                <p>
                  These metrics cover the full evaluation history, independently
                  of the chart period. The 12-month targets overlap. Monthly observations are not independent economic events.
                </p>
                <ResultsTable
                  heads={[
                    "Model",
                    "ROC-AUC ↑",
                    "Average precision ↑",
                    "Brier ↓",
                    "Evaluated months",
                  ]}
                  rows={Object.entries(study.models).map(([key, m]) => [
                    m.name,
                    format(m.metrics.rocAuc),
                    format(m.metrics.averagePrecision),
                    format(m.metrics.brier),
                    m.metrics.n,
                  ])}
                />
                <div className="two-col">
                  <section>
                    <h3>Calibration · {names[model]}</h3>
                    <label>
                      Inspect model
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      >
                        {Object.entries(names).map(([k, n]) => (
                          <option key={k} value={k}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Calibration
                      points={study.models[model].metrics.calibration}
                    />
                    <details className="calibration-data"><summary>Calibration values</summary>
                      <ResultsTable label="Calibration bins" heads={["Mean prediction", "Observed onsets", "Months"]}
                        rows={study.models[model].metrics.calibration.map(p=>[percent(p.meanPrediction),percent(p.observedFrequency),p.n])} />
                    </details>
                    <p className="caption">
                      Ten fixed probability bins. Circle size shows the number of months. The diagonal represents agreement, not a
                      fitted calibration correction.
                    </p>
                  </section>
                  <section>
                    <h3>False alarms and misses</h3>
                    <p>At the illustrative, untuned threshold of 50%:</p>
                    <p>
                      <strong>
                        {study.errors[model].falseAlarmMonths.length}{" "}
                        false-alarm months
                      </strong>{" "}
                      had no onset in the next year.
                    </p>
                    <p>
                      <strong>
                        {study.errors[model].missedPositiveMonths.length} missed
                        positive months
                      </strong>{" "}
                      preceded an onset but stayed below 50%.
                    </p>
                    <p>
                      These counts depend on the threshold. A low probability
                      model can miss every onset at 50% while still
                      rank-ordering months usefully.
                    </p>
                    <details>
                      <summary>Inspect false-alarm months</summary>
                      <ErrorMonths dates={study.errors[model].falseAlarmMonths} onSelect={inspectError} />
                    </details>
                    <details>
                      <summary>Inspect missed positive months</summary>
                      <ErrorMonths dates={study.errors[model].missedPositiveMonths} onSelect={inspectError} />
                    </details>
                  </section>
                </div>
                <h3>Before each recession onset · {names[model]}</h3>
                <ResultsTable
                  heads={[
                    "USREC onset",
                    "Evaluated pre-onset months",
                    "Mean estimate",
                    "Peak estimate",
                    "Months ≥50%",
                    "Brier ↓",
                  ]}
                  rows={study.episodes.map((e) => [
                    <button className="episode-link" onClick={()=>{inspectEpisode(e.onset);document.getElementById("history-section").scrollIntoView({block:"start"});document.getElementById("selected-month").focus({preventScroll:true});}}>{month(e.onset)}</button>,
                    `${e.evaluatedMonths}/12`,
                    percent(e.models[model].meanProbability),
                    percent(e.models[model].maxProbability),
                    e.models[model].monthsAboveHalf,
                    format(e.models[model].metrics.brier),
                  ])}
                />
                <p className="caption">
                  Each row covers the 12 months before the first USREC=1 month.
                  Ranking metrics are undefined within these all-positive windows. Brier remains defined. This target follows USREC’s
                  convention, not the date an NBER announcement was published.
                </p>
                <details className="annual-details"><summary>Annual evaluation details · {study.folds.length} refits</summary>
                <h3>Annual evaluation windows</h3>
                <ResultsTable
                  heads={[
                    "Refit",
                    "Train observations through",
                    "Train outcomes through",
                    "Evaluate through",
                    "ROC-AUC",
                    "AP",
                    "Brier",
                  ]}
                  rows={study.folds.map((f) => [
                    f.id,
                    month(f.trainingEnd),
                    month(f.lastTrainingOutcome),
                    month(f.evaluationEnd),
                    format(f.metrics[model].rocAuc),
                    format(f.metrics[model].averagePrecision),
                    format(f.metrics[model].brier),
                  ])}
                />
                <p className="caption">
                  Undefined means an annual evaluation period contains only one
                  target class. No numeric substitute is inserted.
                </p>
                <a href="/api/study.json" download>Download complete study data ↓</a>
                </details>
              </section>
              <HowToUse />
              <section className="method" id="method-section">
                <h2>Data and method</h2>
                <div className="snapshot">
                  <span>
                    {month(study.observationPeriod.start)} –{" "}
                    {month(study.observationPeriod.end)}
                  </span>
                  <span>
                    FRED snapshot · retrieved{" "}
                    {study.snapshot.retrievedAt.slice(0, 10)}
                  </span>
                  <span>
                    {study.folds.length} annual refits ·{" "}
                    {study.models.logistic.metrics.n} evaluated months
                  </span>
                </div>
                <p className="identity">
                  {study.artifactId} · code {study.codeRevision.slice(0, 8)} ·
                  schema v{study.schemaVersion}
                </p>
                <p>{study.protocol.vintageLimitation}</p>
                <details className="method-detail"><summary>Series, target and model settings</summary>
                <h3>Data and units</h3>
                <p>
                  {study.protocol.spreadDefinition} These are two yields, not a
                  full fitted yield curve.
                </p>
                <ResultsTable
                  heads={["Series", "Definition", "Unit", "Missing months"]}
                  rows={study.snapshot.sources.map((s) => [
                    <a href={s.url}>{s.series}</a>,
                    s.basis,
                    s.unit,
                    study.missingObservations[s.series],
                  ])}
                />
                <p>
                  The study uses GS10, TB3MS and USREC. Missing values are preserved. Models skip rows without all required features. Synthetic histories are
                  restricted to test fixtures.
                </p>
                <h3>Target and eligible training labels</h3>
                <p>
                  {study.protocol.target}. A calendar reindex ensures missing
                  observations cannot shorten the horizon. The final 12 months
                  with unobserved outcomes are excluded from evaluation.
                </p>
                <p>
                  Each January, refit on all eligible earlier observations with
                  at least 20 years of history. A training label’s complete
                  outcome window must end strictly before the refit. The same
                  fitted model is applied throughout that calendar year. Scaling
                  is learned only on the training portion.
                </p>
                <h3>Fixed models, no retrospective tuning</h3>
                <p>
                  Prevalence predicts the mean training target. Logistic
                  regression uses only the standardized spread (C=1). Gradient
                  boosting uses the spread, its three-month lag and change,
                  GS10, and TB3MS: 100 trees, depth 2, learning rate 0.03, seed
                  42. Settings were fixed before the backtest. Evaluation periods were not used to choose them.
                </p>
                </details>
                <details className="method-detail"><summary>Reproduce this snapshot</summary>
                <pre tabIndex={0} role="region" aria-label="Reproduction commands">
                  python -m analysis.acquire{"\n"}python -m analysis.export
                  {"\n"}python -m pytest{"\n"}cd dashboard && npm ci && npm run
                  build
                </pre>
                <p>
                  Skip acquisition to reproduce the checked-in snapshot.
                  Updating downloads a new vintage and changes the data
                  identity. Public browsing reads the committed artifact and
                  does not contact FRED or train on startup.
                </p>
                </details>
                <h3>Limitations</h3>
                <p>
                  There are few recession episodes. Final recession
                  classifications and revised yield data were not all known in
                  real time. Adjacent labels overlap, errors are correlated, and
                  expanding training does not remove changes in monetary
                  regimes. Pandemic recessions need not follow yield-curve
                  mechanisms. The study does not establish a current forecast or
                  a trading strategy.
                </p>
                <p>
                  Snapshot SHA256: <code>{study.snapshot.sha256}</code>
                </p>
              </section>
            <footer>
              <a href="/api/study.json" download="yield-curve-study-v1.json">
                Download data ↓
              </a>
              <span>
                Historical backtest · FRED snapshot{" "}
                {study.snapshot.retrievedAt.slice(0, 10)}
              </span>
            </footer>
          </>
        )}
      {(!study || error) && <HowToUse />}
      </main>
    </>
  );
}

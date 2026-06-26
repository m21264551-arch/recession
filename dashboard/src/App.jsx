import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const API = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '/api')
).replace(/\/$/, '')
const BRAND = 'YieldCurve IQ'

const COLORS = {
  ink: '#101418',
  muted: '#667085',
  grid: '#e8eaef',
  band: '#fde2e2',
  red: '#c62828',
  amber: '#b7791f',
  green: '#1f7a3f',
}

const RECESSIONS = [
  ['1980-01', '1980-07'],
  ['1981-07', '1982-11'],
  ['1990-07', '1991-03'],
  ['2001-03', '2001-11'],
  ['2007-12', '2009-06'],
  ['2020-02', '2020-04'],
]

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'yields', label: 'Yields' },
  { id: 'model', label: 'Model' },
  { id: 'eda', label: 'EDA' },
  { id: 'notes', label: 'Notes' },
]

async function get(path, signal) {
  const response = await fetch(`${API}${path}`, { signal })
  if (!response.ok) throw new Error(`${path} returned ${response.status}`)
  return response.json()
}

function numberOrNull(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function formatNumber(value, digits = 1, fallback = '-') {
  const numeric = numberOrNull(value)
  return numeric === null ? fallback : numeric.toFixed(digits)
}

function formatPercent(value, digits = 1) {
  const numeric = numberOrNull(value)
  return numeric === null ? '-' : `${(numeric * 100).toFixed(digits)}%`
}

function formatRate(value, digits = 1) {
  const numeric = numberOrNull(value)
  return numeric === null ? '-' : `${numeric.toFixed(digits)}%`
}

function formatSigned(value, suffix = '', digits = 2) {
  const numeric = numberOrNull(value)
  if (numeric === null) return '-'
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)}${suffix}`
}

function riskFromProbability(value) {
  const probability = numberOrNull(value) ?? 0

  if (probability > 0.5) {
    return { label: 'High Risk', tone: 'red', color: COLORS.red, summary: 'above the high-risk threshold' }
  }

  if (probability > 0.25) {
    return { label: 'Elevated Risk', tone: 'amber', color: COLORS.amber, summary: 'inside the watch zone' }
  }

  return { label: 'Low Risk', tone: 'green', color: COLORS.green, summary: 'below the watch zone' }
}

function downsample(items, step = 3) {
  return Array.isArray(items) ? items.filter((_, index) => index % step === 0) : []
}

function tickInterval(length, targetTicks) {
  if (!length || length <= targetTicks) return 0
  return Math.max(0, Math.floor(length / targetTicks))
}

function tooltipStyle() {
  return {
    background: '#ffffff',
    border: '1px solid #d9dde5',
    borderRadius: 8,
    boxShadow: '0 18px 40px rgba(16, 24, 40, .12)',
    color: COLORS.ink,
    fontSize: 12,
  }
}

function RecessionBands() {
  return RECESSIONS.map(([start, end]) => (
    <ReferenceArea
      key={`${start}-${end}`}
      x1={start}
      x2={end}
      fill={COLORS.band}
      fillOpacity={0.72}
      strokeOpacity={0}
    />
  ))
}

function LogoLockup() {
  return (
    <div className="logo-lockup">
      <div>
        <strong>{BRAND}</strong>
        <span className="logo-subtitle">Recession Risk Monitor</span>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <main className="center-state">
      <LogoLockup />
      <p>Loading reproducible recession-risk analysis...</p>
    </main>
  )
}

function ErrorState({ error, onRetry }) {
  return (
    <main className="center-state">
      <LogoLockup />
      <h1>Data service unavailable</h1>
      <p>
        Start the local services with <code>./start.sh</code>, then retry.
        {error?.message ? ` ${error.message}.` : ''}
      </p>
      <button type="button" onClick={onRetry}>Retry</button>
    </main>
  )
}

function Pill({ children, tone = 'neutral' }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

function StatCard({ title, value, detail, tone = 'neutral', children }) {
  return (
    <section className="stat-card">
      <div className="stat-title">{title}</div>
      <div className={`stat-value ${tone}`}>{value}</div>
      {detail ? <p>{detail}</p> : null}
      {children}
    </section>
  )
}

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyState({ label = 'No data available' }) {
  return <div className="empty-state">{label}</div>
}

export default function App() {
  const [overview, setOverview] = useState(null)
  const [yields, setYields] = useState(null)
  const [model, setModel] = useState(null)
  const [eda, setEda] = useState(null)
  const [tab, setTab] = useState('overview')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    setStatus('loading')
    setError(null)

    Promise.all([
      get('/overview', controller.signal),
      get('/yields', controller.signal),
      get('/model', controller.signal),
      get('/eda', controller.signal),
    ])
      .then(([overviewData, yieldData, modelData, edaData]) => {
        setOverview(overviewData)
        setYields(yieldData)
        setModel(modelData)
        setEda(edaData)
        setStatus('ready')
      })
      .catch((nextError) => {
        if (nextError.name !== 'AbortError') {
          setError(nextError)
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [refreshVersion])

  const probability = numberOrNull(overview?.current?.probability) ?? 0
  const risk = riskFromProbability(probability)
  const yieldCurve = overview?.yield_curve || {}
  const curveData = ['3M', '2Y', '5Y', '10Y', '30Y']
    .map((term) => ({ term, value: numberOrNull(yieldCurve[term]) }))
    .filter((point) => point.value !== null)
  const spread10y2y = numberOrNull(yieldCurve['10Y']) !== null && numberOrNull(yieldCurve['2Y']) !== null
    ? numberOrNull(yieldCurve['10Y']) - numberOrNull(yieldCurve['2Y'])
    : null
  const curveSignal = overview?.is_inverted ? 'Inverted' : 'Normal'
  const probabilitySeries = useMemo(() => downsample(model?.probability_series), [model])
  const yieldSeries = useMemo(() => downsample(yields?.time_series), [yields])
  const featureImportance = useMemo(() => (
    model?.feature_importance
      ? Object.entries(model.feature_importance)
        .slice(0, 10)
        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: Math.round(value * 100) }))
      : []
  ), [model])
  const coefficients = useMemo(() => (
    model?.lr_coefficients
      ? Object.entries(model.lr_coefficients)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 12)
      : []
  ), [model])
  const correlations = eda?.correlations ? Object.entries(eda.correlations) : []
  const auc = numberOrNull(overview?.model_performance?.gb_auc_mean)

  if (status === 'loading' && !overview) return <LoadingState />
  if (status === 'error') return <ErrorState error={error} onRetry={() => setRefreshVersion((value) => value + 1)} />

  return (
    <main className="app-shell">
      <header className="topbar">
        <LogoLockup />

        <div className="project-intro">
          <h1>Recession risk model driven by the yield curve</h1>
          <p>Interpretable machine learning, time-series validation, and a recruiter-friendly dashboard in one reproducible project.</p>
        </div>

        <div className="topbar-actions">
          <Pill tone="green">Synthetic data</Pill>
          <Pill tone="blue">Time-series CV</Pill>
          <button type="button" onClick={() => setRefreshVersion((value) => value + 1)}>Refresh</button>
        </div>
      </header>

      <section className="hero-grid" aria-label="Project summary">
        <StatCard
          title="12-month recession probability"
          value={formatPercent(probability)}
          detail={`${risk.label}: ${risk.summary}`}
          tone={risk.tone}
        >
          <div className="sparkline" aria-hidden="true">
            <ResponsiveContainer width="100%" height={54}>
              <LineChart data={probabilitySeries.slice(-36)} margin={{ top: 8, right: 2, bottom: 2, left: 2 }}>
                <Line
                  type="monotone"
                  dataKey="ensemble_prob"
                  stroke={risk.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </StatCard>

        <StatCard
          title="Model quality"
          value={auc === null ? '-' : auc.toFixed(3)}
          detail="Gradient boosting AUC, evaluated with forward-looking folds"
        />

        <StatCard
          title="Current curve signal"
          value={curveSignal}
          detail={spread10y2y === null ? '10Y - 2Y spread unavailable' : `10Y - 2Y spread: ${formatSigned(spread10y2y, '%')}`}
          tone={overview?.is_inverted ? 'red' : 'green'}
        />

        <StatCard
          title="Data coverage"
          value={overview?.date_range?.start ? `${overview.date_range.start.slice(0, 4)}-${overview.date_range.end.slice(0, 4)}` : '-'}
          detail={`${overview?.n_observations || '-'} monthly observations`}
        />
      </section>

      <nav className="tabs" aria-label="Dashboard sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <section className="content-grid">
            <Panel
              title="Recession Probability Over Time"
              subtitle="Predicted 12-month recession probability with historical recession bands."
              className="wide"
            >
              {probabilitySeries.length ? (
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={probabilitySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: COLORS.muted }}
                      tickFormatter={(value) => value?.slice(0, 4)}
                      interval={tickInterval(probabilitySeries.length, 10)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: COLORS.muted }}
                      domain={[0, 1]}
                      tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                    />
                    <RecessionBands />
                    <Area
                      type="monotone"
                      dataKey="ensemble_prob"
                      name="Model probability"
                      stroke={COLORS.green}
                      fill={COLORS.green}
                      fillOpacity={0.08}
                      strokeWidth={2.2}
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      name="NBER recession"
                      stroke={COLORS.red}
                      fill={COLORS.red}
                      fillOpacity={0.08}
                      strokeWidth={1}
                      dot={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle()}
                      formatter={(value, name) => [name === 'Model probability' ? formatPercent(value) : value, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </Panel>

            <Panel title="Latest Yield Curve" subtitle="Spot rates across maturities.">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={curveData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis dataKey="term" tick={{ fontSize: 12, fill: COLORS.muted }} />
                  <YAxis domain={[0, 8]} tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(value) => `${value}%`} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {curveData.map((point) => (
                      <Cell key={point.term} fill={point.term === '10Y' ? COLORS.ink : '#8f98a8'} />
                    ))}
                  </Bar>
                  <Tooltip contentStyle={tooltipStyle()} formatter={(value) => [`${formatNumber(value, 2)}%`, 'Yield']} />
                </BarChart>
              </ResponsiveContainer>

              <div className="signal-strip">
                <span>10Y - 2Y Spread</span>
                <strong className={overview?.is_inverted ? 'red' : 'green'}>
                  {spread10y2y === null ? '-' : formatSigned(spread10y2y, '%')}
                </strong>
              </div>
            </Panel>
          </section>

          <section className="insight-grid">
            <Panel title="Signal Reading">
              <ul className="plain-list">
                <li><strong>Probability</strong> estimates whether a recession begins within the next 12 months.</li>
                <li><strong>Curve slope</strong> matters because inversions have historically preceded recessions.</li>
                <li><strong>Green, amber, red</strong> map to low, elevated, and high risk thresholds.</li>
              </ul>
            </Panel>

            <Panel title="Project Depth">
              <ul className="plain-list">
                <li>End-to-end flow: data generation, feature engineering, model validation, API, and UI.</li>
                <li>Validation avoids future leakage with time-series cross-validation.</li>
                <li>Model outputs are translated into product-readable signals.</li>
              </ul>
            </Panel>

            <Panel title="Key Inputs">
              <div className="metric-list">
                <span>Unemployment <strong>{formatRate(overview?.latest_indicators?.unemployment)}</strong></span>
                <span>CPI YoY <strong>{formatRate(overview?.latest_indicators?.cpi_yoy)}</strong></span>
                <span>GDP growth <strong>{formatRate(overview?.latest_indicators?.gdp_growth)}</strong></span>
                <span>ISM PMI <strong>{formatNumber(overview?.latest_indicators?.ism_pmi, 1)}</strong></span>
              </div>
            </Panel>
          </section>
        </>
      )}

      {tab === 'yields' && (
        <>
          <Panel title="Treasury Yields" subtitle="Synthetic monthly Treasury series modeled on historical rate behavior.">
            {yieldSeries.length ? (
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={yieldSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: COLORS.muted }}
                    tickFormatter={(value) => value?.slice(0, 4)}
                    interval={tickInterval(yieldSeries.length, 12)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(value) => `${value}%`} />
                  <RecessionBands />
                  <Line type="monotone" dataKey="t3m" stroke="#9aa4b2" strokeWidth={1} dot={false} name="3-month" />
                  <Line type="monotone" dataKey="t2y" stroke="#5d6678" strokeWidth={1.25} dot={false} name="2-year" />
                  <Line type="monotone" dataKey="t10y" stroke={COLORS.ink} strokeWidth={2} dot={false} name="10-year" />
                  <Line type="monotone" dataKey="t30y" stroke="#2f3848" strokeWidth={1.25} dot={false} name="30-year" />
                  <Tooltip contentStyle={tooltipStyle()} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </Panel>

          <Panel title="10Y - 2Y Spread" subtitle="A negative spread indicates an inverted yield curve.">
            {yieldSeries.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={yieldSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: COLORS.muted }}
                    tickFormatter={(value) => value?.slice(0, 4)}
                    interval={tickInterval(yieldSeries.length, 12)}
                  />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickFormatter={(value) => `${value}%`} />
                  <ReferenceLine y={0} stroke={COLORS.red} strokeDasharray="4 4" />
                  <RecessionBands />
                  <Area
                    type="monotone"
                    dataKey="spread_10y_2y"
                    stroke={COLORS.green}
                    fill={COLORS.green}
                    fillOpacity={0.08}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Tooltip contentStyle={tooltipStyle()} formatter={(value) => [`${value?.toFixed(2)}%`, 'Spread']} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </Panel>
        </>
      )}

      {tab === 'model' && (
        <>
          <section className="hero-grid compact">
            <StatCard title="AUC (CV)" value={formatNumber(model?.cv_metrics?.gb_auc_mean, 3)} detail="Gradient boosting" />
            <StatCard title="Brier score" value={formatNumber(model?.full_metrics?.brier, 3)} detail="Lower is better calibrated" />
            <StatCard title="Accuracy" value={formatPercent(model?.full_metrics?.accuracy)} detail="Full-sample diagnostic" />
            <StatCard
              title="Current probability"
              value={formatPercent(model?.current?.probability)}
              detail={model?.current?.assessment}
              tone={risk.tone}
            />
          </section>

          <section className="content-grid">
            <Panel title="Feature Importance" subtitle="Top gradient boosting predictors." className="wide">
              {featureImportance.length ? (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={featureImportance} layout="vertical" margin={{ left: 145 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: COLORS.ink }} width={135} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {featureImportance.map((_, index) => (
                        <Cell key={index} fill={index < 3 ? COLORS.green : '#aab2c0'} />
                      ))}
                    </Bar>
                    <Tooltip contentStyle={tooltipStyle()} formatter={(value) => [`${value}%`, 'Importance']} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </Panel>

            <Panel title="Calibration Curve" subtitle="Predicted vs observed frequency.">
              {model?.calibration_curve?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis type="number" dataKey="predicted" tick={{ fontSize: 11, fill: COLORS.muted }} domain={[0, 1]} name="Predicted" />
                    <YAxis type="number" dataKey="actual" tick={{ fontSize: 11, fill: COLORS.muted }} domain={[0, 1]} name="Actual" />
                    <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={COLORS.grid} strokeDasharray="4 4" />
                    <Scatter data={model.calibration_curve} fill={COLORS.green} r={5} />
                    <Tooltip contentStyle={tooltipStyle()} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </Panel>
          </section>

          <Panel title="Logistic Regression Coefficients" subtitle="Interpretable baseline features ranked by absolute coefficient.">
            <div className="coefficient-grid">
              {coefficients.map(([name, value]) => (
                <div className="coefficient-row" key={name}>
                  <span>{name.replace(/_/g, ' ')}</span>
                  <strong className={value < 0 ? 'green' : 'red'}>{formatSigned(value, '', 3)}</strong>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {tab === 'eda' && (
        <>
          <Panel title="Correlation with Forward Recession" subtitle="How engineered indicators relate to the 12-month target.">
            <div className="correlation-grid">
              {correlations.map(([name, value]) => (
                <div className="correlation-row" key={name}>
                  <div className="mini-bar">
                    <span style={{ width: `${Math.min(Math.abs(value) * 100, 100)}%`, background: value < 0 ? COLORS.green : COLORS.red }} />
                  </div>
                  <span>{name.replace(/_/g, ' ')}</span>
                  <strong className={value < 0 ? 'green' : 'red'}>{formatSigned(value, '', 3)}</strong>
                </div>
              ))}
            </div>
          </Panel>

          <section className="content-grid">
            <Panel title="Spread Distribution" subtitle="Negative values represent inversion.">
              {eda?.spread_distribution?.bins?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={eda.spread_distribution.bins.map((bin, index) => ({ bin, count: eda.spread_distribution.counts[index] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                    <XAxis dataKey="bin" tick={{ fontSize: 10, fill: COLORS.muted }} />
                    <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} />
                    <ReferenceLine x={0} stroke={COLORS.red} strokeDasharray="4 4" />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {eda.spread_distribution.bins.map((bin, index) => (
                        <Cell key={index} fill={bin < 0 ? COLORS.red : COLORS.green} opacity={bin < 0 ? 0.72 : 0.82} />
                      ))}
                    </Bar>
                    <Tooltip contentStyle={tooltipStyle()} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </Panel>

            <Panel title="Statistical Checks" subtitle="A compact read on signal strength.">
              <div className="metric-list large">
                <span>T-test p-value <strong>{formatNumber(eda?.statistical_tests?.spread_ttest?.p_value, 6)}</strong></span>
                <span>Chi-square p-value <strong>{formatNumber(eda?.statistical_tests?.inversion_chi2?.p_value, 6)}</strong></span>
                <span>
                  Average inversion lead time
                  <strong>
                    {eda?.inversion_lead_times?.length
                      ? `${formatNumber(eda.inversion_lead_times.reduce((sum, item) => sum + item.lead_months, 0) / eda.inversion_lead_times.length, 1)} mo`
                      : '-'}
                  </strong>
                </span>
              </div>
            </Panel>
          </section>
        </>
      )}

      {tab === 'notes' && (
        <section className="notes-layout">
          <Panel title="Why Synthetic Data?" subtitle="A practical portfolio constraint turned into a reproducibility feature.">
            <p className="body-copy">
              Real-world macro datasets require API keys, refresh schedules, and licensing decisions.
              This project generates realistic synthetic data so reviewers can clone, run, and inspect the full pipeline without external credentials.
            </p>
          </Panel>

          <Panel title="Architecture">
            <ol className="step-list">
              <li>Generate yield curves, recession labels, and macro indicators.</li>
              <li>Engineer spreads, rolling averages, inversion flags, and lead-time features.</li>
              <li>Train logistic regression and gradient boosting with time-series folds.</li>
              <li>Serve model outputs through FastAPI and visualize them in React.</li>
            </ol>
          </Panel>

          <Panel title="Next Additions">
            <ul className="plain-list">
              <li>Swap in live FRED series behind the same feature pipeline.</li>
              <li>Add model cards and threshold sensitivity analysis.</li>
              <li>Package scheduled static snapshots for low-cost hosting.</li>
            </ul>
          </Panel>
        </section>
      )}

      <footer className="app-footer">
        <span>{BRAND} is an educational analytics project, not financial advice.</span>
        <span>Built for transparent modeling, product thinking, and clear communication.</span>
      </footer>
    </main>
  )
}

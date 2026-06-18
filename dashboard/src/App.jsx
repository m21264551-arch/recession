import { useState, useEffect } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, Cell, ReferenceLine, ReferenceArea
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const get = (path) => fetch(`${API}${path}`).then(r => r.json())

// ── STYLES ──
const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'20px 24px' }
const label = { fontFamily:'var(--mono)', fontSize:10, letterSpacing:'.1em', color:'var(--text3)', textTransform:'uppercase', marginBottom:8 }
const h2s = { fontSize:20, fontWeight:600, marginBottom:4 }
const section = { marginBottom:40 }

function Stat({ label: l, value, sub, color }) {
  return (
    <div style={card}>
      <div style={label}>{l}</div>
      <div style={{ fontSize:32, fontWeight:600, color: color || 'var(--text)', lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={section}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <span style={{ ...h2s, color:'var(--text)' }}>{title}</span>
        <div style={{ flex:1, height:1, background:'var(--surface2)' }} />
      </div>
      {children}
    </div>
  )
}

// ── RECESSION BANDS for charts ──
const RECESSIONS = [
  ["1980-01","1980-07"],["1981-07","1982-11"],["1990-07","1991-03"],
  ["2001-03","2001-11"],["2007-12","2009-06"],["2020-02","2020-04"],
]

function RecBands() {
  return RECESSIONS.map(([s, e], i) => (
    <ReferenceArea key={i} x1={s} x2={e} fill="rgba(248,113,113,0.08)" strokeOpacity={0} />
  ))
}

// ── MAIN DASHBOARD ──
export default function App() {
  const [overview, setOverview] = useState(null)
  const [yields, setYields] = useState(null)
  const [model, setModel] = useState(null)
  const [eda, setEda] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([get('/overview'), get('/yields'), get('/model'), get('/eda')])
      .then(([o, y, m, e]) => { setOverview(o); setYields(y); setModel(m); setEda(e) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:24, fontWeight:600 }}>RECESSION</div>
      <div style={{ fontSize:13, color:'var(--text3)' }}>Loading analysis...</div>
    </div>
  )

  const prob = overview?.current?.probability || 0
  const probPct = (prob * 100).toFixed(1)
  const probColor = prob > 0.5 ? 'var(--red)' : prob > 0.25 ? 'var(--amber)' : 'var(--green)'

  // Downsample time series for performance
  const yieldTs = yields?.time_series?.filter((_, i) => i % 3 === 0) || []
  const probTs = model?.probability_series?.filter((_, i) => i % 3 === 0) || []
  const featureImp = model?.feature_importance ? Object.entries(model.feature_importance).slice(0, 12).map(([k, v]) => ({ name: k.replace(/_/g, ' '), value: Math.round(v * 100) })) : []
  const rocData = model?.roc_curve || []
  const calData = model?.calibration_curve || []

  // Tabs
  const tabs = ['overview', 'yields', 'model', 'eda']

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 32px' }}>
      {/* HEADER */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
        <div>
          <div style={{ fontSize:28, fontWeight:600, letterSpacing:'.02em' }}>
            RECESSION <span style={{ color:'var(--cyan)', fontSize:14, fontWeight:400, marginLeft:8 }}>probability engine</span>
          </div>
          <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
            {overview?.n_observations} observations · {overview?.date_range?.start} to {overview?.date_range?.end}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:12, height:12, borderRadius:'50%', background:probColor, boxShadow:`0 0 12px ${probColor}` }} />
          <div>
            <div style={{ fontFamily:'var(--mono)', fontSize:24, fontWeight:600, color:probColor }}>{probPct}%</div>
            <div style={{ fontSize:10, color:'var(--text3)' }}>12-month recession probability</div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--surface2)', paddingBottom:0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            fontFamily:'var(--mono)', fontSize:11, letterSpacing:'.08em', textTransform:'uppercase',
            padding:'10px 20px', background:'none', border:'none', cursor:'pointer',
            color: tab === t ? 'var(--cyan)' : 'var(--text3)',
            borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
            marginBottom:-1,
          }}>{t}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === 'overview' && (
        <>
          {/* Stat cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:32 }}>
            <Stat label="Recession Prob." value={`${probPct}%`} sub={overview?.current?.assessment} color={probColor} />
            <Stat label="10Y-2Y Spread" value={`${(overview?.yield_curve?.['10Y'] - overview?.yield_curve?.['2Y'])?.toFixed(2) || '—'}%`} sub={overview?.is_inverted ? '⚠ INVERTED' : 'Normal'} color={overview?.is_inverted ? 'var(--red)' : 'var(--green)'} />
            <Stat label="Unemployment" value={`${overview?.latest_indicators?.unemployment}%`} />
            <Stat label="CPI (YoY)" value={`${overview?.latest_indicators?.cpi_yoy}%`} />
            <Stat label="Model AUC" value={overview?.model_performance?.gb_auc_mean?.toFixed(3)} sub="5-fold time series CV" color="var(--cyan)" />
          </div>

          {/* Probability over time */}
          <Section title="Recession Probability Over Time">
            <div style={card}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={probTs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                  <XAxis dataKey="date" tick={{ fontSize:10, fill:'var(--text3)' }} tickFormatter={d => d?.slice(0,4)} interval={Math.floor(probTs.length/10)} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} domain={[0, 1]} tickFormatter={v => `${(v*100).toFixed(0)}%`} />
                  {RecBands()}
                  <Area type="monotone" dataKey="ensemble_prob" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.15} strokeWidth={1.5} dot={false} name="Model Probability" />
                  <Area type="monotone" dataKey="actual" stroke="var(--red)" fill="var(--red)" fillOpacity={0.1} strokeWidth={0.5} dot={false} name="Actual Recession" />
                  <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', fontSize:11 }} formatter={(v, n) => [n === 'Model Probability' ? `${(v*100).toFixed(1)}%` : v, n]} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>Red shaded areas = NBER recession periods. Cyan = model-predicted probability.</div>
            </div>
          </Section>

          {/* Current yield curve shape */}
          <Section title="Current Yield Curve">
            <div style={{ ...card, display:'flex', gap:32, alignItems:'center' }}>
              <div style={{ flex:1 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={overview?.yield_curve ? Object.entries(overview.yield_curve).map(([k, v]) => ({ term: k, yield: v })) : []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                    <XAxis dataKey="term" tick={{ fontSize:11, fill:'var(--text2)' }} />
                    <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} />
                    <Line type="monotone" dataKey="yield" stroke="var(--cyan)" strokeWidth={2} dot={{ r:5, fill:'var(--cyan)' }} />
                    <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', fontSize:11 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ width:200 }}>
                {overview?.yield_curve && Object.entries(overview.yield_curve).map(([k, v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--surface2)', fontSize:13 }}>
                    <span style={{ color:'var(--text3)' }}>{k}</span>
                    <span style={{ fontFamily:'var(--mono)', fontWeight:500 }}>{v}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </>
      )}

      {/* ═══ YIELDS TAB ═══ */}
      {tab === 'yields' && (
        <>
          <Section title="Treasury Yields (1976–2025)">
            <div style={card}>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={yieldTs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'var(--text3)' }} tickFormatter={d => d?.slice(0,4)} interval={Math.floor(yieldTs.length/12)} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} />
                  {RecBands()}
                  <Line type="monotone" dataKey="t3m" stroke="#94a3b8" strokeWidth={1} dot={false} name="3-Month" />
                  <Line type="monotone" dataKey="t2y" stroke="#fbbf24" strokeWidth={1} dot={false} name="2-Year" />
                  <Line type="monotone" dataKey="t10y" stroke="#22d3ee" strokeWidth={1.5} dot={false} name="10-Year" />
                  <Line type="monotone" dataKey="t30y" stroke="#4ade80" strokeWidth={1} dot={false} name="30-Year" />
                  <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', fontSize:10 }} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="10Y-2Y Spread (Inversion Signal)">
            <div style={card}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={yieldTs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:'var(--text3)' }} tickFormatter={d => d?.slice(0,4)} interval={Math.floor(yieldTs.length/12)} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} />
                  <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 4" />
                  {RecBands()}
                  <Area type="monotone" dataKey="spread_10y_2y" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.15} strokeWidth={1.5} dot={false} />
                  <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', fontSize:10 }} formatter={v => [`${v?.toFixed(2)}%`, 'Spread']} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>When spread goes below zero (red dashed line), the yield curve is inverted — historically precedes recessions by 6-18 months.</div>
            </div>
          </Section>

          <div style={{ ...card, marginBottom:32 }}>
            <div style={label}>INVERSION STATISTICS</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginTop:8 }}>
              <div><span style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:600, color:'var(--cyan)' }}>{yields?.inversion_stats?.total_months_inverted}</span><span style={{ fontSize:12, color:'var(--text3)', marginLeft:6 }}>months inverted</span></div>
              <div><span style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:600, color:'var(--cyan)' }}>{yields?.inversion_stats?.pct_time_inverted}%</span><span style={{ fontSize:12, color:'var(--text3)', marginLeft:6 }}>of total period</span></div>
              <div><span style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:600, color:'var(--cyan)' }}>{yields?.inversion_stats?.total_months}</span><span style={{ fontSize:12, color:'var(--text3)', marginLeft:6 }}>total observations</span></div>
            </div>
          </div>
        </>
      )}

      {/* ═══ MODEL TAB ═══ */}
      {tab === 'model' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:32 }}>
            <Stat label="AUC (CV)" value={model?.cv_metrics?.gb_auc_mean?.toFixed(3)} color="var(--cyan)" sub="Gradient Boosting" />
            <Stat label="Brier Score" value={model?.full_metrics?.brier?.toFixed(3)} sub="Lower = better calibrated" />
            <Stat label="Accuracy" value={`${(model?.full_metrics?.accuracy * 100)?.toFixed(1)}%`} />
            <Stat label="Current P(recession)" value={`${(model?.current?.probability * 100)?.toFixed(1)}%`} color={probColor} sub={model?.current?.assessment} />
          </div>

          <Section title="Feature Importance (Gradient Boosting)">
            <div style={card}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={featureImp} layout="vertical" margin={{ left:140 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                  <XAxis type="number" tick={{ fontSize:10, fill:'var(--text3)' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:11, fill:'var(--text2)' }} width={130} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {featureImp.map((_, i) => <Cell key={i} fill={i < 3 ? 'var(--cyan)' : 'var(--surface2)'} />)}
                  </Bar>
                  <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', fontSize:11 }} formatter={v => [`${v}%`, 'Importance']} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:32 }}>
            <Section title="ROC Curve">
              <div style={card}>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={rocData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                    <XAxis dataKey="fpr" tick={{ fontSize:10, fill:'var(--text3)' }} label={{ value:'FPR', position:'bottom', fontSize:10, fill:'var(--text3)' }} />
                    <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} label={{ value:'TPR', angle:-90, position:'left', fontSize:10, fill:'var(--text3)' }} />
                    <ReferenceLine x1={0} y1={0} x2={1} y2={1} stroke="var(--surface2)" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="tpr" stroke="var(--cyan)" strokeWidth={2} dot={false} />
                    <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', fontSize:10 }} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', marginTop:4 }}>AUC = {model?.full_metrics?.auc}</div>
              </div>
            </Section>

            <Section title="Calibration Curve">
              <div style={card}>
                <ResponsiveContainer width="100%" height={250}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                    <XAxis dataKey="predicted" tick={{ fontSize:10, fill:'var(--text3)' }} domain={[0,1]} name="Predicted" />
                    <YAxis dataKey="actual" tick={{ fontSize:10, fill:'var(--text3)' }} domain={[0,1]} name="Actual" />
                    <ReferenceLine stroke="var(--surface2)" strokeDasharray="4 4" segment={[{x:0,y:0},{x:1,y:1}]} />
                    <Scatter data={calData} fill="var(--cyan)" r={5} />
                    <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', fontSize:10 }} />
                  </ScatterChart>
                </ResponsiveContainer>
                <div style={{ fontSize:10, color:'var(--text3)', textAlign:'center', marginTop:4 }}>Brier Score = {model?.full_metrics?.brier} (perfect = 0)</div>
              </div>
            </Section>
          </div>

          {/* LR Coefficients */}
          <Section title="Logistic Regression Coefficients">
            <div style={{ ...card, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {model?.lr_coefficients && Object.entries(model.lr_coefficients).sort((a,b) => Math.abs(b[1]) - Math.abs(a[1])).map(([k, v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'6px 8px', background:'var(--bg)', borderRadius:4, fontSize:12 }}>
                  <span style={{ color:'var(--text2)' }}>{k.replace(/_/g,' ')}</span>
                  <span style={{ fontFamily:'var(--mono)', color: v < 0 ? 'var(--green)' : 'var(--red)', fontWeight:500 }}>{v > 0 ? '+' : ''}{v.toFixed(3)}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>Negative coefficient = reduces recession probability. Most negative = strongest protective signal.</div>
          </Section>
        </>
      )}

      {/* ═══ EDA TAB ═══ */}
      {tab === 'eda' && (
        <>
          <Section title="Correlation with Recession (12-month forward)">
            <div style={{ ...card, display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {eda?.correlations && Object.entries(eda.correlations).map(([k, v]) => (
                <div key={k} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:'var(--bg)', borderRadius:4 }}>
                  <div style={{ width:60, height:8, background:'var(--surface2)', borderRadius:4, overflow:'hidden', flexShrink:0 }}>
                    <div style={{ width:`${Math.abs(v)*100}%`, height:'100%', background: v < 0 ? 'var(--green)' : 'var(--red)', borderRadius:4 }} />
                  </div>
                  <span style={{ fontSize:12, color:'var(--text2)', flex:1 }}>{k.replace(/_/g,' ')}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:12, fontWeight:500, color: v < 0 ? 'var(--green)' : 'var(--red)' }}>{v > 0 ? '+' : ''}{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>
              Negative correlation (green) = when this indicator increases, recession probability decreases.
              The 10Y-3M spread has the strongest inverse relationship — when it narrows/inverts, recessions follow.
            </div>
          </Section>

          <Section title="Statistical Tests">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={card}>
                <div style={label}>T-TEST: SPREAD PRE-RECESSION VS NORMAL</div>
                <div style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:600 }}>t = {eda?.statistical_tests?.spread_ttest?.t_stat}</div>
                <div style={{ fontSize:12, color: eda?.statistical_tests?.spread_ttest?.p_value < 0.05 ? 'var(--green)' : 'var(--text3)' }}>
                  p = {eda?.statistical_tests?.spread_ttest?.p_value?.toFixed(6)} {eda?.statistical_tests?.spread_ttest?.p_value < 0.05 ? '✓ Significant' : ''}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>Yield spreads are significantly lower in the 12 months preceding recessions.</div>
              </div>
              <div style={card}>
                <div style={label}>CHI-SQUARE: INVERSION → RECESSION</div>
                <div style={{ fontFamily:'var(--mono)', fontSize:20, fontWeight:600 }}>χ² = {eda?.statistical_tests?.inversion_chi2?.chi2}</div>
                <div style={{ fontSize:12, color: eda?.statistical_tests?.inversion_chi2?.p_value < 0.05 ? 'var(--green)' : 'var(--text3)' }}>
                  p = {eda?.statistical_tests?.inversion_chi2?.p_value?.toFixed(6)} {eda?.statistical_tests?.inversion_chi2?.p_value < 0.05 ? '✓ Significant' : ''}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>Yield curve inversion is significantly associated with subsequent recessions.</div>
              </div>
            </div>
          </Section>

          <Section title="Spread Distribution">
            <div style={card}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={eda?.spread_distribution?.bins?.map((b, i) => ({ bin: b, count: eda.spread_distribution.counts[i] })) || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                  <XAxis dataKey="bin" tick={{ fontSize:9, fill:'var(--text3)' }} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} />
                  <ReferenceLine x={0} stroke="var(--red)" strokeDasharray="4 4" />
                  <Bar dataKey="count" radius={[2,2,0,0]}>
                    {(eda?.spread_distribution?.bins || []).map((b, i) => (
                      <Cell key={i} fill={b < 0 ? 'rgba(248,113,113,0.6)' : 'rgba(34,211,238,0.4)'} />
                    ))}
                  </Bar>
                  <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', fontSize:10 }} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:4 }}>Red bars = negative spread (inverted yield curve). The left tail is the danger zone.</div>
            </div>
          </Section>

          {eda?.inversion_lead_times?.length > 0 && (
            <Section title="Inversion Lead Time Before Recessions">
              <div style={{ ...card, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
                {eda.inversion_lead_times.map((lt, i) => (
                  <div key={i} style={{ padding:'10px 14px', background:'var(--bg)', borderRadius:4 }}>
                    <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--text3)' }}>{lt.recession}</div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:600, color:'var(--amber)' }}>{lt.lead_months} mo</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>before recession start</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:8 }}>Average lead time: {(eda.inversion_lead_times.reduce((a,b) => a + b.lead_months, 0) / eda.inversion_lead_times.length).toFixed(1)} months</div>
            </Section>
          )}
        </>
      )}

      {/* FOOTER */}
      <div style={{ borderTop:'1px solid var(--surface2)', paddingTop:20, marginTop:40, display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)' }}>
        <div>Recession — Yield Curve Probability Engine</div>
        <div>Data: Simulated US Treasury yields modeled on FRED historical patterns. Research: Estrella & Mishkin (1998), Ang et al. (2006).</div>
      </div>
    </div>
  )
}

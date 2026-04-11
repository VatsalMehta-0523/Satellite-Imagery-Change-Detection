import React, { useState } from 'react';
import { fetchAPI } from '../../utils/api';

const REPORT_TYPES = [
  { id: 'standard',     label: 'Standard',     icon: '◈', desc: 'Balanced overview with key metrics' },
  { id: 'technical',    label: 'Technical',    icon: '◉', desc: 'In-depth with spectral analysis' },
  { id: 'executive',    label: 'Executive',    icon: '✦', desc: 'High-level summary for decision makers' },
];

const DETAIL_LEVELS = [
  { id: 'summary',  label: 'Summary',  desc: 'Concise highlights' },
  { id: 'standard', label: 'Standard', desc: 'Balanced depth' },
  { id: 'expert',   label: 'Expert',   desc: 'Full analysis' },
];

const SEVERITY_COLORS = { info: 'var(--accent)', warning: 'var(--warning)', critical: 'var(--danger)' };
const STATUS_COLORS = { compliant: 'var(--success)', warning: 'var(--warning)', violation: 'var(--danger)' };

export default function InsightsPage({ projectId, addNotification }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reportType, setReportType] = useState('standard');
  const [detailLevel, setDetailLevel] = useState('standard');

  const generateReport = async () => {
    if (!projectId) return addNotification('MISSION DATA MISSING: SELECT PROJECT', 'warning');
    setLoading(true);
    setShowModal(false);
    try {
      const res = await fetchAPI.getReport(projectId);
      setReport(res.data.report);
      addNotification('INTELLIGENCE DOSSIER GENERATED', 'success');
    } catch (err) {
      addNotification('REPORT GENERATION FAILED', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>
              Intelligence Reports
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Gemini-powered geospatial intelligence dossier
            </p>
          </div>
          <button onClick={() => setShowModal(true)} disabled={loading || !projectId} style={{
            padding: '12px 24px', borderRadius: 10, border: 'none',
            background: projectId ? 'var(--accent)' : 'var(--bg-hover)',
            color: projectId ? 'var(--bg-deep)' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
            cursor: projectId ? 'pointer' : 'not-allowed',
            boxShadow: projectId ? 'var(--glow-accent)' : 'none',
          }}>
            {loading ? 'Compiling...' : '✦ Generate Dossier'}
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '100px 20px' }}><LoadingIndicator /></div>}

        {!report && !loading && (
          <div style={{ textAlign: 'center', padding: '100px 20px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>✦</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}>Ready to generate intelligence</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click "Generate Dossier" to start AI-powered analysis</div>
          </div>
        )}

        {report && !loading && (
          <div style={{ display: 'grid', gap: 24 }}>
            {/* Executive Summary Section */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: 2, marginBottom: 12 }}>EXECUTIVE SUMMARY</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, marginBottom: 16 }}>{report.title}</h2>
              <p style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text-secondary)' }}>{report.executive_summary}</p>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <MetricCard label="VEGETATION DELTA" value={report.key_metrics?.vegetation_change_pct} unit="%" color="var(--success)" />
              <MetricCard label="URBAN EXPANSION" value={report.key_metrics?.urban_expansion_pct} unit="%" color="var(--accent2)" />
              <MetricCard label="WATER SURFACE" value={report.key_metrics?.water_change_pct} unit="%" color="var(--accent)" />
              <MetricCard label="RISK SCORE" value={report.key_metrics?.overall_risk_score} unit="" color="var(--danger)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
              <div style={{ display: 'grid', gap: 20 }}>
                {report.sections?.map((s, i) => (
                  <div key={i} className="glass-card" style={{ padding: 24, borderRadius: 14, borderLeft: `4px solid ${SEVERITY_COLORS[s.severity] || 'var(--border)'}` }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: SEVERITY_COLORS[s.severity], marginBottom: 12, letterSpacing: 1 }}>{s.heading?.toUpperCase()}</div>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{s.content}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: 20 }}>
                <div className="glass-card" style={{ padding: 24, borderRadius: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: 2, marginBottom: 20 }}>COMPLIANCE AUDIT</div>
                  <div style={{ display: 'grid', gap: 16 }}>
                    {report.compliance_assessment?.map((c, i) => (
                      <div key={i} style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{c.rule}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: STATUS_COLORS[c.status], color: '#000' }}>{c.status?.toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: 24, borderRadius: 14, background: 'var(--accent-glow)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: 2, marginBottom: 16 }}>REC. ACTIONS</div>
                  {report.recommendations?.map((r, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', gap: 8 }}>
                      <span>▶</span> {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {report.confidence_note && (
              <div style={{ padding: 14, background: 'rgba(74,96,128,0.1)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>ℹ</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{report.confidence_note}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Config Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,20,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ padding: 40, width: 480, borderRadius: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Configure Report</h2>
            <div style={{ marginBottom: 32 }}>
              <label style={labelStyle}>REPORT TYPE</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {REPORT_TYPES.map(rt => (
                  <button key={rt.id} onClick={() => setReportType(rt.id)} style={{ flex: 1, padding: 16, borderRadius: 12, border: `1px solid ${reportType === rt.id ? 'var(--accent)' : 'var(--border)'}`, background: reportType === rt.id ? 'var(--accent-glow)' : 'transparent', color: reportType === rt.id ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}>{rt.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>DETAIL LEVEL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DETAIL_LEVELS.map(dl => (
                  <button key={dl.id} onClick={() => setDetailLevel(dl.id)} style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: `1px solid ${detailLevel === dl.id ? 'var(--accent)' : 'var(--border)'}`, background: detailLevel === dl.id ? 'var(--accent-glow)' : 'transparent', color: detailLevel === dl.id ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer' }}>{dl.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={() => setShowModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={generateReport} style={primaryBtnStyle}>✦ Generate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, unit, color }) {
  return (
    <div className="glass-card" style={{ padding: 20, borderRadius: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{typeof value === 'number' ? value.toFixed(1) : value}{unit}</div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const color = SEVERITY_COLORS[severity] || 'var(--text-muted)';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, background: `${color}1a`, fontFamily: 'var(--font-mono)', fontSize: 9, color, letterSpacing: 1 }}>
      {severity?.toUpperCase()}
    </span>
  );
}

function LoadingIndicator() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 60, height: 60, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 2 }}>GEMINI IS ANALYZING PIXELS...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle = { display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1.5, marginBottom: 10 };
const cancelBtnStyle = { flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 };
const primaryBtnStyle = { flex: 2, padding: '12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--bg-deep)', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-display)', cursor: 'pointer', boxShadow: 'var(--glow-accent)' };

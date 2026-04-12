import React, { useState } from 'react';
import { fetchAPI, insightsAPI } from '../../utils/api';

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
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!projectId) return addNotification('MISSION DATA MISSING: SELECT PROJECT', 'warning');
    setIsExporting(true);
    setLoading(true);
    try {
      const response = await insightsAPI.downloadReport(projectId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `UrbanEye_Mission_${projectId}.pdf`);
      document.body.appendChild(link);
      link.click();
      addNotification('Intelligence Report ready for download', 'success');
    } catch (e) {
      addNotification('Failed to generate PDF report', 'error');
    } finally {
      setIsExporting(false);
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
          <button onClick={handleExportPDF} disabled={loading || isExporting || !projectId} style={{
            padding: '12px 24px', borderRadius: 10, border: 'none',
            background: projectId ? 'var(--accent)' : 'var(--bg-hover)',
            color: projectId ? 'var(--bg-deep)' : 'var(--text-muted)',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
            cursor: (projectId && !loading) ? 'pointer' : 'not-allowed',
            boxShadow: projectId ? 'var(--glow-accent)' : 'none',
          }}>
            {loading ? 'COMPILING MISSION DATA...' : '✦ Generate Report'}
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '100px 20px' }}><LoadingIndicator /></div>}

        {!loading && (
          <div style={{ textAlign: 'center', padding: '100px 20px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>✦</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}>Ready to generate intelligence</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click "Generate Report" to start AI-powered analysis</div>
          </div>
        )}
      </div>
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

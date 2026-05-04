import React, { useState, useEffect } from 'react';
import { insightsAPI, fetchAPI } from '../../utils/api';

export default function InsightsPage({ projectId, addNotification, jobStatus }) {
  const [insights, setInsights] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const isInsightsReady = jobStatus?.insights === 'ready';

  useEffect(() => {
    if (!projectId) return;
    if (isInsightsReady && jobStatus?.results?.insights) {
      setInsights(jobStatus.results.insights);
    }
  }, [projectId, isInsightsReady, jobStatus]);

  const handleGenerate = async () => {
    if (!projectId) { addNotification('No project loaded', 'error'); return; }
    setIsGenerating(true);
    try {
      const res = await insightsAPI.generate({ project_id: projectId });
      setInsights(res.data);
      addNotification('Intelligence report generated', 'success');
    } catch { addNotification('Failed to generate insights', 'error'); }
    finally { setIsGenerating(false); }
  };

  const handleExport = async () => {
    if (!projectId) return;
    setIsExporting(true);
    try {
      const res = await insightsAPI.downloadReport(projectId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `UrbanEye_Report_${projectId}.pdf`; document.body.appendChild(a); a.click();
      addNotification('Report downloaded', 'success');
    } catch { addNotification('Export failed', 'error'); }
    finally { setIsExporting(false); }
  };

  if (!projectId) return (
    <div className="page-content">
      <EmptyState icon="🧠" title="No mission loaded" desc="Complete a satellite imagery mission to generate intelligence insights." />
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Intelligence Report</span>
          <span className="badge badge-accent">#{projectId}</span>
          {isInsightsReady && <span className="badge badge-success">Ready</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {insights && <button className="btn btn-secondary btn-sm" onClick={handleExport} disabled={isExporting}>{isExporting ? 'Exporting…' : '↓ PDF'}</button>}
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <><span className="spinner spinner-sm" /> Generating…</> : insights ? 'Regenerate' : 'Generate Report'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!insights && !isGenerating && (
          <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 26 }}>🧠</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Generate Intelligence Report</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28 }}>
              Analyze your mission data with Gemini AI to produce an actionable intelligence report covering land-use changes, environmental impact, and compliance.
            </p>
            <button className="btn btn-primary btn-lg" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? <><span className="spinner spinner-sm" /> Analyzing…</> : 'Run Intelligence Analysis'}
            </button>
          </div>
        )}

        {isGenerating && (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Analyzing mission data…</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>Gemini AI is synthesizing spectral, spatial, and temporal observations</p>
          </div>
        )}

        {insights && !isGenerating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860, margin: '0 auto' }}>
            {/* Summary card */}
            {(insights.summary || insights.executive_summary) && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📋</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Executive Summary</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mission {projectId} · AI-generated</div>
                  </div>
                  {insights.severity && (
                    <span className={`badge ${insights.severity === 'critical' ? 'badge-error' : insights.severity === 'high' ? 'badge-warning' : insights.severity === 'low' ? 'badge-success' : 'badge-neutral'}`} style={{ marginLeft: 'auto' }}>
                      {insights.severity?.toUpperCase()}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-primary)' }}>{insights.summary || insights.executive_summary}</p>
              </div>
            )}

            {/* Key findings */}
            {insights.key_findings && insights.key_findings.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>🔍</span> Key Findings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {insights.key_findings.map((finding, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-subtle)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>{finding}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {insights.recommendations && insights.recommendations.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>✅</span> Recommendations
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insights.recommendations.map((rec, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--success-subtle)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.15)' }}>
                      <span style={{ color: 'var(--success)', fontSize: 14, flexShrink: 0 }}>→</span>
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)' }}>{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw text fallback */}
            {typeof insights === 'string' && (
              <div className="card" style={{ padding: 24 }}>
                <div className="prose" dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, '<br/>') }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="empty-state" style={{ height: '100%', marginTop: 60 }}>
      <div className="empty-icon" style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 300, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

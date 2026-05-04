import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI, changeDetectionAPI, insightsAPI, getImageUrl } from '../../utils/api';

export default function ChangeDetectionPage({ projectId, addNotification, jobStatus }) {
  const [result, setResult] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [activeView, setActiveView] = useState('comparison'); // 'comparison' | 'mask'
  const sliderRef = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    const stopDrag = () => { dragging.current = false; };
    window.addEventListener('mouseup', stopDrag);
    return () => window.removeEventListener('mouseup', stopDrag);
  }, []);

  const isReady = jobStatus?.change_detection === 'ready';
  const isSyncing = jobStatus?.change_detection === 'syncing';
  const isPending = (jobStatus?.change_detection === 'pending' || !jobStatus?.change_detection) && !isReady && !isSyncing;
  const isError = jobStatus?.change_detection === 'error';

  useEffect(() => {
    if (!projectId) return;
    if (isReady && (jobStatus.results?.cd || jobStatus.results?.cd_url)) {
      setResult({
        mask_url: jobStatus.results.cd?.mask_url || jobStatus.results.cd_url,
        confidence: Number(jobStatus.results.cd?.confidence || jobStatus.results.confidence || 0),
        change_percentage: jobStatus.results.cd?.change_percentage || jobStatus.results.change_percentage,
        area_m2: jobStatus.results.cd?.area_m2 || jobStatus.results.area_m2,
        area_km2: jobStatus.results.cd?.area_km2 || jobStatus.results.area_km2,
        area_hectares: jobStatus.results.cd?.area_hectares || jobStatus.results.area_hectares,
        t1_url: jobStatus.t1_tci_url,
        t2_url: jobStatus.t2_tci_url,
        t1_date: jobStatus.results.cd?.t1_date || 'Baseline',
        t2_date: jobStatus.results.cd?.t2_date || 'Monitoring'
      });
      setExplanation(jobStatus.results?.explanation);
    } else if (jobStatus?.t1_tci_url && jobStatus?.t2_tci_url) {
      setResult(prev => ({ ...prev, t1_url: jobStatus.t1_tci_url, t2_url: jobStatus.t2_tci_url, t1_date: 'Baseline', t2_date: 'Monitoring' }));
    }
    if (projectId && !jobStatus?.active && !result) {
      fetchAPI.getProject(projectId).then(r => {
        if (r.data.change_detections?.[0]) {
          const cd = r.data.change_detections[0];
          const t1 = r.data.images.find(im => im.id === cd.t1_image_id);
          const t2 = r.data.images.find(im => im.id === cd.t2_image_id);
          const fixPath = p => p ? getImageUrl(`/data/${p.split('data\\')[1]?.replace(/\\/g,'/')}`) : null;
          setResult({ mask_url: fixPath(cd.mask_path), confidence: cd.confidence, change_percentage: cd.change_percentage, area_m2: cd.area_m2, area_km2: cd.area_km2, area_hectares: cd.area_hectares, t1_url: fixPath(t1?.tci_png_path), t2_url: fixPath(t2?.tci_png_path), t1_date: t1?.date, t2_date: t2?.date });
        }
      }).catch(() => {});
    }
  }, [projectId, isReady, jobStatus]);

  const handleDetectChanges = async () => {
    try { await fetchAPI.detectChanges(projectId); addNotification('ChangeFormer inference started', 'info'); }
    catch { addNotification('Failed to trigger detection', 'error'); }
  };

  const onSliderMove = (clientX) => {
    if (!sliderRef.current || !dragging.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    setSliderPos(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  };

  if (!projectId) return (
    <div className="page-content">
      <PageHeader title="Change Detection" subtitle="AI-powered temporal analysis" />
      <EmptyState icon="🗺" title="No mission loaded" desc="Complete the imagery fetch step to enable change detection." />
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Change Detection</span>
            <span className="badge badge-accent">#{projectId}</span>
            {isReady && <span className="badge badge-success">Analysis Complete</span>}
            {isSyncing && <span className="badge badge-warning animate-pulse">Inferencing…</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isPending && !isReady && (
            <button className="btn btn-primary btn-sm" onClick={handleDetectChanges} disabled={isSyncing}>
              {isSyncing ? <><span className="spinner spinner-sm" /> Processing</> : 'Run ChangeFormer Inference'}
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Metrics row */}
        {result?.change_percentage !== undefined && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard label="Change Detected" value={`${(result.change_percentage || result.confidence * 100 || 0).toFixed(2)}%`} sub="of surveyed area" color="var(--accent)" />
            <StatCard label="Footprint" value={`${(result.area_hectares || 0).toFixed(2)} ha`} sub={`${Number(result.area_km2||0).toFixed(4)} km²`} color="#22C55E" />
            <StatCard label="Timespan" value={result.t1_date} sub={`→ ${result.t2_date}`} color="#F59E0B" />
          </div>
        )}

        {/* Action card if images ready but not analysed */}
        {isPending && result?.t1_url && !isReady && (
          <div className="card" style={{ padding: 28, marginBottom: 24, textAlign: 'center', borderColor: 'var(--accent-border)', background: 'var(--accent-subtle)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Imagery synchronized — ready for analysis</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>Both baseline and monitoring scenes are ready. Run ChangeFormer to detect land-use changes.</p>
            <button className="btn btn-primary btn-lg" onClick={handleDetectChanges}>Run ChangeFormer Analysis</button>
          </div>
        )}

        {isSyncing && (
          <div className="card" style={{ padding: 32, textAlign: 'center', marginBottom: 24 }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>ChangeFormer inference running</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Transformer-based change detection in progress…</p>
          </div>
        )}

        {/* Main imagery: Comparison Slider + Mask */}
        {result?.t1_url && result?.t2_url && (
          <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="2" x2="3" y2="22"/><line x1="21" y1="22" x2="3" y2="2"/></svg>
                Interactive Comparison Slider
              </span>
            </div>

            {/* Slider Area */}
            <div 
              ref={sliderRef}
              style={{ position: 'relative', width: '100%', height: 480, cursor: 'ew-resize', userSelect: 'none' }}
              onMouseDown={(e) => { dragging.current = true; onSliderMove(e.clientX); }}
              onMouseMove={(e) => onSliderMove(e.clientX)}
              onTouchMove={(e) => onSliderMove(e.touches[0].clientX)}
              onTouchStart={(e) => { dragging.current = true; onSliderMove(e.touches[0].clientX); }}
              onTouchEnd={() => dragging.current = false}
            >
              {/* Base Image (T2/Monitoring) */}
              <img src={result.t2_url} alt="Monitor" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
              <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
                <span className="badge badge-neutral" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)', fontWeight: 700 }}>
                  Monitoring{result.t2_date ? ` · ${result.t2_date}` : ''}
                </span>
              </div>

              {/* Clipped Image (T1/Baseline) */}
              <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}>
                <img src={result.t1_url} alt="Baseline" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false} />
                <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
                  <span className="badge badge-neutral" style={{ background: 'rgba(30,30,30,0.9)', color: '#fff', backdropFilter: 'blur(4px)', fontWeight: 700 }}>
                    Baseline{result.t1_date ? ` · ${result.t1_date}` : ''}
                  </span>
                </div>
              </div>

              {/* Slider Handle */}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 3, background: 'var(--accent)', transform: 'translateX(-50%)', zIndex: 20, boxShadow: '0 0 12px rgba(0,0,0,0.4)' }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 38, height: 38, background: '#fff', borderRadius: '50%', border: '4px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ width: 2.5, height: 14, background: 'var(--accent)', borderRadius: 2 }} />
                    <div style={{ width: 2.5, height: 14, background: 'var(--accent)', borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Mask view directly below slider */}
            {result.mask_url && (
              <div style={{ borderTop: '1px solid var(--border-light)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Change Mask</span>
                  <span className="badge badge-accent">Red = Positive change (growth)</span>
                </div>
                <div style={{ position: 'relative', background: '#0a0a0a', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden' }}>
                  <img src={result.mask_url} alt="Change mask" style={{ width: '100%', height: 420, objectFit: 'contain', display: 'block' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Explanation */}
        {explanation && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Intelligence Report</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI-generated analysis</div>
              </div>
              {explanation.severity && (
                <span className={`badge ${explanation.severity === 'critical' ? 'badge-error' : explanation.severity === 'high' ? 'badge-warning' : 'badge-success'}`} style={{ marginLeft: 'auto' }}>
                  {explanation.severity?.toUpperCase()}
                </span>
              )}
            </div>
            {explanation.summary && <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 12 }}>{explanation.summary}</p>}
            {explanation.analysis && <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{explanation.analysis}</p>}
          </div>
        )}

        {/* Empty state */}
        {isPending && !result?.t1_url && (
          <EmptyState icon="🛰" title="Awaiting imagery" desc="Complete imagery acquisition in Mission Control first." />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="empty-state">
      <div className="empty-icon" style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>{title}</h1>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{subtitle}</p>}
    </div>
  );
}

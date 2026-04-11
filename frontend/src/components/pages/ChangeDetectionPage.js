import React, { useState, useRef, useEffect } from 'react';
import { fetchAPI } from '../../utils/api';

export default function ChangeDetectionPage({ projectId, addNotification, jobStatus }) {
  const [result, setResult] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [sliderPos, setSliderPos] = useState(50);
  const sliderRef = useRef(null);
  const dragging = useRef(false);

  // Auto-sync with background mission jobStatus
  const isReady = jobStatus?.change_detection === 'ready';
  const isSyncing = jobStatus?.change_detection === 'syncing';
  const isPending = (jobStatus?.change_detection === 'pending' || !jobStatus?.change_detection) && !isReady && !isSyncing;
  const isError = jobStatus?.change_detection === 'error';

  const handleDetectChanges = async () => {
    try {
      await fetchAPI.detectChanges(projectId);
      addNotification('Intelligence workflow initiated', 'info');
      // Re-trigger global polling to ensure we catch the 'syncing' status
      if (jobStatus?.onStartFetch) jobStatus.onStartFetch(projectId);
    } catch (e) {
      addNotification('Failed to trigger detection', 'error');
    }
  };

  useEffect(() => {
    if (!projectId) return;

    // Use live session data if available
    if (isReady && (jobStatus.results.cd || jobStatus.results.cd_url)) {
      setResult({
        mask_url: jobStatus.results.cd?.mask_url || jobStatus.results.cd_url,
        confidence: Number(jobStatus.results.cd?.confidence || jobStatus.results.confidence || 0),
        t1_url: jobStatus.t1_tci_url,
        t2_url: jobStatus.t2_tci_url,
        t1_date: jobStatus.results.cd?.t1_date || jobStatus.t1_date || 'Baseline',
        t2_date: jobStatus.results.cd?.t2_date || jobStatus.t2_date || 'Monitoring'
      });
      setExplanation(jobStatus.results.explanation);
    } else if (jobStatus?.t1_tci_url && jobStatus?.t2_tci_url) {
      // Show TCI even if results aren't ready
      setResult(prev => ({
        ...prev,
        t1_url: jobStatus.t1_tci_url,
        t2_url: jobStatus.t2_tci_url,
        t1_date: jobStatus.t1_date || 'T1 Sync',
        t2_date: jobStatus.t2_date || 'T2 Sync'
      }));
    }

    // Historical Fetch
    if (projectId && !jobStatus?.active && !result && !isPending) {
      fetchAPI.getProject(projectId).then(r => {
        if (r.data.change_detections?.[0]) {
            const cd = r.data.change_detections[0];
            const t1 = r.data.images.find(im => im.id === cd.t1_image_id);
            const t2 = r.data.images.find(im => im.id === cd.t2_image_id);
            setResult({
                mask_url: `/data/${cd.mask_path.split('data\\')[1].replace(/\\/g, '/')}`,
                confidence: cd.confidence,
                t1_url: `/data/${t1.tci_png_path.split('data\\')[1].replace(/\\/g, '/')}`,
                t2_url: `/data/${t2.tci_png_path.split('data\\')[1].replace(/\\/g, '/')}`,
                t1_date: t1.date,
                t2_date: t2.date
            });
        }
      }).catch(() => {});
    }
  }, [projectId, isReady, jobStatus, result, isPending]);

  if (!projectId) return <div style={centerStyle}><EmptyTelemetryState hasProject={false} /></div>;
  if (isSyncing) return <div style={centerStyle}><InferenceLoader logs={jobStatus?.logs} /></div>;
  if (isError) return <div style={centerStyle}><ErrorState addNotification={addNotification} /></div>;

  const handleSliderMove = (clientX) => {
    if (!sliderRef.current || !dragging.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  };

  const activeExp = explanation || {};
  const severityColor = { low: '#10b981', moderate: '#38bdf8', high: '#f59e0b', critical: '#f43f5e' }[activeExp.severity] || 'var(--text-secondary)';

  return (
    <div className="animate-fade-in" style={{ padding: '40px 60px', height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: 2, marginBottom: 12 }}>MISSION ANALYSIS: CHANGE DETECTION</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, lineHeight: 1 }}>DEEP TEMPORAL ANALYSIS</h1>
          </div>
          {isSyncing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', padding: '10px 20px', borderRadius: 30, border: '1px solid var(--accent)' }}>
              <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1 }}>MODEL INFERENCE ACTIVE...</span>
            </div>
          )}
        </div>

        {isPending && !result?.t1_url && <EmptyTelemetryState hasProject={!!projectId} />}
        
        {isPending && result?.t1_url && !isReady && (
          <div className="glass-card animate-slide-up" style={{ padding: 40, textAlign: 'center', marginBottom: 32, border: '1px solid var(--accent)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>MISSION STAGE 1 & 2 COMPLETE</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Imagery and Spectral bands are synchronized. Proceed with AI logic trigger.</p>
            <button 
              onClick={handleDetectChanges}
              className="btn-accent"
              style={{ padding: '12px 32px', fontSize: 11, fontWeight: 900, borderRadius: 30 }}
            >
              INITIATE CHANGE DETECTION (CHANGEFORMER V6)
            </button>
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            
            {/* Metrics Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <DataTile label="CHANGE MAGNITUDE" value={`${(result.confidence * 100).toFixed(1)}%`} sub="Pixel Difference Ratio" color="var(--accent)" />
              <DataTile label="CLASSIFICATION" value={activeExp.change_type?.toUpperCase() || 'CALCULATING...'} sub={activeExp.severity ? `Risk Level: ${activeExp.severity}` : 'Model Processing'} color={severityColor} />
              <DataTile label="OBSERVATION SPAN" value={result.t1_date} sub={`to ${result.t2_date}`} color="#a855f7" />
            </div>

            {/* Tri-Panel Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              <PreviewCard title="BASELINE (T1)" url={result.t1_url} />
              <PreviewCard title="MONITORING (T2)" url={result.t2_url} />
              <PreviewCard title="CHANGE MASK" url={result.mask_url} isMask />
            </div>

            {/* Main Interactive Workstation */}
            <div className="glass-card" style={{ padding: 32, borderRadius: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>INTERACTIVE COMPARISON ENGINE</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>SLIDE TO OVERLAY T1 / T2</div>
              </div>
              
              <div
                ref={sliderRef}
                style={sliderContainerStyle}
                onMouseDown={() => { dragging.current = true; }}
                onMouseMove={(e) => handleSliderMove(e.clientX)}
                onMouseUp={() => { dragging.current = false; }}
                onMouseLeave={() => { dragging.current = false; }}
              >
                <img src={result.t2_url} alt="T2" style={sliderImgStyle} />
                <div style={{ ...sliderOverlayStyle, width: `${sliderPos}%` }}>
                  <img src={result.t1_url} alt="T1" style={{ ...sliderImgStyle, width: sliderRef.current?.offsetWidth || 1200 }} />
                </div>
                <div style={{ ...sliderHandleStyle, left: `${sliderPos}%` }}>
                   <div style={handleCircleStyle}>⇔</div>
                </div>
              </div>
            </div>

            {/* AI Narrative Section */}
            {activeExp.summary && (
              <div className="animate-slide-up" style={aiNarrativeStyle}>
                <div style={{ display: 'flex', gap: 20 }}>
                   <div style={aiIconStyle}>AI</div>
                   <div>
                     <p style={aiSummaryStyle}>{activeExp.summary}</p>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 24 }}>
                        <div>
                           <div style={findingLabelStyle}>CORE FINDINGS</div>
                           {activeExp.key_findings?.map((f, i) => (
                             <div key={i} style={findingItemStyle}>
                               <span style={{ color: 'var(--accent)' }}>▸</span> {f}
                             </div>
                           ))}
                        </div>
                        <div>
                           <div style={findingLabelStyle}>ACTIONABLE INTEL</div>
                           <div style={recommendationStyle}>{activeExp.recommendation}</div>
                        </div>
                     </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components
function DataTile({ label, value, sub, color }) {
  return (
    <div className="glass-card" style={{ padding: '24px 28px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function PreviewCard({ title, url, isMask }) {
  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: isMask ? '1px solid #f43f5e30' : '1px solid var(--border)' }}>
      <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.03)', fontSize: 10, fontWeight: 800, color: isMask ? '#f43f5e' : 'var(--text-muted)', letterSpacing: 1.5 }}>{title}</div>
      <div style={{ height: 220, background: '#000' }}>
        {url ? <img src={url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isMask ? 'hue-rotate(300deg) saturate(2)' : 'none' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-dim)' }}>PENDING...</div>}
      </div>
    </div>
  );
}

function EmptyTelemetryState({ hasProject }) {
  return (
    <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>⬢</div>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{hasProject ? 'WAITING FOR ORBITAL TRIGGER' : 'NO MISSION ACTIVE'}</h3>
      <p style={{ fontSize: 13 }}>{hasProject ? 'Inference begins automatically as soon as imagery is synced.' : 'Select an AOI and initialize fetch protocol to start analysis.'}</p>
    </div>
  );
}

function InferenceLoader({ logs }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{ textAlign: 'center', padding: '100px 0', width: '100%', maxWidth: 800 }}>
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 32px' }}>
         <div className="animate-spin" style={{ position: 'absolute', inset: 0, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
         <div className="animate-spin" style={{ position: 'absolute', inset: 12, border: '3px solid #a855f7', borderBottomColor: 'transparent', borderRadius: '50%', animationDirection: 'reverse' }} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', letterSpacing: 3, marginBottom: 24 }}>MODEL INFERENCE ACTIVE: CHANGEFORMER V6</h3>
      
      {/* Terminal View */}
      <div 
        ref={scrollRef}
        style={{ 
          background: '#000', 
          borderRadius: 12, 
          padding: 20, 
          textAlign: 'left', 
          fontFamily: 'var(--font-mono)', 
          fontSize: 11, 
          color: '#22c55e', 
          height: 200, 
          overflowY: 'auto',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
          border: '1px solid #ffffff10'
        }}
      >
        {logs?.length > 0 ? logs.map((log, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <span style={{ opacity: 0.4 }}>[{new Date().toLocaleTimeString()}]</span> {log}
          </div>
        )) : (
          <div style={{ color: 'var(--text-dim)' }}>Establishing neural uplink...</div>
        )}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>Tiled Siamese networks are processing temporal shifts...</p>
    </div>
  );
}

function ErrorState({ addNotification }) {
  return (
    <div style={{ textAlign: 'center', padding: '100px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 20, color: 'var(--danger)' }}>⚠</div>
      <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase' }}>Inference Engine Failure</h3>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>The ChangeFormer subprocess encountered an orbital or data mismatch.</p>
    </div>
  );
}

// Styling Constants
const centerStyle = { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const sliderContainerStyle = { position: 'relative', height: 500, borderRadius: 12, overflow: 'hidden', cursor: 'col-resize', userSelect: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' };
const sliderImgStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
const sliderOverlayStyle = { position: 'absolute', inset: 0, overflow: 'hidden', borderRight: '2px solid var(--accent)' };
const sliderHandleStyle = { position: 'absolute', top: 0, bottom: 0, width: 2, background: 'var(--accent)', transform: 'translateX(-50%)', zIndex: 20 };
const handleCircleStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', border: '6px solid var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--bg-deep)', fontWeight: 900 };
const aiNarrativeStyle = { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: 40, borderRadius: 24, border: '1px solid rgba(56, 189, 248, 0.2)' };
const aiIconStyle = { width: 50, height: 50, borderRadius: 12, background: 'var(--accent)', color: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 };
const aiSummaryStyle = { fontSize: 18, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-primary)' };
const findingLabelStyle = { fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: 2, marginBottom: 16 };
const findingItemStyle = { fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.4 };
const recommendationStyle = { fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12, borderLeft: '3px solid var(--accent)' };

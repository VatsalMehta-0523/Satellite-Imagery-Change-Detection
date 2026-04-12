import React, { useState, useEffect } from 'react';
import { indicesAPI, getImageUrl } from '../../utils/api';

const INDEX_COLORS = {
  NDVI: '#10b981', NDBI: '#f43f5e', NDWI: '#0ea5e9', MNDWI: '#38bdf8', BSI: '#f59e0b', EVI: '#059669'
};

export default function IndexValidationPage({ projectId, addNotification, jobStatus }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync with background mission jobStatus or fetch historical
  const isMissionActive = jobStatus?.active;
  const isIntelReady = jobStatus?.spectral_intel === 'ready';
  const globalResults = jobStatus?.results?.indices;

  useEffect(() => {
    if (!projectId) return;
    
    // Live update from mission status
    if (globalResults) {
      setData({
        t1: { date: jobStatus.t1_date || 'T1 Sync', indices: globalResults.t1 },
        t2: { date: jobStatus.t2_date || 'T2 Sync', indices: globalResults.t2 }
      });
      setLoading(false);
      return;
    }

    // Historical Fetch (only if no active mission or if active but not loading live data yet)
    if (!isMissionActive && !data) {
        setLoading(true);
        indicesAPI.get(projectId)
          .then(r => {
             if (r.data && Object.keys(r.data).length > 0) {
                const norm = r.data;
                // Normalize t1/t2 historical urls
                ['t1', 't2'].forEach(time => {
                  if (norm[time]?.indices) {
                    Object.values(norm[time].indices).forEach(ix => { 
                      if (ix.url) ix.url = getImageUrl(ix.url);
                      else if (ix.image_path) {
                        const relPart = ix.image_path.includes('data\\') ? ix.image_path.split('data\\')[1] : ix.image_path.split('data/')[1];
                        ix.url = getImageUrl(`/data/${relPart.replace(/\\/g, '/')}`);
                      }
                    });
                  }
                });
                setData(norm);
             }
          })
          .catch(e => {})
          .finally(() => setLoading(false));
    }
  }, [projectId, isMissionActive, isIntelReady, globalResults, jobStatus]);

  if (!projectId) return <div style={centerStyle}><EmptyMsg text="SELECT AOI IN FETCH PAGE TO SYNC INDICES" /></div>;
  
  // Show Loading if:
  // 1. We are explicitly loading historical data
  // 2. We have an active mission but the spectral intelligence isn't ready yet
  if (loading || (isMissionActive && !isIntelReady && !data)) return <div style={centerStyle}><LoadMsg /></div>;

  return (
    <div className="animate-fade-in" style={containerStyle}>
      {/* Sticky Mission Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={badgeStyle}>VALIDATION ENGINE 2.0</div>
          <div style={dotStyle} />
          <span style={headerMetaStyle}>AOI: {jobStatus.results.cd?.location || 'S2-GEOSPATIAL-GRID'}</span>
        </div>
        <h1 style={titleStyle}>SPECTRAL ANALYTICS & <span style={{ color: 'var(--accent)' }}>FLUCTUATION INSIGHTS</span></h1>
        <p style={subTitleStyle}>Interactive workstation for multi-temporal spectral delta interpretation.</p>
      </header>

      {data && (
        <div className="custom-scrollbar" style={scrollAreaStyle}>
          <div style={{ paddingRight: 8 }}> {/* Prevent scrollbar overlap */}
            {Object.entries(data.t2?.indices || {}).map(([name, idx]) => {
              // Standard skipping for missing indices (e.g. Planet Scope has no SWIR bands for NDBI/MNDWI)
              if (!idx || (!idx.url && !idx.path)) return null;
              
              return (
                <IndexComparisonCard 
                  key={name}
                  name={name}
                  t1={data.t1?.indices?.[name]}
                  t2={idx}
                  t1Date={data.t1?.date}
                  t2Date={data.t2?.date}
                  meta={idx.meta}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function IndexComparisonCard({ name, t1, t2, t1Date, t2Date, meta }) {
  const t1Val = t1?.mean || t1?.stats?.mean || 0;
  const t2Val = t2?.mean || t2?.stats?.mean || 0;
  const delta = t2Val - t1Val;
  const color = INDEX_COLORS[name] || 'var(--accent)';

  return (
    <div className="glass-card animate-slide-up" style={cardStyle}>
      {/* Sidebar / Info */}
      <div style={cardSideStyle}>
        <div style={{ ...iconCircleStyle, background: `${color}20`, color: color }}>{name[0]}</div>
        <div style={{ flex: 1 }}>
          <h3 style={cardTitleStyle}>{name}</h3>
          <div style={typeLabelStyle}>{meta?.full_name || 'Spectral Index'}</div>
          <p style={formulaStyle}>{meta?.formula || '(NIR - R) / (NIR + R)'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={deltaLabelStyle}>DELTA Δ</div>
          <div style={{ ...deltaValueStyle, color: delta > 0.05 ? 'var(--success)' : delta < -0.05 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(3)}
          </div>
        </div>
      </div>

      {/* Side by Side Preview */}
      <div style={comparisonGridStyle}>
        <div style={imgPaneStyle}>
          <div style={paneLabelStyle}>{t1Date || 'BASELINE'}</div>
          <div style={imgWrapperStyle}>
            {t1?.url ? <img src={t1.url} alt="T1" style={imgStyle} /> : <div style={imgFallbackStyle}>AWAITING TELEMETRY</div>}
          </div>
          <div style={statsRowStyle}>μ: {t1Val.toFixed(4)}</div>
        </div>
        <div style={imgPaneStyle}>
          <div style={paneLabelStyle}>{t2Date || 'MONITORING'}</div>
          <div style={imgWrapperStyle}>
            {t2?.url ? <img src={t2.url} alt="T2" style={imgStyle} /> : <div style={imgFallbackStyle}>AWAITING TELEMETRY</div>}
          </div>
          <div style={statsRowStyle}>μ: {t2Val.toFixed(4)}</div>
        </div>
      </div>

      {/* AI Intelligence Footer */}
      <div style={aiFooterStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={aiIconCircleStyle}>AI</div>
          <p style={briefingStyle}>
            {t2?.briefing || "Our neural engine is analyzing the spectral fluctuation surface profiles..."}
          </p>
        </div>
        <div style={legendContainerStyle}>
          <div style={legendBarStyle}>
            {meta?.stops?.map((stop, i) => (
              <div key={i} style={{ flex: 1, height: '100%', background: stop[1] }} title={stop[2]} />
            ))}
          </div>
          <div style={legendLabelsStyle}>
            <span style={{ color: 'var(--text-dim)' }}>{meta?.range?.[0] || -1}</span>
            <span style={{ fontSize: 9, opacity: 0.5 }}>CALIBRATED PROFILE</span>
            <span style={{ color: 'var(--text-dim)' }}>{meta?.range?.[1] || 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyMsg({ text }) {
  return <div style={{ textAlign: 'center', maxWidth: 400 }}>
    <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.3 }}>⬢</div>
    <div style={{ fontSize: 13, color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase' }}>{text}</div>
  </div>;
}

function LoadMsg() {
  return <div style={{ textAlign: 'center' }}>
     <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 24px' }}>
         <div className="animate-spin" style={{ position: 'absolute', inset: 0, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    <div className="animate-pulse" style={{ fontSize: 11, fontWeight: 900, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase' }}>DECODING SPECTRAL BANDS...</div>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Extracting N-dimensional indices from temporal data...</p>
  </div>;
}

// Styles
const containerStyle = { padding: '40px 60px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerStyle = { marginBottom: 32, flexShrink: 0 };
const titleStyle = { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 8, letterSpacing: -1 };
const subTitleStyle = { color: 'var(--text-secondary)', fontSize: 15, maxWidth: 800, lineHeight: 1.5 };
const badgeStyle = { fontSize: 9, fontWeight: 900, background: 'var(--accent)', color: 'var(--bg-deep)', padding: '3px 8px', borderRadius: 4, letterSpacing: 1 };
const dotStyle = { width: 4, height: 4, borderRadius: '50%', background: 'var(--text-dim)' };
const headerMetaStyle = { fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' };
const centerStyle = { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const scrollAreaStyle = { 
  flex: 1, 
  overflowY: 'auto', 
  display: 'flex', 
  flexDirection: 'column', 
  gap: 32, 
  paddingBottom: 40,
  paddingRight: 10 // gutter for scrollbar
};

const cardStyle = { 
  display: 'flex', 
  flexDirection: 'column', 
  padding: 0, 
  overflow: 'hidden', 
  border: '1px solid var(--border)',
  minHeight: 520
};

const cardSideStyle = { 
  padding: '24px 32px', 
  display: 'flex', 
  alignItems: 'center', 
  gap: 20, 
  borderBottom: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.02)'
};

const iconCircleStyle = { width: 50, height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900 };
const cardTitleStyle = { fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 };
const typeLabelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 2, letterSpacing: 0.5 };
const formulaStyle = { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', opacity: 0.7, marginTop: 4 };
const deltaLabelStyle = { fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 };
const deltaValueStyle = { fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)' };

const comparisonGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' };
const imgPaneStyle = { display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' };
const paneLabelStyle = { padding: '8px 16px', fontSize: 10, fontWeight: 800, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' };
const imgWrapperStyle = { height: 320, background: '#000', overflow: 'hidden' };
const imgStyle = { width: '100%', height: '100%', objectFit: 'cover' };
const imgFallbackStyle = { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 3, fontWeight: 800 };
const statsRowStyle = { padding: '10px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)' };

const aiFooterStyle = { padding: '24px 32px', background: 'rgba(0,0,0,0.2)' };
const aiIconCircleStyle = { width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', color: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 };
const briefingStyle = { fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0, fontWeight: 500 };
const legendContainerStyle = { marginTop: 20 };
const legendBarStyle = { height: 8, borderRadius: 4, display: 'flex', overflow: 'hidden' };
const legendLabelsStyle = { display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, marginTop: 6 };

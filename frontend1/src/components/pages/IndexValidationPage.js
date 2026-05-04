import React, { useState, useEffect } from 'react';
import { indicesAPI, getImageUrl } from '../../utils/api';

const INDEX_META = {
  NDVI:  { label: 'NDVI',  name: 'Normalized Difference Vegetation',  color: '#22C55E', icon: '🌱' },
  NDBI:  { label: 'NDBI',  name: 'Normalized Difference Built-up',     color: '#F43F5E', icon: '🏗' },
  NDWI:  { label: 'NDWI',  name: 'Normalized Difference Water',        color: '#0EA5E9', icon: '💧' },
  MNDWI: { label: 'MNDWI', name: 'Modified NDWI',                     color: '#38BDF8', icon: '🌊' },
  BSI:   { label: 'BSI',   name: 'Bare Soil Index',                    color: '#F59E0B', icon: '🏜' },
  EVI:   { label: 'EVI',   name: 'Enhanced Vegetation Index',          color: '#059669', icon: '🌿' },
};

export default function IndexValidationPage({ projectId, addNotification, jobStatus }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(null);

  const isMissionActive = jobStatus?.active;
  const isIntelReady = jobStatus?.spectral_intel === 'ready';
  const globalResults = jobStatus?.results?.indices;

  useEffect(() => {
    if (!projectId) return;
    if (globalResults) {
      setData({ t1: { date: jobStatus.t1_date || 'Baseline', indices: globalResults.t1 }, t2: { date: jobStatus.t2_date || 'Monitor', indices: globalResults.t2 } });
      setLoading(false);
      return;
    }
    if (!isMissionActive && !data) {
      setLoading(true);
      indicesAPI.get(projectId).then(r => {
        if (r.data && Object.keys(r.data).length > 0) {
          const norm = r.data;
          ['t1','t2'].forEach(t => {
            if (norm[t]?.indices) Object.values(norm[t].indices).forEach(ix => {
              if (ix.url) ix.url = getImageUrl(ix.url);
              else if (ix.image_path) {
                const rel = ix.image_path.includes('data\\') ? ix.image_path.split('data\\')[1] : ix.image_path.split('data/')[1];
                ix.url = getImageUrl(`/data/${rel.replace(/\\/g, '/')}`);
              }
            });
          });
          setData(norm);
        }
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [projectId, isMissionActive, isIntelReady, globalResults, jobStatus]);

  if (!projectId) return (
    <div className="page-content">
      <EmptyState icon="📡" title="No mission loaded" desc="Complete imagery acquisition to unlock spectral index analysis." />
    </div>
  );

  if (loading || (isMissionActive && !isIntelReady && !data)) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div className="spinner spinner-lg" />
      <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Computing spectral indices…</p>
    </div>
  );

  const indexNames = data ? Object.keys({ ...(data.t2?.indices || {}), ...(data.t1?.indices || {}) }) : [];
  const selectedMeta = activeIndex ? INDEX_META[activeIndex] || { label: activeIndex, name: activeIndex, color: 'var(--accent)', icon: '📊' } : null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Spectral Indices</span>
          <span className="badge badge-accent">#{projectId}</span>
          {isIntelReady && <span className="badge badge-success">Ready</span>}
        </div>
        {data && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{indexNames.length} indices computed</span>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!data && !loading && (
          <EmptyState icon="📊" title="Spectral analysis pending" desc="Spectral indices will be computed when the mission pipeline completes." />
        )}

        {data && (
          <>
            {/* Index tabs */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 24 }}>
              <button
                onClick={() => setActiveIndex(null)}
                className="btn btn-sm upscale-hover"
                style={{
                  background: activeIndex === null ? 'var(--text-primary)' : 'var(--bg-card)',
                  color: activeIndex === null ? 'var(--bg-primary)' : 'var(--text-primary)',
                  border: `1px solid ${activeIndex === null ? 'var(--text-primary)' : 'var(--border-light)'}`,
                  padding: '6px 14px', flexShrink: 0, fontWeight: 700
                }}
              >
                All
              </button>
              {indexNames.map(name => {
                const meta = INDEX_META[name];
                return (
                  <button
                    key={name}
                    onClick={() => setActiveIndex(activeIndex === name ? null : name)}
                    className="btn btn-sm"
                    style={{
                      background: activeIndex === name ? meta?.color || 'var(--accent)' : 'var(--bg-card)',
                      color: activeIndex === name ? '#fff' : 'var(--text-primary)',
                      border: `1px solid ${activeIndex === name ? meta?.color || 'var(--accent)' : 'var(--border-light)'}`,
                      gap: 6, flexShrink: 0, padding: '6px 14px'
                    }}
                  >
                    <span>{meta?.icon}</span>{name}
                  </button>
                );
              })}
            </div>

            {/* Show selected index expanded */}
            {activeIndex && (
              <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${selectedMeta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{selectedMeta.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedMeta.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedMeta.name}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setActiveIndex(null)}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {[{ key: 't1', label: 'Baseline', date: data.t1?.date }, { key: 't2', label: 'Monitor', date: data.t2?.date }].map(panel => {
                    const idx = data[panel.key]?.indices?.[activeIndex];
                    return (
                      <div key={panel.key} style={{ borderRight: panel.key === 't1' ? '1px solid var(--border-light)' : undefined }}>
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{panel.label}</span>
                          {panel.date && <span className="badge badge-neutral">{panel.date}</span>}
                          {idx?.mean !== undefined && <span style={{ fontSize: 12, fontWeight: 700, color: selectedMeta.color }}>μ {Number(idx.mean).toFixed(3)}</span>}
                        </div>
                        {idx?.url ? (
                          <img src={idx.url} alt={`${activeIndex} ${panel.label}`} style={{ width: '100%', height: 300, objectFit: 'contain', background: '#000', display: 'block' }} />
                        ) : (
                          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No image available</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            {/* Grid of all indices */}
            {!activeIndex && (
              <div className="index-grid">
              {indexNames.map(name => {
                const meta = INDEX_META[name] || { label: name, name, color: 'var(--accent)', icon: '📊' };
                const t1idx = data.t1?.indices?.[name];
                const t2idx = data.t2?.indices?.[name];
                const hasChange = t1idx?.mean !== undefined && t2idx?.mean !== undefined;
                const delta = hasChange ? (t2idx.mean - t1idx.mean) : null;

                return (
                  <div key={name} className="card" style={{ overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 200ms' }}
                    onClick={() => setActiveIndex(name)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                  >
                    {/* Card header */}
                    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{meta.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{meta.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.name}</div>
                      </div>
                      {delta !== null && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(3)}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Change</span>
                        </div>
                      )}
                    </div>

                    {/* Image grid — compact side by side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                      {[{ key: 't1', label: 'T1', idx: t1idx }, { key: 't2', label: 'T2', idx: t2idx }].map(panel => (
                        <div key={panel.key} style={{ position: 'relative', borderRight: panel.key === 't1' ? '1px solid var(--border-light)' : undefined }}>
                          <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 5 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}>{panel.label}</span>
                          </div>
                          {panel.idx?.url ? (
                            <img src={panel.idx.url} alt={`${name} ${panel.label}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ aspectRatio: '1', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
                            </div>
                          )}
                          {panel.idx?.mean !== undefined && (
                            <div style={{ position: 'absolute', bottom: 6, right: 6 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                                {Number(panel.idx.mean).toFixed(3)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="empty-state" style={{ height: '100%' }}>
      <div className="empty-icon" style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

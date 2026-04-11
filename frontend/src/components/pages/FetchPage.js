import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from '../shared/DrawControl';
import { fetchAPI } from '../../utils/api';

const SOURCES = [
  { id: 's2dr3', label: 'S2DR3', sub: '2.5m Enhanced', icon: '⬢', available: true },
  { id: 'planet', label: 'Planet Labs', sub: '3m Ultra-Res', icon: '◈', available: true },
  { id: 'gee', label: 'GEE (S2)', sub: '10m Open Source', icon: '✦', available: true },
];

export default function FetchPage({ projectId, setProjectId, addNotification, jobStatus, onStartFetch }) {
  const [aoi, setAoi] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [source, setSource] = useState('s2dr3');
  const [t1Date, setT1Date] = useState('2018-01-03');
  const [t2Date, setT2Date] = useState('2026-03-27');
  const [context, setContext] = useState('');

  const handlePolygonCreated = useCallback((e) => {
    const geojson = e.layer.toGeoJSON();
    setAoi(geojson);
    setShowModal(true);
  }, []);

  const handleFetch = async () => {
    if (!aoi) return;

    try {
      // Background context fetch
      fetchAPI.getContext({ aoi_geojson: aoi.geometry, t1_date: t1Date, t2_date: t2Date, source })
        .then(r => setContext(r.data.context)).catch(() => { });

      const res = await fetchAPI.startFetch({ aoi_geojson: aoi.geometry, t1_date: t1Date, t2_date: t2Date, source });
      const pid = res.data.project_id;
      setProjectId(pid);
      setShowModal(false);

      // Trigger global polling in App.js
      if (onStartFetch) onStartFetch(pid);

    } catch (err) {
      addNotification('Mission Control: Sync Initiation Failed', 'error');
    }
  };

  const isSyncing = jobStatus.active;

  return (
    <div className="animate-fade-in" style={containerStyle}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={pulseDotStyle} />
          <h1 style={titleStyle}>MISSION CONTROL: IMAGERY AQUISITION</h1>
        </div>
        <p style={subTitleStyle}>Define Area of Interest (AOI) for multi-temporal analysis</p>
      </header>

      <div style={gridStyle}>
        {/* Map Section */}
        <div className="glass" style={mapWrapperStyle}>
          <style>{`
            .leaflet-control-container { z-index: 800 !important; }
            .leaflet-top, .leaflet-bottom { z-index: 800 !important; }
          `}</style>
          <MapContainer center={[23.01, 72.47]} zoom={13} style={{ width: '100%', height: '100%', zIndex: 1 }}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri &mdash; Source: Esri"
            />
            <FeatureGroup>
              <EditControl position="topright" onCreated={handlePolygonCreated} draw={{ polygon: true, rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false }} />
            </FeatureGroup>
          </MapContainer>
          {!aoi && !isSyncing && <div style={mapOverlayStyle}>✦ INITIALIZE SYSTEM: DRAW AOI POLYGON</div>}
          {isSyncing && <div style={mapOverlayStyle}>SYSTEM SYNC IN PROGRESS... ACCESSING T1/T2 ORBITS</div>}
        </div>

        {/* Info & Preview Section */}
        <div style={sidebarStyle}>
          {context && (
            <div className="glass-card" style={contextCardStyle}>
              <div style={cardHeaderStyle}>AI BREIFING</div>
              <p style={contextTextStyle}>{context}</p>
            </div>
          )}

          <div style={previewGridStyle}>
            <ImagePanel label="T1 ORBITAL" status={jobStatus.t1} imgUrl={jobStatus.t1_tci_url} date={t1Date} pct={jobStatus.progress.t1} />
            <ImagePanel label="T2 ORBITAL" status={jobStatus.t2} imgUrl={jobStatus.t2_tci_url} date={t2Date} pct={jobStatus.progress.t2} />
          </div>

          <div className="glass" style={coordsCardStyle}>
            <div style={cardHeaderStyle}>SYSTEM STATUS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={statusRowStyle}>
                <span style={labelSmallStyle}>NETWORK</span>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>STABLE</span>
              </div>
              <div style={statusRowStyle}>
                <span style={labelSmallStyle}>GCLOUD LINK</span>
                <span style={{ color: isSyncing ? 'var(--accent)' : 'var(--text-muted)' }}>{isSyncing ? 'ACTIVE' : 'IDLE'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <FetchModal
          source={source} setSource={setSource}
          t1Date={t1Date} setT1Date={setT1Date}
          t2Date={t2Date} setT2Date={setT2Date}
          onFetch={handleFetch}
          onDiscard={() => { setShowModal(false); setAoi(null); }}
          loading={isSyncing}
        />
      )}
    </div>
  );
}

function ImagePanel({ label, status, imgUrl, date, pct }) {
  const isLoading = status === 'loading' || status === 'pending';
  const isReady = (status === 'ready' || status === 'tci_ready' || status === 'done') && imgUrl;
  const isError = status === 'error';

  return (
    <div className="glass-card" style={{ ...panelStyle, borderColor: isReady ? 'var(--accent)' : 'var(--border)' }}>
      <div style={panelHeaderStyle}>
        <span style={{ color: isReady ? 'var(--accent)' : 'var(--text-muted)' }}>{label}</span>
        <span>{date}</span>
      </div>
      <div style={viewportStyle}>
        {isReady ? <img src={imgUrl} alt={label} style={imageStyle} />
          : isLoading ? <ShimmerLoader label={label} pct={pct} />
            : isError ? <div style={errorTextStyle}>TELEMETRY LOST</div>
              : <div style={awaitingTextStyle}>AWAITING LINK</div>}
      </div>
    </div>
  );
}

function ShimmerLoader({ label, pct }) {
  return (
    <div className="animate-shimmer" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={pulseCircleStyle}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)' }}>{pct}%</span>
      </div>
      <div style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: 2, fontWeight: 700 }}>{label} SYNC...</div>
    </div>
  );
}

function FetchModal({ source, setSource, t1Date, setT1Date, t2Date, setT2Date, onFetch, onDiscard, loading }) {
  return (
    <div style={modalOverlayStyle}>
      <div className="glass-card animate-slide-up" style={modalContentStyle}>
        <header style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>MISSION CONFIGURATION</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Select provider and synchronization windows</p>
        </header>

        <div style={{ marginBottom: 32 }}>
          <label style={modalLabelStyle}>SENSOR PROVIDER</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {SOURCES.map(s => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                disabled={!s.available}
                style={{
                  ...sourceBtnStyle,
                  borderColor: source === s.id ? 'var(--accent)' : 'var(--border)',
                  background: source === s.id ? 'var(--accent-glow)' : 'rgba(255,255,255,0.03)',
                  opacity: s.available ? 1 : 0.4,
                  cursor: s.available ? 'pointer' : 'not-allowed'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, color: source === s.id ? 'var(--accent)' : 'var(--text-muted)' }}>{s.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.sub}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          <div><label style={modalLabelStyle}>T1 ENVELOPE</label><input type="date" value={t1Date} onChange={e => setT1Date(e.target.value)} style={modalInputStyle} /></div>
          <div><label style={modalLabelStyle}>T2 ENVELOPE</label><input type="date" value={t2Date} onChange={e => setT2Date(e.target.value)} style={modalInputStyle} /></div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <button onClick={onDiscard} style={modalCancelBtn}>ABORT</button>
          <button onClick={onFetch} disabled={loading} style={modalPrimaryBtn}>{loading ? 'STARTING...' : 'INJECT MISSION'}</button>
        </div>
      </div>
    </div>
  );
}

// Styles
const containerStyle = { height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 40px' };
const titleStyle = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: 1 };
const subTitleStyle = { color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 };
const pulseDotStyle = { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)', animation: 'pulse-glow 1.5s infinite' };
const gridStyle = { flex: 1, display: 'flex', gap: 32, minHeight: 0 };
const mapWrapperStyle = { flex: 1.5, position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden' };
const mapOverlayStyle = { position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', padding: '12px 24px', borderRadius: 40, border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, zIndex: 500 };
const sidebarStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 };
const cardHeaderStyle = { fontSize: 9, fontWeight: 800, color: 'var(--accent)', letterSpacing: 2, marginBottom: 12 };
const contextCardStyle = { padding: 24, borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--accent)' };
const contextTextStyle = { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 };
const previewGridStyle = { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 0 };
const panelStyle = { display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-md)', overflow: 'hidden', transition: 'var(--transition)' };
const panelHeaderStyle = { padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)', display: 'flex', justifyContent: 'space-between' };
const viewportStyle = { flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' };
const imageStyle = { width: '100%', height: '100%', objectFit: 'cover', transition: 'var(--transition)' };
const awaitingTextStyle = { color: 'var(--text-dim)', fontSize: 10, fontWeight: 700, letterSpacing: 1 };
const errorTextStyle = { color: 'var(--danger)', fontSize: 10, fontWeight: 700 };
const coordsCardStyle = { padding: 20, borderRadius: 'var(--radius-md)' };
const pulseCircleStyle = { width: 44, height: 44, border: '2px solid var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse-glow 2s infinite' };
const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 };
const modalContentStyle = { width: 520, padding: 40, borderRadius: 'var(--radius-lg)' };
const modalLabelStyle = { display: 'block', fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1.5, marginBottom: 12 };
const sourceBtnStyle = { flex: 1, padding: '14px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', transition: 'var(--transition)' };
const modalInputStyle = { width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 14, outline: 'none', colorScheme: 'dark' };
const modalCancelBtn = { flex: 1, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const modalPrimaryBtn = { flex: 2, padding: 16, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'var(--bg-deep)', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 20px rgba(0,212,255,0.3)' };
const statusRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 11 };
const labelSmallStyle = { fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: 1 };

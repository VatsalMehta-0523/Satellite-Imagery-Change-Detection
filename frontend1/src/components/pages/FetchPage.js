import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, GeoJSON } from 'react-leaflet';
import { EditControl } from '../shared/DrawControl';
import { fetchAPI } from '../../utils/api';

const SOURCES = [
  { id: 's2dr3',  label: 'Sentinel-2 DR3', sub: '10m · 5-day revisit', color: '#8B7CF6' },
  { id: 'gee',   label: 'Google Earth Engine', sub: '10–30m · Archive', color: '#22C55E' },
  { id: 'planet',label: 'Planet Labs', sub: '3m · Daily', color: '#F59E0B' },
];

const YEARS = Array.from({ length: 12 }, (_, i) => 2026 - i);

export default function FetchPage({ projectId, setProjectId, aoi, setAoi, addNotification, jobStatus, onStartFetch, setStagedSelection, setActivePage }) {
  const [source, setSource] = useState('s2dr3');
  const [t1Date, setT1Date] = useState(null);
  const [t2Date, setT2Date] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFlow, setDateFlow] = useState(null); // 'year_t1' | 'loading' | 'cal_t1' | 'year_t2' | 'cal_t2' | 'confirm'
  const [selectedYear, setSelectedYear] = useState(null);
  const [validDates, setValidDates] = useState([]);
  const comparisonRef = useRef(null);
  const notifiedHasImages = useRef(false);

  // Auto-scroll to comparison when both dates set
  useEffect(() => {
    if (t1Date && t2Date && comparisonRef.current) {
      setTimeout(() => comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, [t1Date, t2Date]);

  const getBbox = useCallback(() => {
    if (!aoi) return null;
    const geom = aoi.geometry || aoi;
    const lons = [], lats = [];
    const extract = (c) => { for (const item of c) { if (typeof item[0] === 'number') { lons.push(item[0]); lats.push(item[1]); } else extract(item); } };
    extract(geom.coordinates);
    if (!lons.length) return null;
    return `${Math.min(...lons)},${Math.min(...lats)},${Math.max(...lons)},${Math.max(...lats)}`;
  }, [aoi]);

  const handleSearch = async (e) => {
    if (e.key !== 'Enter' || !searchQuery.trim() || !mapInstance) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data?.[0]) { mapInstance.setView([data[0].lat, data[0].lon], 14); addNotification(`Centered on ${data[0].display_name.split(',')[0]}`, 'success'); }
    } catch { addNotification('Search failed', 'error'); }
  };

  const handlePolygonCreated = useCallback((e) => {
    setAoi(e.layer.toGeoJSON());
    setDateFlow('year_t1');
  }, [setAoi]);

  const handleYearSelect = async (year) => {
    setSelectedYear(year);
    const bbox = getBbox();
    if (!bbox) { addNotification('Draw an AOI first', 'error'); return; }
    setDateFlow('loading');
    try {
      const res = await fetchAPI.getValidDates(bbox, year);
      setValidDates(res.data.dates || []);
      setDateFlow(dateFlow === 'year_t1' || !t1Date ? 'cal_t1' : 'cal_t2');
    } catch { addNotification('Could not fetch valid dates', 'error'); setDateFlow(t1Date ? 'year_t2' : 'year_t1'); }
  };

  const handleDateSelect = (date) => {
    if (dateFlow === 'cal_t1') { setT1Date(date); setSelectedYear(null); setValidDates([]); setDateFlow('year_t2'); }
    else if (dateFlow === 'cal_t2') { setT2Date(date); setValidDates([]); setDateFlow(null); }
  };

  const handleTransmitToAgent = () => {
    if (!t1Date || !t2Date || !aoi) { addNotification('Complete AOI and date selection first', 'error'); return; }
    setStagedSelection({ aoi: aoi.geometry || aoi, t1Date, t2Date, source });
    addNotification('Telemetry staged — switch to ORION Agent to begin', 'success');
    setActivePage('agent');
  };

  const handleStartDirectFetch = async () => {
    if (!aoi || !t1Date || !t2Date) return;
    try {
      const res = await fetchAPI.startFetch({ aoi_geojson: aoi.geometry || aoi, t1_date: t1Date, t2_date: t2Date, source });
      const pid = res.data.project_id;
      setProjectId(pid);
      setDateFlow(null);
      if (onStartFetch) onStartFetch(pid);
      addNotification(`Mission #${pid} initiated`, 'success');
    } catch { addNotification('Failed to start mission', 'error'); }
  };

  const isSyncing = jobStatus.active;
  const hasImages = jobStatus.t1_tci_url && jobStatus.t2_tci_url;

  useEffect(() => {
    if (hasImages && !notifiedHasImages.current) {
      addNotification('Images successfully fetched and displayed!', 'success');
      notifiedHasImages.current = true;
    } else if (!hasImages) {
      notifiedHasImages.current = false;
    }
  }, [hasImages, addNotification]);

  const isMapExpanded = !(isSyncing || hasImages || projectId);

  const dateFlowStep = dateFlow === 'year_t1' ? 0 : dateFlow === 'loading' ? 1 : dateFlow === 'cal_t1' ? 2 :
                       dateFlow === 'year_t2' ? 3 : dateFlow === 'cal_t2' ? 4 : -1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isSyncing && <span className="dot dot-success animate-pulse" />}
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Mission Control</span>
          {projectId && <span className="badge badge-accent">#{projectId}</span>}
        </div>
        <div style={{ display: 'flex', align: 'center', gap: 10 }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search location..."
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', width: 180 }}
            />
          </div>
          {t1Date && t2Date && (
            <button className="btn btn-primary btn-sm" onClick={handleTransmitToAgent}>
              Send to ORION →
            </button>
          )}
        </div>
      </div>

      {/* ── Main layout: Scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* MAP HERO */}
        <div className="map-collapse-container" style={{ position: 'relative', height: isMapExpanded ? 'calc(100vh - 56px)' : '55vh', minHeight: 400, flexShrink: 0 }}>
          <MapContainer
            center={[23.03, 72.49]} zoom={13}
            style={{ width: '100%', height: '100%' }}
            ref={setMapInstance}
          >
            <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="© Google" />
            {aoi && <GeoJSON data={aoi} style={{ color: 'var(--accent)', weight: 2.5, fillOpacity: 0.12, fillColor: 'var(--accent)' }} />}
            <FeatureGroup>
              <EditControl
                position="topright"
                onCreated={handlePolygonCreated}
                draw={{ polygon: { shapeOptions: { color: '#8B7CF6', weight: 2 } }, rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false }}
              />
            </FeatureGroup>
          </MapContainer>

          {/* Map Overlay Instructions */}
          {!aoi && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 500,
              background: 'var(--bg-card)', backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-medium)', borderRadius: 10, padding: '10px 20px',
              fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap',
              boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 8
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Draw a polygon on the map to define your Area of Interest
            </div>
          )}

          {/* Config glass panel top-right of map */}
          <div className="map-config-panel">
            {/* Source selector */}
            <div className="glass-panel" style={{ padding: '12px 14px' }}>
              <div className="label" style={{ marginBottom: 8 }}>Imagery Source</div>
              {SOURCES.map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', border: `2px solid ${source === s.id ? s.color : 'var(--border-medium)'}`,
                    background: source === s.id ? s.color : 'transparent', flexShrink: 0,
                    transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {source === s.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <input type="radio" value={s.id} checked={source === s.id} onChange={() => setSource(s.id)} style={{ display: 'none' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Date status */}
            {(t1Date || t2Date) && (
              <div className="glass-panel" style={{ padding: '12px 14px' }}>
                <div className="label" style={{ marginBottom: 8 }}>Temporal Envelope</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[{ label: 'Baseline (T1)', date: t1Date }, { label: 'Monitor (T2)', date: t2Date }].map(d => (
                    <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.label}</span>
                      <span className="badge badge-accent" style={{ fontSize: 10 }}>{d.date || '—'}</span>
                    </div>
                  ))}
                </div>
                {t1Date && t2Date && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-primary" style={{ width: '100%', fontSize: 12 }} onClick={handleStartDirectFetch}>
                      Start Fetch
                    </button>
                    <button className="btn btn-secondary" style={{ width: '100%', fontSize: 12 }} onClick={handleTransmitToAgent}>
                      Use ORION Agent
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Syncing status */}
            {isSyncing && (
              <div className="glass-panel" style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="spinner spinner-sm" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Syncing Imagery</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Mission #{projectId} active</div>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  {[{ label: 'Baseline T1', pct: jobStatus.progress?.t1 || 0, done: jobStatus.t1 === 'ready' },
                    { label: 'Monitor T2', pct: jobStatus.progress?.t2 || 0, done: jobStatus.t2 === 'ready' }].map(row => (
                    <div key={row.label} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{row.label}</span>
                        {row.done ? <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 600 }}>Ready</span>
                          : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.pct}%</span>}
                      </div>
                      <div className="progress-track">
                        <div className="progress-bar" style={{ width: `${row.done ? 100 : row.pct}%`, background: row.done ? 'var(--success)' : 'var(--accent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel below map: image comparison ── */}
        <div style={{ paddingBottom: 40, borderTop: '1px solid var(--border-light)', background: 'var(--bg-primary)' }}
          ref={comparisonRef}>
          {hasImages ? (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div className="section-title">Temporal Imagery</div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>Side-by-Side Comparison</h2>
                </div>
                <span className="badge badge-success">
                  <span className="dot" style={{ background: 'var(--success)', width: 6, height: 6 }} />
                  Synchronized
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <ImageCard label="Baseline" date={t1Date} url={jobStatus.t1_tci_url} status={jobStatus.t1} pct={jobStatus.progress?.t1} />
                <ImageCard label="Monitoring" date={t2Date} url={jobStatus.t2_tci_url} status={jobStatus.t2} pct={jobStatus.progress?.t2} />
              </div>
            </div>
          ) : aoi ? (
            <div style={{ padding: 24 }}>
              <div className="section-title">Temporal Imagery</div>
              {!t1Date || !t2Date ? (
                <div className="empty-state" style={{ padding: '32px 24px' }}>
                  <div className="empty-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.75"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>Select dates to continue</div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320, lineHeight: 1.6 }}>
                    {!t1Date ? 'A date picker opened automatically. Select a baseline (T1) date.' : 'Now select a monitoring (T2) date.'}
                  </p>
                  {!t1Date && <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setDateFlow('year_t1')}>Select Dates</button>}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '32px 24px' }}>
                  <div className="spinner spinner-lg" />
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Mission starting... imagery will appear here</p>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px 24px' }}>
              <div className="empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><polygon points="3 7 9 4 15 7 21 4 21 17 15 20 9 17 3 20 3 7"/><line x1="9" y1="4" x2="9" y2="17"/><line x1="15" y1="7" x2="15" y2="20"/></svg>
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>No area drawn</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 280 }}>Draw a polygon on the map above to define your Area of Interest. Imagery comparison will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Date Flow Modals ── */}
      {dateFlow && dateFlow !== null && (
        <DateFlowModal
          step={dateFlow}
          years={YEARS}
          selectedYear={selectedYear}
          validDates={validDates}
          onYearSelect={handleYearSelect}
          onDateSelect={handleDateSelect}
          onClose={() => setDateFlow(null)}
          onBack={() => setDateFlow(dateFlow === 'cal_t1' ? 'year_t1' : 'year_t2')}
          isT1={!t1Date}
        />
      )}
    </div>
  );
}

function ImageCard({ label, date, url, status, pct }) {
  const isReady = (status === 'ready' || status === 'done') && url;
  const isLoading = status === 'loading' || status === 'pending';

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</div>
          {date && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{date}</div>}
        </div>
        {isReady && <span className="badge badge-success">Ready</span>}
        {isLoading && <span className="badge badge-neutral">Syncing {pct ? `${pct}%` : ''}</span>}
      </div>
      <div style={{ aspectRatio: '16/10', background: 'var(--bg-tertiary)', position: 'relative', overflow: 'hidden' }}>
        {isReady ? (
          <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : isLoading ? (
          <div className="radar-scan-overlay" style={{ background: 'linear-gradient(to bottom, transparent, rgba(34, 197, 94, 0.4), transparent)' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-medium)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Awaiting sync</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DateFlowModal({ step, years, selectedYear, validDates, onYearSelect, onDateSelect, onClose, onBack, isT1 }) {
  const isLoading = step === 'loading';
  const isYearPick = step === 'year_t1' || step === 'year_t2';
  const isCalendar = step === 'cal_t1' || step === 'cal_t2';
  const forT1 = step === 'year_t1' || step === 'cal_t1';

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: isYearPick ? 480 : 560, padding: 32 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div className="section-title">{forT1 ? 'Step 1 of 2' : 'Step 2 of 2'} — {forT1 ? 'Baseline (T1)' : 'Monitor (T2)'}</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {isYearPick ? 'Select Year' : isCalendar ? 'Select Date' : 'Loading…'}
            </h2>
            {isYearPick && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>Choose a year to scan Sentinel-2 archive coverage</p>}
            {isCalendar && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}><strong style={{ color: 'var(--accent)' }}>{validDates.length} dates</strong> with confirmed imagery found</p>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
        </div>

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 12 }}>
            <div className="spinner spinner-lg" />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Querying Earth Engine for {selectedYear} coverage…</p>
          </div>
        )}

        {isYearPick && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {years.map(y => (
              <button
                key={y}
                className="btn btn-secondary"
                style={{ justifyContent: 'center', padding: '12px', fontSize: 15, fontWeight: 700 }}
                onClick={() => onYearSelect(y)}
              >{y}</button>
            ))}
          </div>
        )}

        {isCalendar && <CalendarGrid year={selectedYear} validDates={validDates} onSelect={onDateSelect} />}

        {!isLoading && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            {isCalendar && <button className="btn btn-ghost" onClick={onBack}>← Back</button>}
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarGrid({ year, validDates, onSelect }) {
  const [month, setMonth] = useState(() => {
    if (validDates.length > 0) return parseInt(validDates[0].split('-')[1], 10) - 1;
    return new Date().getMonth();
  });

  const validSet = new Set(validDates);
  const allMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Mo','Tu','We','Th','Fr','Sa','Su'];

  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthCounts = allMonths.map((_, mi) => validDates.filter(d => parseInt(d.split('-')[1], 10) - 1 === mi).length);

  return (
    <div>
      {/* Month strip */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {allMonths.map((m, i) => (
          <button
            key={m}
            onClick={() => setMonth(i)}
            style={{
              padding: '5px 10px', border: '1px solid', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
              background: month === i ? 'var(--accent)' : monthCounts[i] ? 'var(--bg-tertiary)' : 'transparent',
              color: month === i ? '#fff' : monthCounts[i] ? 'var(--text-primary)' : 'var(--text-muted)',
              borderColor: month === i ? 'var(--accent)' : 'var(--border-light)',
              fontSize: 11, fontWeight: 700, position: 'relative',
              transition: 'all 150ms'
            }}
          >
            {m}
            {monthCounts[i] > 0 && month !== i && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, background: 'var(--accent)', borderRadius: '50%', fontSize: 8, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{monthCounts[i]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {days.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>)}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const valid = validSet.has(ds);
          return (
            <button
              key={i}
              disabled={!valid}
              onClick={() => valid && onSelect(ds)}
              style={{
                padding: '10px 0', border: '1px solid', borderRadius: 6, textAlign: 'center',
                fontSize: 13, fontWeight: valid ? 700 : 400, cursor: valid ? 'pointer' : 'default',
                background: valid ? 'var(--accent-subtle)' : 'transparent',
                color: valid ? 'var(--accent)' : 'var(--text-muted)',
                borderColor: valid ? 'var(--accent-border)' : 'transparent',
                opacity: valid ? 1 : 0.4,
                transition: 'all 150ms'
              }}
              onMouseEnter={e => { if (valid) e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { if (valid) { e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.color = 'var(--accent)'; } }}
            >{day}</button>
          );
        })}
      </div>
    </div>
  );
}

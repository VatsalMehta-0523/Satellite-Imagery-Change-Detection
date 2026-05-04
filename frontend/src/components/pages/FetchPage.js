import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, FeatureGroup, GeoJSON } from 'react-leaflet';
import { EditControl } from '../shared/DrawControl';
import { fetchAPI } from '../../utils/api';

const SOURCES = [
  { id: 's2dr3', label: 'S2DR3', sub: '2.5m Enhanced', icon: '⬢', available: true },
  { id: 'planet', label: 'Planet Labs', sub: '3m Ultra-Res', icon: '◈', available: true },
  { id: 'gee', label: 'GEE (S2)', sub: '10m Open Source', icon: '✦', available: true },
];

const YEARS = [];
for (let y = 2026; y >= 2015; y--) YEARS.push(y);

export default function FetchPage({ projectId, setProjectId, aoi, setAoi, addNotification, jobStatus, onStartFetch, setStagedSelection, setActivePage }) {
  const [source, setSource] = useState('s2dr3');
  const [t1Date, setT1Date] = useState(null);
  const [t2Date, setT2Date] = useState(null);
  const [context, setContext] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [mapInstance, setMapInstance] = useState(null);

  // Multi-step date selection state
  const [dateStep, setDateStep] = useState(null); // null | 'year_t1' | 'loading_t1' | 'cal_t1' | 'year_t2' | 'loading_t2' | 'cal_t2' | 'confirm'
  const [selectedYear, setSelectedYear] = useState(null);
  const [validDates, setValidDates] = useState([]);
  const [showSourceModal, setShowSourceModal] = useState(false);

  // Compute bbox from AOI for GEE queries
  const getAoiBbox = useCallback(() => {
    if (!aoi) return null;
    const geom = aoi.geometry || aoi;
    const coords = geom.coordinates;
    const lons = [], lats = [];
    const extract = (c) => {
      for (const item of c) {
        if (typeof item[0] === 'number') { lons.push(item[0]); lats.push(item[1]); }
        else extract(item);
      }
    };
    extract(coords);
    if (!lons.length) return null;
    return `${Math.min(...lons)},${Math.min(...lats)},${Math.max(...lons)},${Math.max(...lats)}`;
  }, [aoi]);

  const handleSearch = async (e) => {
    if (e.key !== 'Enter' || !searchQuery.trim() || !mapInstance) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        mapInstance.setView([lat, lon], 13);
        addNotification(`Tactical Link: Centered on ${data[0].display_name}`, 'success');
      }
    } catch (err) {
      addNotification('Search Engine Offline', 'error');
    }
  };

  const handlePolygonCreated = useCallback((e) => {
    const geojson = e.layer.toGeoJSON();
    setAoi(geojson);
    // After polygon is drawn, start the date selection flow
    setDateStep('year_t1');
  }, [setAoi]);

  // Year selected → fetch valid dates from GEE
  const handleYearSelect = async (year) => {
    setSelectedYear(year);
    const bbox = getAoiBbox();
    if (!bbox) { addNotification('No AOI available for date query', 'error'); return; }

    const target = dateStep === 'year_t1' ? 'loading_t1' : 'loading_t2';
    setDateStep(target);
    
    try {
      const res = await fetchAPI.getValidDates(bbox, year);
      setValidDates(res.data.dates || []);
      setDateStep(target === 'loading_t1' ? 'cal_t1' : 'cal_t2');
    } catch (err) {
      addNotification('GEE date query failed. Try again.', 'error');
      setDateStep(target === 'loading_t1' ? 'year_t1' : 'year_t2');
    }
  };

  // Date selected from calendar
  const handleDateSelect = (date) => {
    if (dateStep === 'cal_t1') {
      setT1Date(date);
      // Now start T2 flow
      setSelectedYear(null);
      setValidDates([]);
      setDateStep('year_t2');
    } else if (dateStep === 'cal_t2') {
      setT2Date(date);
      setValidDates([]);
      setDateStep('confirm');
      setShowSourceModal(true);
    }
  };

  const handleTransmitToAgent = () => {
    if (!t1Date || !t2Date) { addNotification('Select both T1 and T2 dates first', 'error'); return; }
    setStagedSelection({ aoi: aoi.geometry, t1Date, t2Date, source });
    addNotification('Mission Control: Telemetry Transmitted to ORION', 'success');
    setActivePage('agent');
  };

  const handleFetch = async () => {
    if (!aoi || !t1Date || !t2Date) return;
    try {
      fetchAPI.getContext({ aoi_geojson: aoi.geometry, t1_date: t1Date, t2_date: t2Date, source })
        .then(r => setContext(r.data.context)).catch(() => { });

      const res = await fetchAPI.startFetch({ aoi_geojson: aoi.geometry, t1_date: t1Date, t2_date: t2Date, source });
      const pid = res.data.project_id;
      setProjectId(pid);
      setShowSourceModal(false);
      setDateStep(null);

      if (onStartFetch) onStartFetch(pid);
    } catch (err) {
      addNotification('Mission Control: Sync Initiation Failed', 'error');
    }
  };

  const isSyncing = jobStatus.active;

  return (
    <div className="animate-fade-in" style={containerStyle}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={pulseDotStyle} />
            <h1 style={titleStyle}>MISSION CONTROL: IMAGERY ACQUISITION</h1>
          </div>
          <p style={subTitleStyle}>Define Area of Interest (AOI) for multi-temporal analysis</p>
        </div>
        
        <div className="glass-card" style={searchContainerStyle}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <input 
            type="text" 
            placeholder="SEARCH TACTICAL AOI (E.G. DUBAI, AHMEDABAD)" 
            style={searchInputStyle}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </header>

      <div style={gridStyle}>
        <div className="glass" style={mapWrapperStyle}>
          <style>{`
            .leaflet-control-container { z-index: 800 !important; }
            .leaflet-top, .leaflet-bottom { z-index: 800 !important; }
          `}</style>
          <MapContainer 
            center={[23.01, 72.47]} 
            zoom={13} 
            style={{ width: '100%', height: '100%', zIndex: 1 }}
            ref={setMapInstance}
          >
            <TileLayer
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              attribution="&copy; Google Imagery"
            />
            
            {aoi && (
              <GeoJSON 
                data={aoi} 
                style={{ color: 'var(--accent)', weight: 3, fillOpacity: 0.2 }} 
              />
            )}

            <FeatureGroup>
              <EditControl 
                position="topright" 
                onCreated={handlePolygonCreated} 
                draw={{ 
                  polygon: { shapeOptions: { color: 'var(--accent)' } }, 
                  rectangle: false, 
                  circle: false, 
                  circlemarker: false, 
                  marker: false, 
                  polyline: false 
                }} 
              />
            </FeatureGroup>
          </MapContainer>
          {!aoi && !isSyncing && <div style={mapOverlayStyle}>✦ INITIALIZE SYSTEM: DRAW AOI POLYGON</div>}
          {isSyncing && <div style={mapOverlayStyle}>SYSTEM SYNC IN PROGRESS... ACCESSING T1/T2 ORBITS</div>}
        </div>

        <div style={sidebarStyle}>
          {/* Date Status Cards */}
          <div className="glass-card" style={{ padding: 20, borderRadius: 'var(--radius-md)' }}>
            <div style={cardHeaderStyle}>TEMPORAL CONFIGURATION</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={statusRowStyle}>
                <span style={labelSmallStyle}>T1 DATE</span>
                <span style={{ color: t1Date ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 12 }}>
                  {t1Date || 'NOT SET'}
                </span>
              </div>
              <div style={statusRowStyle}>
                <span style={labelSmallStyle}>T2 DATE</span>
                <span style={{ color: t2Date ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 12 }}>
                  {t2Date || 'NOT SET'}
                </span>
              </div>
              <div style={statusRowStyle}>
                <span style={labelSmallStyle}>SOURCE</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 12 }}>
                  {source.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {context && (
            <div className="glass-card" style={contextCardStyle}>
              <div style={cardHeaderStyle}>AI BRIEFING</div>
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

      {/* STEP 1/5: Year Selector Modal for T1 or T2 */}
      {(dateStep === 'year_t1' || dateStep === 'year_t2') && (
        <YearSelectorModal
          title={dateStep === 'year_t1' ? 'SELECT YEAR — T1 (BASELINE)' : 'SELECT YEAR — T2 (MONITORING)'}
          onSelect={handleYearSelect}
          onClose={() => setDateStep(null)}
        />
      )}

      {/* STEP 2: Loading State */}
      {(dateStep === 'loading_t1' || dateStep === 'loading_t2') && (
        <div style={modalOverlayStyle}>
          <div className="glass-card animate-slide-up" style={{ ...modalContentStyle, textAlign: 'center', padding: 60 }}>
            <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 24px' }}>
              <div className="animate-spin" style={{ position: 'absolute', inset: 0, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', letterSpacing: 2, marginBottom: 8 }}>
              QUERYING EARTH ENGINE
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Scanning Sentinel-2 archive for {selectedYear}...
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Calendar with Highlighted Dates */}
      {(dateStep === 'cal_t1' || dateStep === 'cal_t2') && (
        <CalendarModal
          title={dateStep === 'cal_t1' ? 'SELECT DATE — T1 (BASELINE)' : 'SELECT DATE — T2 (MONITORING)'}
          year={selectedYear}
          validDates={validDates}
          onSelect={handleDateSelect}
          onBack={() => setDateStep(dateStep === 'cal_t1' ? 'year_t1' : 'year_t2')}
          onClose={() => setDateStep(null)}
        />
      )}

      {/* STEP 5 (confirm): Source + Launch Modal */}
      {showSourceModal && dateStep === 'confirm' && (
        <SourceModal
          source={source} setSource={setSource}
          t1Date={t1Date} t2Date={t2Date}
          onFetch={handleFetch}
          onTransmit={handleTransmitToAgent}
          onDiscard={() => { setShowSourceModal(false); setDateStep(null); setAoi(null); setT1Date(null); setT2Date(null); }}
          loading={isSyncing}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Year Selector Modal
// ─────────────────────────────────────────────────────────────
function YearSelectorModal({ title, onSelect, onClose }) {
  return (
    <div style={modalOverlayStyle}>
      <div className="glass-card animate-slide-up" style={{ ...modalContentStyle, width: 440 }}>
        <header style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--accent)', letterSpacing: 2, marginBottom: 8 }}>STEP 1</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>{title}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>Choose a year to scan for available Sentinel-2 imagery</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => onSelect(y)}
              style={yearBtnStyle}
              onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-primary)'; }}
            >
              {y}
            </button>
          ))}
        </div>

        <button onClick={onClose} style={{ ...modalCancelBtn, marginTop: 24, width: '100%' }}>CANCEL</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Calendar Modal with Highlighted Valid Dates
// ─────────────────────────────────────────────────────────────
function CalendarModal({ title, year, validDates, onSelect, onBack, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(0); // 0-11

  // Auto-jump to first month with valid dates
  useEffect(() => {
    if (validDates.length > 0) {
      const firstDate = validDates[0];
      const month = parseInt(firstDate.split('-')[1], 10) - 1;
      setCurrentMonth(month);
    }
  }, [validDates]);

  const validSet = new Set(validDates);
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Count valid dates per month for the month selector
  const monthCounts = monthNames.map((_, mi) => {
    return validDates.filter(d => parseInt(d.split('-')[1], 10) - 1 === mi).length;
  });

  // Build calendar grid for current month
  const firstDay = new Date(year, currentMonth, 1);
  const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
  // getDay() returns 0=Sun, we want 0=Mon
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={modalOverlayStyle}>
      <div className="glass-card animate-slide-up" style={{ ...modalContentStyle, width: 560 }}>
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--accent)', letterSpacing: 2, marginBottom: 8 }}>
            {validDates.length} VALID DATES FOUND
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>{title}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
            Highlighted dates have confirmed Sentinel-2 coverage
          </p>
        </header>

        {/* Month Selector — scrollable row */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {monthNames.map((m, i) => (
            <button
              key={m}
              onClick={() => setCurrentMonth(i)}
              style={{
                padding: '8px 12px',
                border: '1px solid',
                borderColor: currentMonth === i ? 'var(--accent)' : 'var(--border)',
                borderRadius: 8,
                background: currentMonth === i ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: currentMonth === i ? 'var(--accent)' : monthCounts[i] > 0 ? 'var(--text-primary)' : 'var(--text-dim)',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0,
                position: 'relative',
                letterSpacing: 1
              }}
            >
              {m}
              {monthCounts[i] > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: 'var(--accent)', color: 'var(--bg-deep)',
                  fontSize: 8, fontWeight: 900, borderRadius: 10,
                  padding: '1px 5px', minWidth: 16, textAlign: 'center'
                }}>{monthCounts[i]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1, padding: '8px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 24 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} />;
            const dateStr = `${year}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isValid = validSet.has(dateStr);
            return (
              <button
                key={i}
                onClick={() => isValid && onSelect(dateStr)}
                disabled={!isValid}
                style={{
                  padding: '10px 0',
                  border: '1px solid',
                  borderColor: isValid ? 'var(--accent)' : 'transparent',
                  borderRadius: 8,
                  background: isValid ? 'rgba(0,212,255,0.12)' : 'transparent',
                  color: isValid ? '#fff' : 'var(--text-dim)',
                  fontSize: 13,
                  fontWeight: isValid ? 800 : 500,
                  cursor: isValid ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  boxShadow: isValid ? '0 0 12px rgba(0,212,255,0.15)' : 'none',
                  opacity: isValid ? 1 : 0.35
                }}
                onMouseEnter={e => { if (isValid) { e.target.style.background = 'rgba(0,212,255,0.3)'; e.target.style.boxShadow = '0 0 20px rgba(0,212,255,0.3)'; }}}
                onMouseLeave={e => { if (isValid) { e.target.style.background = 'rgba(0,212,255,0.12)'; e.target.style.boxShadow = '0 0 12px rgba(0,212,255,0.15)'; }}}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onBack} style={{ ...modalCancelBtn, flex: 1 }}>← BACK TO YEAR</button>
          <button onClick={onClose} style={{ ...modalCancelBtn, flex: 1 }}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Source + Launch Modal (final step after both dates are confirmed)
// ─────────────────────────────────────────────────────────────
function SourceModal({ source, setSource, t1Date, t2Date, onFetch, onTransmit, onDiscard, loading }) {
  return (
    <div style={modalOverlayStyle}>
      <div className="glass-card animate-slide-up" style={modalContentStyle}>
        <header style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>MISSION CONFIGURATION</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Confirm temporal envelope and select provider</p>
        </header>

        {/* Confirmed Dates Display */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div className="glass-card" style={{ padding: 16, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--text-dim)', letterSpacing: 1.5, marginBottom: 6 }}>T1 BASELINE</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{t1Date}</div>
          </div>
          <div className="glass-card" style={{ padding: 16, borderLeft: '3px solid #a855f7' }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--text-dim)', letterSpacing: 1.5, marginBottom: 6 }}>T2 MONITORING</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#a855f7' }}>{t2Date}</div>
          </div>
        </div>

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
                  background: source === s.id ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
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

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <button onClick={onDiscard} style={modalCancelBtn}>ABORT</button>
          <button onClick={onFetch} disabled={loading} style={modalPrimaryBtn}>{loading ? 'STARTING...' : 'INJECT MISSION'}</button>
        </div>

        <button 
          onClick={onTransmit} 
          style={{ ...modalPrimaryBtn, background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--accent)', width: '100%', boxShadow: 'none' }}
        >
          🚀 TRANSMIT TELEMETRY TO ORION
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Image Panel (unchanged)
// ─────────────────────────────────────────────────────────────
function ImagePanel({ label, status, imgUrl, date, pct }) {
  const isLoading = status === 'loading' || status === 'pending';
  const isReady = (status === 'ready' || status === 'tci_ready' || status === 'done') && imgUrl;
  const isError = status === 'error';

  return (
    <div className="glass-card" style={{ ...panelStyle, borderColor: isReady ? 'var(--accent)' : 'var(--border)' }}>
      <div style={panelHeaderStyle}>
        <span style={{ color: isReady ? 'var(--accent)' : 'var(--text-muted)' }}>{label}</span>
        <span>{date || '—'}</span>
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

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const containerStyle = { height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 40px' };
const titleStyle = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: 1 };
const subTitleStyle = { color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 };
const searchContainerStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderRadius: 40, width: 400, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' };
const searchInputStyle = { background: 'transparent', border: 'none', color: '#fff', fontSize: 10, fontWeight: 700, width: '100%', outline: 'none', letterSpacing: 1 };
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
const modalCancelBtn = { flex: 1, padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const modalPrimaryBtn = { flex: 2, padding: 16, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'var(--bg-deep)', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 20px rgba(0,212,255,0.3)' };
const yearBtnStyle = { padding: '16px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', fontSize: 16, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' };
const statusRowStyle = { display: 'flex', justifyContent: 'space-between', fontSize: 11 };
const labelSmallStyle = { fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: 1 };

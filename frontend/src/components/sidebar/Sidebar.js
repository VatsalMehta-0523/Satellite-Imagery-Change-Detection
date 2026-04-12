import React from 'react';

const NAV_ITEMS = [
  { id: 'fetch',      icon: '⬢', label: 'Fetch',           sub: 'Imagery Sync' },
  { id: 'overview',   icon: '✦', label: 'Overview',        sub: '3-Way Comparison' },
  { id: 'change',     icon: '◈', label: 'Change Analysis', sub: 'ChangeFormer AI' },
  { id: 'indices',    icon: '▥', label: 'Index Intel',     sub: 'Spectral Validation' },
  { id: 'compliance', icon: '▣', label: 'Compliance',      sub: 'Regulation Engine' },
  { id: 'insights',   icon: '✴', label: 'Insights AI',      sub: 'Project Reports' },
  { id: 'agent',      icon: '🧠', label: 'ORION Agent',      sub: 'Mission Control' },
];

export default function Sidebar({ open, onOpen, onClose, activePage, onNavigate, jobActive }) {
  return (
    <div 
      className="glass"
      onClick={() => { if (!open) onOpen(); }}
      style={{
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        width: open ? 'var(--sidebar-w-open)' : 'var(--sidebar-w-closed)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition)',
        borderRight: '1px solid var(--border)',
        boxShadow: open ? '30px 0 60px rgba(0,0,0,0.5)' : 'none',
        overflow: 'hidden',
        cursor: open ? 'default' : 'pointer'
      }}
    >
      {/* Brand Header */}
      <div style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: open ? 'space-between' : 'center',
        padding: open ? '0 20px' : '0',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {open ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={logoCircleStyle}>
                <SatIcon />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={brandNameStyle}>GEOVISION</span>
                <span style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: 2, fontWeight: 600 }}>ADVANCED AI</span>
              </div>
            </div>
            <button onClick={onClose} style={closeBtnStyle}>✕</button>
          </>
        ) : (
          <button onClick={onOpen} style={openBtnStyle}>
            <SatIcon />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '20px 0', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: open ? '14px 24px' : '16px 0',
                justifyContent: open ? 'flex-start' : 'center',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'var(--transition)',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                position: 'relative',
              }}
              onMouseEnter={e => { if(!isActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { if(!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {isActive && <div style={activeIndicatorStyle} />}
              <span style={{ fontSize: 22, filter: isActive ? 'drop-shadow(0 0 8px var(--accent))' : 'none' }}>
                {item.icon}
              </span>
              {open && (
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, letterSpacing: 0.3 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 10, color: isActive ? 'var(--accent-dim)' : 'var(--text-muted)', marginTop: 1 }}>
                    {item.sub}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      {open && (
        <div style={footerStyle}>
          {jobActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--accent-glow)', borderRadius: 8, border: '1px solid var(--accent-dim)', marginBottom: 12 }}>
              <div style={syncDotStyle} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', letterSpacing: 1 }}>MISSION SYNC ACTIVE</span>
                <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>Background telemetry...</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={statusDotStyle} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)' }}>S2DR3 SYSTEM ONLINE</span>
            </div>
          )}
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            Uptime: 99.9% • v1.4.2-stable
          </div>
        </div>
      )}
    </div>
  );
}

const logoCircleStyle = {
  width: 36, height: 36, 
  borderRadius: '50%', 
  background: 'var(--accent-glow)', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center',
  border: '1px solid var(--accent-glow)',
};

const brandNameStyle = {
  fontFamily: 'var(--font-display)', 
  fontWeight: 800, 
  fontSize: 16, 
  color: 'var(--text-primary)', 
  letterSpacing: 1.5,
};

const closeBtnStyle = {
  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4
};

const openBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const activeIndicatorStyle = {
  position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: 'var(--accent)', borderRadius: '0 4px 4px 0', boxShadow: '0 0 10px var(--accent)'
};

const footerStyle = {
  padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)'
};

const statusDotStyle = {
  width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)', animation: 'pulse-glow 2s infinite'
};

const syncDotStyle = {
  width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)', animation: 'pulse-glow 1s infinite'
};

function SatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

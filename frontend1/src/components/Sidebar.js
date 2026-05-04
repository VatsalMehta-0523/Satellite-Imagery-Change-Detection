import React, { useState, useEffect, useRef } from 'react';

const NAV_ITEMS = [
  { id: 'fetch',      label: 'Mission Control', icon: MapIcon },
  { id: 'overview',  label: 'Overview',         icon: HomeIcon },
  { id: 'change',    label: 'Change Detection', icon: LayersIcon },
  { id: 'indices',   label: 'Spectral Indices',  icon: ChartIcon },
  { id: 'compliance',label: 'Compliance',        icon: ShieldIcon },
  { id: 'agent',     label: 'ORION Agent',       icon: RobotIcon },
];

export default function Sidebar({ activePage, onNavigate, jobStatus, theme, onToggleTheme }) {
  const [expanded, setExpanded] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };
    if (expanded) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  return (
    <nav
      ref={sidebarRef}
      className={`sidebar ${expanded ? 'expanded' : ''}`}
      onClick={() => { if (!expanded) setExpanded(true); }}
    >
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{
          width: 36, height: 36, flexShrink: 0,
          background: 'var(--accent)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: -0.5
        }}>UE</div>
        <div style={{ overflow: 'hidden', opacity: expanded ? 1 : 0, transition: 'opacity 200ms' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', lineHeight: 1 }}>UrbanEye</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: 2 }}>Geospatial Intelligence</div>
        </div>
      </div>

      {/* Active mission indicator */}
      {jobStatus.active && (
        <div style={{ margin: '8px 8px 4px', padding: '8px 12px', borderRadius: 8, background: 'var(--success-subtle)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="dot dot-success animate-pulse" />
            {expanded && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', whiteSpace: 'nowrap', overflow: 'hidden' }}>Mission Active</span>}
          </div>
        </div>
      )}

      {/* Nav Items */}
      <div style={{ flex: 1, padding: '8px 0', overflow: 'hidden' }}>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <div
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
              title={!expanded ? item.label : undefined}
            >
              <div className="nav-icon"><Icon size={18} /></div>
              <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 150ms', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom controls */}
      <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-light)' }}>
        <div
          className="nav-item"
          onClick={onToggleTheme}
          title={!expanded ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
        >
          <div className="nav-icon">
            {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </div>
          <span style={{ opacity: expanded ? 1 : 0, transition: 'opacity 150ms', fontSize: 13, whiteSpace: 'nowrap' }}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
        </div>
      </div>
    </nav>
  );
}

/* ── Inline SVG Icons ── */
function MapIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 7 9 4 15 7 21 4 21 17 15 20 9 17 3 20 3 7"/><line x1="9" y1="4" x2="9" y2="17"/><line x1="15" y1="7" x2="15" y2="20"/></svg>;
}
function HomeIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function LayersIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function ChartIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="14" width="4" height="8"/><rect x="10" y="8" width="4" height="14"/><rect x="18" y="4" width="4" height="18"/></svg>;
}
function ShieldIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function BrainIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2a2.5 2.5 0 0 1 5 0v1"/><path d="M14.5 3a4 4 0 0 1 4 4v2a4 4 0 0 1-.5 2"/><path d="M9.5 3a4 4 0 0 0-4 4v2a4 4 0 0 0 .5 2"/><path d="M12 12v10"/><path d="M8 11.5l4 .5 4-.5"/><circle cx="12" cy="12" r="2"/></svg>;
}
function RobotIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>;
}
function SunIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
}
function MoonIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}

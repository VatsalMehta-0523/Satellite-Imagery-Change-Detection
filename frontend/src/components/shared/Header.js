import React, { useState } from 'react';

export default function Header({ notifications, onClearNotification }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [dark, setDark] = useState(true);

  return (
    <header style={{
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-elevated)',
      gap: 12,
      flexShrink: 0,
      position: 'relative',
      zIndex: 50,
    }}>
      {/* Theme toggle */}
      <button
        onClick={() => setDark(!dark)}
        style={headerBtnStyle}
        title="Toggle theme"
      >
        <span style={{ fontSize: 16 }}>{dark ? '☽' : '☀'}</span>
      </button>

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          style={{ ...headerBtnStyle, position: 'relative' }}
          title="Notifications"
        >
          <span style={{ fontSize: 16 }}>◎</span>
          {notifications.length > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', display: 'block',
              animation: 'pulse 1.5s infinite',
            }} />
          )}
        </button>

        {showNotifs && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            width: 320, background: 'var(--bg-card)',
            border: '1px solid var(--border-bright)',
            borderRadius: 12, boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: 1 }}>
              NOTIFICATIONS
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                No new notifications
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ color: n.type === 'success' ? 'var(--success)' : n.type === 'error' ? 'var(--danger)' : 'var(--accent)', fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                    {n.type === 'success' ? '✓' : n.type === 'error' ? '✕' : '◈'}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>{n.msg}</span>
                  <button onClick={() => onClearNotification(n.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </header>
  );
}

const headerBtnStyle = {
  width: 38,
  height: 38,
  borderRadius: 8,
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-secondary)',
  transition: 'var(--transition)',
};

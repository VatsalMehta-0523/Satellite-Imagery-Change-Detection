import React, { useState, useEffect } from 'react';
import { complianceAPI } from '../../utils/api';

export default function CompliancePage({ projectId, addNotification }) {
  const [rules, setRules] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ rule_name: '', description: '' });
  const [loading, setLoading] = useState(false);

  const fetchRules = async () => {
    try {
      const r = await complianceAPI.listAll();
      setRules(r.data);
    } catch (_) {}
  };

  useEffect(() => { fetchRules(); }, [projectId]);

  const openAdd = () => {
    setEditing(null);
    setForm({ rule_name: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({ rule_name: rule.rule_name, description: rule.description });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.rule_name.trim()) return;
    setLoading(true);
    try {
      if (editing) {
        await complianceAPI.update(editing.id, form);
        addNotification('Rule updated', 'success');
      } else {
        await complianceAPI.add({ ...form, project_id: projectId || 1 });
        addNotification('Rule added', 'success');
      }
      await fetchRules();
      setShowModal(false);
    } catch (e) {
      addNotification('Save failed: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await complianceAPI.delete(id);
      setRules(prev => prev.filter(r => r.id !== id));
      addNotification('Rule deleted', 'success');
    } catch (e) {
      addNotification('Delete failed', 'error');
    }
  };

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)' }}>
              Compliance Rules
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Define rules to evaluate detected land-use changes against regulatory thresholds
            </p>
          </div>
          <button onClick={openAdd} style={primaryBtnStyle}>
            + Add Rule
          </button>
        </div>

        {!projectId && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--accent2)' }}>⚠</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No project loaded. Rules will be added to project ID 1. Fetch images first to associate rules with a project.</span>
          </div>
        )}

        {/* Rules table */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            {['RULE NAME', 'DESCRIPTION', 'ACTIONS'].map(h => (
              <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1.5 }}>{h}</span>
            ))}
          </div>

          {rules.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, opacity: 0.2, marginBottom: 12 }}>▣</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text-secondary)', marginBottom: 6 }}>No rules defined</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Add rules to evaluate compliance of detected changes</div>
            </div>
          ) : (
            rules.map((rule, i) => (
              <div
                key={rule.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 2fr auto',
                  padding: '16px 20px', borderBottom: i < rules.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center', gap: 16,
                  transition: 'var(--transition)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 3 }}>
                    {rule.rule_name}
                  </div>
                  <StatusBadge status={rule.status} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {rule.description}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(rule)} style={iconActionBtn('#00d4ff')}>✎</button>
                  <button onClick={() => handleDelete(rule.id)} style={iconActionBtn('#ff4d6d')}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,20,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 16, padding: 32, width: 480, maxWidth: '90vw', boxShadow: 'var(--shadow-lg)', animation: 'slideUp 0.2s ease' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, marginBottom: 6 }}>
              {editing ? 'Edit Rule' : 'Add Compliance Rule'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
              Define a rule to evaluate against detected changes
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>RULE NAME</label>
              <input
                value={form.rule_name}
                onChange={e => setForm(p => ({ ...p, rule_name: e.target.value }))}
                placeholder="e.g. No construction within 500m of water bodies"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>DESCRIPTION</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Ensure protected zones are not violated by urban expansion"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 90, lineHeight: 1.6 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button onClick={handleSave} disabled={loading} style={{ ...primaryBtnStyle, flex: 2, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Saving...' : editing ? 'Update Rule' : 'Add Rule'}
              </button>
            </div>
            <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    pending: { color: 'var(--text-muted)', bg: 'rgba(74,96,128,0.15)', label: 'PENDING' },
    compliant: { color: 'var(--success)', bg: 'rgba(34,211,160,0.12)', label: 'COMPLIANT' },
    warning: { color: 'var(--warning)', bg: 'rgba(245,166,35,0.12)', label: 'WARNING' },
    violation: { color: 'var(--danger)', bg: 'rgba(255,77,109,0.12)', label: 'VIOLATION' },
  }[status || 'pending'];

  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: cfg.bg, fontFamily: 'var(--font-mono)', fontSize: 9, color: cfg.color, letterSpacing: 1 }}>
      {cfg.label}
    </span>
  );
}

const iconActionBtn = (color) => ({
  width: 32, height: 32, borderRadius: 6, border: `1px solid ${color}33`,
  background: 'transparent', color, cursor: 'pointer', fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'var(--transition)',
});

const labelStyle = { display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1.5, marginBottom: 8 };
const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none', colorScheme: 'dark' };
const cancelBtnStyle = { flex: 1, padding: '12px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)' };
const primaryBtnStyle = { padding: '12px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--bg-deep)', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-display)', cursor: 'pointer', boxShadow: 'var(--glow-accent)', letterSpacing: 0.5 };

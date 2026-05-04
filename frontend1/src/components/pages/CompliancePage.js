import React, { useState, useEffect } from 'react';
import { complianceAPI, insightsAPI } from '../../utils/api';

const STATUS_CONFIG = {
  pending:   { color: 'var(--text-muted)', bg: 'var(--bg-tertiary)', label: 'Pending' },
  compliant: { color: 'var(--success)', bg: 'var(--success-subtle)', label: 'Compliant' },
  warning:   { color: 'var(--warning)', bg: 'var(--warning-subtle)', label: 'Warning' },
  violation: { color: 'var(--error)', bg: 'var(--error-subtle)', label: 'Violation' },
};

export default function CompliancePage({ projectId, addNotification }) {
  const [rules, setRules] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ rule_name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchRules = async () => {
    try { const r = await complianceAPI.listAll(); setRules(r.data); } catch {}
  };
  useEffect(() => { fetchRules(); }, [projectId]);

  const openAdd = () => { setEditing(null); setForm({ rule_name: '', description: '' }); setShowModal(true); };
  const openEdit = (r) => { setEditing(r); setForm({ rule_name: r.rule_name, description: r.description }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.rule_name.trim()) return;
    setLoading(true);
    try {
      if (editing) await complianceAPI.update(editing.id, form);
      else await complianceAPI.add({ ...form, project_id: projectId || 1 });
      addNotification(editing ? 'Rule updated' : 'Rule added', 'success');
      await fetchRules(); setShowModal(false);
    } catch (e) { addNotification('Save failed: ' + e.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule permanently?')) return;
    try { await complianceAPI.delete(id); setRules(prev => prev.filter(r => r.id !== id)); addNotification('Rule deleted', 'success'); }
    catch { addNotification('Delete failed', 'error'); }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const resp = await insightsAPI.downloadReport(projectId);
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a'); a.href = url; a.download = `UrbanEye_Report_${projectId}.pdf`; document.body.appendChild(a); a.click();
      addNotification('Report downloaded', 'success');
    } catch { addNotification('Export failed', 'error'); }
    finally { setIsExporting(false); }
  };

  const stats = { total: rules.length, compliant: rules.filter(r=>r.status==='compliant').length, violations: rules.filter(r=>r.status==='violation').length, warnings: rules.filter(r=>r.status==='warning').length };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Compliance Rules</span>
          {stats.violations > 0 && <span className="badge badge-error">{stats.violations} violations</span>}
          {stats.warnings > 0 && <span className="badge badge-warning">{stats.warnings} warnings</span>}
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Rule</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Stats */}
        {rules.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Rules', value: stats.total, color: 'var(--text-primary)' },
              { label: 'Compliant', value: stats.compliant, color: 'var(--success)' },
              { label: 'Warnings', value: stats.warnings, color: 'var(--warning)' },
              { label: 'Violations', value: stats.violations, color: 'var(--error)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color, fontSize: 28 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {!projectId && (
          <div style={{ padding: '10px 16px', background: 'var(--warning-subtle)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠</span> No project loaded. Rules will be created globally.
          </div>
        )}

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {rules.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, opacity: 0.2, marginBottom: 12 }}>⚖</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>No compliance rules</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>Add rules to evaluate detected changes against regulatory thresholds</p>
              <button className="btn btn-primary" onClick={openAdd}>Create First Rule</button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => {
                  const s = STATUS_CONFIG[rule.status || 'pending'];
                  return (
                    <tr key={rule.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{rule.rule_name}</div>
                        {rule.project_id && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Project #{rule.project_id}</div>}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 300, lineHeight: 1.5 }}>{rule.description}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}>
                          {s.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(rule)} style={{ padding: '4px 8px' }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rule.id)} style={{ padding: '4px 8px' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {projectId && rules.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button className="btn btn-secondary" onClick={handleExportPDF} disabled={isExporting}>
              {isExporting ? <><span className="spinner spinner-sm" /> Exporting Report…</> : '↓ Export Full Compliance Report'}
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 480, padding: 32 }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {editing ? 'Edit Rule' : 'New Compliance Rule'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Define a regulatory threshold to evaluate against detected changes</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Rule Name</label>
              <input className="input" value={form.rule_name} onChange={e => setForm(p => ({ ...p, rule_name: e.target.value }))}
                placeholder="e.g. No construction within 500m of protected zones" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Description</label>
              <textarea className="input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe the regulatory basis for this rule..." rows={4}
                style={{ resize: 'vertical', minHeight: 88, lineHeight: 1.6 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2, opacity: loading ? 0.6 : 1 }} onClick={handleSave} disabled={loading}>
                {loading ? <><span className="spinner spinner-sm" /> Saving…</> : editing ? 'Update Rule' : 'Add Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

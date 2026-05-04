import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import Tooltip from '../shared/Tooltip';

const FEATURES = [
  { icon: '🛰', title: 'Multi-Source Imagery', desc: 'Sentinel-2 DR3, Planet Labs, and Google Earth Engine — unified in one interface with temporal precision.', color: '#8B7CF6' },
  { icon: '🤖', title: 'ChangeFormer AI', desc: 'Transformer-based siamese network delivering pixel-precise change masks at satellite scale.', color: '#22C55E' },
  { icon: '📊', title: 'Spectral Analytics', desc: 'NDVI, NDBI, NDWI, MNDWI, BSI, EVI — 6 scientific indices for comprehensive land-use validation.', color: '#0EA5E9' },
  { icon: '⚖', title: 'Compliance Engine', desc: 'Define custom regulatory rules and evaluate detected changes against thresholds automatically.', color: '#F59E0B' },
  { icon: '🧠', title: 'AI Intelligence', desc: 'Gemini-powered narratives tailored for urban planners, environmental analysts, and executives.', color: '#F43F5E' },
  { icon: '🗺', title: 'ORION Agent', desc: 'Conversational autonomous agent that plans and executes full satellite analysis missions.', color: '#A855F7' },
];
const FLOWCHART = `
graph TD
  classDef default fill:#F7F7F5,stroke:#D6D6D6,stroke-width:1px,color:#1F1F1F,font-family:Inter;
  classDef engine fill:#8B7CF6,stroke:#7A6AE6,stroke-width:1px,color:#fff,font-family:Inter;
  classDef data fill:#22C55E,stroke:#16A34A,stroke-width:1px,color:#fff,font-family:Inter;

  A[Satellite Constellations]:::data --> B(GEE / Sentinel-2 / Planet)
  B --> C{UrbanEye Core Engine}:::engine
  C -->|Pre-processing| D[Image Alignment]
  D --> E[ChangeFormer v6]
  E --> F[Feature Extraction]
  F --> G[Cross-attention]
  G --> H(Final Temporal Change Mask):::engine
  H --> I{Insights Agent}
`;

function MermaidChart({ chart }) {
  const ref = useRef(null);
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'base', fontFamily: 'Inter' });
    if (ref.current) {
      mermaid.render('mermaid-svg-' + Math.random().toString(36).substr(2, 9), chart).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      });
    }
  }, [chart]);
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }} />;
}

function OverviewSlider({ leftImg, leftLabel, rightImg, rightLabel }) {
  const sliderRef = useRef(null);
  const [sliderPos, setSliderPos] = useState(50);
  const dragging = useRef(false);

  useEffect(() => {
    const stopDrag = () => { dragging.current = false; };
    window.addEventListener('mouseup', stopDrag);
    return () => window.removeEventListener('mouseup', stopDrag);
  }, []);

  const onSliderMove = (clientX) => {
    if (!sliderRef.current || !dragging.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    setSliderPos(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <div
      className="card upscale-hover"
      ref={sliderRef}
      style={{ position: 'relative', width: '100%', height: 320, cursor: 'ew-resize', userSelect: 'none', overflow: 'hidden' }}
      onMouseDown={(e) => { dragging.current = true; onSliderMove(e.clientX); }}
      onMouseMove={(e) => onSliderMove(e.clientX)}
      onTouchMove={(e) => onSliderMove(e.touches[0].clientX)}
      onTouchStart={(e) => { dragging.current = true; onSliderMove(e.touches[0].clientX); }}
      onTouchEnd={() => dragging.current = false}
    >
      <img src={rightImg} alt={rightLabel} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false}
        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
      <div style={{ display: 'none', width: '100%', height: '100%', background: 'var(--bg-tertiary)', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Missing: {rightImg}</span>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
        <span className="badge badge-neutral" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)' }}>{rightLabel}</span>
      </div>

      <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}>
        <img src={leftImg} alt={leftLabel} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} draggable={false}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        <div style={{ display: 'none', width: '100%', height: '100%', background: 'var(--bg-elevated)', borderRight: '1px solid var(--border-medium)', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Missing: {leftImg}</span>
        </div>
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
          <span className="badge badge-neutral" style={{ background: 'rgba(30,30,30,0.9)', color: '#fff', backdropFilter: 'blur(4px)' }}>{leftLabel}</span>
        </div>
      </div>

      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`, width: 3, background: 'var(--accent)', transform: 'translateX(-50%)', zIndex: 20, boxShadow: '0 0 12px rgba(0,0,0,0.4)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 32, height: 32, background: '#fff', borderRadius: '50%', border: '3px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            <div style={{ width: 2, height: 12, background: 'var(--accent)', borderRadius: 2 }} />
            <div style={{ width: 2, height: 12, background: 'var(--accent)', borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <span style={{ fontWeight: 700, fontSize: 15 }}>Overview</span>
        <span className="badge badge-success" style={{ marginLeft: 8 }}>
          <span className="dot" style={{ background: 'var(--success)', width: 6, height: 6 }} /> Platform Active
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Hero */}
        <div className="card" style={{ padding: '48px 40px', textAlign: 'center', marginBottom: 32, position: 'relative', overflow: 'hidden', minHeight: '85vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent), #22C55E, #0EA5E9)' }} />
          <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 99, background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1, marginBottom: 16 }}>
            AI-NATIVE GEOSPATIAL INTELLIGENCE
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 24 }}>
            See the Earth{' '}
            <span style={{ color: 'var(--accent)' }}>Change</span>
          </h1>

          <div style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 680, margin: '0 auto 32px', textAlign: 'left', background: 'var(--bg-tertiary)', padding: '24px 32px', borderRadius: 12, border: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Project Gist :</div>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><strong>Multi-Source Data:</strong> Ingests and unifies imagery from Sentinel-2, Planet Labs, and Google Earth Engine.</li>
              <li><strong>AI Change Detection:</strong> Leverages a Siamese Transformer (ChangeFormer) architecture to detect pixel-precise urban modifications.</li>
              <li><strong>Spectral Analytics:</strong> Computes 6 scientific indices (NDVI, NDBI, NDWI, MNDWI, BSI, EVI) to validate environmental and land-use shifts.</li>
              <li><strong>Intelligence Reporting:</strong> Integrates LLMs to autonomously generate structured executive summaries and compliance reports from the raw analytical data.</li>
              <li><strong>Autonomous Agent (ORION):</strong> Uses LangGraph to translate conversational prompts into complex, automated geospatial workflows.</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-success"><span className="dot" style={{ background: 'var(--success)', width: 6, height: 6 }} /> S2DR3 Pipeline Active</span>
            <span className="badge badge-accent">ChangeFormer v6 Loaded</span>
            <span className="badge badge-neutral">6 Spectral Indices</span>
          </div>
        </div>

        {/* Setup instructions & Comparisons */}
        <div style={{ marginBottom: 36 }}>
          <div className="section-title" style={{ marginBottom: 24 }}>Imagery Comparison Visualization</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Slider 1: GEE vs Planet */}
            <div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Resolution Comparison</div>
                <div className="text-secondary text-sm">GEE vs Planet Labs (3m)</div>
              </div>
              <OverviewSlider leftImg="/images/gee.png" leftLabel="Google Earth Engine" rightImg="/images/planet.png" rightLabel="Planet Labs" />
            </div>

            {/* Slider 2: GEE vs S2DR3 */}
            <div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Processing Comparison</div>
                <div className="text-secondary text-sm">GEE vs Sentinel-2 DR3</div>
              </div>
              <OverviewSlider leftImg="/images/gee.png" leftLabel="Google Earth Engine" rightImg="/images/s2dr3.png" rightLabel="Sentinel-2 DR3" />
            </div>
          </div>
        </div>

        {/* ChangeFormer Architecture */}
        <div style={{ marginBottom: 40 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Network Architecture</div>
          <div className="card" style={{ padding: 24, background: 'var(--bg-card)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>
              Transformer (ChangeFormer) Pretrained Model
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
              Special thanks to <a href="https://github.com/wgcban/ChangeFormer" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Wele Gedara Chaminda Bandara, and Vishal M. Patel</a> for their foundational work on the ChangeFormer architecture.
            </p>
            
            <div style={{ background: '#ffffff', borderRadius: 8, padding: 16, marginBottom: 32, display: 'flex', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
              <img src="/images/IGARS_ChangeFormer.jpeg" alt="ChangeFormer Architecture" style={{ maxWidth: '100%', height: 'auto', borderRadius: 4 }} />
            </div>

            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>
              Fine-Tuning on OSCD Dataset
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 0 }}>
              We have fine-tuned this pretrained model using the <a href="https://ieee-dataport.org/open-access/oscd-onera-satellite-change-detection" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>OSCD</a> (Onera Satellite Change Detection) dataset to specialize its detection capabilities for high-resolution urban environments.
            </p>
          </div>
        </div>

        {/* Feature cards */}
        <div>
          <div className="section-title" style={{ marginBottom: 16 }}>Platform Capabilities</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="card" style={{ padding: '20px', transition: 'box-shadow 200ms', cursor: 'default' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${f.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
                  <Tooltip text={`Dive deep into ${f.title}`} position="bottom">
                    {f.title}
                  </Tooltip>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Source comparison */}
        <div>
          <div className="section-title" style={{ marginBottom: 16 }}>Imagery Sources</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Provider</th>
                  <th>Resolution</th>
                  <th>Revisit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Sentinel-2 DR3', provider: 'ESA / Copernicus', res: '10m', revisit: '5 days', status: 'active' },
                  { name: 'Planet Labs', provider: 'Planet', res: '3m', revisit: 'Daily', status: 'available' },
                  { name: 'Google Earth Engine', provider: 'Google', res: '10–30m', revisit: 'Archive', status: 'available' },
                ].map(s => (
                  <tr key={s.name}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{s.provider}</td>
                    <td><span className="chip">{s.res}</span></td>
                    <td><span className="chip">{s.revisit}</span></td>
                    <td>
                      <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-accent'}`}>{s.status === 'active' ? 'Active' : 'Available'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

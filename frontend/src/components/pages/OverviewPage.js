import React, { useState } from 'react';

const FEATURES = [
  { icon: '⬡', title: 'Multi-Source Imagery', desc: 'Sentinel-2 DR3, Planet Labs, and Google Earth Engine — unified in one interface.' },
  { icon: '◉', title: 'ChangeFormer AI', desc: 'Transformer-based siamese network delivering pixel-precise change masks at scale.' },
  { icon: '◎', title: 'Spectral Validation', desc: 'NDVI, NDBI, NDWI, MNDWI, BSI, EVI — 6 indices validating every model prediction.' },
  { icon: '▣', title: 'Compliance Engine', desc: 'Define custom rules and evaluate regulatory compliance against detected changes.' },
  { icon: '✦', title: 'AI Reports', desc: 'Gemini-powered intelligence reports tailored to urban planners, analysts, and executives.' },
];

const PLANS = [
  {
    name: 'Explorer',
    price: '$49',
    period: '/mo',
    color: 'var(--text-secondary)',
    features: ['S2DR3 imagery only', '5 projects/month', 'Standard indices', 'Basic reports'],
    cta: 'Get Started',
  },
  {
    name: 'Professional',
    price: '$149',
    period: '/mo',
    color: 'var(--accent)',
    featured: true,
    features: ['S2DR3 + Planet Labs', '25 projects/month', 'All 6 indices', 'AI-powered reports', 'Compliance rules'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    color: 'var(--accent2)',
    features: ['All sources incl. GEE', 'Unlimited projects', 'Custom model training', 'Priority support', 'SLA guarantee'],
    cta: 'Contact Sales',
  },
];

export default function OverviewPage() {
  const [showPricing, setShowPricing] = useState(false);

  return (
    <div style={{ padding: '32px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 60, position: 'relative', background: 'var(--bg-card)', padding: '60px 40px', borderRadius: 20, border: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: 3, marginBottom: 16 }}>AI-NATIVE GEOSPATIAL INTELLIGENCE</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 42, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 20 }}>
            See the Earth <span style={{ color: 'var(--accent)' }}>Change</span> In Real Time
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 32px' }}>
            GeoVision combines multi-source satellite imagery with deep learning change detection — delivering actionable intelligence for urban planners and environmental analysts.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <div style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--accent-glow)', border: '1px solid var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>S2DR3 PIPELINE ACTIVE</div>
            <div style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(34,211,160,0.08)', border: '1px solid var(--success)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--success)' }}>CHANGEFORMER LOADED</div>
          </div>
        </div>

        {/* Features grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 60 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, transition: 'var(--transition)' }}>
              <div style={{ fontSize: 26, marginBottom: 12, color: 'var(--accent)' }}>{f.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Source comparison */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 16 }}>SOURCE COMPARISON</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { name: 'S2DR3', sub: 'Sentinel-2 DR3', res: '10m', cadence: '5 days', status: 'active', color: 'var(--success)' },
              { name: 'Planet Labs', sub: 'Planet Scope', res: '3m', cadence: 'Daily', status: 'coming soon', color: 'var(--text-muted)' },
              { name: 'Google Earth Engine', sub: 'GEE Archive', res: '10–30m', cadence: 'Variable', status: 'coming soon', color: 'var(--text-muted)' },
            ].map(s => (
              <div key={s.name} style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 10, border: `1px solid ${s.status === 'active' ? 'var(--success)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{s.name}</div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 8px', borderRadius: 4, background: s.status === 'active' ? 'rgba(34,211,160,0.12)' : 'rgba(74,96,128,0.12)', color: s.color, letterSpacing: 1 }}>{s.status.toUpperCase()}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-muted)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button onClick={() => setShowPricing(true)} style={{ padding: '14px 36px', borderRadius: 12, border: '1px solid var(--accent)', background: 'var(--accent-glow)', color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', boxShadow: 'var(--glow-accent)' }}>View Pricing Plans →</button>
        </div>
      </div>

      {showPricing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,12,20,0.9)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 20, padding: 40, maxWidth: 860, width: '100%', boxShadow: 'var(--shadow-lg)', animation: 'slideUp 0.2s ease', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24 }}>Choose Your Plan</h2>
              <button onClick={() => setShowPricing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {PLANS.map(plan => (
                <div key={plan.name} style={{ padding: 28, borderRadius: 16, background: plan.featured ? 'var(--accent-glow)' : 'var(--bg-elevated)', border: `1px solid ${plan.featured ? 'var(--accent)' : 'var(--border)'}`, position: 'relative' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: plan.color, marginBottom: 8 }}>{plan.name}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 20 }}>{plan.price}<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{plan.period}</span></div>
                  {plan.features.map(f => (
                    <div key={f} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>✓ {f}</div>
                  ))}
                  <button style={{ width: '100%', marginTop: 24, padding: '11px', borderRadius: 8, border: `1px solid ${plan.color}`, background: plan.featured ? 'var(--accent)' : 'transparent', color: plan.featured ? 'var(--bg-deep)' : plan.color, fontWeight: 700, cursor: 'pointer' }}>{plan.cta}</button>
                </div>
              ))}
            </div>
          </div>
          <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }`}</style>
        </div>
      )}
    </div>
  );
}

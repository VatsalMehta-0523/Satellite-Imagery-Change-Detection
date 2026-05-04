import React, { useState, useEffect, useRef } from 'react';
import './styles/globals.css';
import Sidebar from './components/Sidebar';
import FetchPage from './components/pages/FetchPage';
import OverviewPage from './components/pages/OverviewPage';
import ChangeDetectionPage from './components/pages/ChangeDetectionPage';
import IndexValidationPage from './components/pages/IndexValidationPage';
import CompliancePage from './components/pages/CompliancePage';
import InsightsPage from './components/pages/InsightsPage';
import AgentPage from './components/pages/AgentPage';
import { fetchAPI, getImageUrl } from './utils/api';

const PAGES = {
  fetch: FetchPage,
  overview: OverviewPage,
  change: ChangeDetectionPage,
  indices: IndexValidationPage,
  compliance: CompliancePage,
  insights: InsightsPage,
  agent: AgentPage,
};

export default function App() {
  const [activePage, setActivePage] = useState('fetch');
  const [projectId, setProjectId] = useState(null);
  const [aoi, setAoi] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('ue_theme') || 'light');
  const [stagedSelection, setStagedSelection] = useState(null);
  const [agentMessages, setAgentMessages] = useState([
    { role: 'agent', content: '## Welcome to UrbanEye\n\nI\'m ORION, your geospatial intelligence assistant. I can help you create missions, fetch satellite imagery, and analyze changes automatically.\n\nSay **"Help"** to learn what I can do, or describe your area of interest to begin.' }
  ]);
  const [agentProgress, setAgentProgress] = useState(0);
  const [agentSessionId] = useState(`sess_${Math.random().toString(36).substr(2, 9)}`);
  const [jobStatus, setJobStatus] = useState({
    active: false, stage: 'idle',
    t1: 'idle', t2: 'idle',
    change_detection: 'idle', spectral_intel: 'idle', insights: 'idle',
    t1_tci_url: null, t2_tci_url: null,
    progress: { t1: 0, t2: 0 }, results: {}
  });

  const pollRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ue_theme', theme);
  }, [theme]);

  const addNotification = (msg, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const startPolling = (pid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setProjectId(pid);
    setJobStatus(p => ({ ...p, active: true, stage: 'tci_sync', t1: 'loading', t2: 'loading' }));
    let states = { t1_done: false, t2_done: false, cd_done: false, intel_done: false, insights_done: false };

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetchAPI.getStatus(pid);
        const s = r.data;
        if (s.results?.indices) {
          ['t1','t2'].forEach(t => {
            if (s.results.indices[t]) Object.values(s.results.indices[t]).forEach(idx => { if (idx.url) idx.url = getImageUrl(idx.url); });
          });
        }
        setJobStatus(prev => ({
          ...prev,
          stage: s.stage || prev.stage, t1: s.t1 || prev.t1, t2: s.t2 || prev.t2,
          change_detection: s.change_detection || prev.change_detection,
          spectral_intel: s.spectral_intel || prev.spectral_intel,
          insights: s.insights || prev.insights,
          t1_tci_url: getImageUrl(s.t1_tci_url) || prev.t1_tci_url,
          t2_tci_url: getImageUrl(s.t2_tci_url) || prev.t2_tci_url,
          progress: s.progress || prev.progress,
          results: { ...prev.results, ...s.results }, logs: s.logs || prev.logs
        }));
        if (!states.t1_done && s.t1 === 'ready') { addNotification('T1 baseline imagery ready', 'success'); states.t1_done = true; }
        if (!states.t2_done && s.t2 === 'ready') { addNotification('T2 monitoring imagery ready', 'success'); states.t2_done = true; }
        if (!states.cd_done && s.change_detection === 'ready') { addNotification('Change detection complete', 'success'); states.cd_done = true; }
        if (!states.intel_done && s.spectral_intel === 'ready') { addNotification('Spectral indices processed', 'success'); states.intel_done = true; }
        if (!states.insights_done && s.insights === 'ready') { addNotification('Intelligence report ready', 'success'); states.insights_done = true; }
        if (s.stage === 'complete' && s.insights === 'ready') { clearInterval(pollRef.current); setJobStatus(p => ({ ...p, active: false })); }
      } catch (_) {}
    }, 2500);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const PageComponent = PAGES[activePage] || FetchPage;

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        jobStatus={jobStatus}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      />

      <div className="main-area">
        <PageComponent
          projectId={projectId}
          setProjectId={setProjectId}
          aoi={aoi}
          setAoi={setAoi}
          addNotification={addNotification}
          jobStatus={jobStatus}
          onStartFetch={startPolling}
          setActivePage={setActivePage}
          stagedSelection={stagedSelection}
          setStagedSelection={setStagedSelection}
          agentMessages={agentMessages}
          setAgentMessages={setAgentMessages}
          agentProgress={agentProgress}
          setAgentProgress={setAgentProgress}
          agentSessionId={agentSessionId}
          theme={theme}
        />
      </div>

      {/* Toast Notifications */}
      <div className="toast-stack">
        {notifications.map(n => (
          <div key={n.id} className={`toast toast-${n.type}`}>
            <span className={`dot dot-${n.type === 'success' ? 'success' : n.type === 'error' ? 'warning' : 'accent'}`} style={{ background: n.type === 'error' ? 'var(--error)' : undefined }} />
            <span style={{ flex: 1, lineHeight: 1.4 }}>{n.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

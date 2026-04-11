import React, { useState, useEffect, useRef } from 'react';
import './styles/globals.css';
import Sidebar from './components/sidebar/Sidebar';
import Header from './components/shared/Header';
import FetchPage from './components/pages/FetchPage';
import OverviewPage from './components/pages/OverviewPage';
import ChangeDetectionPage from './components/pages/ChangeDetectionPage';
import IndexValidationPage from './components/pages/IndexValidationPage';
import CompliancePage from './components/pages/CompliancePage';
import InsightsPage from './components/pages/InsightsPage';
import { fetchAPI } from './utils/api';

const PAGES = {
  fetch: FetchPage,
  overview: OverviewPage,
  change: ChangeDetectionPage,
  indices: IndexValidationPage,
  compliance: CompliancePage,
  insights: InsightsPage,
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('fetch');
  const [projectId, setProjectId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  
  // Advanced Global Mission Status
  const [jobStatus, setJobStatus] = useState({
    active: false,
    stage: 'idle', // 'tci_sync', 'intel_acquisition', 'ai_synthesis', 'complete'
    t1: 'idle',
    t2: 'idle',
    change_detection: 'idle',
    spectral_intel: 'idle',
    insights: 'idle',
    t1_tci_url: null,
    t2_tci_url: null,
    progress: { t1: 0, t2: 0 },
    results: {}
  });

  const pollRef = useRef(null);

  const addNotification = (msg, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const startPolling = (pid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setProjectId(pid);
    setJobStatus(p => ({ ...p, active: true, stage: 'tci_sync', t1: 'loading', t2: 'loading' }));
    
    let states = {
      t1_done: false,
      t2_done: false,
      cd_done: false,
      intel_done: false,
      insights_done: false
    };

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetchAPI.getStatus(pid);
        const s = r.data;
        
        setJobStatus(prev => ({
          ...prev,
          stage: s.stage || prev.stage,
          t1: s.t1 || prev.t1,
          t2: s.t2 || prev.t2,
          change_detection: s.change_detection || prev.change_detection,
          spectral_intel: s.spectral_intel || prev.spectral_intel,
          insights: s.insights || prev.insights,
          t1_tci_url: s.t1_tci_url || prev.t1_tci_url,
          t2_tci_url: s.t2_tci_url || prev.t2_tci_url,
          progress: s.progress || prev.progress,
          results: { ...prev.results, ...s.results },
          logs: s.logs || prev.logs
        }));

        // Notification Triggers
        if (!states.t1_done && s.t1 === 'ready') {
          addNotification('T1 Imagery: Synchronization Complete', 'success');
          states.t1_done = true;
        }
        if (!states.t2_done && s.t2 === 'ready') {
          addNotification('T2 Imagery: Synchronization Complete', 'success');
          states.t2_done = true;
        }
        if (!states.cd_done && s.change_detection === 'ready') {
          addNotification('Change Analysis: Mask Ready', 'info');
          states.cd_done = true;
        }
        if (!states.intel_done && s.spectral_intel === 'ready') {
          addNotification('Spectral Intel: Indices Processed', 'info');
          states.intel_done = true;
        }
        if (!states.insights_done && s.insights === 'ready') {
          addNotification('Mission Intelligence: Final Report Ready', 'success');
          states.insights_done = true;
        }

        // Only stop polling if the entire mission + final insights are ready
        if (s.stage === 'complete' && s.insights === 'ready') {
          clearInterval(pollRef.current);
          setJobStatus(p => ({ ...p, active: false }));
        }
      } catch (_) {}
    }, 2500);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const PageComponent = PAGES[activePage] || FetchPage;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      <Sidebar
        open={sidebarOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
        activePage={activePage}
        onNavigate={(page) => { setActivePage(page); setSidebarOpen(false); }}
        jobActive={jobStatus.active}
      />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'var(--transition)',
        marginLeft: sidebarOpen ? 'var(--sidebar-w-open)' : 'var(--sidebar-w-closed)',
      }}>
        <Header
          notifications={notifications}
          onClearNotification={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
        />
        <main style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <PageComponent
            projectId={projectId}
            setProjectId={setProjectId}
            addNotification={addNotification}
            jobStatus={jobStatus}
            onStartFetch={startPolling}
          />
        </main>
      </div>
    </div>
  );
}

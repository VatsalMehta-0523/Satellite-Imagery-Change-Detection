import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SOCKET_URL } from '../../utils/api';

const AGENT_WS_URL = `${SOCKET_URL}/ws/agent/`;

export default function AgentPage({
  projectId, setProjectId, aoi, addNotification,
  stagedSelection, setStagedSelection,
  agentMessages, setAgentMessages,
  agentProgress, setAgentProgress,
  agentSessionId, onStartFetch, setActivePage
}) {
  const [inputValue, setInputValue] = useState('');
  const [connected, setConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const messages = agentMessages;
  const setMessages = setAgentMessages;
  const progress = agentProgress;
  const setProgress = setAgentProgress;

  const ws = useRef(null);
  const scrollRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectCount = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  const connect = () => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    ws.current = new WebSocket(`${AGENT_WS_URL}${agentSessionId}`);

    ws.current.onopen = () => {
      setConnected(true);
      reconnectCount.current = 0;
      addNotification('ORION connected', 'success');
    };
    ws.current.onmessage = (event) => {
      setIsTyping(false);
      handleAgentMessage(JSON.parse(event.data));
    };
    ws.current.onclose = (e) => {
      setConnected(false);
      if (!e.wasClean) {
        const delay = Math.min(1000 * Math.pow(2, reconnectCount.current), 30000);
        addNotification(`ORION disconnected. Reconnecting…`, 'warning');
        reconnectTimer.current = setTimeout(() => { reconnectCount.current += 1; connect(); }, delay);
      }
    };
    ws.current.onerror = () => setConnected(false);
  };

  const handleAgentMessage = (data) => {
    if (data.type === 'AGENT_MESSAGE') {
      setMessages(prev => [...prev, { role: 'agent', content: data.content }]);
    } else if (data.type === 'TOOL_EXECUTION') {
      let displayContent = data.result;
      try {
        const parsed = JSON.parse(data.result);
        if (parsed?.message || parsed?.ui_location) {
          displayContent = `**${data.tool?.replace(/_/g, ' ').toUpperCase()} COMPLETE**\n\n${parsed.message || ''}`;
          if (parsed.ui_location) displayContent += `\n\n📍 **Location:** ${parsed.ui_location}`;
        }
      } catch {
        displayContent = `Tool executed: **${data.tool}**\n\n${data.result || ''}`;
      }
      setMessages(prev => [...prev, { role: 'tool', content: displayContent, tool: data.tool }]);
      setProgress(prev => Math.min(prev + 15, 95));
    } else if (data.type === 'MISSION_SYNC_TRIGGER') {
      const pid = data.project_id || projectId;
      if (pid) {
        setProjectId(pid);
        if (onStartFetch) onStartFetch(pid);
        addNotification(`Dashboard synchronized — Mission #${pid}`, 'success');
      }
    } else if (data.type === 'PROGRESS_UPDATE') {
      setProgress(data.progress || 0);
    } else if (data.type === 'MISSION_COMPLETE' || data.type === 'CYCLE_COMPLETE') {
      setProgress(100);
      addNotification('Mission complete', 'success');
    } else if (data.type === 'ERROR') {
      setMessages(prev => [...prev, { role: 'agent', content: `**Error:** ${data.content}` }]);
      addNotification(data.content, 'error');
    }
  };

  const sendMessage = () => {
    if (!inputValue.trim() || !connected) return;
    let missionPayload = null;
    const isAffirmative = /ready|go|hi|already|staged|selected|proceed|start/i.test(inputValue.toLowerCase());
    if (isAffirmative && stagedSelection) {
      missionPayload = stagedSelection;
      if (setStagedSelection) setStagedSelection(null);
      addNotification('Mission telemetry transmitted to ORION', 'success');
    }
    const msg = {
      type: 'CHAT_MESSAGE',
      content: inputValue,
      user_request: inputValue,
      aoi: missionPayload?.aoi || aoi,
      project_id: projectId,
      mission_params: missionPayload || null
    };
    ws.current.send(JSON.stringify(msg));
    setMessages(prev => [...prev, { role: 'user', content: inputValue }]);
    setInputValue('');
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 15000);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const hasStagedMission = !!stagedSelection;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--error)', boxShadow: connected ? '0 0 0 2px var(--success-subtle)' : undefined, transition: 'all 0.3s' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>ORION Agent</span>
          <span className={`badge ${connected ? 'badge-success' : 'badge-error'}`}>{connected ? 'Online' : 'Offline'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {projectId && <span className="badge badge-accent">Mission #{projectId}</span>}
          {hasStagedMission && (
            <span className="badge badge-warning" style={{ cursor: 'pointer' }} onClick={() => inputRef.current?.focus()}>
              📡 Staged mission ready
            </span>
          )}
          {progress > 0 && progress < 100 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div className="progress-track" style={{ width: 80 }}>
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{progress}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Staged mission banner */}
      {hasStagedMission && (
        <div style={{ padding: '10px 20px', background: 'var(--warning-subtle)', borderBottom: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14 }}>📡</span>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
            <strong>Mission telemetry staged</strong> — Source: <code style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 3 }}>{stagedSelection.source}</code>, T1: <code style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 3 }}>{stagedSelection.t1Date}</code>, T2: <code style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 3 }}>{stagedSelection.t2Date}</code>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setInputValue('GO AHEAD'); setTimeout(sendMessage, 100); }}>
            Deploy Mission →
          </button>
        </div>
      )}

      {/* Message list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((m, i) => (
          <ChatBubble key={i} message={m} />
        ))}
        {isTyping && <TypingIndicator />}
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            disabled={!connected}
            placeholder={connected ? (hasStagedMission ? 'Say "GO AHEAD" to deploy the staged mission, or type a new instruction…' : "Describe what you'd like to analyze, e.g. 'Monitor Ahmedabad for urban expansion since 2020'") : 'ORION is reconnecting…'}
            rows={2}
            style={{
              flex: 1, resize: 'none', padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
              fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
              background: 'var(--bg-primary)', border: '1px solid var(--border-medium)',
              borderRadius: 10, outline: 'none', transition: 'border-color 150ms',
              opacity: connected ? 1 : 0.6
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-medium)'}
          />
          <button
            className="btn btn-primary"
            onClick={sendMessage}
            disabled={!connected || !inputValue.trim()}
            style={{ padding: '10px 20px', flexShrink: 0, alignSelf: 'flex-end' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['GO AHEAD', 'What can you do?', 'Create a mission', 'Show changes'].map(q => (
            <button
              key={q}
              className="chip"
              style={{ cursor: 'pointer', transition: 'all 150ms', padding: '4px 10px', fontSize: 11 }}
              onClick={() => { setInputValue(q); inputRef.current?.focus(); }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message: m }) {
  const isAgent = m.role === 'agent';
  const isTool = m.role === 'tool';

  if (isTool) {
    return (
      <div style={{ alignSelf: 'flex-start', maxWidth: '85%', animation: 'slideUp 0.2s ease' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
          ⚙ Tool Executed
        </div>
        <div style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)', borderRadius: '4px 12px 12px 12px', padding: '12px 16px', fontSize: 13, lineHeight: 1.6 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p style={{ margin: 0, color: 'var(--text-primary)' }}>{children}</p>, strong: ({children}) => <strong style={{ color: 'var(--accent)' }}>{children}</strong> }}>
            {m.content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div style={{ alignSelf: isAgent ? 'flex-start' : 'flex-end', maxWidth: '80%', animation: 'slideUp 0.2s ease' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6, color: isAgent ? 'var(--text-muted)' : 'var(--accent)', textTransform: 'uppercase', textAlign: isAgent ? 'left' : 'right' }}>
        {isAgent ? 'ORION' : 'You'}
      </div>
      <div className={isAgent ? 'chat-bubble-agent' : 'chat-bubble-user'} style={{ padding: '12px 16px', fontSize: 13.5, lineHeight: 1.65 }}>
        {isAgent ? (
          <div className="prose" style={{ margin: 0 }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({children}) => <p style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>{children}</p>,
                h2: ({children}) => <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 6px' }}>{children}</h2>,
                h3: ({children}) => <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '10px 0 4px' }}>{children}</h3>,
                strong: ({children}) => <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{children}</strong>,
                ul: ({children}) => <ul style={{ paddingLeft: 18, margin: '4px 0 8px' }}>{children}</ul>,
                li: ({children}) => <li style={{ marginBottom: 4, color: 'var(--text-primary)' }}>{children}</li>,
                code: ({inline, children}) => inline
                  ? <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: 3, color: 'var(--accent)' }}>{children}</code>
                  : <pre style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 6, fontSize: 11.5, overflowX: 'auto', margin: '8px 0', fontFamily: 'var(--font-mono)' }}><code>{children}</code></pre>,
                table: ({children}) => <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, margin: '8px 0' }}>{children}</table>,
                th: ({children}) => <th style={{ padding: '6px 10px', borderBottom: '2px solid var(--border-medium)', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{children}</th>,
                td: ({children}) => <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--divider)', color: 'var(--text-primary)' }}>{children}</td>,
              }}
            >
              {m.content}
            </ReactMarkdown>
          </div>
        ) : (
          <span>{m.content}</span>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ alignSelf: 'flex-start', animation: 'slideUp 0.2s ease' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>ORION</div>
      <div className="chat-bubble-agent" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', opacity: 0.6, animation: `pulse 1.2s ease ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

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
    agentSessionId, onStartFetch
}) {
    const [inputValue, setInputValue] = useState('');
    const [connected, setConnected] = useState(false);
    
    // Alias to local variable names used in original logic to minimize refactor drift
    const messages = agentMessages;
    const setMessages = setAgentMessages;
    const progress = agentProgress;
    const setProgress = setAgentProgress;

    const ws = useRef(null);
    const scrollRef = useRef(null);
    const reconnectTimer = useRef(null);
    const reconnectCount = useRef(0);

    useEffect(() => {
        connect();
        return () => {
            if (ws.current) ws.current.close();
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        };
    }, []);

    const connect = () => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        
        console.log(`[ORION] Attempting neural link establishment...`);
        ws.current = new WebSocket(`${AGENT_WS_URL}${agentSessionId}`);
        
        ws.current.onopen = () => {
            setConnected(true);
            reconnectCount.current = 0;
            addNotification('ORION Neural Uplink Established', 'success');
        };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleAgentMessage(data);
        };

        ws.current.onclose = (e) => {
            setConnected(false);
            if (!e.wasClean) {
                const delay = Math.min(1000 * Math.pow(2, reconnectCount.current), 30000);
                addNotification(`ORION Link Interrupted. Reconnecting in ${delay/1000}s...`, 'warning');
                reconnectTimer.current = setTimeout(() => {
                    reconnectCount.current += 1;
                    connect();
                }, delay);
            }
        };

        ws.current.onerror = () => {
            setConnected(false);
        };
    };

    const handleAgentMessage = (data) => {
        if (data.type === 'AGENT_MESSAGE') {
            setMessages(prev => [...prev, { role: 'agent', content: data.content }]);
        } else if (data.type === 'TOOL_EXECUTION') {
            setMessages(prev => [...prev, { role: 'agent', content: `[ACTION] ${data.tool.toUpperCase()}: ${data.result}` }]);
            setProgress(prev => Math.min(prev + 15, 95));
        } else if (data.type === 'MISSION_SYNC_TRIGGER') {
            // Neural Sync: Dashboard is now controlled by the AI agent
            if (data.project_id) {
                setProjectId(data.project_id);
                if (onStartFetch) onStartFetch(data.project_id);
                addNotification(`ORION: Dashboard Synchronized with Mission ${data.project_id}`, 'success');
            }
        } else if (data.type === 'PROGRESS_UPDATE') {
            setProgress(data.progress || 0);
        } else if (data.type === 'MISSION_COMPLETE') {
            addNotification('ORION: Mission successfully executed.', 'success');
            setProgress(100);
        } else if (data.type === 'HEARTBEAT') {
            // Internal use
        } else if (data.type === 'CYCLE_COMPLETE') {
            setProgress(100);
        } else if (data.type === 'ERROR') {
            setMessages(prev => [...prev, { role: 'agent', content: `CRITICAL ERROR: ${data.content}` }]);
            addNotification(data.content, 'error');
        }
    };

    const sendMessage = () => {
        if (!inputValue.trim() || !connected) return;
        
        let missionPayload = null;
        const input = inputValue.toLowerCase();
        
        // Robust Handoff Detection (Fuzzy matching)
        const isAffirmative = /ready|go|hi|already|staged|selected|proceed/i.test(input);
        
        if (isAffirmative && stagedSelection) {
            missionPayload = stagedSelection;
            addNotification('ORION: Telemetry Link Synchronized', 'success');
            // Clear staged selection after handoff to prevent re-ingestion
            if (setStagedSelection) setStagedSelection(null);
        }

        const type = input === 'ack' ? 'HUMAN_INPUT' : 'CHAT_MESSAGE';
        
        const msg = {
            type: type,
            content: inputValue,
            user_request: inputValue,
            aoi: missionPayload?.aoi || aoi,
            project_id: projectId,
            mission_params: missionPayload || null 
        };
        
        ws.current.send(JSON.stringify(msg));
        setMessages(prev => [...prev, { role: 'user', content: inputValue }]);
        setInputValue('');
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="animate-fade-in" style={containerStyle}>
            <header style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                            <div style={{ ...pulseDotStyle, background: connected ? 'var(--accent)' : 'var(--danger)' }} />
                            <h1 style={titleStyle}>ORION INTELLIGENCE: MISSION CONTROL</h1>
                        </div>
                        <p style={subTitleStyle}>Autonomous Geospatial Orchestration Engine v2.0</p>
                    </div>
                    <div className="glass-card" style={connectionBadgeStyle}>
                        <div style={{ ...statusDotStyle, background: connected ? 'var(--success)' : 'var(--danger)' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>
                            {connected ? 'LINK: ESTABLISHED' : 'LINK: RESYNCING'}
                        </span>
                    </div>
                </div>
            </header>

            <div style={mainGridStyle}>
                {/* Chat Interface */}
                <div className="glass" style={chatSectionStyle}>
                    <div ref={scrollRef} style={messageListStyle}>
                        {messages.map((m, i) => (
                            <div key={i} style={{ 
                                marginBottom: 24, 
                                display: 'flex', 
                                flexDirection: 'column',
                                alignItems: m.role === 'agent' ? 'flex-start' : 'flex-end',
                                maxWidth: '100%'
                            }}>
                                <div style={{ 
                                    fontSize: 9, 
                                    fontWeight: 900, 
                                    color: 'var(--text-dim)', 
                                    marginBottom: 6,
                                    textTransform: 'uppercase',
                                    letterSpacing: 2
                                }}>{m.role === 'agent' ? '✦ ORION-1' : '◈ FIELD COMMAND'}</div>
                                <div className="glass-card" style={{ 
                                    padding: '16px 20px', 
                                    borderRadius: 16, 
                                    fontSize: 14,
                                    lineHeight: 1.6,
                                    maxWidth: '80%',
                                    background: m.role === 'agent' ? 'var(--bg-elevated)' : 'var(--accent)',
                                    color: m.role === 'agent' ? 'var(--text-primary)' : 'var(--bg-deep)',
                                    border: m.role === 'agent' ? '1px solid var(--border)' : 'none',
                                    boxShadow: m.role === 'user' ? '0 10px 20px rgba(0,212,255,0.2)' : 'none',
                                    overflow: 'hidden'
                                }}>
                                    {m.role === 'agent' ? (
                                        <ReactMarkdown 
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                table: ({node, ...props}) => <table style={tableStyle} {...props} />,
                                                th: ({node, ...props}) => <th style={thStyle} {...props} />,
                                                td: ({node, ...props}) => <td style={tdStyle} {...props} />,
                                                h2: ({node, ...props}) => <h2 style={h2Style} {...props} />,
                                                ul: ({node, ...props}) => <ul style={ulStyle} {...props} />
                                            }}
                                        >
                                            {m.content}
                                        </ReactMarkdown>
                                    ) : m.content}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ ...inputAreaStyle, opacity: connected ? 1 : 0.6 }}>
                            <input 
                                type="text" 
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                disabled={!connected}
                                placeholder={connected ? "Enter mission instructions (e.g. 'Analyze Ahmedabad for industrial growth since 2018')" : "Neural Link Offline..."}
                                style={inputStyle}
                            />
                            <button 
                                onClick={sendMessage} 
                                disabled={!connected}
                                style={{ ...sendBtnStyle, background: connected ? 'var(--accent)' : 'var(--text-dim)' }}
                            >
                                {connected ? 'SEND MISSION' : '✕'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Telemetry Sidebar */}
                <div style={telemetrySidebarStyle}>
                    <div className="glass-card" style={telemetryCardStyle}>
                        <div style={cardHeaderStyle}>RESOURCE TELEMETRY</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <div style={labelRowStyle}>
                                    <span style={labelSmallStyle}>MISSION EXECUTION</span>
                                    <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{progress}%</span>
                                </div>
                                <div style={progressContainerStyle}>
                                    <div style={{ ...progressBarStyle, width: `${progress}%` }} />
                                </div>
                            </div>

                            <div style={statsRowStyle}>
                                <div style={statGroupStyle}>
                                    <div style={labelSmallStyle}>LATENCY</div>
                                    <div style={statValStyle}>24ms</div>
                                </div>
                                <div style={statGroupStyle}>
                                    <div style={labelSmallStyle}>UPTIME</div>
                                    <div style={statValStyle}>99.9%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={telemetryCardStyle}>
                        <div style={cardHeaderStyle}>MISSION CONTEXT</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {stagedSelection && (
                                <div className="animate-pulse" style={{ 
                                    padding: '8px 12px', 
                                    background: 'rgba(0,212,255,0.1)', 
                                    border: '1px solid var(--accent)',
                                    borderRadius: 6,
                                    marginBottom: 8,
                                    textAlign: 'center'
                                }}>
                                    <span style={{ fontSize: 9, fontWeight: 900, color: 'var(--accent)', letterSpacing: 1.5 }}>
                                        TELEMETRY STAGED: READY FOR UPLINK
                                    </span>
                                </div>
                            )}
                            <div style={contextItemStyle}>
                                <span style={labelSmallStyle}>PROJECT_ID</span>
                                <span style={contextValStyle}>{projectId || 'UNASSIGNED'}</span>
                            </div>
                            <div style={contextItemStyle}>
                                <span style={labelSmallStyle}>ORBITAL_PROVIDER</span>
                                <span style={contextValStyle}>{stagedSelection?.source?.toUpperCase() || 'AUTO_NEGOTIATE'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ ...telemetryCardStyle, flex: 1, borderBottom: 'none' }}>
                        <div style={cardHeaderStyle}>SYSTEM LOGS</div>
                        <div style={logContainerStyle}>
                            <div style={logLineStyle}><span style={logTimeStyle}>[08:22:14]</span> INFRA: Proactor Policy Set.</div>
                            <div style={logLineStyle}><span style={logTimeStyle}>[08:22:15]</span> NEURAL: ORION Model v2 Ready.</div>
                            <div style={logLineStyle}><span style={logTimeStyle}>[08:22:16]</span> LINK: WebSocket Handshake Success.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Styles
const containerStyle = { height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 40px' };
const titleStyle = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: 1 };
const subTitleStyle = { color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 };
const pulseDotStyle = { width: 10, height: 10, borderRadius: '50%', boxShadow: '0 0 10px currentColor' };
const connectionBadgeStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 40 };
const statusDotStyle = { width: 6, height: 6, borderRadius: '50%', boxShadow: '0 0 8px currentColor' };

const mainGridStyle = { flex: 1, display: 'flex', gap: 32, minHeight: 0 };
const chatSectionStyle = { flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-lg)', overflow: 'hidden' };
const messageListStyle = { flex: 1, overflowY: 'auto', padding: '32px 40px', scrollBehavior: 'smooth' };

const inputAreaStyle = { display: 'flex', gap: 16, background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 12, border: '1px solid var(--border)' };
const inputStyle = { flex: 1, background: 'transparent', border: 'none', padding: '12px 20px', color: '#fff', fontSize: 15, outline: 'none' };
const sendBtnStyle = { padding: '12px 28px', border: 'none', borderRadius: 8, color: 'var(--bg-deep)', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'var(--transition)' };

const telemetrySidebarStyle = { width: 320, display: 'flex', flexDirection: 'column', gap: 20 };
const telemetryCardStyle = { padding: 24, borderRadius: 'var(--radius-md)' };
const cardHeaderStyle = { fontSize: 9, fontWeight: 900, color: 'var(--accent)', letterSpacing: 2.5, marginBottom: 20 };

const labelRowStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: 10 };
const labelSmallStyle = { fontSize: 9, fontWeight: 800, color: 'var(--text-dim)', letterSpacing: 1 };
const progressContainerStyle = { height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' };
const progressBarStyle = { height: '100%', background: 'var(--accent)', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 0 12px var(--accent)' };

const statsRowStyle = { display: 'flex', gap: 32 };
const statGroupStyle = { flex: 1 };
const statValStyle = { fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 };

const contextItemStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const contextValStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' };

const logContainerStyle = { display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10 };
const logLineStyle = { color: 'var(--text-dim)', opacity: 0.8 };
const logTimeStyle = { color: 'var(--accent)', fontWeight: 700, marginRight: 8 };

// Tactical Markdown Styles
const h2Style = { fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 20, marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 };
const tableStyle = { width: '100%', borderCollapse: 'collapse', margin: '16px 0', fontSize: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, overflow: 'hidden' };
const thStyle = { background: 'rgba(0,212,255,0.1)', color: 'var(--accent)', textAlign: 'left', padding: '12px 16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 };
const tdStyle = { padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' };
const ulStyle = { paddingLeft: 20, marginBottom: 16 };

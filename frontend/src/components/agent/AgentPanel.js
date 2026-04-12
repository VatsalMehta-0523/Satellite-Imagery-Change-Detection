import React, { useState, useEffect, useRef } from 'react';

const AGENT_WS_URL = `ws://${window.location.host}/ws/agent/`;

export default function AgentPanel({ projectId, aoi, addNotification }) {
    const [messages, setMessages] = useState([
        { role: 'agent', content: 'SYSTEM: ORION Agent v2.0 Online. Initializing mission logic...' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [connected, setConnected] = useState(false);
    const [progress, setProgress] = useState(0);
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
        
        console.log(`[ORION] Attempting neural link establishment (Attempt ${reconnectCount.current + 1})...`);
        ws.current = new WebSocket(`${AGENT_WS_URL}${sessionId.current}`);
        
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
        } else if (data.type === 'PROGRESS_UPDATE') {
            setProgress(data.progress || 0);
        } else if (data.type === 'MISSION_COMPLETE') {
            addNotification('ORION: Mission successfully executed.', 'success');
            setProgress(100);
        } else if (data.type === 'CYCLE_COMPLETE') {
            setProgress(100);
        } else if (data.type === 'ERROR') {
            setMessages(prev => [...prev, { role: 'agent', content: `CRITICAL ERROR: ${data.content}` }]);
            addNotification(data.content, 'error');
        }
    };

    const sendMessage = () => {
        if (!inputValue.trim() || !connected) return;
        
        const type = inputValue.toLowerCase() === 'ack' ? 'HUMAN_INPUT' : 'CHAT_MESSAGE';
        
        const msg = {
            type: type,
            content: inputValue,
            user_request: inputValue,
            aoi: aoi,
            project_id: projectId
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
        <div className="glass-card animate-slide-up" style={panelStyle}>
            <div style={headerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={connected ? "animate-pulse" : ""} style={{ width: 10, height: 10, borderRadius: '50%', background: connected ? 'var(--accent)' : 'var(--danger)' }} />
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5 }}>
                        ORION AGENT {connected ? 'v2.0' : <span style={{ color: 'var(--danger)' }}>[OFFLINE]</span>}
                    </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {connected ? `PHASE: ${progress < 100 ? 'ACTIVE' : 'STANDBY'}` : 'UPLINK SIGNAL LOST'}
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', width: '100%' }}>
                <div style={{ height: '100%', background: 'var(--accent)', width: `${progress}%`, transition: 'width 0.5s ease' }} />
            </div>

            <div ref={scrollRef} style={chatContainerStyle}>
                {messages.map((m, i) => (
                    <div key={i} style={{ 
                        marginBottom: 16, 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: m.role === 'agent' ? 'flex-start' : 'flex-end'
                    }}>
                        <div style={{ 
                            fontSize: 9, 
                            fontWeight: 900, 
                            color: 'var(--text-dim)', 
                            marginBottom: 4,
                            textTransform: 'uppercase'
                        }}>{m.role}</div>
                        <div style={{ 
                            padding: '12px 16px', 
                            borderRadius: 14, 
                            fontSize: 13,
                            lineHeight: 1.5,
                            maxWidth: '85%',
                            background: m.role === 'agent' ? 'rgba(255,255,255,0.03)' : 'var(--accent)',
                            color: m.role === 'agent' ? 'var(--text-primary)' : 'var(--bg-deep)',
                            border: m.role === 'agent' ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            fontFamily: m.role === 'agent' ? 'var(--font-mono)' : 'inherit'
                        }}>
                            {m.content}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ ...inputAreaStyle, opacity: connected ? 1 : 0.6 }}>
                <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    disabled={!connected}
                    placeholder={connected ? "Enter mission objectives..." : "Neural Link Offline..."}
                    style={{ ...inputStyle, cursor: connected ? 'text' : 'not-allowed' }}
                />
                <button 
                    onClick={sendMessage} 
                    disabled={!connected} 
                    style={{ ...sendBtnStyle, opacity: connected ? 1 : 0.5, cursor: connected ? 'pointer' : 'not-allowed' }}
                >
                    {connected ? '✦' : '✕'}
                </button>
            </div>
        </div>
    );
}

// Styling
const panelStyle = {
    position: 'fixed',
    bottom: 30,
    right: 30,
    width: 380,
    height: 520,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    border: '1px solid rgba(56, 189, 248, 0.2)'
};

const headerStyle = {
    padding: '16px 20px',
    background: 'rgba(255,255,255,0.01)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
};

const chatContainerStyle = {
    flex: 1,
    padding: 20,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
};

const inputAreaStyle = {
    padding: 16,
    background: 'rgba(0,0,0,0.2)',
    display: 'flex',
    gap: 10,
    borderTop: '1px solid rgba(255,255,255,0.05)'
};

const inputStyle = {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'white',
    fontSize: 13,
    outline: 'none'
};

const sendBtnStyle = {
    width: 40,
    height: 38,
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--bg-deep)',
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 16
};

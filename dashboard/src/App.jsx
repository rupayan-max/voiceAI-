import React, { useState, useEffect } from 'react';

// Pricing constants based on Gemini API rates
const GEMINI_PRICING = {
  AUDIO_INPUT_PER_SEC: 0.00005,
  AUDIO_OUTPUT_PER_SEC: 0.0002,
  TEXT_INPUT_PER_1K: 0.00015,
  TEXT_OUTPUT_PER_1K: 0.0006,
};

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');

  // API Key & System Persona State
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful, concise AI voice customer support assistant.'
  );

  // Time Filter State
  const [timeRange, setTimeRange] = useState('Today');
  const [chartRange, setChartRange] = useState('Last 24 hours');

  // Cumulative Metrics State
  const [metrics, setMetrics] = useState({
    totalSessions: 9,
    activeSessions: 0,
    totalDurationSec: 1428,
    runningCost: 0.29,
  });

  // Dynamic Chart Data State
  const [chartData, setChartData] = useState([
    { time: '00:00', tokens: 25000 },
    { time: '04:00', tokens: 28000 },
    { time: '08:00', tokens: 26000 },
    { time: '12:00', tokens: 36000 },
    { time: '16:00', tokens: 42000 },
    { time: '20:00', tokens: 39000 },
    { time: 'Now', tokens: 52000 },
  ]);

  // Session Table Logs
  const [sessions, setSessions] = useState([
    { id: 'SESS-1092', time: '10:14 AM', duration: '3m 42s', tokens: 14200, cost: 0.045, status: 'Completed' },
    { id: 'SESS-1091', time: '09:45 AM', duration: '5m 12s', tokens: 21500, cost: 0.068, status: 'Completed' },
    { id: 'SESS-1090', time: '09:12 AM', duration: '1m 30s', tokens: 5800, cost: 0.018, status: 'Completed' },
    { id: 'SESS-1089', time: '08:30 AM', duration: '4m 15s', tokens: 18100, cost: 0.054, status: 'Completed' },
  ]);

  // Voice Agent Active Session State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isApiLoading, setIsApiLoading] = useState(false);

  // Session Duration Timer
  useEffect(() => {
    let interval = null;
    if (isSessionActive) {
      interval = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isSessionActive]);

  // Toggle Voice Session (Start / Stop)
  const toggleVoiceSession = () => {
    if (isSessionActive) {
      setIsSessionActive(false);

      const estimatedTokens = Math.max(2500, sessionTime * 45 + chatMessages.length * 180);
      const sessionCost = Number(
        (sessionTime * GEMINI_PRICING.AUDIO_INPUT_PER_SEC + (estimatedTokens / 1000) * GEMINI_PRICING.TEXT_OUTPUT_PER_1K).toFixed(3)
      );

      const mins = Math.floor(sessionTime / 60);
      const secs = sessionTime % 60;
      const durationStr = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

      const newSession = {
        id: `SESS-${1093 + sessions.length}`,
        time: 'Just now',
        duration: durationStr,
        tokens: estimatedTokens,
        cost: sessionCost,
        status: 'Completed',
      };

      setSessions((prev) => [newSession, ...prev]);
      setMetrics((prev) => ({
        ...prev,
        totalSessions: prev.totalSessions + 1,
        activeSessions: 0,
        totalDurationSec: prev.totalDurationSec + sessionTime,
        runningCost: Number((prev.runningCost + sessionCost).toFixed(2)),
      }));

      setChartData((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].tokens += estimatedTokens;
        return updated;
      });

      setSessionTime(0);
    } else {
      setIsSessionActive(true);
      setMetrics((prev) => ({ ...prev, activeSessions: 1 }));
      setChatMessages([
        { sender: 'agent', text: 'Hello! Live Gemini Voice Session connected. Ask me anything.' },
      ]);
    }
  };

  // Send Message to Gemini API or Demo Simulator
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || !isSessionActive) return;

    const currentText = userInput;
    setUserInput('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: currentText }]);

    if (!apiKey.trim()) {
      setIsApiLoading(true);
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'agent',
            text: `[Demo Mode] Received: "${currentText}". Enter your Gemini API key in Settings to fetch live model responses!`,
          },
        ]);
        setIsApiLoading(false);
      }, 700);
      return;
    }

    setIsApiLoading(true);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: currentText }] }],
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Gemini API request failed');
      }

      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response text received.';
      setChatMessages((prev) => [...prev, { sender: 'agent', text: aiText }]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'agent', text: `API Error: ${err.message}` },
      ]);
    } finally {
      setIsApiLoading(false);
    }
  };

  const formatDuration = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const exportSessionsCSV = () => {
    const headers = ['Session ID,Time,Duration,Tokens,Cost,Status\n'];
    const rows = sessions.map(
      (s) => `${s.id},${s.time},${s.duration},${s.tokens},${s.cost},${s.status}`
    );
    const blob = new Blob([...headers, rows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice_sessions_${Date.now()}.csv`;
    a.click();
  };

  const getTabLabel = (id) => {
    switch (id) {
      case 'overview': return 'Overview';
      case 'agent': return 'Voice Agent';
      case 'sessions': return 'Sessions';
      case 'usage': return 'Usage';
      case 'costs': return 'Costs';
      case 'settings': return 'Settings';
      default: return id;
    }
  };

  return (
    <div style={styles.appWrapper}>
      {/* SIDEBAR NAVIGATION */}
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.brandHeader}>
            <div style={styles.brandIcon}>AI</div>
            <div>
              <div style={styles.brandTitle}>VoiceMetrics</div>
              <div style={styles.brandSubtitle}>Gemini Analytics</div>
            </div>
          </div>

          <div style={styles.navSectionTitle}>PLATFORM</div>
          <nav style={styles.navList}>
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'agent', label: 'Voice Agent', icon: '🎙️' },
              { id: 'sessions', label: 'Sessions', icon: '⏱️' },
              { id: 'usage', label: 'Usage', icon: '📈' },
              { id: 'costs', label: 'Costs', icon: '💲' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  ...styles.navButton,
                  ...(activeTab === item.id ? styles.navButtonActive : {}),
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div style={styles.statusBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: apiKey ? '#10b981' : '#f59e0b',
              }}
            ></span>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Gemini API</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            {apiKey ? 'Key Configured' : 'Demo Mode (Key Missing)'}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={styles.mainContent}>
        <header style={styles.topHeader}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            AI Voice Platform /{' '}
            <span style={{ color: '#0f172a', fontWeight: 'bold' }}>
              {getTabLabel(activeTab)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={styles.realtimeBadge}>
              <span style={styles.greenPulse}></span> Real-time
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              title="User Settings"
              style={styles.avatarButton}
            >
              RB
            </button>
          </div>
        </header>

        <div style={{ padding: '28px' }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div style={styles.subHeadingText}>AI VOICE OPERATIONS</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h1 style={styles.mainTitle}>Usage & Cost Dashboard</h1>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    style={styles.timeDropdown}
                  >
                    <option value="Today">Today</option>
                    <option value="Yesterday">Yesterday</option>
                    <option value="Last 7 Days">Last 7 Days</option>
                  </select>
                </div>
                <p style={styles.descriptionText}>
                  Monitor Gemini voice sessions, usage, and estimated API cost in real time.
                </p>
              </div>

              {/* KPI CARDS */}
              <div style={styles.kpiGrid}>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiHeader}>
                    <span style={styles.kpiIcon}>🎙️</span>
                    <span style={styles.kpiBadge}>+12.5% vs yesterday</span>
                  </div>
                  <div style={styles.kpiValue}>{metrics.totalSessions}</div>
                  <div style={styles.kpiLabel}>Total Sessions</div>
                </div>

                <div style={styles.kpiCard}>
                  <div style={styles.kpiHeader}>
                    <span style={styles.kpiIcon}>📈</span>
                  </div>
                  <div style={styles.kpiValue}>{metrics.activeSessions}</div>
                  <div style={styles.kpiLabel}>Active Sessions</div>
                  <div style={styles.kpiSubLabel}>
                    {metrics.activeSessions > 0 ? 'Live stream active' : 'No active sessions'}
                  </div>
                </div>

                <div style={styles.kpiCard}>
                  <div style={styles.kpiHeader}>
                    <span style={styles.kpiIcon}>⏱️</span>
                  </div>
                  <div style={styles.kpiValue}>{formatDuration(metrics.totalDurationSec)}</div>
                  <div style={styles.kpiLabel}>Total Duration</div>
                  <div style={styles.kpiSubLabel}>Conversation time</div>
                </div>

                <div style={styles.kpiCard}>
                  <div style={styles.kpiHeader}>
                    <span style={styles.kpiIcon}>💲</span>
                  </div>
                  <div style={styles.kpiValue}>${metrics.runningCost.toFixed(2)}</div>
                  <div style={styles.kpiLabel}>Running Cost</div>
                  <div style={styles.kpiSubLabel}>Estimated Gemini API cost</div>
                </div>
              </div>

              {/* CHART & LIVE AGENT TESTER */}
              <div style={styles.dashboardSplit}>
                <div style={styles.panelCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Usage Overview</h3>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Token and audio usage over the current period
                      </span>
                    </div>
                    <select
                      value={chartRange}
                      onChange={(e) => setChartRange(e.target.value)}
                      style={styles.smallDropdown}
                    >
                      <option value="Last 24 hours">Last 24 hours</option>
                      <option value="Last 7 days">Last 7 days</option>
                    </select>
                  </div>

                  <div style={styles.chartContainer}>
                    {chartData.map((pt, i) => (
                      <div key={i} style={styles.chartCol}>
                        <div
                          style={{
                            ...styles.chartBar,
                            height: `${Math.min(100, (pt.tokens / 60000) * 100)}%`,
                          }}
                        ></div>
                        <span style={styles.chartLabel}>{pt.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.panelCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>GEMINI LIVE AGENT</div>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Voice Agent</h3>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: isSessionActive ? '#10b981' : '#64748b' }}>
                      ● {isSessionActive ? 'Live' : 'Offline'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <button
                      onClick={toggleVoiceSession}
                      style={{
                        ...styles.micButton,
                        backgroundColor: isSessionActive ? '#ef4444' : '#f1f5f9',
                        color: isSessionActive ? '#ffffff' : '#0f172a',
                        border: isSessionActive ? '2px solid #dc2626' : '1px solid #cbd5e1',
                      }}
                    >
                      🎙️
                    </button>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                      {isSessionActive ? 'Click microphone to stop session' : 'Start a voice session'}
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
                      {formatDuration(sessionTime)}
                    </div>
                  </div>

                  <div style={styles.chatBox}>
                    {chatMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '40px' }}>
                        Click microphone above to start testing
                      </div>
                    ) : (
                      chatMessages.map((m, idx) => (
                        <div
                          key={idx}
                          style={{
                            textAlign: m.sender === 'user' ? 'right' : 'left',
                            marginBottom: '8px',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '6px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              backgroundColor: m.sender === 'user' ? '#0f172a' : '#ffffff',
                              color: m.sender === 'user' ? '#ffffff' : '#0f172a',
                              border: m.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                              maxWidth: '85%',
                            }}
                          >
                            {m.text}
                          </span>
                        </div>
                      ))
                    )}
                    {isApiLoading && <div style={{ fontSize: '11px', color: '#2563eb' }}>Gemini processing...</div>}
                  </div>

                  <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <input
                      type="text"
                      placeholder={isSessionActive ? 'Type or speak message...' : 'Start session first'}
                      disabled={!isSessionActive}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      style={styles.textInput}
                    />
                    <button
                      type="submit"
                      disabled={!isSessionActive || isApiLoading}
                      style={{
                        ...styles.sendButton,
                        opacity: isSessionActive ? 1 : 0.5,
                        cursor: isSessionActive ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>

              {/* RECENT SESSIONS TABLE */}
              <div style={styles.panelCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Recent Voice Sessions</h3>
                  <button onClick={exportSessionsCSV} style={styles.secondaryButton}>
                    📥 Export CSV
                  </button>
                </div>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeadRow}>
                      <th style={styles.th}>SESSION ID</th>
                      <th style={styles.th}>TIME</th>
                      <th style={styles.th}>DURATION</th>
                      <th style={styles.th}>TOKENS</th>
                      <th style={styles.th}>EST. COST</th>
                      <th style={styles.th}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, idx) => (
                      <tr key={idx} style={styles.tableRow}>
                        <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>{s.id}</td>
                        <td style={styles.td}>{s.time}</td>
                        <td style={styles.td}>{s.duration}</td>
                        <td style={styles.td}>{s.tokens.toLocaleString()}</td>
                        <td style={{ ...styles.td, color: '#16a34a', fontWeight: 'bold' }}>${s.cost.toFixed(3)}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: VOICE AGENT */}
          {activeTab === 'agent' && (
            <div>
              <h1 style={styles.mainTitle}>Voice Agent Testing & Setup</h1>
              <p style={styles.descriptionText}>Test and manage your Gemini voice agent deployment parameters.</p>

              <div style={{ ...styles.panelCard, marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>
                      Status: {isSessionActive ? '🟢 Live Session Running' : '🔴 Agent Idle'}
                    </h3>
                    <p style={{ ...styles.descriptionText, marginTop: '4px' }}>
                      Current Session Time: <strong>{formatDuration(sessionTime)}</strong>
                    </p>
                  </div>
                  <button onClick={toggleVoiceSession} style={styles.actionButton}>
                    {isSessionActive ? 'End Live Session' : 'Start Live Session'}
                  </button>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <label style={styles.inputLabel}>ACTIVE SYSTEM INSTRUCTION / PERSONA</label>
                  <textarea
                    rows={3}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    style={styles.textInputFull}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SESSIONS */}
          {activeTab === 'sessions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={styles.mainTitle}>Session Logs ({sessions.length})</h1>
                  <p style={styles.descriptionText}>Historical archive of all completed AI voice sessions.</p>
                </div>
                <button onClick={exportSessionsCSV} style={styles.actionButton}>
                  📥 Export CSV Data
                </button>
              </div>

              <div style={{ ...styles.panelCard, marginTop: '20px' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeadRow}>
                      <th style={styles.th}>SESSION ID</th>
                      <th style={styles.th}>TIME</th>
                      <th style={styles.th}>DURATION</th>
                      <th style={styles.th}>TOKENS</th>
                      <th style={styles.th}>EST. COST</th>
                      <th style={styles.th}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, idx) => (
                      <tr key={idx} style={styles.tableRow}>
                        <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>{s.id}</td>
                        <td style={styles.td}>{s.time}</td>
                        <td style={styles.td}>{s.duration}</td>
                        <td style={styles.td}>{s.tokens.toLocaleString()}</td>
                        <td style={{ ...styles.td, color: '#16a34a', fontWeight: 'bold' }}>${s.cost.toFixed(3)}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: USAGE */}
          {activeTab === 'usage' && (
            <div>
              <h1 style={styles.mainTitle}>Token & Audio Usage</h1>
              <p style={styles.descriptionText}>Real-time breakdown of input/output token throughput.</p>

              <div style={{ ...styles.panelCard, marginTop: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
                  Total Tokens Processed:{' '}
                  <span style={{ color: '#2563eb' }}>
                    {chartData.reduce((acc, curr) => acc + curr.tokens, 0).toLocaleString()}
                  </span>
                </h3>
                <div style={styles.chartContainer}>
                  {chartData.map((pt, i) => (
                    <div key={i} style={styles.chartCol}>
                      <div
                        style={{
                          ...styles.chartBar,
                          height: `${Math.min(100, (pt.tokens / 60000) * 100)}%`,
                        }}
                      ></div>
                      <span style={styles.chartLabel}>{pt.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: COSTS */}
          {activeTab === 'costs' && (
            <div>
              <h1 style={styles.mainTitle}>Billing & Cost Analysis</h1>
              <p style={styles.descriptionText}>Live expenditure calculated using real Gemini API pricing rates.</p>

              <div style={{ ...styles.panelCard, marginTop: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '24px' }}>
                  Total Running Spend:{' '}
                  <span style={{ color: '#16a34a' }}>${metrics.runningCost.toFixed(2)}</span>
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
                  Calculated dynamically from session duration and token streaming throughput.
                </p>
                <button
                  onClick={() => setMetrics((prev) => ({ ...prev, runningCost: 0 }))}
                  style={{ ...styles.actionButton, marginTop: '16px' }}
                >
                  Reset Spend Counter
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '600px' }}>
              <h1 style={styles.mainTitle}>Settings & Credentials</h1>
              <p style={styles.descriptionText}>Configure your Google Gemini API key and voice persona prompt.</p>

              <div style={{ ...styles.panelCard, marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={styles.inputLabel}>GEMINI API KEY</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    style={styles.textInputFull}
                  />
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    Key is stored in runtime memory for live API processing.
                  </div>
                </div>

                <div>
                  <label style={styles.inputLabel}>SYSTEM PERSONA / PROMPT</label>
                  <textarea
                    rows={4}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    style={{ ...styles.textInputFull, fontFamily: 'inherit' }}
                  />
                </div>

                <button
                  onClick={() => alert('Settings saved successfully!')}
                  style={styles.actionButton}
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// STYLES OBJECT
const styles = {
  appWrapper: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  brandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '28px',
  },
  brandIcon: {
    width: '32px',
    height: '32px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderRadius: '8px',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  brandTitle: {
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#ffffff',
  },
  brandSubtitle: {
    fontSize: '11px',
    color: '#64748b',
  },
  navSectionTitle: {
    fontSize: '10px',
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: '0.05em',
    marginBottom: '10px',
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
    textAlign: 'left',
  },
  navButtonActive: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontWeight: 'bold',
  },
  statusBox: {
    backgroundColor: '#1e293b',
    padding: '12px',
    borderRadius: '8px',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  },
  topHeader: {
    height: '60px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 28px',
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
  },
  realtimeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#0f172a',
  },
  greenPulse: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
  },
  avatarButton: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#e2e8f0',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 'bold',
    fontSize: '12px',
    border: 'none',
    cursor: 'pointer',
  },
  subHeadingText: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: '0.05em',
  },
  mainTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '4px 0 0 0',
  },
  descriptionText: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '4px',
  },
  timeDropdown: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    cursor: 'pointer',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
  },
  kpiHeader: {
    display: 'flex',
    justify: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  kpiIcon: {
    fontSize: '18px',
  },
  kpiBadge: {
    fontSize: '11px',
    color: '#16a34a',
  },
  kpiValue: {
    fontSize: '28px',
    fontWeight: 'bold',
  },
  kpiLabel: {
    fontSize: '13px',
    color: '#64748b',
    marginTop: '2px',
  },
  kpiSubLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '2px',
  },
  dashboardSplit: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '20px',
  },
  panelCard: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
  },
  smallDropdown: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    cursor: 'pointer',
  },
  chartContainer: {
    height: '180px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    paddingTop: '20px',
  },
  chartCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease',
  },
  chartLabel: {
    fontSize: '10px',
    color: '#94a3b8',
    marginTop: '8px',
  },
  micButton: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    fontSize: '24px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  chatBox: {
    height: '140px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '10px',
    overflowY: 'auto',
    border: '1px solid #e2e8f0',
  },
  textInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
  },
  textInputFull: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    boxSizing: 'border-box',
  },
  sendButton: {
    padding: '8px 16px',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
  },
  actionButton: {
    padding: '10px 16px',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '6px 12px',
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  inputLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: '6px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13px',
  },
  tableHeadRow: {
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '10px',
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 'bold',
  },
  tableRow: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '12px 10px',
  },
  statusBadge: {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
  },
};
import React from 'react'
import './App.css'

// SVG Icon Components matching the original design
const DocumentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
)

const ClipboardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    <line x1="12" y1="11" x2="12" y2="17"/>
    <line x1="9" y1="14" x2="15" y2="14"/>
  </svg>
)

const GridListIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)

const ChatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <line x1="8" y1="9" x2="16" y2="9"/>
    <line x1="8" y1="13" x2="14" y2="13"/>
  </svg>
)

const PhoneIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
)

const features = [
  {
    id: 1,
    Icon: DocumentIcon,
    iconBg: '#E8F5E9',
    iconColor: '#43A047',
    title: 'Convert Meeting Notes to Requirements',
    description: 'Transform raw meeting content into structured product requirements',
    input: 'Webex transcripts, AI notes, PM notes',
    output: 'Structured recap with problems, requirements, risks'
  },
  {
    id: 2,
    Icon: ClipboardIcon,
    iconBg: '#FFF3E0',
    iconColor: '#FB8C00',
    title: 'Generate PRD (v0)',
    description: 'Create an early PRD designed to surface clarity and gaps',
    input: 'Meeting recap, notes, or prompt',
    output: 'Draft PRD for review and iteration'
  },
  {
    id: 3,
    Icon: GridListIcon,
    iconBg: '#FFEBEE',
    iconColor: '#E53935',
    title: 'Generate Epics & Jira Tickets',
    description: 'Break down requirements into actionable development work',
    input: 'PRD or requirements document',
    output: 'Epics, stories, and acceptance criteria'
  },
  {
    id: 4,
    Icon: ChatIcon,
    iconBg: '#E0F2F1',
    iconColor: '#00897B',
    title: 'Recommend Features from Feedback',
    description: 'Identify patterns and opportunities from customer input',
    input: 'Feedback, support tickets, notes',
    output: 'Clustered themes and recommendations'
  },
  {
    id: 5,
    Icon: PhoneIcon,
    iconBg: '#FCE4EC',
    iconColor: '#D81B60',
    title: 'Generate CX / AI Assistant Mockups',
    description: 'Create screen flows and UI specifications for features',
    input: 'Feature idea or PRD',
    output: 'Screen flows and UI specs'
  }
]

function FeatureCard({ feature }) {
  const { Icon } = feature
  return (
    <div className="feature-card">
      <div className="feature-icon" style={{ backgroundColor: feature.iconBg, color: feature.iconColor }}>
        <Icon />
      </div>
      <h3 className="feature-title">{feature.title}</h3>
      <p className="feature-description">{feature.description}</p>
      <div className="feature-io">
        <div className="io-row">
          <span className="io-label">INPUT</span>
          <span className="io-value">{feature.input}</span>
        </div>
        <div className="io-row">
          <span className="io-label">OUTPUT</span>
          <span className="io-value">{feature.output}</span>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="36" height="36" rx="8" fill="#4ECDC4"/>
              <path d="M10 13h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M10 18h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M10 23h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="header-text">
            <h1>CX AI Assistant for Product Management</h1>
            <span className="alpha-badge">ALPHA</span>
          </div>
        </div>
      </header>
      
      <main className="main-content">
        <section className="tasks-section">
          <div className="section-header">
            <h2>START A TASK</h2>
            <button className="info-button" aria-label="More information">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="7" stroke="#9CA3AF" strokeWidth="1.5"/>
                <path d="M8 7v4M8 5h.01" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          
          <div className="features-grid">
            {features.map(feature => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App

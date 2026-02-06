import React from 'react';

/**
 * Single source of truth for the 5 capability cards.
 * Used by DashboardPage (info mode) and ProjectViewPage (workspace mode).
 */
export const CAPABILITIES = [
  {
    id: 'requirements',
    title: 'Convert Meeting Notes to Requirements',
    description: 'Transform raw meeting content into structured product requirements',
    colorHex: '#4ECDC4',
    colorName: 'teal',
    comingSoon: false,
    inputText: 'Webex transcripts, AI notes, PM notes',
    outputText: 'Structured recap with problems, requirements, risks',
    stageRoute: 'requirements',
    tip: null,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <path d="M9 12h6M9 16h4"/>
      </svg>
    ),
  },
  {
    id: 'prd',
    title: 'Generate PRD',
    description: 'Create an early PRD designed to surface clarity and gaps',
    colorHex: '#F97316',
    colorName: 'orange',
    comingSoon: false,
    inputText: 'Meeting recap, notes, or prompt',
    outputText: 'Draft PRD for review and iteration',
    stageRoute: 'prd',
    tip: 'Tip: Adding requirements first gives better results',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
    ),
  },
  {
    id: 'stories',
    title: 'User Stories',
    description: 'Generate actionable user stories from your requirements',
    colorHex: '#3B82F6',
    colorName: 'blue',
    comingSoon: false,
    inputText: 'Requirements from meeting recap',
    outputText: 'User stories with acceptance criteria',
    stageRoute: 'stories',
    tip: 'Tip: A PRD helps generate more accurate stories',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'features',
    title: 'Recommend Features from Feedback',
    description: 'Identify patterns and opportunities from customer input',
    colorHex: '#8B5CF6',
    colorName: 'purple',
    comingSoon: true,
    inputText: 'Feedback, support tickets, notes',
    outputText: 'Clustered themes and recommendations',
    stageRoute: null,
    tip: 'Tip: Works best with multiple feedback sources',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    ),
  },
  {
    id: 'mockups',
    title: 'Generate CX / AI Assistant Mockups',
    description: 'Create screen flows and UI specifications for features',
    colorHex: '#EC4899',
    colorName: 'pink',
    comingSoon: false,
    inputText: 'Feature idea or PRD',
    outputText: 'Screen flows and UI specs',
    stageRoute: 'mockups',
    tip: 'Tip: User stories help define what to mock up',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <circle cx="6" cy="6" r="1" fill="currentColor"/>
        <circle cx="9" cy="6" r="1" fill="currentColor"/>
        <path d="M8 15l2-2 3 3 3-4 2 2"/>
      </svg>
    ),
  },
];

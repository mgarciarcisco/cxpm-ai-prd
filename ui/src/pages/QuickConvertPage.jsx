import React from 'react';
import { Link } from 'react-router-dom';
import './QuickConvertPage.css';

/**
 * Quick Convert landing page with conversion card options.
 * Allows users to quickly convert content without creating a project.
 */
function QuickConvertPage() {
  const conversionCards = [
    {
      id: 'requirements',
      title: 'Extract Requirements',
      description: 'Turn meeting notes or documents into structured requirements with problems, goals, and features.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5C15 6.10457 14.1046 7 13 7H11C9.89543 7 9 6.10457 9 5Z" stroke="currentColor" strokeWidth="2"/>
          <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M9 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      href: '/quick-convert/requirements',
      color: 'teal',
    },
    {
      id: 'prd',
      title: 'Generate PRD',
      description: 'Transform requirements or notes into a comprehensive Product Requirements Document.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      href: '/quick-convert/prd',
      color: 'purple',
    },
    {
      id: 'stories',
      title: 'Create User Stories',
      description: 'Generate user stories from a PRD or feature description, with acceptance criteria.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
        </svg>
      ),
      href: '/quick-convert/stories',
      color: 'blue',
    },
    {
      id: 'mockups',
      title: 'Design Mockups',
      description: 'Generate UI mockups from user stories or feature descriptions using AI.',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
          <path d="M3 9H21" stroke="currentColor" strokeWidth="2"/>
          <circle cx="6" cy="6" r="1" fill="currentColor"/>
          <circle cx="9" cy="6" r="1" fill="currentColor"/>
          <path d="M8 15L10 13L13 16L16 12L18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      href: '/quick-convert/mockups',
      color: 'orange',
    },
  ];

  return (
    <main className="main-content">
      <section className="quick-convert">
        {/* Back Link */}
        <Link to="/dashboard" className="quick-convert__back-link">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="quick-convert__header">
          <h1 className="quick-convert__title">Quick Convert</h1>
          <p className="quick-convert__subtitle">
            Transform your content without creating a project. Generate artifacts instantly and download or save them later.
          </p>
        </div>

        {/* Conversion Cards Grid */}
        <div className="quick-convert__grid">
          {conversionCards.map((card) => (
            <Link
              key={card.id}
              to={card.href}
              className={`conversion-card conversion-card--${card.color}`}
            >
              <div className="conversion-card__icon">
                {card.icon}
              </div>
              <div className="conversion-card__content">
                <h3 className="conversion-card__title">{card.title}</h3>
                <p className="conversion-card__description">{card.description}</p>
              </div>
              <div className="conversion-card__arrow">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

export default QuickConvertPage;

"use client";
import React from 'react';

export default function LegalFooter({ compact = false, styleOverrides }) {
  const link = (href, label) => (
    <a href={href} style={{ color: '#111', textDecoration: 'underline', fontSize: 'clamp(12px, 1.4vw, 14px)' }}>{label}</a>
  );
  const baseFooterStyle = {
    borderTop: '1px solid #e5e7eb',
    marginTop: compact ? 4 : 16,
    padding: compact ? 'clamp(6px, 1vh, 8px) clamp(10px, 2vw, 12px)' : 'clamp(10px, 2vh, 14px) clamp(12px, 3vw, 16px)',
    background: '#fafafa'
  };
  const footerStyle = { ...baseFooterStyle, ...(styleOverrides || {}) };
  const rowStyle = {
    maxWidth: 'clamp(640px, 84vw, 1200px)',
    margin: '0 auto',
    display: 'flex',
    gap: compact ? 'clamp(8px, 1.2vw, 12px)' : 'clamp(10px, 1.6vw, 16px)',
    flexWrap: 'wrap'
  };
  return (
    <footer style={footerStyle}>
      <div style={rowStyle}>
        {link('/legal/terms', 'Terms')}
        {link('/legal/privacy', 'Privacy')}
        {link('/legal/cookies', 'Cookie Policy')}
        {link('/legal/dmca', 'DMCA')}
        {link('/legal/ccpa', 'DPA/CCPA')}
      </div>
    </footer>
  );
}

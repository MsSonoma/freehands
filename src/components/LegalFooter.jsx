"use client";
import React from 'react';

export default function LegalFooter({ compact = false, styleOverrides }) {
  const link = (href, label) => (
    <a href={href} style={{ color: '#111', textDecoration: 'underline' }}>{label}</a>
  );
  const baseFooterStyle = {
    borderTop: '1px solid #e5e7eb',
    marginTop: compact ? 4 : 16,
    padding: compact ? '8px 12px' : '12px 16px',
    background: '#fafafa'
  };
  const footerStyle = { ...baseFooterStyle, ...(styleOverrides || {}) };
  const rowStyle = {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    gap: compact ? 12 : 16,
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

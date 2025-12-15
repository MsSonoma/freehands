'use client';

/**
 * PageHeader - Consistent header with title and optional subtitle/description
 * 
 * Provides clear page context with optional help text. Used to orient users
 * at the top of complex facilitator pages.
 * 
 * @param {string} title - Page title
 * @param {string} subtitle - Optional subtitle or description
 * @param {JSX.Element} children - Optional additional help content
 */
export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-gray-600">{subtitle}</p>
      )}
      {children && (
        <div className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
}

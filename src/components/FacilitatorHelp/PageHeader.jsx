'use client';

/**
 * PageHeader - Consistent header with title and optional subtitle/description
 *
 * Provides clear page context with optional help text. Used to orient users
 * at the top of complex facilitator pages.
 *
 * @param {string} title - Page title
 * @param {string} subtitle - Optional subtitle or description
 * @param {JSX.Element} actions - Optional right-side actions rendered on the same row as the title
 * @param {JSX.Element} children - Optional additional help content (renders below title/subtitle)
 */
export default function PageHeader({ title, subtitle, actions = null, children, dense = false, className = '' }) {
  return (
    <div className={`${dense ? 'mb-2' : 'mb-6'} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <h1 className={`${dense ? 'text-lg leading-tight' : 'text-2xl'} font-bold text-gray-900`}>{title}</h1>
        {actions && (
          <div className="shrink-0 flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {subtitle && (
        <p className={`${dense ? 'mt-0.5 text-xs leading-snug' : 'mt-2'} text-gray-600`}>{subtitle}</p>
      )}
      {children && (
        <div className={dense ? 'mt-1' : 'mt-3'}>
          {children}
        </div>
      )}
    </div>
  );
}

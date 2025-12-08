// Intentionally minimal: disable middleware in dev to avoid manifest lookups.
// Next.js 16 requires an export, so we provide a pass-through middleware.

import { NextResponse } from 'next/server';

export function middleware(request) {
  return NextResponse.next();
}

// Disable middleware matching (empty config = no routes matched)
export const config = {
  matcher: []
};

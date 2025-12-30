"use client";

/**
 * Direct access route for V2 AudioEngine testing
 * Navigate to: http://localhost:3001/session/v2test
 * 
 * No feature flag needed - this is a standalone test page
 */

import SessionPageV2Inner from '../v2/SessionPageV2';

export default function V2TestPage() {
  return <SessionPageV2Inner />;
}

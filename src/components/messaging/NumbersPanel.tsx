/**
 * Numbers Panel - Embedded in Messages tab
 * 
 * Reuses the numbers page logic but renders inside Messages tab
 */

'use client';

import { NumbersPageContent } from './NumbersPanelContent';

export function NumbersPanel() {
  return <NumbersPageContent />;
}

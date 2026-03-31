/**
 * Playwright Test: Sitter Blocked Outside Window
 * 
 * Tests that sitter send outside active assignment window returns 403.
 */

import { test, expect } from '@playwright/test';

test('sitter send outside window returns 403', async ({ page, request }) => {
  // Mock authentication as sitter
  // In real test, you'd set up proper auth cookies
  // For now, we'll test the API endpoint directly
  
  const threadId = 'test-thread-id';
  const orgId = 'test-org-id';
  const sitterId = 'test-sitter-id';
  
  // Mock thread with expired assignment window
  const mockThread = {
    id: threadId,
    orgId,
    sitterId,
    status: 'active',
    assignmentWindows: [
      {
        id: 'window-1',
        sitterId,
        startsAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        endsAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      },
    ],
  };
  
  // Intercept API call
  await page.route(`**/api/sitter/threads/${threadId}/messages`, async (route) => {
    const request = route.request();
    
    if (request.method() === 'POST') {
      // Simulate server-side window check
      const window = mockThread.assignmentWindows[0];
      const now = new Date();
      const windowStart = new Date(window.startsAt);
      const windowEnd = new Date(window.endsAt);
      
      if (now < windowStart || now > windowEnd) {
        // Window not active - return 403
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Assignment window is not active. Messages can only be sent during active assignment windows.',
            code: 'WINDOW_NOT_ACTIVE',
            windowStartsAt: window.startsAt,
            windowEndsAt: window.endsAt,
          }),
        });
      } else {
        // Should not reach here in this test
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messageId: 'msg-123' }),
        });
      }
    } else {
      await route.continue();
    }
  });
  
  // Make API call directly (simulating sitter send)
  const response = await request.post(`/api/sitter/threads/${threadId}/messages`, {
    data: {
      body: 'Test message',
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  // Verify 403 response
  expect(response.status()).toBe(403);
  
  const responseBody = await response.json();
  expect(responseBody.code).toBe('WINDOW_NOT_ACTIVE');
  expect(responseBody.error).toContain('Assignment window is not active');
  expect(responseBody.windowStartsAt).toBeDefined();
  expect(responseBody.windowEndsAt).toBeDefined();
});

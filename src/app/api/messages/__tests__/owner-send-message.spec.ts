/**
 * Playwright Test: Owner Send Message
 * 
 * Tests that owner can create thread by phone and send message.
 * Mocks Twilio API to avoid real SMS charges.
 */

import { test, expect } from '@playwright/test';

// Mock Twilio in test environment
test.beforeEach(async ({ page }) => {
  // Intercept Twilio API calls
  await page.route('**/api/messages/threads/**/messages', async (route) => {
    const request = route.request();
    
    if (request.method() === 'POST') {
      // Mock successful Twilio send
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messageId: 'msg-test-123',
          providerMessageSid: 'SM' + Math.random().toString(36).substring(7),
          hasPolicyViolation: false,
        }),
      });
    } else {
      await route.continue();
    }
  });
});

test('owner can create thread by phone and send message', async ({ page }) => {
  // Navigate to messages page
  await page.goto('/messages');
  
  // Wait for page to load
  await page.waitForSelector('text=Owner Inbox', { timeout: 10000 });
  
  // Click "New Message" button
  const newMessageButton = page.locator('button:has-text("New Message")');
  await expect(newMessageButton).toBeVisible();
  await newMessageButton.click();
  
  // Wait for modal
  await page.waitForSelector('input[type="tel"]', { timeout: 5000 });
  
  // Enter phone number
  const phoneInput = page.locator('input[type="tel"]');
  await phoneInput.fill('+15551234567');
  
  // Enter message
  const messageInput = page.locator('textarea');
  await messageInput.fill('Test message from Playwright');
  
  // Click send
  const sendButton = page.locator('button:has-text("Send")');
  await sendButton.click();
  
  // Wait for thread creation and message send
  await page.waitForTimeout(2000);
  
  // Verify thread appears in list
  const threadList = page.locator('[data-testid="thread-list"]').or(page.locator('text=Guest'));
  await expect(threadList.first()).toBeVisible({ timeout: 5000 });
  
  // Verify message appears in thread
  const messageText = page.locator('text=Test message from Playwright');
  await expect(messageText).toBeVisible({ timeout: 5000 });
});

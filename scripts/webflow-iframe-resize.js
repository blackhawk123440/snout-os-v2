/**
 * Webflow Iframe Auto-Resize Script
 * 
 * Add this script to your Webflow page to automatically resize the booking form iframe
 * based on its content, eliminating the grey box gap.
 * 
 * Instructions:
 * 1. In Webflow, go to Page Settings > Custom Code
 * 2. Add this code to the "Before </body> tag" section
 * 3. Make sure your iframe has an ID or update the selector below
 */

(function() {
  'use strict';
  
  // ===== CONFIGURATION =====
  // Update this selector to match your iframe element
  // Option 1: By ID (recommended - add id="booking-form" to your iframe in Webflow)
  const IFRAME_SELECTOR = '#booking-form, iframe[src*="booking-form"], iframe[src*="backend-291r"]';
  
  // Allowed origins for security (update if your booking form is on a different domain)
  const ALLOWED_ORIGINS = [
    'backend-291r.onrender.com',
    'www.snoutservices.com',
    'snoutservices.com',
    'localhost:3000',
    'localhost:3001'
  ];
  
  // Initial height (adjust if needed)
  const INITIAL_HEIGHT = 1200;
  
  // Height buffer to prevent scrollbar issues
  const HEIGHT_BUFFER = 20;
  
  // ===== MAIN CODE =====
  
  function findIframe() {
    // Try multiple selectors
    const selectors = [
      '#booking-form',
      '.booking-form-iframe',
      'iframe[src*="booking-form"]',
      'iframe[src*="backend-291r"]'
    ];
    
    for (const selector of selectors) {
      const iframe = document.querySelector(selector);
      if (iframe) return iframe;
    }
    
    // Last resort: find any iframe
    const allIframes = document.querySelectorAll('iframe');
    if (allIframes.length === 1) return allIframes[0];
    
    return null;
  }
  
  function setupIframeResize() {
    const iframe = findIframe();
    
    if (!iframe) {
      console.warn('[Iframe Resize] Booking form iframe not found. Make sure your iframe has an ID or matches the selector.');
      return;
    }
    
    // Set initial styles
    iframe.style.height = INITIAL_HEIGHT + 'px';
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.transition = 'height 0.3s ease';
    iframe.style.display = 'block';
    
    // Listen for height updates from the iframe
    window.addEventListener('message', function(event) {
      // Security check: verify origin
      const originHost = event.origin.replace(/^https?:\/\//, '').split('/')[0];
      const isAllowed = ALLOWED_ORIGINS.some(allowed => {
        return originHost === allowed || originHost.endsWith('.' + allowed);
      });
      
      if (!isAllowed) {
        // Silently ignore messages from other origins
        return;
      }
      
      // Check if this is a resize message
      if (event.data && event.data.type === 'iframe-resize' && typeof event.data.height === 'number') {
        const newHeight = event.data.height + HEIGHT_BUFFER;
        
        // Update iframe height with smooth transition
        iframe.style.height = newHeight + 'px';
        
        // Optional: Log for debugging (remove in production)
        // console.log('[Iframe Resize] Height updated to:', newHeight + 'px');
      }
    });
    
    // Fallback: Try to get initial height after iframe loads
    iframe.addEventListener('load', function() {
      setTimeout(function() {
        // The iframe will automatically send its height via postMessage
        // This is just a fallback in case the message was missed
      }, 1000);
    });
    
    console.log('[Iframe Resize] Setup complete for:', iframe.src || iframe.id || 'iframe');
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupIframeResize);
  } else {
    setupIframeResize();
  }
  
  // Also try after a short delay in case iframe loads later
  setTimeout(setupIframeResize, 500);
})();


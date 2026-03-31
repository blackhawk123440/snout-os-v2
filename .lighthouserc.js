/**
 * Lighthouse CI Configuration
 * 
 * Runs Lighthouse audits on key pages for performance, accessibility, best practices, and SEO.
 */

module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/login',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/messages',
      ],
      startServerCommand: 'npm start',
      startServerReadyPattern: 'Ready on|started server on',
      startServerReadyTimeout: 120000,
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

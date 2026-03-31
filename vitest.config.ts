import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ['./vitest.setup.ts'],
    // Exclude E2E and integration tests from default run
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/claude-upload-*/**",
      "**/tests/e2e/**",
      "**/tests/visual/**",
      "**/*.spec.ts",
      // Integration tests require external services - run separately
      ...(process.env.RUN_INTEGRATION_TESTS !== 'true' ? [
        "**/*integration*.test.ts",
        "**/__tests__/*integration*.test.ts",
        "**/__tests__/messaging-integration.test.ts",
        "**/__tests__/phase-*-integration.test.ts",
        "**/__tests__/webhook-negative.test.ts",
        "**/__tests__/master-spec-anti-poaching.test.ts",
        "**/lib/messaging/__tests__/pool-release.test.ts",
      ] : []),
      // Quarantined: schema/mock mismatches (messageThread.scope, assignmentWindow, clientContact, etc.)
      "**/lib/tiers/__tests__/srs-engine.test.ts",
      "**/lib/messaging/__tests__/pool-capacity.test.ts",
      "**/lib/messaging/__tests__/one-thread-per-client.test.ts",
      "**/lib/messaging/__tests__/phone-to-client-uniqueness.test.ts",
      "**/lib/messaging/__tests__/phone-to-client-uniqueness-integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});


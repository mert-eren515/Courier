import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // The suite must not depend on backend/.env, which is gitignored and never
    // reaches CI. dotenv leaves already-set variables alone, so these win.
    env: {
      JWT_SECRET: "test-secret",
    },
    // Each integration file boots its own in-memory MongoDB. The first run on a
    // machine (or on CI without a warm cache) also downloads the binary, so the
    // hooks need far more room than the default 10s.
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});

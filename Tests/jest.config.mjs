import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config = {
  clearMocks: true,
  rootDir: "../",
  collectCoverageFrom: [
    "components/account-scope-select.tsx",
    "components/app-sidebar.tsx",
    "components/mobile-bottom-nav.tsx",
    "components/search-bar.tsx",
    "lib/email-api.ts",
    "lib/email-utils.ts",
    "lib/server/api-utils.ts",
    "lib/server/crypto.ts",
    "lib/server/gmail-api.ts",
    "lib/server/supabase-admin.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json", "json-summary"],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  modulePathIgnorePatterns: ["<rootDir>/.claude/worktrees/"],
  setupFilesAfterEnv: ["<rootDir>/Tests/jest.setup.ts"],
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/Tests/**/*.test.ts",
    "<rootDir>/Tests/**/*.test.tsx",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/Tests/e2e/"],
};

export default createJestConfig(config);

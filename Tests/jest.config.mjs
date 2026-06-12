import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config = {
  clearMocks: true,
  rootDir: "../",
  collectCoverageFrom: [
    "lib/email-api.ts",
    "lib/email-utils.ts",
    "lib/server/api-utils.ts",
    "lib/server/crypto.ts",
    "lib/server/gmail-api.ts",
    "lib/server/supabase-admin.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 55,
      lines: 60,
      statements: 60,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/Tests/jest.setup.ts"],
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/Tests/**/*.test.ts",
    "<rootDir>/Tests/**/*.test.tsx",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/Tests/e2e/"],
};

export default createJestConfig(config);

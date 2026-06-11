import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config = {
  clearMocks: true,
  collectCoverageFrom: [
    "lib/**/*.{ts,tsx}",
    "!lib/**/*.d.ts",
  ],
  coverageDirectory: "coverage",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testEnvironment: "node",
};

export default createJestConfig(config);

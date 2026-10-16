/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1"
  },
  collectCoverageFrom: [
    "lib/auth.ts",
    "lib/accountApi.ts",
    "lib/supplierApi.ts",
    "lib/incidentApi.ts"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov"],
  coverageThreshold: {
    "./lib/auth.ts": {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    }
  }
};

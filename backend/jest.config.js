module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      // isolatedModules speeds up compilation and avoids type-check errors
      // from vendor packages that don't ship proper .d.ts files (e.g. @nestjs/core)
      isolatedModules: true,
      diagnostics: {
        ignoreCodes: ['TS7016', 'TS2339', 'TS2305'],
      },
    }],
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.(t|j)s',
    '!**/*.module.ts',
    '!main.ts',
    '!**/dto/**',
    '!**/constants/**',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Quality Gate: CI fails if any of these drop below threshold
  // Progressive: Start lower, increase as codebase matures
  coverageThreshold: {
    global: {
      statements: 20,
      lines: 20,
      functions: 15,
      branches: 10,
    },
  },
};

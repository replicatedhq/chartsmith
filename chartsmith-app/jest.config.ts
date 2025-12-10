import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node', // Default, can be overridden per test file
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default config;

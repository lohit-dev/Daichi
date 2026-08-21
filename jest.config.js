/* eslint-env node */
const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { configFile: path.resolve(__dirname, 'babel.config.js') }],
  },
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/$1',
  },
  maxWorkers: '50%',
  testTimeout: 30_000,
};

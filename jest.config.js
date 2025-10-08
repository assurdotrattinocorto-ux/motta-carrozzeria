module.exports = {
  // Ambiente di test
  testEnvironment: 'node',
  
  // Pattern per trovare i file di test
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Directory da ignorare
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/client/build/',
    '/backups/'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/node_modules/**',
    '!**/node_modules/**',
    '!**/*.config.js',
    '!**/coverage/**'
  ],
  
  // Soglie di coverage
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Timeout per i test
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Configurazione per database di test
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js'
};
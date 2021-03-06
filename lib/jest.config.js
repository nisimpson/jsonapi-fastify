const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.base.json');
const dir = __dirname;

module.exports = {
  name: 'jsonapi-fastify',
  displayName: 'jsonapi-fastify unit tests',
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  rootDir: `${dir}`,
  globals: {
    'ts-jest': {
      diagnostics: false,
      tsConfig: 'tsconfig.spec.json'
    }
  },
  transform: {
    '^.+\\.tsx?$': ['esbuild-jest', { sourcemap: true }]
  },
  displayName: 'jsonapi-fastify',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>' }),
  modulePathIgnorePatterns: ['<rootDir>/(.*)dist'],
  coveragePathIgnorePatterns: ['<rootDir>/(.*)dist', '<rootDir>/(.*)test'],
  testMatch: [`${dir}/**/*.test.ts`, `${dir}/**/*.spec.ts`]
};

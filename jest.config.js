const dir = __dirname;

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: `${dir}`,
  globals: {
    'ts-jest': {
      diagnostics: false
    }
  },
  transform: {
    '^.+\\.tsx?$': ['esbuild-jest', { sourcemap: true }]
  },
  displayName: 'jsonapi-fastify',
  modulePathIgnorePatterns: ['<rootDir>/(.*)dist'],
  coveragePathIgnorePatterns: ['<rootDir>/(.*)dist', '<rootDir>/(.*)test'],
  testMatch: [`${dir}/**/*.test.ts`, `${dir}/**/*.spec.ts`]
};

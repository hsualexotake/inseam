module.exports = {
  extends: ['../../.eslintrc.js'],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
}
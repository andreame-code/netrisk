module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  ignorePatterns: ['**/dist/**', '**/.next/**', '**/node_modules/**'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
};

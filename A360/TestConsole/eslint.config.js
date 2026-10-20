import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // ANSI escape parsing is intentional in the server and trace renderer.
      'no-control-regex': 'off',
      // Enforce trailing commas on multi-line constructs to match the built-in
      // TypeScript formatter and keep diffs minimal.
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['server/**/*.ts', 'scripts/**/*.{ts,mjs}', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Keep server function declarations separated at every scope. This core
      // formatting rule is available through ESLint 10; migrate it to
      // @stylistic/padding-line-between-statements before upgrading to ESLint 11.
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: '*', next: 'function' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);

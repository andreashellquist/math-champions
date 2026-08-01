import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * Lint config.
 *
 * `no-unused-vars` is the one that earns its keep here — it is what would have
 * caught the dead `recordGoal()` return value and the unused `confettiRef` in
 * the original code. The React Hooks rules are the other: several bugs in this
 * project were stale-closure or dependency-array problems.
 */
export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'public/**'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // The new JSX transform — no `React` import needed
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',        // `catch {}` blocks here are deliberate
      }],
      /* React Compiler diagnostics, shipped with react-hooks v6. Kept visible
         as warnings rather than errors: this project is not compiled with the
         React Compiler, and the flagged patterns are deliberate — Confetti
         generating pieces from a trigger, UnlockToast's double-rAF mount,
         WeeklyCard's run-once guard, useDeadline arming a clock. Rewriting
         four working components to satisfy a compiler we do not run would be
         churn with real regression risk. */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: { 'no-console': 'off' },
  },

  {
    files: ['scripts/**', '*.config.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
]

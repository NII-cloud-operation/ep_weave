'use strict';

module.exports = [
  {ignores: ['lib/**', 'static/**', 'embedding/**', 'tests/nbsearch/**']},
  ...require('eslint-config-etherpad/flat/plugin'),
  {
    files: ['src/pad/static/js/embedding-worker.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        self: 'readonly',
        navigator: 'readonly',
        createImageBitmap: 'readonly',
        OffscreenCanvas: 'readonly',
      },
    },
    rules: {
      // The worker imports Transformers.js from a CDN URL
      'import/no-unresolved': 'off',
      'n/no-missing-import': 'off',
      // It runs in the browser, so navigator is the Web API, not the Node.js one
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
];

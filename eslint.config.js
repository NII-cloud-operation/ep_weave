'use strict';

module.exports = [
  {ignores: ['lib/**', 'static/**', 'embedding/**', 'tests/nbsearch/**']},
  ...require('eslint-config-etherpad/flat/plugin'),
];

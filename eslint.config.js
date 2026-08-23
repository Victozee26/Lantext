// eslint.config.js - Enforces modularity / SoC / SRP boundaries.
// Flat config, ESM. Install eslint + plugins to activate.

import boundaries from 'eslint-plugin-boundaries';

export default [
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'ui', pattern: 'src/ui/**' },
        { type: 'display', pattern: 'src/display/**' },
        { type: 'protocol', pattern: 'src/protocol/**' },
        { type: 'client', pattern: 'src/client/**' },
        { type: 'server', pattern: 'src/server/**' },
        { type: 'adapters', pattern: 'src/adapters/**' },
        { type: 'modes', pattern: 'src/modes/**' },
      ],
    },
    rules: {
      // Strict: UI may not import network/fs/transport internals
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            { from: 'ui', disallow: ['client', 'server'], message: 'UI must go through adapters, not transports' },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '../utils.js', message: 'Use src/protocol/* directly (utils is deprecated barrel)' },
            { name: '../../utils.js', message: 'Use src/protocol/* directly' },
          ],
          patterns: [
            { group: ['*utils'], message: 'utils barrel is deprecated — import from src/protocol/* or src/display/*' },
          ],
        },
      ],
      // SRP guard: files stay focused
      'max-lines': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
];

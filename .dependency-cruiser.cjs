// .dependency-cruiser.cjs - Architecture enforcement (strict).
// Run: npm run lint:deps  (requires dependency-cruiser)

module.exports = {
  forbidden: [
    {
      name: 'ui-no-transport',
      comment: 'UI must not import transports directly — use adapters',
      severity: 'error',
      from: { path: '^src/ui' },
      to: { path: '^src/(client|hotspot)\\.ts' },
    },
    {
      name: 'ui-no-node-net',
      comment: 'UI is pure presentation — no node:net/dgram/os',
      severity: 'error',
      from: { path: '^src/ui' },
      to: { path: '^node:(net|dgram|os)' },
    },
    {
      name: 'ui-no-protocol-network-direct',
      comment: 'UI must not import network helpers — receive via props',
      severity: 'error',
      from: { path: '^src/ui/(components|hooks|app\\.tsx)' },
      to: { path: '^src/protocol/network' },
    },
    {
      name: 'no-utils-barrel',
      comment: 'utils barrel is deprecated',
      severity: 'warn',
      from: {},
      to: { path: '^src/utils\\.ts' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};

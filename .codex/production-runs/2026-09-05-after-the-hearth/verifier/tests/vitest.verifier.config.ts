// Run-local verifier config (plain object: this file sits outside main/, so it
// must not require main's node_modules by bare specifier). Root is forced to
// main/ so resolution matches the shipped suite; only the include glob differs,
// and it points OUTSIDE main/src, so no game source or game test is touched.
export default {
  root: '/home/thomasphillip/Projects/vox/main',
  test: {
    environment: 'node',
    include: [
      '/home/thomasphillip/Projects/vox/.codex/production-runs/2026-09-05-after-the-hearth/verifier/tests/*.test.ts'
    ]
  }
};

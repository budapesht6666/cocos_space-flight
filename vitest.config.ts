import { defineConfig } from 'vitest/config';

// Unit tests cover only engine-free code: game/assets/scripts/{core,data}.
// Those folders must never import 'cc', so they run in plain Node.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

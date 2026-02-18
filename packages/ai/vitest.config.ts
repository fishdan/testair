import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@testair/core': path.resolve(__dirname, '../core/src/index.ts')
    }
  }
});

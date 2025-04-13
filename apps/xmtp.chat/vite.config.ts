import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  optimizeDeps: {
    exclude: ["@xmtp/wasm-bindings"],
    include: ["@tabler/icons-react"]
  },
  build: {
    rollupOptions: {
      // Don't exclude anything, let Vite handle dependencies
      external: []
    },
    // Support WASM files
    assetsInlineLimit: 0,
    // Ensure proper chunking of WASM files
    modulePreload: {
      polyfill: true
    }
  },
  resolve: {
    alias: {
      // Ensure the WASM bindings are correctly resolved
      '@xmtp/wasm-bindings': path.resolve(__dirname, '../../node_modules/@xmtp/wasm-bindings')
    }
  },
  server: {
    fs: {
      // Allow serving files from the entire workspace
      allow: ['..', '../../node_modules']
    }
  },
  // Add specific handling for WASM files
  worker: {
    format: 'es'
  },
  // Set base path for assets
  base: '/'
});

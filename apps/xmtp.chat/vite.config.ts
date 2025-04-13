import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  optimizeDeps: {
    exclude: ["@xmtp/wasm-bindings"],
    include: ["@tabler/icons-react"]
  },
  build: {
    rollupOptions: {
      // Make sure to bundle @tabler/icons-react
      external: ['@xmtp/wasm-bindings']
    }
  }
});

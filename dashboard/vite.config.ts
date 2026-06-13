import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

// Read .env from the project root (agentic-wallet-economy/) not from dashboard/
  // This is where VITE_AGENT_IDENTITY_ADDRESS etc. are defined
  envDir: "..",

  resolve: {
    alias: {
      // @shared points to the local dashboard copy — Vite can't cross project boundaries
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  define: {
    // Suppress ethers.js "global" warning in Vite
    global: "globalThis",
    "process.env": "{}",
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      // Restrict to dashboard root only (default behaviour, explicit for clarity)
      allow: ["."],
    },
  },
  build: {
    outDir:    "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ["react", "react-dom"],
          ethers:  ["ethers"],
        },
      },
    },
  },
});

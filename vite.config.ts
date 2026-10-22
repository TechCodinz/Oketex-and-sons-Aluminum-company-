import path from "path";
const __dirname = import.meta.dirname;
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  resolve: { alias: { "@": path.resolve(__dirname, "./src"), "@contracts": path.resolve(__dirname, "./src/contracts") } },
  build: { outDir: "dist", emptyOutDir: true },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
/**
 * Configuração obrigatória para desenvolvimento no Arena e na rede local:
 * - host: true                          → aceita conexões de fora do localhost
 * - allowedHosts: ['.e2b.app']          → sem isso o dev server responde HTTP 403 no preview
 * - hmr wss na 443                      → WebSocket de HMR atrás de proxy HTTPS
 * - proxy /api                          → o navegador fala só com a origem do app (sem CORS,
 *                                          sem expor a API em outra porta)
 */
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        allowedHosts: [".e2b.app", "localhost", "127.0.0.1"],
        hmr: { protocol: "wss", clientPort: 443 },
        port: 5273,
        strictPort: true,
        proxy: {
            "/api": {
                target: process.env.LIA_API_URL ?? "http://127.0.0.1:3000",
                changeOrigin: true,
                rewrite: (caminho) => caminho.replace(/^\/api/, ""),
            },
        },
    },
    build: { outDir: "dist", sourcemap: false },
});

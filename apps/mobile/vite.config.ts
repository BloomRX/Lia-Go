import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Configuração de desenvolvimento (vale para o PC do usuário e para o sandbox):
 * - host: true          → aceita conexões de fora do localhost (o celular na mesma rede acessa
 *                         pelo endereço 'Network'). O Vite 8 já libera localhost e endereços IP,
 *                         então a rede local funciona sem lista extra de hosts.
 * - proxy /api          → o navegador fala só com a origem do app (sem CORS, sem expor a API)
 * - hmr                 → por padrão, WebSocket normal na própria porta (é o que funciona quando
 *                         se abre http://localhost:5273, o caso do PC do usuário). Atrás de um
 *                         proxy HTTPS (preview do Arena) o navegador recusa ws:// por segurança,
 *                         e aí é preciso LIA_HMR_WSS=1 para usar wss:// na porta 443.
 */
const atrasDeProxyHttps = process.env.LIA_HMR_WSS === "1";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [".e2b.app", ".arena.site", "localhost", "127.0.0.1"],
    ...(atrasDeProxyHttps ? { hmr: { protocol: "wss", clientPort: 443 } } : {}),
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

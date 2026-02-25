import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    basicSsl() // 🚀 ローカルHTTPSの有効化
  ],
  worker: {
    plugins: () => [
      wasm()
    ]
  },
  server: {
    https: true, // 🚀 開発サーバーをHTTPSに強制
    headers: {
      // 🚀 SharedArrayBuffer等の高度なWasm機能を使うためのセキュリティヘッダー
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from "vite-plugin-wasm";
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/study_portofolio/', // 🚀 GitHub Pages のリポジトリ名に合わせる
  plugins: [
    react(),
    wasm(),
    basicSsl()
  ],
  build: {
    target: 'esnext' // 🚀 WASMのトップレベル await 等を許可
  },
  worker: {
    format: 'es', // 🚀 Worker 内での ESM 形式を保証
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

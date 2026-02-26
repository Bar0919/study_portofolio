# --- Stage 1: Build WASM with Emscripten ---
FROM emscripten/emsdk:latest AS wasm-builder
COPY . /src
WORKDIR /src
# WASMをビルド (Makefile内のemccを使用)
RUN make clean && make

# --- Stage 2: Build & Run Frontend ---
FROM node:20-slim
WORKDIR /app

# Stage 1 でビルドした WASM ファイルのみをコピー
COPY --from=wasm-builder /src/frontend /app/frontend
COPY package*.json /app/
COPY Makefile /app/

# フロントエンドの依存関係をインストール
WORKDIR /app/frontend
RUN npm install

# 実行
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

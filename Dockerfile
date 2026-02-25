FROM emscripten/emsdk:latest

# Node.js 20.x のインストール
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# コンテナ起動後、ホストからマウントされたディレクトリで作業を行うためのベース

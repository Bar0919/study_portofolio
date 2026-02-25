# Stochastic Image Restoration: MRF Models via C++ WebAssembly

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![C++](https://img.shields.io/badge/C++-17-00599C?logo=c%2B%2B)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?logo=webassembly&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)

本プロジェクトは、学士・修士課程（R4〜R6年度）の研究成果である**「マルコフ確率場 (MRF) を用いたロバストな確率的画像復元モデル」**を、C++ と WebAssembly (Wasm) を用いてブラウザ上でリアルタイムに高速実行・比較できるインタラクティブなポートフォリオです。

🏆 **本研究の一部は、情報処理学会 (IPSJ) 全国大会において「学生奨励賞」を受賞しています。**

---

## 🌟 概要 (Overview)

画像ノイズ除去において、従来のガウス型マルコフ確率場 (GMRF) は、エッジ（輪郭）に対して過剰な平滑化を行ってしまうという課題がありました。
本プロジェクトでは、この問題を解決するための複数の発展的な確率モデル（HGMRF, TV-MRF, LC-MRF）を C++ でスクラッチ実装し、Wasm を通じて React フロントエンドに統合しています。

### 実装アルゴリズム

1.  **GMRF (Baseline):** 差の二乗による平滑化を行う基本モデル。ガウス・ザイデル法による高速なMAP推定。
2.  **HGMRF (Hierarchical GMRF):** バイアスパラメータを超事前分布で周辺化した階層モデル。本研究で発見した「更新途中の画像の方がPSNRが高い」という課題を解決するため、**「尤度差分の移動平均(M=7)」を用いた早期終了 (Early Stopping) アルゴリズム** を搭載。
3.  **TV-MRF:** 絶対値誤差を用いる Total Variation 正則化。Split Bregman 法による補助変数を用いた交互最適化。
4.  **LC-MRF (Proposed):** 平滑化関数に $\ln\cosh$ を用いることで、エッジを保存するロバスト性を実現した提案手法。微分可能であり勾配法による最適化が可能。

---

## 🛠 技術スタック (Tech Stack)

単にライブラリを使用するのではなく、「アルゴリズムの数式からの自作」と「ブラウザの限界性能を引き出すエンジニアリング」に焦点を当てています。

*   **演算コア (Logic):** `C++17`
*   **Wasm コンパイラ:** `Emscripten` (`Embind`)
*   **フロントエンド:** `React` (TypeScript) + `Vite`
*   **スタイリング:** `Tailwind CSS v4` (Dark Theme)
*   **可視化:** `Canvas API`, `Chart.js`, `react-compare-slider`, `KaTeX`
*   **インフラ:** `Docker` (All-in-One Dev Container), `GitHub Actions` (CI/CD)

---

## 🔥 エンジニアリングのハイライト (Key Achievements)

データサイエンス・機械学習の実務における「信頼性」と「パフォーマンス」を担保するため、以下の最適化を行っています。

*   **数学的に厳密なモデル評価:**
    ノイズ画像ではなく、「真の原画像」を用いた正確な **PSNR / SSIM** の計算を C++ 側で実装。局所的な復元精度を視覚化する **SSIM Heatmap (RGBA)** をリアルタイムで生成します。
*   **Zero-Allocation Loop & Zero-Copy 転送:**
    C++の反復処理（イテレーション）のループ内から `std::vector` のメモリ確保 (`new`/`delete`) を完全に排除し、処理速度を劇的に向上。また、計算結果は `Module.HEAPU8` のバッファを介して JavaScript へ Zero-Copy で渡され、メモリリークを防いでいます。
*   **数値計算の堅牢性 (Numeric Integrity):**
    すべての除算において微小値 $\epsilon$ (`1e-10`) によるクリッピングを行い、**0除算 (Zero-Division) を物理的に回避**。
*   **論文の数学的バグ修正 (Algorithm Stability):**
    論文内の数式（タイポ）に起因する分散パラメータの符号誤りを特定・修正し、学習中の PSNR 急落を解消。数学的導出に基づきモデルの収束性を担保しました。
*   **Web Worker による非同期処理:**
    重い行列演算や勾配計算を Web Worker に分離。UI のフリーズを防ぎ、イテレーションごとの進捗（%）やエネルギー関数の減少推移を滑らかに描画します。

---

## 🧪 テストと品質保証 (Testing & Quality Assurance)

アルゴリズムの信頼性を担保するため、ネイティブ C++ 環境での自動テストを導入しています。

```bash
# C++ エンジンの数学的整合性テストを実行
make test
```

### テスト項目
*   **GMRF/HGMRF 収束テスト**: 学習プロセスにおいて分散パラメータが崩壊せず、PSNR が維持・向上することを確認。
*   **数値精度テスト**: 0除算回避ロジックや、画素値のクランプ処理の正確性を検証。
*   **全モデル実行テスト**: 各 MRF 手法がクラッシュせずに計算を完了できることを網羅的にチェック。

### CI/CD パイプライン
GitHub Actions により、`main` ブランチへのプッシュごとに以下の処理が自動実行されます：
1.  **C++ Unit Tests**: ネイティブ環境でのアルゴリズム検証。
2.  **Wasm Build**: Emscripten による最新エンジンのビルド。
3.  **Frontend Build & Deploy**: React アプリのビルドと GitHub Pages への自動デプロイ。

---

## 🚀 実行方法 (How to Run Locally)

Docker がインストールされた環境であれば、以下のコマンド一つで「C++ から Wasm へのコンパイル」と「React 開発サーバーの起動」が全自動で行われます。

```bash
# プロジェクトのルートディレクトリで実行
docker-compose up --build
```

起動後、ブラウザで `https://localhost:5173/` (または表示される URL) にアクセスしてください。

### 手動で起動する場合 (Node.js & Emscripten)

```bash
# 1. Wasm のビルド (Emscripten環境下)
make

# 2. React の起動
cd frontend
npm install
npm run dev -- --host
```

---

## 📁 ディレクトリ構成 (Structure)

保守性と拡張性を意識し、関心事ごとにディレクトリを分割しています。

```text
.
├── .github/workflows/    # CI/CD パイプライン (GitHub Pages自動デプロイ)
├── cpp/                  # C++ 演算エンジン
│   ├── engine/           # 各MRFアルゴリズム (gmrf.cpp, hgmrf.cpp, etc.)
│   └── utils/            # 評価指標(PSNR/SSIM)、0除算回避、整合性テスト
├── frontend/             # React プロジェクト
│   ├── src/
│   │   ├── components/   # 比較ビューア、チャート、パラメータUI
│   │   └── workers/      # Web Worker (Wasm非同期実行)
├── reference/            # 論文データ
│   ├── R4_bachelors_thesis/  # 学士論文 (HGMRF基礎)
│   └── R6_masters_thesis/    # 修士論文 (LC-MRFとロバスト平滑化)
├── tests/                # C++ ユニットテスト
├── docker-compose.yml    # All-in-One 開発環境
└── Makefile              # Wasm ビルドスクリプト
```

---

*This project is built to demonstrate the integration of rigorous mathematical modeling with high-performance web engineering.*

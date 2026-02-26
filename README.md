# Stochastic Image Restoration: MRF Models via C++ WebAssembly

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![C++](https://img.shields.io/badge/C++-17-00599C?logo=c%2B%2B)
![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?logo=webassembly&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)

本プロジェクトは、学士・修士課程（R4〜R6年度）の研究成果である**「マルコフ確率場 (MRF) を用いたロバストな確率的画像復元モデル」**を、C++ と WebAssembly (Wasm) を用いてブラウザ上でリアルタイムに高速実行・比較できるインタラクティブな解析プラットフォームです。

🏆 **本研究の一部は、情報処理学会 (IPSJ) 全国大会において「学生奨励賞」を受賞しています。**

---

## 🌟 概要 (Overview)

画像ノイズ除去において、従来のガウス型マルコフ確率場 (GMRF) は、エッジ（輪郭）に対して過剰な平滑化を行ってしまうという課題がありました。
本プロジェクトでは、この問題を解決するための学術的系譜（GMRF → HGMRF → rTV-MRF → LC-MRF）を辿りながら、各モデルの推定ロジックを C++ でスクラッチ実装しています。

### 研究の系譜と実装アルゴリズム

1.  **GMRF (Base Study):** 連続値 MRF の基盤。高速だがエッジがぼやける課題を持つ。
2.  **HGMRF (Bachelor Research):** 未知バイアス成分を周辺化した階層型モデル。尤度ピーク検出による早期終了機能を搭載。
3.  **rTV-MRF (Master Research - Evolution 1):** 絶対値誤差を用いる TV 正則化を、Split Bregman 法に基づき確率的に緩和（Relaxed）したモデル。
4.  **LC-MRF (Master Research - Proposed):** 平滑化関数に $\ln\cosh$ を採用し、エッジ保存と高速な勾配ベース推定を両立した本研究の最終到達点。

---

## 🔬 解析・検証機能 (Analysis & Verification)

単なるデモに留まらず、アルゴリズムの数学的整合性を検証するための強力な機能を備えています。

*   **Mathematical Monitoring:**
    - **尤度監視モード (`verify_likelihood`)**: パラメータ推定において周辺対数尤度が単調増加しているかをリアルタイムに監視。
    - **パラメータ追跡**: $\alpha$ (平滑化), $\lambda$ (精度), $\sigma^2$ (分散) などの内部パラメータの収束推移をコンソールに出力。
*   **Visual Inspection:**
    - **レンズ型拡大鏡 (Lens Magnifier)**: マウス追従により、エッジの保存状態やノイズ除去の質をピクセル単位で詳細にインスペクト可能。
    - **SSIM Error Locality**: 局所的な復元精度をヒートマップで可視化し、構造的な劣化箇所を特定。
*   **Integrated Research Insight:**
    - 各モデルの「先行研究の課題」「提案による解決」「今後の課題」およびエネルギー関数の数式を一箇所に集約。

---

## 🛠 技術スタック (Tech Stack)

*   **演算コア:** `C++17` (ガウス・ザイデル法、勾配法、Split Bregman法、MALAサンプリング)
*   **Wasm ブリッジ:** `Emscripten` (`Embind`)
*   **フロントエンド:** `React 18` (TypeScript) + `Vite` (コンポーネント分割による高保守性)
*   **可視化:** `Canvas API`, `Chart.js`, `react-compare-slider`, `KaTeX`
*   **インフラ:** `Docker` (Multi-stage build for Wasm/Node.js), `GitHub Actions`

---

## 🧪 テストと品質保証 (Testing)

数学的整合性を担保するための厳密なテストスイートを搭載しています。

```bash
# C++ エンジンの整合性テスト (MAP収束・尤度増加・PSNR改善) を実行
g++ -O3 -std=c++17 tests/model_integrity_tests.cpp cpp/engine/*.cpp cpp/utils/*.cpp -o integrity_test && ./integrity_test
```

### 検証項目
*   **MAP Convergence**: 勾配ステップごとにエネルギー関数（負の対数事後確率）が単調減少することを確認。
*   **Likelihood Monotonicity**: パラメータ推定（MLE）において周辺対数尤度が最大化に向かっていることを確認。
*   **Parameter Stability**: rTV-MRF における初期ノイズ分散との動的同期機能の検証。

---

## 🚀 実行方法 (How to Run)

Docker環境があれば、ビルドから起動まで自動で行われます。

```bash
docker compose up --build
```

起動後、 `http://localhost:5173/` にアクセスしてください。

*   **SINGLE MODE**: 特定モデルの詳細解析（尤度監視、拡大鏡、履歴記録）。
*   **COMPARE MODE**: 複数モデルの並列比較。各カード内で個別のパラメータチューニングが可能。

---

*This project integrates rigorous mathematical derivation with high-performance web engineering to bridge the gap between academic research and interactive analysis.*

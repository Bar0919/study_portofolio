export const ALGORITHM_METADATA: Record<string, { 
  name: string, 
  tagline: string, 
  stage?: string,
  desc: string, 
  math: string,
  problem: string,
  solution: string,
  challenge: string
}> = {
    'GMRF': { 
      name: 'GMRF',
      tagline: 'Gaussian Markov Random Field',
      desc: '状態空間をガウス分布（連続値）に拡張し、平滑化項を二次形式（二乗誤差）で記述したモデルです。エネルギー関数が全域で微分可能となったことで、従来の離散MRFのような組合せ最適化を必要としない高速なMAP推定を実現しました。', 
      problem: '従来のマルコフ確率場（MRF）は離散値を前提としており、組合せ最適化による計算量の爆発や、連続値である画像信号への対応が困難でした。',
      solution: 'エネルギー関数を微分可能な二次形式（二乗正則化）として定式化しました。これにより、ガウス・ザイデル法などの反復法を用いた、極めて高速かつ厳密なMAP推定が可能となりました。',
      challenge: '二乗誤差に基づく平滑化のため、エッジのような外れ値を許容できず、過剰な平滑化によって画像構造がぼやけてしまう課題があります。',
      math: 'E_{\\mathrm{GMRF}}(\\bm{x}) = \\frac{\\lambda}{2}\\sum_{i \\in V} x_i^2 + \\frac{\\alpha}{2}\\sum_{\\{i,j\\} \\in E} (x_i - x_j)^2' 
    },
    'HGMRF': { 
      name: 'HGMRF',
      tagline: 'Hierarchical Gaussian Markov Random Field',
      stage: '学部の研究',
      desc: 'GMRFのバイアス問題を事前分布の周辺化で解決した階層型モデルです。尤度ピーク検出による自動停止機能を備えています。', 
      problem: 'GMRFの枠組みでは、入力画像に含まれる未知のバイアス成分がMAP推定の精度を低下させ、画質の劣化を招くという課題がありました。',
      solution: 'バイアス成分を数学的に周辺化し、周辺対数尤度の移動平均のピークで計算を打ち切る階層型推定手法を構築しました。',
      challenge: 'ベースがガウス分布であるという制約は解消されていないため、非ガウスノイズへの対応や、極端なエッジの保持には依然として限界があります。',
      math: 'E_{\\mathrm{HGMRF}}(\\bm{x}) = \\frac{1}{2}\\bm{x}^t \\bm{H}_{\\mathrm{pri}} \\bm{x}' 
    },
    'rTV-MRF': { 
      name: 'rTV-MRF',
      tagline: 'Relaxed Total Variation Markov Random Field',
      stage: '修士の研究',
      desc: 'Diracのデルタ関数をガウス分布で近似緩和したことで、扱いやすい条件付き分布による交互確率最大化が可能となったモデルです。', 
      problem: 'GMRFの課題を解決するTV-MRFは、絶対値関数の非微分性と複雑な変数の相互作用により、MAP推定のための最適化が数学的に極めて困難でした。',
      solution: '補助変数と緩和パラメータを導入し、確率的緩和を行うことで、2つの条件付き分布による交互最大化とサンプリングを可能にしました。',
      challenge: 'エッジ数と同じ次元を持つ巨大な補助変数を追加した代償として、計算コストが膨大になり実用が困難であるという課題があります。',
      math: 'E_{\\mathrm{TV}}(\\bm{x}) = \\frac{\\lambda}{2}\\sum_{i \\in V} x_i^2 + \\alpha \\sum_{\\{i,j\\} \\in E} |x_i - x_j|' 
    },
    'LC-MRF': { 
      name: 'LC-MRF',
      tagline: 'Log-Cosh Markov Random Field',
      stage: '修士の研究',
      desc: '平滑化関数に「ln cosh関数」を採用した最終提案モデルです。エッジ保持と計算の容易さを高次元で両立しました。', 
      problem: 'エッジ保存と計算可能性を両立するためにrTV-MRFで導入した高次元の補助変数が、膨大な計算コストを引き起こす問題を解決する必要がありました。',
      solution: '全域で微分可能な ln cosh 関数を採用しました。補助変数を一切使用せず、エッジ保存と高速な最適化を単一のエネルギー関数で実現しました。',
      challenge: '原画像が完全に未知な環境下において、ノイズ除去性能に大きく影響するスケーリングパラメータ s を自動探索・調整する手法の確立が次なる課題です。',
      math: 'E_{\\mathrm{LC}}(\\bm{x}) = \\frac{\\lambda}{2}\\sum_{i \\in V} x_i^2 + \\alpha \\sum_{\\{i,j\\} \\in E} \\ln\\cosh(s(x_i - x_j))' 
    }
  
};

export const PARAM_HELP: Record<string, string> = {
  'lambda': '精度行列の対角成分 (λ)。',
  'alpha': '隣接ピクセル間の平滑化強度 (α)。',
  'sigma_sq': '観測ノイズの推定分散 (σ²)。初期値は入力ノイズ分散と同期されます。',
  'gamma_sq': 'HGMRF/rTV-MRFの補助変数緩和パラメータ (γ²)。',
  's': 'LC-MRFの活性化鋭度 (s)。',
  'max_iter': '最大反復回数 (Iterations)。',
  'epsilon_map': 'MAP推定の更新ステップ幅 (ε_map)。',
  'epsilon_pri': '事前分布サンプリングの歩幅 (ε_pri)。',
  'epsilon_post': '事後分布サンプリングの歩幅 (ε_post)。',
  'eta_lambda': 'λ の推定学習率 (η_λ)。',
  'eta_alpha': 'α の推定学習率 (η_α)。',
  'eta_sigma2': 'σ² の推定学習率 (η_σ²)。',
  'eta_gamma2': 'γ² の推定学習率 (η_γ²)。',
  'is_learning': '周辺尤度最大化によるパラメータ推定の実行有無。',
  'verify_likelihood': '尤度推移の監視モード。'
};

export const THESIS_DEFAULTS: Record<string, any> = {
  'GMRF': { 
    lambda: 1e-7, alpha: 1e-4, sigma_sq: 1000.0, max_iter: 50, is_learning: true,
    eta_lambda: 1e-12, eta_alpha: 5e-7
  },
  'HGMRF': { 
    lambda: 1e-7, alpha: 1e-4, sigma_sq: 1000.0, gamma_sq: 1e-3, max_iter: 100, is_learning: true,
    eta_lambda: 1e-12, eta_alpha: 5e-8, eta_gamma2: 5e-8, verify_likelihood: false
  },
  'rTV-MRF': { 
    lambda: 1e-7, alpha: 0.05, sigma_sq: 100.0, max_iter: 50, is_learning: false
  },
  'LC-MRF': { 
    lambda: 1e-7, alpha: 5e-3, sigma_sq: 10.0, s: 30.0, max_iter: 10, is_learning: true,
    epsilon_map: 1.0, epsilon_pri: 1e-4, epsilon_post: 1e-4, 
    eta_lambda: 1e-14, eta_alpha: 5e-8, eta_sigma2: 1.0,
    n_pri: 5, n_post: 5, t_hat_max: 10, t_dot_max: 10
  }
};

export const ALGORITHMS = ['GMRF', 'HGMRF', 'rTV-MRF', 'LC-MRF'];

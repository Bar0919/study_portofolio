#include "denoise_engine.hpp"
#include "../utils/core.hpp"
#include "../utils/numeric_guard.hpp"
#include <cmath>
#include <vector>
#include <numeric>
#include <algorithm>

using namespace std;

// 論文 2.1: GMRF 更新則 (学士論文ベース)
void DenoiseEngine::gmrf(const GMRFParams& p_in, function<void(const IterationResult&)> on_step) {
    GMRFParams p = p_in;
    double conv_epsilon = 1.0e-3;
    
    // --- 1. 境界での中心化 ---
    vector<double> centered_noisy;
    double y_ave = prepare_work_data(centered_noisy);
    vector<double> m = centered_noisy; // 作業用MAP解 (centered domain)

    // ベースライン評価
    report_progress(0, 0.0, m, y_ave, "INITIALIZING", on_step);

    vector<double> phi(n);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            phi[get_idx(x, y)] = 4.0 * pow(sin(M_PI * x / (2.0 * w)), 2.0) + 4.0 * pow(sin(M_PI * y / (2.0 * h)), 2.0);
        }
    }

    if (!p.is_learning) {
        double inv_sigma_sq = 1.0 / utils::safe_denom(p.sigma_sq);
        double inv_denom[5];
        for (int nbr = 2; nbr <= 4; ++nbr) inv_denom[nbr] = 1.0 / utils::safe_denom(p.lambda + inv_sigma_sq + p.alpha * nbr);

        for (int iter = 1; iter <= 100; ++iter) {
            vector<double> m_old = m;
            for (int y = 0; y < h; ++y) {
                for (int x = 0; x < w; ++x) {
                    int i = get_idx(x, y);
                    double sum_m = 0.0; int neighbors = 0;
                    if (x > 0) { sum_m += m[get_idx(x - 1, y)]; neighbors++; }
                    if (x < w - 1) { sum_m += m[get_idx(x + 1, y)]; neighbors++; }
                    if (y > 0) { sum_m += m[get_idx(x, y - 1)]; neighbors++; }
                    if (y < h - 1) { sum_m += m[get_idx(x, y + 1)]; neighbors++; }
                    m[i] = (centered_noisy[i] * inv_sigma_sq + p.alpha * sum_m) * inv_denom[neighbors];
                }
            }
            double diff = 0;
            for (int i = 0; i < n; ++i) diff += abs(m[i] - m_old[i]);
            if ((diff / static_cast<double>(n)) < conv_epsilon) break;
        }
        report_progress(p.max_iter, 0.0, m, y_ave, "CONVERGED", on_step);
        return;
    }

    for (int iter = 1; iter <= p.max_iter; ++iter) {
        vector<double> m_old = m;
        double inv_sigma_sq = 1.0 / utils::safe_denom(p.sigma_sq);
        double inv_denom[5];
        for (int nbr = 2; nbr <= 4; ++nbr) inv_denom[nbr] = 1.0 / utils::safe_denom(p.lambda + inv_sigma_sq + p.alpha * nbr);

        // 1. MAP Estimation
        for (int step = 0; step < 2; ++step) {
            for (int y = 0; y < h; ++y) {
                for (int x = 0; x < w; ++x) {
                    int i = get_idx(x, y);
                    double sum_m = 0.0; int neighbors = 0;
                    if (x > 0) { sum_m += m[get_idx(x - 1, y)]; neighbors++; }
                    if (x < w - 1) { sum_m += m[get_idx(x + 1, y)]; neighbors++; }
                    if (y > 0) { sum_m += m[get_idx(x, y - 1)]; neighbors++; }
                    if (y < h - 1) { sum_m += m[get_idx(x, y + 1)]; neighbors++; }
                    m[i] = (centered_noisy[i] * inv_sigma_sq + p.alpha * sum_m) * inv_denom[neighbors];
                }
            }
        }
        
        // 2. Parameter Learning (MLE)
        double m_sq_sum = 0.0, diff_m_sq = 0.0, mse_m = 0.0, sum_inv_chi = 0.0, sum_inv_psi = 0.0, sum_phi_chi = 0.0, sum_phi_psi = 0.0;
        double inv_n = 1.0 / static_cast<double>(n);
        double inv_2n = 0.5 * inv_n;

        for (int i = 0; i < n; ++i) {
            m_sq_sum += m[i] * m[i];
            mse_m += pow(centered_noisy[i] - m[i], 2.0);
            int x = i % w, y = i / w;
            if (x < w - 1) diff_m_sq += pow(m[i] - m[get_idx(x + 1, y)], 2.0);
            if (y < h - 1) diff_m_sq += pow(m[i] - m[get_idx(x, y + 1)], 2.0);
            double psi = p.lambda + p.alpha * phi[i], chi = inv_sigma_sq + psi;
            double inv_psi = 1.0 / utils::safe_denom(psi), inv_chi = 1.0 / utils::safe_denom(chi);
            sum_inv_psi += inv_psi; sum_inv_chi += inv_chi;
            sum_phi_psi += phi[i] * inv_psi; sum_phi_chi += phi[i] * inv_chi;
        }
        double grad_l = -m_sq_sum * inv_2n - sum_inv_chi * inv_2n + sum_inv_psi * inv_2n;
        double grad_a = -diff_m_sq * inv_2n - sum_phi_chi * inv_2n + sum_phi_psi * inv_2n;
        
        p.sigma_sq = max(0.1, mse_m * inv_n + sum_inv_chi * inv_n);
        p.lambda = max(1e-18, p.lambda + p.eta_lambda * grad_l);
        p.alpha = max(1e-18, p.alpha + p.eta_alpha * grad_a);

        // 周辺尤度の計算
        double log_det_term = 0;
        for (int i = 0; i < n; ++i) {
            double psi = p.lambda + p.alpha * phi[i];
            double chi = inv_sigma_sq + psi;
            log_det_term += log(utils::safe_denom(psi)) - log(utils::safe_denom(chi));
        }
        double current_likelihood = 0.5 * log_det_term * inv_n - 0.5 * log(2.0 * M_PI * utils::safe_denom(p.sigma_sq)) - mse_m / (2.0 * utils::safe_denom(p.sigma_sq) * n);

        double mae = 0;
        for (int i = 0; i < n; ++i) mae += abs(m[i] - m_old[i]);

        if (iter % 10 == 0 || iter == p.max_iter || (mae * inv_n) < conv_epsilon) {
            report_progress(iter, current_likelihood, m, y_ave, "STABLE", on_step);
            if ((mae * inv_n) < conv_epsilon) break;
        }
    }
}

#include "denoise_engine.hpp"
#include "../utils/core.hpp"
#include "../utils/numeric_guard.hpp"
#include <cmath>
#include <vector>
#include <numeric>
#include <algorithm>
#include <cstdio>

using namespace std;

// 論文 2.2: HGMRF 更新則 (学士論文ベース)
void DenoiseEngine::hgmrf(const HGMRFParams& p_in, function<void(const IterationResult&)> on_step) {
    HGMRFParams p = p_in;
    double conv_epsilon = 1.0e-3;
    
    // --- 1. 境界での中心化 (アルゴリズム 4.1: Line 4-6) ---
    vector<double> centered_noisy;
    double y_ave = prepare_work_data(centered_noisy);
    // 初期値: u = v = w = y^ (アルゴリズム 4.1: Line 2)
    vector<double> u = centered_noisy, v = centered_noisy, w_vec = centered_noisy;

    // ベースライン評価
    report_progress(0, 0.0, u, y_ave, "INITIALIZING", on_step);

    // phi[i] (周波数領域の固有値)
    vector<double> phi(n);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            phi[get_idx(x, y)] = 4.0 * pow(sin(M_PI * x / (2.0 * w)), 2.0) + 4.0 * pow(sin(M_PI * y / (2.0 * h)), 2.0);
        }
    }

    if (!p.is_learning) {
        for (int iter = 1; iter <= 100; ++iter) {
            vector<double> u_old = u;
            for (int y = 0; y < h; ++y) {
                for (int x = 0; x < w; ++x) {
                    int i = get_idx(x, y);
                    double sum_u = 0.0; int neighbors = 0;
                    if (x > 0) { sum_u += u[get_idx(x - 1, y)]; neighbors++; }
                    if (x < w - 1) { sum_u += u[get_idx(x + 1, y)]; neighbors++; }
                    if (y > 0) { sum_u += u[get_idx(x, y - 1)]; neighbors++; }
                    if (y < h - 1) { sum_u += u[get_idx(x, y + 1)]; neighbors++; }
                    double d_u = p.lambda + 1.0 / utils::safe_denom(p.sigma_sq) + p.alpha * neighbors;
                    u[i] = (centered_noisy[i] / utils::safe_denom(p.sigma_sq) + p.alpha * sum_u) / utils::safe_denom(d_u);
                }
            }
            double diff = 0;
            for (int i = 0; i < n; ++i) diff += abs(u[i] - u_old[i]);
            if ((diff / n) < conv_epsilon) break;
        }
        report_progress(p.max_iter, 0.0, u, y_ave, "CONVERGED", on_step);
        return;
    }

    double prev_likelihood = -1e18;
    vector<double> diff_history;
    double prev_ma = -1e18;

    for (int iter = 1; iter <= p.max_iter; ++iter) {
        vector<double> u_old = u;
        
        // --- MAP Estimation (Algorithm 4.1: Line 8-16) ---
        for (int step = 0; step < 2; ++step) { 
            for (int y = 0; y < h; ++y) {
                for (int x = 0; x < w; ++x) {
                    int i = get_idx(x, y);
                    double sum_u = 0.0, sum_v_u = 0.0;
                    int neighbors = 0;
                    if (x > 0) { int ni = get_idx(x - 1, y); sum_u += u[ni]; sum_v_u += (v[ni] - u[ni]); neighbors++; }
                    if (x < w - 1) { int ni = get_idx(x + 1, y); sum_u += u[ni]; sum_v_u += (v[ni] - u[ni]); neighbors++; }
                    if (y > 0) { int ni = get_idx(x, y - 1); sum_u += u[ni]; sum_v_u += (v[ni] - u[ni]); neighbors++; }
                    if (y < h - 1) { int ni = get_idx(x, y + 1); sum_u += u[ni]; sum_v_u += (v[ni] - u[ni]); neighbors++; }
                    
                    // u_i 更新則 (論文 Algorithm 4.1: Line 13)
                    double d_u = p.lambda + 1.0 / utils::safe_denom(p.sigma_sq) + p.alpha * neighbors; 
                    u[i] = (centered_noisy[i] / utils::safe_denom(p.sigma_sq) + p.gamma_sq * v[i] + p.alpha * sum_u) / utils::safe_denom(d_u);
                    
                    // v_i 更新則 (論文 Algorithm 4.1: Line 14)
                    double d_v = p.lambda + p.gamma_sq + p.alpha * neighbors;
                    v[i] = ((p.lambda + p.alpha * neighbors) * u[i] + p.alpha * sum_v_u) / utils::safe_denom(d_v);
                }
            }
        }

        // --- Bias Estimation (w) (Algorithm 4.1: Line 18-24) ---
        for (int step = 0; step < 2; ++step) {
            for (int y = 0; y < h; ++y) {
                for (int x = 0; x < w; ++x) {
                    int i = get_idx(x, y);
                    double sum_w = 0; int neighbors = 0;
                    if (x > 0) { sum_w += w_vec[get_idx(x-1, y)]; neighbors++; }
                    if (x < w - 1) { sum_w += w_vec[get_idx(x+1, y)]; neighbors++; }
                    if (y > 0) { sum_w += w_vec[get_idx(x, y-1)]; neighbors++; }
                    if (y < h - 1) { sum_w += w_vec[get_idx(x, y+1)]; neighbors++; }
                    w_vec[i] = (v[i] + p.alpha * sum_w) / utils::safe_denom(p.lambda + p.alpha * neighbors);
                }
            }
        }

        // --- Parameter Learning (MLE) (Algorithm 4.1: Line 28-32) ---
        double mse_u = 0;
        for (int i = 0; i < n; ++i) mse_u += pow(centered_noisy[i] - u[i], 2);

        double grad_l = 0, grad_a = 0, grad_g = 0, u_sq = 0, v_sq = 0, w_sq = 0, diff_u = 0, diff_w = 0, sum_inv_chi = 0;
        for (int i = 0; i < n; ++i) {
            u_sq += u[i] * u[i]; v_sq += v[i] * v[i]; w_sq += w_vec[i] * w_vec[i];
            int x = i % w, y = i / w;
            if (x < w - 1) { 
                diff_u += pow(u[i]-u[get_idx(x+1,y)], 2); 
                diff_w += pow(w_vec[i]-w_vec[get_idx(x+1,y)], 2); 
            }
            if (y < h - 1) { 
                diff_u += pow(u[i]-u[get_idx(x,y+1)], 2); 
                diff_w += pow(w_vec[i]-w_vec[get_idx(x,y+1)], 2); 
            }
            
            // 周辺尤度の微分項 (Appendix C: 式 C.13)
            double psi_h = pow(p.lambda + p.alpha * phi[i], 2) / utils::safe_denom(p.gamma_sq + p.lambda + p.alpha * phi[i]);
            double chi_h = 1.0 / utils::safe_denom(p.sigma_sq) + psi_h;
            double t1 = 2.0 / utils::safe_denom(p.lambda + p.alpha * phi[i]), t2 = 1.0 / utils::safe_denom(p.gamma_sq + p.lambda + p.alpha * phi[i]);
            double dt = t1 - t2;
            
            grad_l += (1.0 / utils::safe_denom(chi_h)) * dt;
            grad_g += (1.0 / utils::safe_denom(chi_h)) * (-t2);
            grad_a += (phi[i] / utils::safe_denom(chi_h)) * dt;
            sum_inv_chi += 1.0 / utils::safe_denom(chi_h);
        }
        
        // 勾配の集約 (Appendix C: 式 C.12)
        grad_l = -u_sq/(2.*n) + (p.gamma_sq*p.gamma_sq*w_sq)/(2.*n) + grad_l/(2.*n*utils::safe_denom(p.sigma_sq));
        grad_g = -v_sq/(2.*n) - grad_g/(2.*n*utils::safe_denom(p.sigma_sq));
        grad_a = -diff_u/(2.*n) + (p.gamma_sq*p.gamma_sq*diff_w)/(2.*n) + grad_a/(2.*n*utils::safe_denom(p.sigma_sq));

        p.lambda = max(1e-18, p.lambda + p.eta_lambda * grad_l);
        p.alpha = max(1e-18, p.alpha + p.eta_alpha * grad_a);
        p.gamma_sq = max(1e-18, p.gamma_sq + p.eta_gamma2 * grad_g);
        // sigma^2 更新則修正 (周辺尤度最大化の停留条件)
        p.sigma_sq = max(0.1, mse_u / n + sum_inv_chi / n); 

        // --- 周辺対数尤度の計算 (アルゴリズム 4.1: Line 25) ---
        double log_det_term = 0;
        for (int i = 0; i < n; ++i) {
            double psi_h = pow(p.lambda + p.alpha * phi[i], 2) / utils::safe_denom(p.gamma_sq + p.lambda + p.alpha * phi[i]);
            double chi_h = 1.0 / utils::safe_denom(p.sigma_sq) + psi_h;
            log_det_term += log(utils::safe_denom(psi_h)) - log(utils::safe_denom(chi_h));
        }
        double current_likelihood = 0.5 * log_det_term / n - 0.5 * log(2.0 * M_PI * utils::safe_denom(p.sigma_sq)) - mse_u / (2.0 * utils::safe_denom(p.sigma_sq) * n);

        if (p.verify_likelihood) {
            double actual_mse = 0;
            for (int i = 0; i < n; ++i) actual_mse += pow(original_data[i] - (u[i] + y_ave), 2);
            double actual_psnr = 10.0 * std::log10(255.0 * 255.0 / utils::safe_denom(actual_mse / n));

            printf("[MONITOR] Iter %3d: L=%.6f, alpha=%.3e, lambda=%.3e, gamma2=%.3e, sigma2=%.3f, PSNR=%.2f\n",
                   iter, current_likelihood, p.alpha, p.lambda, p.gamma_sq, p.sigma_sq, actual_psnr);
            if (iter > 1 && current_likelihood < prev_likelihood - 1e-10) {
                printf("  [VERIFY] Iteration %d: Likelihood decreased (diff: %.6e)\n", 
                       iter, current_likelihood - prev_likelihood);
            }
        }

        double mae = 0;
        for (int i = 0; i < n; ++i) mae += abs(u[i] - u_old[i]);

        report_progress(iter, current_likelihood, u, y_ave, "OPTIMIZING", on_step);

        // --- 尤度差分の移動平均によるピーク検出 (アルゴリズム 4.2) ---
        if (iter > 1) {
            diff_history.push_back(current_likelihood - prev_likelihood);
            if (diff_history.size() > 7) diff_history.erase(diff_history.begin());
        }
        prev_likelihood = current_likelihood;

        if (diff_history.size() == 7) {
            double current_ma = accumulate(diff_history.begin(), diff_history.end(), 0.0) / 7.0;
            // ピーク検出: 移動平均が減少に転じた瞬間
            if (iter > 7 && current_ma < prev_ma && prev_ma > -1e10) {
                report_progress(iter, current_likelihood, u, y_ave, "OPTIMAL PEAK FOUND (EARLY STOPPING)", on_step);
                break; 
            }
            prev_ma = current_ma;
        }

        if ((mae / n) < conv_epsilon) {
            report_progress(iter, current_likelihood, u, y_ave, "CONVERGED", on_step);
            break;
        }
    }
}

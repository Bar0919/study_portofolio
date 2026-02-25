#include "denoise_engine.hpp"
#include "../utils/core.hpp"
#include "../utils/numeric_guard.hpp"
#include <cmath>
#include <vector>
#include <numeric>
#include <algorithm>

// 論文 2.2: HGMRF 更新則 (学士論文ベース)
void DenoiseEngine::hgmrf(const HGMRFParams& p_in, std::function<void(const IterationResult&)> on_step) {
    HGMRFParams p = p_in;
    double conv_epsilon = 1.0e-3;
    
    // --- 1. 境界での中心化 ---
    std::vector<double> centered_noisy;
    double y_ave = prepare_work_data(centered_noisy);
    std::vector<double> u = centered_noisy, v = centered_noisy, w_vec = centered_noisy;

    // ベースライン評価
    report_progress(0, 0.0, u, y_ave, "INITIALIZING", on_step);

    std::vector<double> phi(n);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            phi[get_idx(x, y)] = 4.0 * std::pow(std::sin(M_PI * x / (2.0 * w)), 2.0) + 4.0 * std::pow(std::sin(M_PI * y / (2.0 * h)), 2.0);
        }
    }

    if (!p.is_learning) {
        for (int iter = 1; iter <= 100; ++iter) {
            std::vector<double> u_old = u;
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
            for (int i = 0; i < n; ++i) diff += std::abs(u[i] - u_old[i]);
            if ((diff / n) < conv_epsilon) break;
        }
        report_progress(p.max_iter, 0.0, u, y_ave, "CONVERGED", on_step);
        return;
    }

    double prev_likelihood = 0;
    std::vector<double> diff_history;
    double prev_ma = -1e18;
    std::vector<double> best_u(n);
    double best_psnr = -1.0;

    for (int iter = 1; iter <= p.max_iter; ++iter) {
        std::vector<double> u_old = u;
        // MAP推定
        report_progress(iter, 0.0, u, y_ave, "MAP OPTIMIZATION", on_step);
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
                    double d_u = p.lambda + 1.0 / utils::safe_denom(p.sigma_sq) + p.gamma_sq + p.alpha * neighbors;
                    u[i] = (centered_noisy[i] / utils::safe_denom(p.sigma_sq) + p.gamma_sq * v[i] + p.alpha * sum_u) / utils::safe_denom(d_u);
                    double d_v = p.lambda + p.gamma_sq + p.alpha * neighbors;
                    v[i] = ((p.lambda + p.alpha * neighbors) * u[i] + p.alpha * sum_v_u) / utils::safe_denom(d_v);
                }
            }
        }

        // Bias Estimation (w)
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

        // Parameter Learning
        report_progress(iter, 0.0, u, y_ave, "PARAMETER ESTIMATION", on_step);
        double mse_u = 0;
        for (int i = 0; i < n; ++i) mse_u += std::pow(centered_noisy[i] - u[i], 2);

        double grad_l = 0, grad_a = 0, grad_g = 0, u_sq = 0, v_sq = 0, w_sq = 0, diff_u = 0, diff_w = 0, sum_inv_chi = 0;
        for (int i = 0; i < n; ++i) {
            u_sq += u[i] * u[i]; v_sq += v[i] * v[i]; w_sq += w_vec[i] * w_vec[i];
            int x = i % w, y = i / w;
            if (x < w - 1) { diff_u += std::pow(u[i]-u[get_idx(x+1,y)], 2); diff_w += std::pow(w_vec[i]-w_vec[get_idx(x+1,y)], 2); }
            if (y < h - 1) { diff_u += std::pow(u[i]-u[get_idx(x,y+1)], 2); diff_w += std::pow(w_vec[i]-w_vec[get_idx(x,y+1)], 2); }
            double psi_h = std::pow(p.lambda + p.alpha * phi[i], 2) / utils::safe_denom(p.gamma_sq + p.lambda + p.alpha * phi[i]);
            double chi_h = 1.0 / utils::safe_denom(p.sigma_sq) + psi_h;
            double t1 = 2.0 / utils::safe_denom(p.lambda + p.alpha * phi[i]), t2 = 1.0 / utils::safe_denom(p.gamma_sq + p.lambda + p.alpha * phi[i]);
            double dt = t1 - t2;
            grad_l += (1.0 / utils::safe_denom(chi_h)) * dt;
            grad_g += (1.0 / utils::safe_denom(chi_h)) * (-t2);
            grad_a += (phi[i] / utils::safe_denom(chi_h)) * dt;
            sum_inv_chi += 1.0 / utils::safe_denom(chi_h);
        }
        grad_l = -u_sq/(2.*n) + (p.gamma_sq*p.gamma_sq*w_sq)/(2.*n) + grad_l/(2.*n*utils::safe_denom(p.sigma_sq));
        grad_g = -v_sq/(2.*n) + grad_g/(2.*n*utils::safe_denom(p.sigma_sq));
        grad_a = -diff_u/(2.*n) + (p.gamma_sq*diff_w)/(2.*n) + grad_a/(2.*n*utils::safe_denom(p.sigma_sq));

        p.lambda = std::max(1e-18, p.lambda + p.eta_lambda * grad_l);
        p.alpha = std::max(1e-18, p.alpha + p.eta_alpha * grad_a);
        p.gamma_sq = std::max(1e-18, p.gamma_sq + p.eta_gamma2 * grad_g);
        p.sigma_sq = std::max(0.1, mse_u / n + sum_inv_chi / n);

        // 真の周辺対数尤度の計算 (ピーク検出用)
        double log_det_term = 0;
        for (int i = 0; i < n; ++i) {
            double psi_h = std::pow(p.lambda + p.alpha * phi[i], 2) / utils::safe_denom(p.gamma_sq + p.lambda + p.alpha * phi[i]);
            double chi_h = 1.0 / utils::safe_denom(p.sigma_sq) + psi_h;
            log_det_term += std::log(utils::safe_denom(psi_h)) - std::log(utils::safe_denom(chi_h));
        }
        double current_likelihood = 0.5 * log_det_term / n - 0.5 * std::log(2.0 * M_PI * utils::safe_denom(p.sigma_sq)) - mse_u / (2.0 * utils::safe_denom(p.sigma_sq) * n);

        double mae = 0;
        for (int i = 0; i < n; ++i) mae += std::abs(u[i] - u_old[i]);

        if (iter % 10 == 0 || iter == p.max_iter || (mae / n) < conv_epsilon) {
            report_progress(iter, current_likelihood, u, y_ave, "STABLE", on_step);
            if ((mae / n) < conv_epsilon) break;
        }

        // ピーク検出
        if (iter > 1) {
            diff_history.push_back(current_likelihood - prev_likelihood);
            if (diff_history.size() > 7) diff_history.erase(diff_history.begin());
        }
        prev_likelihood = current_likelihood;

        if (diff_history.size() == 7) {
            double current_ma = std::accumulate(diff_history.begin(), diff_history.end(), 0.0) / 7.0;
            if (iter > 7 && current_ma < prev_ma && prev_ma > -1e10) {
                report_progress(iter, current_likelihood, u, y_ave, "OPTIMAL PEAK FOUND", on_step);
                break; 
            }
            prev_ma = current_ma;
        }
    }
}

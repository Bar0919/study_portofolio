#include "denoise_engine.hpp"
#include "../utils/core.hpp"
#include "../utils/numeric_guard.hpp"
#include <cmath>
#include <vector>
#include <numeric>
#include <algorithm>

// MALAサンプリング用の内部ヘルパー
namespace {
    double stable_log_cosh(double x) {
        double a = std::abs(x);
        return a + std::log1p(std::exp(-2.0 * a)) - 0.6931471805599453;
    }
    double calc_E_LC(const std::vector<double>& x, double lambda, double alpha, double s, int w, int h) {
        double energy = 0.0;
        for (int y = 0; y < h; ++y) {
            for (int dx = 0; dx < w; ++dx) {
                int i = y * w + dx;
                energy += (lambda / 2.0) * x[i] * x[i];
                if (dx < w - 1) energy += alpha * stable_log_cosh(s * (x[i] - x[i + 1]));
                if (y < h - 1) energy += alpha * stable_log_cosh(s * (x[i] - x[i + w]));
            }
        }
        return energy;
    }
    double calc_E_post(const std::vector<double>& x, const std::vector<double>& y_noisy, double lambda, double alpha, double sigma_sq, double s, int w, int h) {
        double energy = calc_E_LC(x, lambda, alpha, s, w, h);
        for (size_t i = 0; i < x.size(); ++i) energy += std::pow(y_noisy[i] - x[i], 2.0) / (2.0 * utils::safe_denom(sigma_sq));
        return energy;
    }
    void calc_grad_LC(const std::vector<double>& x, std::vector<double>& grad, double lambda, double alpha, double s, int w, int h) {
        for (int y = 0; y < h; ++y) {
            for (int dx = 0; dx < w; ++dx) {
                int i = y * w + dx;
                double sum_t = 0.0;
                if (dx > 0) sum_t += std::tanh(s * (x[i] - x[i - 1]));
                if (dx < w - 1) sum_t += std::tanh(s * (x[i] - x[i + 1]));
                if (y > 0) sum_t += std::tanh(s * (x[i] - x[i - w]));
                if (y < h - 1) sum_t += std::tanh(s * (x[i] - x[i + w]));
                grad[i] = lambda * x[i] + alpha * s * sum_t;
            }
        }
    }
    void calc_grad_post(const std::vector<double>& x, const std::vector<double>& y_n, std::vector<double>& grad, double l, double a, double s2, double s, int w, int h) {
        calc_grad_LC(x, grad, l, a, s, w, h);
        for (size_t i = 0; i < x.size(); ++i) grad[i] += -(y_n[i] - x[i]) / utils::safe_denom(s2);
    }
    double calc_log_Q(const std::vector<double>& to, const std::vector<double>& from, const std::vector<double>& g_from, double eps) {
        double norm_sq = 0.0;
        for (size_t i = 0; i < to.size(); ++i) {
            double diff = to[i] - from[i] + eps * g_from[i];
            norm_sq += diff * diff;
        }
        return -norm_sq / (4.0 * utils::safe_denom(eps));
    }
}

// 論文 4.1: LC-MRF 更新則 (修士論文ベース)
void DenoiseEngine::lc_mrf(const LCMRFParams& p_in, std::function<void(const IterationResult&)> on_step) {
    LCMRFParams p = p_in;
    double conv_epsilon = 1.0e-3;
    
    // --- 1. 境界での中心化 ---
    std::vector<double> centered_noisy;
    double y_ave = prepare_work_data(centered_noisy);
    std::vector<double> m = centered_noisy, p_s(n), q_s(n), grad(n), g_star(n), star(n);

    // ベースライン評価
    report_progress(0, 0.0, m, y_ave, "INITIALIZING", on_step);

    if (!p.is_learning) {
        for (int iter = 1; iter <= 100; ++iter) {
            std::vector<double> m_old = m;
            for (int step = 0; step < 2; ++step) {
                calc_grad_post(m, centered_noisy, grad, p.lambda, p.alpha, p.sigma_sq, p.s, w, h);
                for (int i = 0; i < n; ++i) m[i] -= p.epsilon_map * grad[i];
            }
            double diff = 0;
            for (int i = 0; i < n; ++i) diff += std::abs(m[i] - m_old[i]);
            if ((diff / n) < conv_epsilon) break;
        }
        report_progress(p.max_iter, 0.0, m, y_ave, "CONVERGED", on_step);
        return;
    }

    for (int iter = 1; iter <= p.max_iter; ++iter) {
        std::vector<double> m_old = m;
        // 1. MAP Optimization
        for (int step = 0; step < 2; ++step) {
            calc_grad_post(m, centered_noisy, grad, p.lambda, p.alpha, p.sigma_sq, p.s, w, h);
            for (int i = 0; i < n; ++i) m[i] -= p.epsilon_map * grad[i];
        }
        // MAP更新後に一度報告
        report_progress(iter, 0.0, m, y_ave, "MAP OPTIMIZATION", on_step);

        double exp_pri_sq = 0, exp_pri_lc = 0;
        double exp_post_sq = 0, exp_post_lc = 0, exp_post_mq = 0;

        // 2. Prior Sampling (MALA)
        // サンプリング開始を報告
        report_progress(iter, 0.0, m, y_ave, "MCMC PRIOR SAMPLING", on_step);
        for (int mu = 0; mu < p.n_pri; ++mu) {
            std::fill(p_s.begin(), p_s.end(), 0.0);
            for (int t = 0; t < p.t_hat_max; ++t) {
                calc_grad_LC(p_s, grad, p.lambda, p.alpha, p.s, w, h);
                for (int i = 0; i < n; ++i) {
                    double r = std::sqrt(-2.0 * std::log((rand()+1.0)/(RAND_MAX+2.0))) * std::cos(2.0*M_PI*(rand()+1.0)/(RAND_MAX+2.0));
                    star[i] = p_s[i] - p.epsilon_pri * grad[i] + std::sqrt(2.0 * p.epsilon_pri) * r;
                }
                calc_grad_LC(star, g_star, p.lambda, p.alpha, p.s, w, h);
                double log_a = -calc_E_LC(star, p.lambda, p.alpha, p.s, w, h) + calc_E_LC(p_s, p.lambda, p.alpha, p.s, w, h) + calc_log_Q(p_s, star, g_star, p.epsilon_pri) - calc_log_Q(star, p_s, grad, p.epsilon_pri);
                if (static_cast<double>(rand())/RAND_MAX <= std::exp(std::min(0.0, log_a))) p_s = star;
            }
            for (int i = 0; i < n; ++i) {
                exp_pri_sq += p_s[i] * p_s[i];
                int x = i % w, y = i / w;
                if (x < w - 1) exp_pri_lc += stable_log_cosh(p.s * (p_s[i] - p_s[i+1]));
                if (y < h - 1) exp_pri_lc += stable_log_cosh(p.s * (p_s[i] - p_s[i+w]));
            }
        }
        exp_pri_sq /= p.n_pri; exp_pri_lc /= p.n_pri;

        // 3. Posterior Sampling (MALA)
        report_progress(iter, 0.0, m, y_ave, "MCMC POSTERIOR SAMPLING", on_step);
        for (int mu = 0; mu < p.n_post; ++mu) {
            q_s = m;
            for (int t = 0; t < p.t_dot_max; ++t) {
                calc_grad_post(q_s, centered_noisy, grad, p.lambda, p.alpha, p.sigma_sq, p.s, w, h);
                for (int i = 0; i < n; ++i) {
                    double r = std::sqrt(-2.0 * std::log((rand()+1.0)/(RAND_MAX+2.0))) * std::cos(2.0*M_PI*(rand()+1.0)/(RAND_MAX+2.0));
                    star[i] = q_s[i] - p.epsilon_post * grad[i] + std::sqrt(2.0 * p.epsilon_post) * r;
                }
                calc_grad_post(star, g_star, centered_noisy, p.lambda, p.alpha, p.sigma_sq, p.s, w, h);
                double log_aq = -calc_E_post(star, centered_noisy, p.lambda, p.alpha, p.sigma_sq, p.s, w, h) + calc_E_post(q_s, centered_noisy, p.lambda, p.alpha, p.sigma_sq, p.s, w, h) + calc_log_Q(q_s, star, g_star, p.epsilon_post) - calc_log_Q(star, q_s, grad, p.epsilon_post);
                if (static_cast<double>(rand())/RAND_MAX <= std::exp(std::min(0.0, log_aq))) q_s = star;
            }
            for (int i = 0; i < n; ++i) {
                exp_post_sq += q_s[i] * q_s[i];
                exp_post_mq += std::pow(centered_noisy[i] - q_s[i], 2.0);
                int x = i % w, y = i / w;
                if (x < w - 1) exp_post_lc += stable_log_cosh(p.s * (q_s[i] - q_s[i+1]));
                if (y < h - 1) exp_post_lc += stable_log_cosh(p.s * (q_s[i] - q_s[i+w]));
            }
        }
        exp_post_sq /= p.n_post; exp_post_lc /= p.n_post; exp_post_mq /= p.n_post;

        // 4. Parameter Learning (MLE)
        report_progress(iter, 0.0, m, y_ave, "PARAMETER ESTIMATION", on_step);
        double grad_l = (exp_post_sq - exp_pri_sq) / (2.0 * n);
        double grad_a = (exp_post_lc - exp_pri_lc) / (2.0 * n);
        double grad_s2 = exp_post_mq / (2.0 * std::pow(p.sigma_sq, 2.0) * n) - 1.0 / (2.0 * utils::safe_denom(p.sigma_sq));

        if (std::isnan(grad_l) || std::isinf(grad_l)) grad_l = 0.0;
        if (std::isnan(grad_a) || std::isinf(grad_a)) grad_a = 0.0;
        if (std::isnan(grad_s2) || std::isinf(grad_s2)) grad_s2 = 0.0;

        p.lambda = std::max(1e-18, p.lambda + p.eta_lambda * grad_l);
        p.alpha = std::max(1e-18, p.alpha + p.eta_alpha * grad_a);
        p.sigma_sq = std::max(0.1, p.sigma_sq + p.eta_sigma2 * grad_s2);

        double mae = 0;
        for (int i = 0; i < n; ++i) mae += std::abs(m[i] - m_old[i]);

        if (iter % 10 == 0 || iter == p.max_iter || (mae / n) < conv_epsilon) {
            report_progress(iter, calc_E_post(m, centered_noisy, p.lambda, p.alpha, p.sigma_sq, p.s, w, h), m, y_ave, "STABLE", on_step);
            if ((mae / n) < conv_epsilon) break;
        }
    }
}

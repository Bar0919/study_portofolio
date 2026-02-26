#include "denoise_engine.hpp"
#include "../utils/core.hpp"
#include "../utils/numeric_guard.hpp"
#include <cmath>
#include <vector>
#include <numeric>
#include <algorithm>

void DenoiseEngine::rtv_mrf(const RTVMRFParams& p_in, std::function<void(const IterationResult&)> on_step) {
    RTVMRFParams p = p_in;
    double mu = p.alpha;
    double lambda_reg = 1.0; 
    double conv_epsilon = 1.0e-3;

    std::vector<double> centered_noisy;
    double y_ave = prepare_work_data(centered_noisy);
    std::vector<double> x_vec = centered_noisy;
    std::vector<double> d_x(n, 0.0), d_y(n, 0.0), b_x(n, 0.0), b_y(n, 0.0);

    report_progress(0, 0.0, x_vec, y_ave, "INITIALIZING", on_step);

    for (int iter = 1; iter <= p.max_iter; ++iter) {
        std::vector<double> x_old = x_vec;
        
        // 1. x-step (MAP Optimization)
        for (int step = 0; step < 2; ++step) {
            for (int y = 0; y < h; ++y) {
                for (int x = 0; x < w; ++x) {
                    int i = get_idx(x, y);
                    double nx = 0; int count = 0;
                    if (x > 0) { nx += x_vec[get_idx(x-1, y)] - d_x[get_idx(x-1, y)] + b_x[get_idx(x-1, y)]; count++; }
                    if (x < w - 1) { nx += x_vec[get_idx(x+1, y)] + d_x[i] - b_x[i]; count++; }
                    if (y > 0) { nx += x_vec[get_idx(x, y-1)] - d_y[get_idx(x, y-1)] + b_y[get_idx(x, y-1)]; count++; }
                    if (y < h - 1) { nx += x_vec[get_idx(x, y+1)] + d_y[i] - b_y[i]; count++; }
                    double denom = p.lambda + 1.0/utils::safe_denom(p.sigma_sq) + count * lambda_reg;
                    x_vec[i] = (centered_noisy[i]/utils::safe_denom(p.sigma_sq) + lambda_reg * nx) / utils::safe_denom(denom);
                }
            }
        }

        // 2. d-step (Shrinkage)
        for (int y = 0; y < h; ++y) {
            for (int x = 0; x < w; ++x) {
                int i = get_idx(x, y);
                if (x < w - 1) {
                    double diff = x_vec[i] - x_vec[get_idx(x+1, y)] + b_x[i];
                    double mag = std::abs(diff);
                    d_x[i] = std::max(mag - mu/lambda_reg, 0.0) * (diff / utils::safe_denom(mag));
                }
                if (y < h - 1) {
                    double diff = x_vec[i] - x_vec[get_idx(x, y+1)] + b_y[i];
                    double mag = std::abs(diff);
                    d_y[i] = std::max(mag - mu/lambda_reg, 0.0) * (diff / utils::safe_denom(mag));
                }
            }
        }

        // 3. b-step (Bregman Update)
        for (int i = 0; i < n; ++i) {
            int x = i % w, y = i / w;
            if (x < w - 1) b_x[i] += (x_vec[i] - x_vec[get_idx(x+1, y)] - d_x[i]);
            if (y < h - 1) b_y[i] += (x_vec[i] - x_vec[get_idx(x, y+1)] - d_y[i]);
        }

        double mae = 0;
        for (int i = 0; i < n; ++i) mae += std::abs(x_vec[i] - x_old[i]);

        report_progress(iter, 0.0, x_vec, y_ave, "OPTIMIZING", on_step);

        if ((mae / n) < conv_epsilon) {
            report_progress(iter, 0.0, x_vec, y_ave, "CONVERGED", on_step);
            break;
        }
    }
}

#ifndef DENOISE_ENGINE_HPP
#define DENOISE_ENGINE_HPP

#include <vector>
#include <string>
#include <functional>
#include <cstdint>
#include "../utils/core.hpp"

struct IterationResult {
    int iteration;
    double energy;
    double psnr;
    double ssim;
    std::string current_task;
};

struct GMRFParams {
    double lambda = 1.0e-7;
    double alpha = 1.0e-4;
    double sigma_sq = 1000.0;
    int max_iter = 50;
    bool is_learning = true;
    double eta_lambda = 1.0e-12;
    double eta_alpha = 5.0e-7;
};

struct HGMRFParams {
    double lambda = 1.0e-7;
    double alpha = 1.0e-4;
    double sigma_sq = 1000.0;
    double gamma_sq = 1.0e-3;
    int max_iter = 100;
    bool is_learning = true;
    double eta_lambda = 1.0e-12;
    double eta_alpha = 5.0e-8;
    double eta_gamma2 = 5.0e-8;
};

struct LCMRFParams {
    double lambda = 1.0e-7;
    double alpha = 5.0e-3;
    double sigma_sq = 10.0;
    double s = 30.0;
    int max_iter = 50;
    bool is_learning = true;
    double epsilon_map = 1.0;
    double epsilon_pri = 1.0e-4;
    double epsilon_post = 1.0e-4;
    double eta_lambda = 1.0e-14;
    double eta_alpha = 5.0e-8;
    double eta_sigma2 = 1.0;
    int n_pri = 5;
    int n_post = 5;
    int t_hat_max = 10;
    int t_dot_max = 10;
};

struct TVMRFParams {
    double lambda = 1.0e-7;
    double alpha = 0.5;
    double sigma_sq = 100.0;
    int max_iter = 50;
    bool is_learning = false;
};

class DenoiseEngine {
public:
    DenoiseEngine(int width, int height);
    void set_input(const uint8_t* original_arr, const uint8_t* noisy_arr, int size);
    
    // アルゴリズムのエントリポイント
    void gmrf(const GMRFParams& p, std::function<void(const IterationResult&)> on_step);
    void hgmrf(const HGMRFParams& p, std::function<void(const IterationResult&)> on_step);
    void lc_mrf(const LCMRFParams& p, std::function<void(const IterationResult&)> on_step);
    void tv_mrf(const TVMRFParams& p, std::function<void(const IterationResult&)> on_step);
    
    void get_output(uint8_t* out_data);
    void get_initial_ssim_heatmap(uint8_t* out_rgba);
    void get_ssim_heatmap(uint8_t* out_rgba);

protected:
    // 内部ユーティリティ：境界での中心化・解除を一括管理
    double prepare_work_data(std::vector<double>& centered_noisy);
    void report_progress(int iter, double energy, const std::vector<double>& centered_x, double y_ave, const std::string& task, std::function<void(const IterationResult&)> on_step);

    int w, h, n;
    std::vector<double> original_data, noisy_data, current_data, centered_original;
    int get_idx(int x, int y) const { return y * w + x; }
};

#endif

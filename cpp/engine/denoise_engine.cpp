#include "denoise_engine.hpp"
#include "../utils/core.hpp"
#include "../utils/numeric_guard.hpp"
#include <cmath>
#include <vector>
#include <numeric>
#include <algorithm>

namespace utils {
    double calculate_psnr(const std::vector<double>& orig, const std::vector<double>& denoise);
    double calculate_ssim(const std::vector<double>& img1, const std::vector<double>& img2);
    void generate_ssim_heatmap(const std::vector<double>& orig, const std::vector<double>& denoise, int width, int height, std::vector<uint8_t>& out_rgba);
}

DenoiseEngine::DenoiseEngine(int width, int height) : w(width), h(height), n(width * height) {
    original_data.resize(n);
    noisy_data.resize(n);
    current_data.resize(n);
}

void DenoiseEngine::set_input(const uint8_t* original_arr, const uint8_t* noisy_arr, int size) {
    for (int i = 0; i < n; ++i) {
        original_data[i] = static_cast<double>(original_arr[i]);
        noisy_data[i] = static_cast<double>(noisy_arr[i]);
    }
}

double DenoiseEngine::prepare_work_data(std::vector<double>& centered_noisy) {
    double y_ave = 0.0;
    for (int i = 0; i < n; ++i) y_ave += noisy_data[i];
    y_ave /= static_cast<double>(n);

    centered_noisy.resize(n);
    for (int i = 0; i < n; ++i) {
        centered_noisy[i] = noisy_data[i] - y_ave;
    }
    return y_ave;
}

void DenoiseEngine::report_progress(int iter, double energy, const std::vector<double>& centered_x, double y_ave, const std::string& task, std::function<void(const IterationResult&)> on_step) {
    // 【重要修正】SSIMは輝度の絶対値(0-255)に依存するため、必ず中心化を解除してから評価する
    std::vector<double> uncentered(n);
    for (int i = 0; i < n; ++i) {
        uncentered[i] = centered_x[i] + y_ave;
    }
    
    // 評価対象は常に 0-255 の物理的な画素値空間
    double psnr = utils::calculate_psnr(original_data, uncentered);
    double ssim = utils::calculate_ssim(original_data, uncentered);
    
    // 現在の状態をエンジンに同期（出力用）
    current_data = uncentered;
    
    on_step({iter, energy, psnr, ssim, task});
}

void DenoiseEngine::get_output(uint8_t* out_data) {
    for (int i = 0; i < n; ++i) {
        out_data[i] = utils::clamp_and_round(current_data[i]);
    }
}

void DenoiseEngine::get_initial_ssim_heatmap(uint8_t* out_rgba) {
    std::vector<uint8_t> temp_rgba;
    utils::generate_ssim_heatmap(original_data, noisy_data, w, h, temp_rgba);
    std::copy(temp_rgba.begin(), temp_rgba.end(), out_rgba);
}

void DenoiseEngine::get_ssim_heatmap(uint8_t* out_rgba) {
    std::vector<uint8_t> temp_rgba;
    utils::generate_ssim_heatmap(original_data, current_data, w, h, temp_rgba);
    std::copy(temp_rgba.begin(), temp_rgba.end(), out_rgba);
}

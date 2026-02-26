#include <iostream>
#include <vector>
#include <iomanip>
#include <functional>
#include <cmath>
#include <random>
#include "../cpp/engine/denoise_engine.hpp"

int main() {
    std::cout << "=== HGMRF vs GMRF Benchmarking (Noise sigma=5, Initial sigma2=1000) ===" << std::endl;
    
    int width = 256;
    int height = 256;
    int n = width * height;
    DenoiseEngine engine(width, height);
    
    // 指示通り ノイズ sigma = 5 (分散 25)
    double noise_sigma = 5.0;
    std::mt19937 gen(42); 
    std::normal_distribution<double> dist(0, noise_sigma);
    
    std::vector<uint8_t> original(n);
    std::vector<uint8_t> noisy(n);
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            int i = y * width + x;
            // 構造のある画像（階段状）
            double val = (x < width / 2) ? 100.0 : 200.0;
            original[i] = static_cast<uint8_t>(val);
            double noise = dist(gen);
            noisy[i] = static_cast<uint8_t>(std::max(0.0, std::min(255.0, std::round(val + noise))));
        }
    }
    
    engine.set_input(original.data(), noisy.data(), n);
    
    // 1. GMRF 実行
    std::cout << "\n[GMRF] Running with defaults..." << std::endl;
    GMRFParams gp; // sigma_sq 初期値 1000.0
    double gmrf_psnr = 0;
    engine.gmrf(gp, [&](const IterationResult& res) {
        gmrf_psnr = res.psnr;
    });
    std::cout << "GMRF Final PSNR: " << gmrf_psnr << " dB" << std::endl;

    // 2. HGMRF 実行
    std::cout << "\n[HGMRF] Running with defaults and monitoring..." << std::endl;
    HGMRFParams hp; // sigma_sq 初期値 1000.0
    hp.max_iter = 100;
    hp.is_learning = true;
    hp.verify_likelihood = true; // パラメータ推移を表示
    
    double hgmrf_psnr = 0;
    engine.hgmrf(hp, [&](const IterationResult& res) {
        hgmrf_psnr = res.psnr;
    });
    std::cout << "HGMRF Final PSNR: " << hgmrf_psnr << " dB" << std::endl;

    std::cout << "\nConclusion:" << std::endl;
    std::cout << "GMRF:  " << gmrf_psnr << " dB" << std::endl;
    std::cout << "HGMRF: " << hgmrf_psnr << " dB" << std::endl;
    if (hgmrf_psnr > gmrf_psnr) {
        std::cout << "SUCCESS: HGMRF outperformed GMRF by " << (hgmrf_psnr - gmrf_psnr) << " dB" << std::endl;
    }

    return 0;
}

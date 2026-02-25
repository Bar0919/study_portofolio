#include <vector>
#include <cmath>
#include <numeric>
#include <algorithm>
#include <cstdint>

namespace utils {

double calculate_psnr(const std::vector<double>& orig, const std::vector<double>& denoise) {
    double mse = 0;
    for (size_t i = 0; i < orig.size(); ++i) {
        double diff = orig[i] - denoise[i];
        mse += diff * diff;
    }
    mse /= orig.size();
    if (mse < 1e-10) return 100.0;
    return 10.0 * std::log10(255.0 * 255.0 / mse);
}

// 簡易版SSIM (Global SSIM for status update)
double calculate_ssim(const std::vector<double>& img1, const std::vector<double>& img2) {
    double c1 = 6.5025, c2 = 58.5225;
    double m1 = 0, m2 = 0, s1 = 0, s2 = 0, s12 = 0;
    int n = img1.size();

    for(int i=0; i<n; ++i) {
        m1 += img1[i];
        m2 += img2[i];
    }
    m1 /= n; m2 /= n;

    for(int i=0; i<n; ++i) {
        s1 += (img1[i] - m1) * (img1[i] - m1);
        s2 += (img2[i] - m2) * (img2[i] - m2);
        s12 += (img1[i] - m1) * (img2[i] - m2);
    }
    s1 /= (n - 1); s2 /= (n - 1); s12 /= (n - 1);

    double ssim = ((2 * m1 * m2 + c1) * (2 * s12 + c2)) / ((m1 * m1 + m2 * m2 + c1) * (s1 + s2 + c2));
    return ssim;
}

// 局所SSIMヒートマップの生成 (WasmからCanvasへ直接描画可能なRGBA配列を返す)
void generate_ssim_heatmap(const std::vector<double>& orig, const std::vector<double>& denoise, int width, int height, std::vector<uint8_t>& out_rgba) {
    if (out_rgba.size() != width * height * 4) {
        out_rgba.resize(width * height * 4);
    }
    
    int window_size = 11;
    int half_w = window_size / 2;
    double c1 = 6.5025, c2 = 58.5225;

    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            double m1 = 0, m2 = 0, s1 = 0, s2 = 0, s12 = 0;
            int count = 0;

            for (int wy = -half_w; wy <= half_w; ++wy) {
                for (int wx = -half_w; wx <= half_w; ++wx) {
                    int nx = std::clamp(x + wx, 0, width - 1);
                    int ny = std::clamp(y + wy, 0, height - 1);
                    int idx = ny * width + nx;
                    
                    m1 += orig[idx];
                    m2 += denoise[idx];
                    count++;
                }
            }
            m1 /= count; m2 /= count;

            for (int wy = -half_w; wy <= half_w; ++wy) {
                for (int wx = -half_w; wx <= half_w; ++wx) {
                    int nx = std::clamp(x + wx, 0, width - 1);
                    int ny = std::clamp(y + wy, 0, height - 1);
                    int idx = ny * width + nx;
                    
                    s1 += (orig[idx] - m1) * (orig[idx] - m1);
                    s2 += (denoise[idx] - m2) * (denoise[idx] - m2);
                    s12 += (orig[idx] - m1) * (denoise[idx] - m2);
                }
            }
            s1 /= (count - 1); s2 /= (count - 1); s12 /= (count - 1);

            double local_ssim = ((2 * m1 * m2 + c1) * (2 * s12 + c2)) / ((m1 * m1 + m2 * m2 + c1) * (s1 + s2 + c2));
            
            // 色変換: SSIM(1.0)=青(良い), SSIM(0.0以下)=赤(悪い)
            double val = std::clamp(local_ssim, 0.0, 1.0);
            uint8_t r = static_cast<uint8_t>(std::clamp(255.0 * (1.0 - val), 0.0, 255.0));
            uint8_t b = static_cast<uint8_t>(std::clamp(255.0 * val, 0.0, 255.0));
            
            int out_idx = (y * width + x) * 4;
            out_rgba[out_idx] = r;       // R
            out_rgba[out_idx + 1] = 0;   // G
            out_rgba[out_idx + 2] = b;   // B
            out_rgba[out_idx + 3] = 255; // Alpha (完全不透明にして明度を統一)
        }
    }
}

} // namespace utils

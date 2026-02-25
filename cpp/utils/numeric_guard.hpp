#ifndef NUMERIC_GUARD_HPP
#define NUMERIC_GUARD_HPP

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>
#include <stdexcept>

namespace utils {

// 入出力時のクリッピングと整数丸め
inline uint8_t clamp_and_round(double val) {
    return static_cast<uint8_t>(std::round(std::clamp(val, 0.0, 255.0)));
}

// 整数部ズレ検知（Integrity Check）
inline void check_integrity(const std::vector<uint8_t>& original, const std::vector<double>& converted) {
    if (original.size() != converted.size()) {
        throw std::runtime_error("Size mismatch during integrity check.");
    }
    for (size_t i = 0; i < original.size(); ++i) {
        // 処理前の転送テスト用：整数部分が1でも異なればエラー
        if (original[i] != static_cast<uint8_t>(std::round(converted[i]))) {
            throw std::runtime_error("Numerical integrity violation: Integer part changed during data transfer.");
        }
    }
}

} // namespace utils

#endif

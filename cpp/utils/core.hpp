#ifndef CORE_HPP
#define CORE_HPP

#include <algorithm>
#include <cmath>
#include <vector>
#include <cstdint>

namespace utils {

// 0除算回避用の微小値
constexpr double EPSILON = 1e-10;

// 安全な除算のための分母クリッピング
inline double safe_denom(double val) {
    if (std::signbit(val)) {
        return std::min(val, -EPSILON);
    } else {
        return std::max(val, EPSILON);
    }
}

// 中心化解除（共通ユーティリティ）
inline void uncenter(std::vector<double>& data, double ave) {
    for (auto& val : data) val += ave;
}

} // namespace utils

#endif

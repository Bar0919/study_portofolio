#include <iostream>
#include <vector>
#include <cassert>
#include <cmath>
#include <cstdint>
#include "../cpp/engine/denoise_engine.hpp"
#include "../cpp/utils/numeric_guard.hpp"
#include "../cpp/utils/core.hpp"

namespace utils {
    double calculate_psnr(const std::vector<double>& orig, const std::vector<double>& denoise);
}

void test_numeric_integrity() {
    std::cout << "Testing Numeric Integrity... ";
    for (int i = 0; i <= 255; ++i) {
        double d = static_cast<double>(i);
        uint8_t rounded = utils::clamp_and_round(d);
        if (rounded != i) {
            std::cerr << "FAILED at " << i << " (got " << (int)rounded << ")" << std::endl;
            exit(1);
        }
    }
    std::cout << "PASSED" << std::endl;
}

void test_safe_denom() {
    std::cout << "Testing 0-Division Avoidance... ";
    assert(utils::safe_denom(0.0) >= 1e-10);
    assert(utils::safe_denom(0.000000000001) >= 1e-10);
    assert(utils::safe_denom(-0.0) <= -1e-10);
    std::cout << "PASSED" << std::endl;
}

void test_metrics() {
    std::cout << "Testing PSNR Calculation... ";
    std::vector<double> img1 = {100.0, 150.0};
    std::vector<double> img2 = {100.0, 150.0};
    double psnr_perfect = utils::calculate_psnr(img1, img2);
    assert(psnr_perfect == 100.0);

    std::vector<double> img3 = {100.0, 150.0};
    std::vector<double> img4 = {110.0, 140.0}; 
    double psnr = utils::calculate_psnr(img3, img4);
    assert(std::abs(psnr - 28.13) < 0.1);
    std::cout << "PASSED" << std::endl;
}

void test_algorithm_run() {
    std::cout << "Testing Algorithm Execution (GMRF)... ";
    DenoiseEngine engine(2, 2);
    std::vector<uint8_t> input = {100, 110, 120, 130};
    engine.set_input(input.data(), input.size());
    
    Params p;
    p.max_iter = 1;
    p.alpha = 0.1;
    p.sigma_sq = 10.0;
    
    bool called = false;
    engine.gmrf(p, [&](const IterationResult& res) {
        called = true;
    });
    
    assert(called);
    std::cout << "PASSED (Completed)" << std::endl;
}

int main() {
    try {
        test_numeric_integrity();
        test_safe_denom();
        test_metrics();
        test_algorithm_run();
        std::cout << "\nALL TESTS PASSED SUCCESSFULLY!" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "\nTEST FAILED with exception: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}

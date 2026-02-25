#include <iostream>
#include <vector>
#include <iomanip>
#include <functional>
#include "../cpp/engine/denoise_engine.hpp"

void run_test(const std::string& name, std::function<void(DenoiseEngine&)> test_fn) {
    std::cout << "\n=== Testing " << name << " ===" << std::endl;
    DenoiseEngine engine(4, 4);
    std::vector<uint8_t> original(16, 100);
    std::vector<uint8_t> noisy(16, 110);
    engine.set_input(original.data(), noisy.data(), 16);
    
    try {
        test_fn(engine);
        std::cout << name << ": PASSED" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << name << ": FAILED with exception: " << e.what() << std::endl;
    }
}

int main() {
    run_test("GMRF", [](DenoiseEngine& engine) {
        GMRFParams p; p.max_iter = 1; p.is_learning = true;
        engine.gmrf(p, [](const IterationResult& res) {
            std::cout << "  Iter " << res.iteration << ": PSNR=" << res.psnr << std::endl;
        });
    });

    run_test("HGMRF", [](DenoiseEngine& engine) {
        HGMRFParams p; p.max_iter = 1; p.is_learning = true;
        engine.hgmrf(p, [](const IterationResult& res) {
            std::cout << "  Iter " << res.iteration << ": PSNR=" << res.psnr << std::endl;
        });
    });

    run_test("LC-MRF", [](DenoiseEngine& engine) {
        LCMRFParams p; p.max_iter = 1; p.is_learning = true;
        p.n_pri = 1; p.n_post = 1;
        engine.lc_mrf(p, [](const IterationResult& res) {
            std::cout << "  Iter " << res.iteration << ": PSNR=" << res.psnr << std::endl;
        });
    });

    run_test("TV-MRF", [](DenoiseEngine& engine) {
        TVMRFParams p; p.max_iter = 1; p.is_learning = false;
        engine.tv_mrf(p, [](const IterationResult& res) {
            std::cout << "  Iter " << res.iteration << ": PSNR=" << res.psnr << std::endl;
        });
    });

    std::cout << "\nALL MODEL TESTS COMPLETED." << std::endl;
    return 0;
}

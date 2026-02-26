#include <iostream>
#include <vector>
#include <iomanip>
#include <functional>
#include <cmath>
#include <cstdlib>
#include "../cpp/engine/denoise_engine.hpp"

int main() {
    std::cout << "=== HGMRF Likelihood Increase Verification ===" << std::endl;
    
    int width = 32;
    int height = 32;
    int n = width * height;
    DenoiseEngine engine(width, height);
    
    // Create some synthetic data
    std::vector<uint8_t> original(n);
    std::vector<uint8_t> noisy(n);
    for (int i = 0; i < n; ++i) {
        original[i] = 128 + 30 * std::sin(i * 0.1);
        noisy[i] = original[i] + (std::rand() % 41 - 20); // Add noise
    }
    
    engine.set_input(original.data(), noisy.data(), n);
    
    HGMRFParams p;
    p.max_iter = 50;
    p.is_learning = true;
    
    double last_likelihood = -1e30;
    bool always_increasing = true;
    int decrease_count = 0;

    engine.hgmrf(p, [&](const IterationResult& res) {
        if (res.iteration > 0 && res.current_task == "OPTIMIZING") {
            if (last_likelihood > -1e29) { // Skip first iteration check
                if (res.energy < last_likelihood) {
                    // Allow very small numerical fluctuations
                    if (last_likelihood - res.energy > 1e-10) {
                        std::cout << "Iter " << res.iteration 
                                  << ": Likelihood = " << std::fixed << std::setprecision(6) << res.energy 
                                  << " (DECREASED by " << (last_likelihood - res.energy) << ")" << std::endl;
                        always_increasing = false;
                        decrease_count++;
                    } else {
                         std::cout << "Iter " << res.iteration 
                                  << ": Likelihood = " << std::fixed << std::setprecision(6) << res.energy << std::endl;
                    }
                } else {
                    std::cout << "Iter " << res.iteration 
                              << ": Likelihood = " << std::fixed << std::setprecision(6) << res.energy << std::endl;
                }
            } else {
                std::cout << "Iter " << res.iteration 
                          << ": Likelihood = " << std::fixed << std::setprecision(6) << res.energy << std::endl;
            }
            last_likelihood = res.energy;
        }
    });

    if (always_increasing) {
        std::cout << "\nSUCCESS: Likelihood was monotonically increasing." << std::endl;
    } else {
        std::cout << "\nRESULT: Likelihood decreased " << decrease_count << " times." << std::endl;
    }

    return 0;
}

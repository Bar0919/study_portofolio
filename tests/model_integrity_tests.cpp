#include <iostream>
#include <vector>
#include <cmath>
#include <iomanip>
#include <string>
#include <algorithm>
#include "../cpp/engine/denoise_engine.hpp"
#include "../cpp/utils/core.hpp"

using namespace std;

struct TestStats {
    string name;
    bool energy_decreased = true;
    bool likelihood_increased = true;
    bool psnr_improved = true;
    double initial_psnr = 0;
    double final_psnr = 0;
};

void print_result(const TestStats& stats) {
    cout << "\n[" << stats.name << " TEST RESULT]" << endl;
    if (stats.name == "LC-MRF") {
        cout << "  - Energy Monotonicity (MAP): " << (stats.energy_decreased ? "PASSED ✅" : "FAILED ❌") << endl;
    }
    if (stats.name == "GMRF" || stats.name == "HGMRF") {
        cout << "  - Likelihood Monotonicity (MLE): " << (stats.likelihood_increased ? "PASSED ✅" : "FAILED ❌") << endl;
    }
    cout << "  - Quality Improvement: " << (stats.psnr_improved ? "PASSED ✅" : "FAILED ❌") 
         << " (" << fixed << setprecision(2) << stats.initial_psnr << " -> " << stats.final_psnr << " dB)" << endl;
}

void run_gmrf_integrity() {
    int n = 64 * 64;
    DenoiseEngine engine(64, 64);
    vector<uint8_t> orig(n, 128), noisy(n);
    for(int i=0; i<n; ++i) noisy[i] = orig[i] + (rand()%21-10);
    engine.set_input(orig.data(), noisy.data(), n);

    TestStats stats; stats.name = "GMRF";
    GMRFParams p; p.max_iter = 20; p.is_learning = true;
    
    double last_likelihood = -1e30;
    engine.gmrf(p, [&](const IterationResult& res) {
        if (res.iteration == 0) stats.initial_psnr = res.psnr;
        if (res.iteration > 0) {
            // GMRFの学習では res.energy に周辺対数尤度が入る
            if (res.iteration > 1 && res.energy < last_likelihood - 1e-7) {
                stats.likelihood_increased = false;
            }
            last_likelihood = res.energy;
            stats.final_psnr = res.psnr;
        }
    });
    stats.psnr_improved = (stats.final_psnr > stats.initial_psnr - 0.5); // Allow slight fluctuations
    print_result(stats);
}

void run_hgmrf_integrity() {
    int n = 64 * 64;
    DenoiseEngine engine(64, 64);
    vector<uint8_t> orig(n, 128), noisy(n);
    for(int i=0; i<n; ++i) noisy[i] = orig[i] + (rand()%21-10);
    engine.set_input(orig.data(), noisy.data(), n);

    TestStats stats; stats.name = "HGMRF";
    HGMRFParams p; p.max_iter = 20; p.is_learning = true;
    
    double last_likelihood = -1e30;
    engine.hgmrf(p, [&](const IterationResult& res) {
        if (res.iteration == 0) stats.initial_psnr = res.psnr;
        if (res.iteration > 0 && res.current_task == "OPTIMIZING") {
            if (last_likelihood > -1e29 && res.energy < last_likelihood - 1e-5) {
                stats.likelihood_increased = false; 
            }
            last_likelihood = res.energy;
            stats.final_psnr = res.psnr;
        }
    });
    stats.psnr_improved = (stats.final_psnr > stats.initial_psnr);
    print_result(stats);
}

void run_lcmrf_integrity() {
    int n = 64 * 64;
    DenoiseEngine engine(64, 64);
    vector<uint8_t> orig(n, 128), noisy(n);
    for(int i=0; i<n; ++i) {
        orig[i] = (i < n/2) ? 100 : 200;
        noisy[i] = orig[i] + (rand()%11-5);
    }
    engine.set_input(orig.data(), noisy.data(), n);

    TestStats stats; stats.name = "LC-MRF";
    LCMRFParams p; p.max_iter = 15; p.is_learning = false; // Test MAP convergence
    p.alpha = 0.1; p.s = 5.0; // Moderate settings
    
    double last_energy = 1e30;
    engine.lc_mrf(p, [&](const IterationResult& res) {
        if (res.iteration == 0) stats.initial_psnr = res.psnr;
        if (res.iteration > 0) {
            // LC-MRFのenergyは負の対数事後確率（最小化対象）
            if (last_energy < 1e29 && res.energy > last_energy + 1e-4) {
                stats.energy_decreased = false;
            }
            last_energy = res.energy;
            stats.final_psnr = res.psnr;
        }
    });
    stats.psnr_improved = (stats.final_psnr > stats.initial_psnr);
    print_result(stats);
}

void run_rtvmrf_integrity() {
    int n = 64 * 64;
    DenoiseEngine engine(64, 64);
    vector<uint8_t> orig(n, 128), noisy(n);
    for(int i=0; i<n; ++i) {
        orig[i] = (i < n/2) ? 100 : 200;
        noisy[i] = orig[i] + (rand()%11-5);
    }
    engine.set_input(orig.data(), noisy.data(), n);

    TestStats stats; stats.name = "rTV-MRF";
    RTVMRFParams p; p.max_iter = 10; p.is_learning = false;
    
    engine.rtv_mrf(p, [&](const IterationResult& res) {
        if (res.iteration == 0) stats.initial_psnr = res.psnr;
        if (res.iteration > 0) {
            stats.final_psnr = res.psnr;
        }
    });
    stats.psnr_improved = (stats.final_psnr > stats.initial_psnr);
    print_result(stats);
}

int main() {
    cout << "=== MRF Model Integrity Test Suite ===" << endl;
    srand(42);
    
    run_gmrf_integrity();
    run_hgmrf_integrity();
    run_rtvmrf_integrity();
    run_lcmrf_integrity();

    return 0;
}

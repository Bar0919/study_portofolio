#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "engine/denoise_engine.hpp"
#include "utils/numeric_guard.hpp"

using namespace emscripten;

class WasmEngine {
public:
    WasmEngine(int w, int h) : engine(w, h), width(w), height(h) {}
    void setInput(val original_arr, val noisy_arr) {
        auto orig_vec = vecFromJSArray<uint8_t>(original_arr);
        auto noisy_vec = vecFromJSArray<uint8_t>(noisy_arr);
        engine.set_input(orig_vec.data(), noisy_vec.data(), orig_vec.size());
    }
    val getOutput() {
        if (output_buffer.size() != width * height) output_buffer.resize(width * height);
        engine.get_output(output_buffer.data());
        return val(typed_memory_view(output_buffer.size(), output_buffer.data()));
    }
    val getInitialSSIMHeatmap() {
        if (initial_heatmap_buffer.size() != width * height * 4) initial_heatmap_buffer.resize(width * height * 4);
        engine.get_initial_ssim_heatmap(initial_heatmap_buffer.data());
        return val(typed_memory_view(initial_heatmap_buffer.size(), initial_heatmap_buffer.data()));
    }
    val getSSIMHeatmap() {
        if (heatmap_buffer.size() != width * height * 4) heatmap_buffer.resize(width * height * 4);
        engine.get_ssim_heatmap(heatmap_buffer.data());
        return val(typed_memory_view(heatmap_buffer.size(), heatmap_buffer.data()));
    }
    void runGMRF(GMRFParams p, val onStep) {
        engine.gmrf(p, [&](const IterationResult& res) { onStep(res.iteration, res.energy, res.psnr, res.ssim); });
    }
    void runLCMRF(LCMRFParams p, val onStep) {
        engine.lc_mrf(p, [&](const IterationResult& res) { onStep(res.iteration, res.energy, res.psnr, res.ssim); });
    }
    void runHGMRF(HGMRFParams p, val onStep) {
        engine.hgmrf(p, [&](const IterationResult& res) { onStep(res.iteration, res.energy, res.psnr, res.ssim); });
    }
    void runTVMRF(TVMRFParams p, val onStep) {
        engine.tv_mrf(p, [&](const IterationResult& res) { onStep(res.iteration, res.energy, res.psnr, res.ssim); });
    }
private:
    DenoiseEngine engine;
    int width, height;
    std::vector<uint8_t> output_buffer, heatmap_buffer, initial_heatmap_buffer;
};

EMSCRIPTEN_BINDINGS(my_module) {
    value_object<GMRFParams>("GMRFParams")
        .field("lambda", &GMRFParams::lambda).field("alpha", &GMRFParams::alpha)
        .field("sigma_sq", &GMRFParams::sigma_sq).field("max_iter", &GMRFParams::max_iter)
        .field("is_learning", &GMRFParams::is_learning).field("eta_lambda", &GMRFParams::eta_lambda)
        .field("eta_alpha", &GMRFParams::eta_alpha);

    value_object<HGMRFParams>("HGMRFParams")
        .field("lambda", &HGMRFParams::lambda).field("alpha", &HGMRFParams::alpha)
        .field("sigma_sq", &HGMRFParams::sigma_sq).field("gamma_sq", &HGMRFParams::gamma_sq)
        .field("max_iter", &HGMRFParams::max_iter).field("is_learning", &HGMRFParams::is_learning)
        .field("eta_lambda", &HGMRFParams::eta_lambda).field("eta_alpha", &HGMRFParams::eta_alpha)
        .field("eta_gamma2", &HGMRFParams::eta_gamma2);

    value_object<LCMRFParams>("LCMRFParams")
        .field("lambda", &LCMRFParams::lambda).field("alpha", &LCMRFParams::alpha)
        .field("sigma_sq", &LCMRFParams::sigma_sq).field("s", &LCMRFParams::s)
        .field("max_iter", &LCMRFParams::max_iter).field("is_learning", &LCMRFParams::is_learning)
        .field("epsilon_map", &LCMRFParams::epsilon_map).field("epsilon_pri", &LCMRFParams::epsilon_pri)
        .field("epsilon_post", &LCMRFParams::epsilon_post).field("eta_lambda", &LCMRFParams::eta_lambda)
        .field("eta_alpha", &LCMRFParams::eta_alpha).field("eta_sigma2", &LCMRFParams::eta_sigma2)
        .field("n_pri", &LCMRFParams::n_pri).field("n_post", &LCMRFParams::n_post)
        .field("t_hat_max", &LCMRFParams::t_hat_max).field("t_dot_max", &LCMRFParams::t_dot_max);

    value_object<TVMRFParams>("TVMRFParams")
        .field("lambda", &TVMRFParams::lambda).field("alpha", &TVMRFParams::alpha)
        .field("sigma_sq", &TVMRFParams::sigma_sq).field("max_iter", &TVMRFParams::max_iter)
        .field("is_learning", &TVMRFParams::is_learning);

    class_<WasmEngine>("WasmEngine")
        .constructor<int, int>()
        .function("setInput", &WasmEngine::setInput)
        .function("getOutput", &WasmEngine::getOutput)
        .function("runGMRF", &WasmEngine::runGMRF)
        .function("runLCMRF", &WasmEngine::runLCMRF)
        .function("runHGMRF", &WasmEngine::runHGMRF)
        .function("runTVMRF", &WasmEngine::runTVMRF)
        .function("getSSIMHeatmap", &WasmEngine::getSSIMHeatmap)
        .function("getInitialSSIMHeatmap", &WasmEngine::getInitialSSIMHeatmap);
}

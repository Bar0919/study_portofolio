import createModule from '../wasm/denoise_module.js';

let wasmModule: any = null;
let engine: any = null;
let isAborted = false;

const initWasm = async () => {
  if (!wasmModule) {
    wasmModule = await createModule();
  }
};

self.onmessage = async (e) => {
  const { type, data } = e.data;

  try {
    if (type === 'abort') {
      isAborted = true;
      return;
    }

    if (type === 'init') {
      await initWasm();
      const { width, height } = data;
      if (engine) engine.delete();
      engine = new wasmModule.WasmEngine(width, height);
      self.postMessage({ type: 'initialized' });
    }

    if (type === 'run') {
      isAborted = false;
      const { algorithm, params, originalImage, noisyImage } = data;
      
      engine.setInput(originalImage, noisyImage);

      // 初期状態のヒートマップを即座に送信
      const initialHeatmapData = new Uint8Array(engine.getInitialSSIMHeatmap());
      self.postMessage({ type: 'initial_heatmap', heatmap: initialHeatmapData }, [initialHeatmapData.buffer] as any);

      let finalPsnr = 0;
      let finalSsim = 0;
      let globalStep = 0; // X軸用の連続ステップ数
      const startTime = performance.now();

      const onStep = (iter: number, energy: number, psnr: number, ssim: number, task: string) => {
        if (isAborted) throw new Error('ABORTED');
        finalPsnr = psnr;
        finalSsim = ssim;
        globalStep++;
        
        if (data.mode === 'single') {
          const resultView = engine.getOutput();
          const resultCopy = new Uint8Array(resultView);
          self.postMessage({ 
            type: 'progress', 
            data: { iteration: iter, step: globalStep, energy, psnr, ssim, task },
            image: resultCopy 
          }, [resultCopy.buffer] as any);
        } else {
          self.postMessage({ 
            type: 'progress', 
            data: { iteration: iter, step: globalStep, energy, psnr, ssim, task }
          });
        }
      };

      try {
        if (algorithm === 'GMRF') {
          engine.runGMRF(params, onStep);
        } else if (algorithm === 'LC-MRF') {
          engine.runLCMRF(params, onStep);
        } else if (algorithm === 'HGMRF') {
          engine.runHGMRF(params, onStep);
        } else if (algorithm === 'rTV-MRF') {
          engine.runRTVMRF(params, onStep);
        }
      } catch (e: any) {
        if (e.message === 'ABORTED') {
          self.postMessage({ type: 'aborted' });
          return;
        }
        throw e;
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const resultCopy = new Uint8Array(engine.getOutput());
      const initialHeatmapCopy = new Uint8Array(engine.getInitialSSIMHeatmap());
      const heatmapCopy = new Uint8Array(engine.getSSIMHeatmap());
      
      (self.postMessage as any)({ 
          type: 'done', 
          algorithm: algorithm,
          finalPsnr: finalPsnr,
          finalSsim: finalSsim,
          executionTime: executionTime,
          data: resultCopy, 
          initialHeatmap: initialHeatmapCopy, 
          heatmap: heatmapCopy 
      }, [resultCopy.buffer, initialHeatmapCopy.buffer, heatmapCopy.buffer]);
    }
  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message });
  }
};

import {
  AutoConfig,
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';

const MODEL = 'onnx-community/embeddinggemma-2-ONNX';
const REVISION = 'daa72c51243991dfcaf9f9137d2c573d8f7790c0';
const MAX_TOKENS = 2560;
env.allowLocalModels = false;
let loaded;

const progress = (message) => {
  self.postMessage({progress: message});
};

const load = async () => {
  if (!navigator.gpu || !(await navigator.gpu.requestAdapter())) {
    throw new Error('WebGPU is unavailable');
  }
  progress('Loading browser model…');
  const downloads = new Map();
  const options = {
    revision: REVISION,
    progress_callback: (event) => {
      if (event.status !== 'progress') return;
      downloads.set(event.file, event);
      const entries = [...downloads.values()];
      const loaded = entries.reduce((sum, item) => sum + item.loaded, 0) / 1048576;
      const total = entries.reduce((sum, item) => sum + item.total, 0) / 1048576;
      progress(`Loading browser model (${loaded.toFixed(0)} / ${total.toFixed(0)} MB)…`);
    },
  };
  const config = await AutoConfig.from_pretrained(MODEL, options);
  config.audio_config = null;
  const processor = await AutoProcessor.from_pretrained(MODEL, options);
  const model = await AutoModel.from_pretrained(MODEL, {
    ...options,
    config,
    device: 'webgpu',
    dtype: 'q8',
  });
  return {processor, model};
};

const image = async (src) => {
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Could not read the image: ${response.status}`);
  }
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    return RawImage.fromCanvas(canvas);
  } finally {
    bitmap.close();
  }
};

self.onmessage = async ({data}) => {
  try {
    loaded ??= load();
    const {processor, model} = await loaded;
    progress('Embedding in browser…');
    const inputs =
      data.kind === 'text'
        ? await processor(`task: search result | query: ${data.text}`, null, null, null, {
          truncation: true,
          max_length: MAX_TOKENS,
        })
        : await processor(null, await image(data.src));
    const output = await model(inputs);
    try {
      self.postMessage({vector: Array.from(output.sentence_embedding.data)});
    } finally {
      for (const tensor of Object.values(output)) tensor.dispose();
    }
  } catch (error) {
    self.postMessage({error: error.message});
  }
};

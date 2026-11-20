(function (factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.HanseoHand = api;
})(function () {
  const HEIGHT = 32;
  let model = null;

  function load(meta, buffer) {
    const weights = buffer instanceof Float32Array ? buffer : new Float32Array(buffer);
    let offset = 0;
    const tensors = {};
    meta.tensors.forEach((spec) => {
      const size = spec.shape.reduce((total, dim) => total * dim, 1);
      tensors[spec.name] = { shape: spec.shape, data: weights.subarray(offset, offset + size) };
      offset += size;
    });
    model = { meta, tensors };
  }

  async function prepare() {
    if (model) return model;
    const meta = await fetch("vendor/hand/model.json", { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error("hand model");
      return res.json();
    });
    const buffer = await fetch("vendor/hand/weights.bin", { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error("hand weights");
      return res.arrayBuffer();
    });
    load(meta, buffer);
    return model;
  }

  function conv(input, weight, bias, padY, padX) {
    const [outC, inC, kH, kW] = weight.shape;
    const data = new Float32Array(outC * input.h * input.w);
    const w = weight.data;
    const b = bias.data;
    for (let oc = 0; oc < outC; oc += 1) {
      for (let y = 0; y < input.h; y += 1) {
        for (let x = 0; x < input.w; x += 1) {
          let sum = b[oc];
          for (let ic = 0; ic < inC; ic += 1) {
            for (let ky = 0; ky < kH; ky += 1) {
              const iy = y + ky - padY;
              if (iy < 0 || iy >= input.h) continue;
              for (let kx = 0; kx < kW; kx += 1) {
                const ix = x + kx - padX;
                if (ix < 0 || ix >= input.w) continue;
                const iv = input.data[(ic * input.h + iy) * input.w + ix];
                const wv = w[(((oc * inC + ic) * kH + ky) * kW) + kx];
                sum += iv * wv;
              }
            }
          }
          data[(oc * input.h + y) * input.w + x] = sum;
        }
      }
    }
    return { c: outC, h: input.h, w: input.w, data };
  }

  function relu(input) {
    const data = new Float32Array(input.data.length);
    for (let i = 0; i < data.length; i += 1) data[i] = input.data[i] > 0 ? input.data[i] : 0;
    return { c: input.c, h: input.h, w: input.w, data };
  }

  function pool(input, kH, kW) {
    const outH = Math.floor(input.h / kH);
    const outW = Math.floor(input.w / kW);
    const data = new Float32Array(input.c * outH * outW);
    for (let ic = 0; ic < input.c; ic += 1) {
      for (let y = 0; y < outH; y += 1) {
        for (let x = 0; x < outW; x += 1) {
          let best = -Infinity;
          for (let ky = 0; ky < kH; ky += 1) {
            for (let kx = 0; kx < kW; kx += 1) {
              const value = input.data[(ic * input.h + y * kH + ky) * input.w + x * kW + kx];
              if (value > best) best = value;
            }
          }
          data[(ic * outH + y) * outW + x] = best;
        }
      }
    }
    return { c: input.c, h: outH, w: outW, data };
  }

  function linear(vector, weight, bias) {
    const [outC, inC] = weight.shape;
    const result = new Float32Array(outC);
    for (let o = 0; o < outC; o += 1) {
      let sum = bias.data[o];
      const row = o * inC;
      for (let i = 0; i < inC; i += 1) sum += weight.data[row + i] * vector[i];
      result[o] = sum;
    }
    return result;
  }

  function forward(input, width) {
    const spec = [
      ["conv", "conv.0.weight", "conv.0.bias", 1, 1],
      ["relu"],
      ["pool", 2, 2],
      ["conv", "conv.3.weight", "conv.3.bias", 1, 1],
      ["relu"],
      ["pool", 2, 2],
      ["conv", "conv.6.weight", "conv.6.bias", 1, 2],
      ["relu"],
      ["pool", 8, 1],
    ];
    let current = { c: 1, h: HEIGHT, w: width, data: input };
    spec.forEach((step) => {
      if (step[0] === "relu") current = relu(current);
      else if (step[0] === "pool") current = pool(current, step[1], step[2]);
      else current = conv(current, model.tensors[step[1]], model.tensors[step[2]], step[3], step[4]);
    });
    const steps = current.w;
    const features = current.c;
    return Array.from({ length: steps }, (_, t) => {
      const column = new Float32Array(features);
      for (let c = 0; c < features; c += 1) column[c] = current.data[c * steps + t];
      return linear(column, model.tensors["fc.weight"], model.tensors["fc.bias"]);
    });
  }

  function yieldThread() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function convAsync(input, weight, bias, padY, padX, alive) {
    const [outC, inC, kH, kW] = weight.shape;
    const data = new Float32Array(outC * input.h * input.w);
    const w = weight.data;
    const b = bias.data;
    let marked = performance.now();
    for (let oc = 0; oc < outC; oc += 1) {
      if (performance.now() - marked > 10) {
        await yieldThread();
        marked = performance.now();
        if (alive && !alive()) return null;
      }
      for (let y = 0; y < input.h; y += 1) {
        for (let x = 0; x < input.w; x += 1) {
          let sum = b[oc];
          for (let ic = 0; ic < inC; ic += 1) {
            for (let ky = 0; ky < kH; ky += 1) {
              const iy = y + ky - padY;
              if (iy < 0 || iy >= input.h) continue;
              for (let kx = 0; kx < kW; kx += 1) {
                const ix = x + kx - padX;
                if (ix < 0 || ix >= input.w) continue;
                const iv = input.data[(ic * input.h + iy) * input.w + ix];
                const wv = w[(((oc * inC + ic) * kH + ky) * kW) + kx];
                sum += iv * wv;
              }
            }
          }
          data[(oc * input.h + y) * input.w + x] = sum;
        }
      }
    }
    return { c: outC, h: input.h, w: input.w, data };
  }

  async function forwardAsync(input, width, alive) {
    const spec = [
      ["conv", "conv.0.weight", "conv.0.bias", 1, 1],
      ["relu"],
      ["pool", 2, 2],
      ["conv", "conv.3.weight", "conv.3.bias", 1, 1],
      ["relu"],
      ["pool", 2, 2],
      ["conv", "conv.6.weight", "conv.6.bias", 1, 2],
      ["relu"],
      ["pool", 8, 1],
    ];
    let current = { c: 1, h: HEIGHT, w: width, data: input };
    for (let index = 0; index < spec.length; index += 1) {
      const step = spec[index];
      if (step[0] === "relu") current = relu(current);
      else if (step[0] === "pool") current = pool(current, step[1], step[2]);
      else {
        current = await convAsync(current, model.tensors[step[1]], model.tensors[step[2]], step[3], step[4], alive);
        if (!current) return null;
      }
    }
    const steps = current.w;
    const features = current.c;
    const rows = [];
    for (let t = 0; t < steps; t += 1) {
      if (t % 8 === 0) {
        await yieldThread();
        if (alive && !alive()) return null;
      }
      const column = new Float32Array(features);
      for (let c = 0; c < features; c += 1) column[c] = current.data[c * steps + t];
      rows.push(linear(column, model.tensors["fc.weight"], model.tensors["fc.bias"]));
    }
    return rows;
  }

  function decode(rows) {
    const chars = model.meta.chars;
    let text = "";
    let previous = -1;
    let confidence = 0;
    rows.forEach((row) => {
      let best = 0;
      let max = -Infinity;
      for (let i = 0; i < row.length; i += 1) {
        if (row[i] > max) {
          max = row[i];
          best = i;
        }
      }
      let sum = 0;
      const shifted = new Float32Array(row.length);
      for (let i = 0; i < row.length; i += 1) {
        shifted[i] = Math.exp(row[i] - max);
        sum += shifted[i];
      }
      confidence += shifted[best] / sum;
      if (best !== model.meta.blank && best !== previous) text += chars[best - 1];
      previous = best;
    });
    return { text, confidence: rows.length ? (100 * confidence) / rows.length : 0 };
  }

  function readInk(input, width) {
    if (!model) throw new Error("hand model");
    return decode(forward(input, width));
  }

  function sampleCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = frame.data;
    let left = canvas.width;
    let top = canvas.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4] < 176) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (right < left) return null;
    const cropW = right - left + 1;
    const cropH = bottom - top + 1;
    const fitted = document.createElement("canvas");
    const width = Math.min(256, Math.max(32, Math.round(cropW * (HEIGHT / cropH))));
    const padded = Math.min(256, Math.ceil(width / 4) * 4);
    fitted.width = padded;
    fitted.height = HEIGHT;
    const fittedCtx = fitted.getContext("2d");
    fittedCtx.fillStyle = "#fff";
    fittedCtx.fillRect(0, 0, padded, HEIGHT);
    fittedCtx.imageSmoothingEnabled = true;
    fittedCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, Math.min(padded, width), HEIGHT);
    const sample = fittedCtx.getImageData(0, 0, padded, HEIGHT).data;
    const input = new Float32Array(HEIGHT * padded);
    for (let i = 0; i < input.length; i += 1) input[i] = 1 - sample[i * 4] / 255;
    return { input, width: padded };
  }

  function readCanvas(canvas) {
    const sample = sampleCanvas(canvas);
    if (!sample) return { text: "", confidence: 0 };
    return readInk(sample.input, sample.width);
  }

  async function readCanvasAsync(canvas, alive) {
    const sample = sampleCanvas(canvas);
    if (!sample) return { text: "", confidence: 0 };
    await yieldThread();
    if (alive && !alive()) return null;
    const rows = await forwardAsync(sample.input, sample.width, alive);
    if (!rows) return null;
    return decode(rows);
  }

  return { load, prepare, readInk, readCanvas, readCanvasAsync };
});

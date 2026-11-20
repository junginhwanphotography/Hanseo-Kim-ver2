(function () {
  const PAUSE_MS = 750;
  const CHECK_MS = 180;
  const CONFIRM_MS = 420;
  const SESSION_GAP_MS = 4000;
  const phoneQuery =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(max-width: 720px), (pointer: coarse)")
      : { matches: false };
  let timer = 0;
  let token = 0;
  const submitted = new WeakSet();
  let tagsPromise = null;

  function tagsFromCatalog(catalog) {
    const tags = new Set();
    (catalog.recent || []).forEach((project) => {
      (project.images || []).forEach((src) => {
        const tag = window.HanseoTags.tagFromSrc(src);
        if (tag) tags.add(tag);
      });
    });
    return [...tags];
  }

  function loadTags() {
    if (!tagsPromise) {
      tagsPromise = fetch("catalog.json", { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error("catalog");
          return res.json();
        })
        .then(tagsFromCatalog)
        .catch((error) => {
          tagsPromise = null;
          throw error;
        });
    }
    return tagsPromise;
  }

  function prepare() {
    loadTags()
      .then((tags) => {
        if (window.HanseoTags && window.HanseoTags.warmTags) window.HanseoTags.warmTags(tags);
      })
      .catch(() => {});
    if (window.HanseoHand) window.HanseoHand.prepare().catch(() => {});
  }

  function writingSession(strokes) {
    const used = (strokes || []).filter((stroke) => stroke.points && stroke.points.length && stroke.at);
    if (!used.length) return [];
    const session = [used[used.length - 1]];
    for (let i = used.length - 2; i >= 0; i -= 1) {
      if ((used[i + 1].at || 0) - (used[i].at || 0) > SESSION_GAP_MS) break;
      session.unshift(used[i]);
    }
    return session;
  }

  function densifyPoints(points) {
    if (!points || points.length < 2) return points || [];
    const out = [points[0]];
    for (let i = 1; i < points.length; i += 1) {
      const a = out[out.length - 1];
      const b = points[i];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(dist / 2));
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          t: a.t != null && b.t != null ? a.t + (b.t - a.t) * t : b.t,
        });
      }
    }
    return out;
  }

  function renderInk(strokes, options) {
    const opts = options || {};
    const used = writingSession(strokes);
    if (!used.some((stroke) => !stroke.erase)) return null;
    const phone = phoneQuery.matches;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const drawn = used.map((stroke) => ({
      ...stroke,
      points: densifyPoints(stroke.points),
    }));
    drawn.forEach((stroke) => {
      stroke.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });
    const span = Math.max(maxX - minX, maxY - minY);
    const letter = Math.max(24, Math.min(maxX - minX, maxY - minY));
    if (!Number.isFinite(span) || span < 24) return null;
    const thickScale = opts.thicknessScale || 1;
    const targetScale = opts.targetScale || 1;
    const thickness = Math.max(
      (phone ? 11 : 8) * thickScale,
      Math.min(letter * (phone ? 0.14 : 0.11) * thickScale, (phone ? 32 : 28) * thickScale)
    );
    const pad = thickness * 2;
    const width = Math.ceil(maxX - minX + pad * 2);
    const height = Math.ceil(maxY - minY + pad * 2);
    const draft = document.createElement("canvas");
    draft.width = Math.max(1, width);
    draft.height = Math.max(1, height);
    const ctx = draft.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = thickness;
    ctx.translate(pad - minX, pad - minY);
    drawn.forEach((stroke) => {
      ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
      ctx.strokeStyle = "#111";
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i += 1) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      if (stroke.points.length === 1) ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y);
      ctx.stroke();
    });
    const pixels = ctx.getImageData(0, 0, draft.width, draft.height).data;
    let left = draft.width;
    let top = draft.height;
    let right = -1;
    let bottom = -1;
    let dark = 0;
    for (let y = 0; y < draft.height; y += 1) {
      for (let x = 0; x < draft.width; x += 1) {
        const index = (y * draft.width + x) * 4;
        if (pixels[index + 3] > 40 && pixels[index] < 210) {
          dark += 1;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (dark < 30 || right < left) return null;
    const cropW = right - left + 1;
    const cropH = bottom - top + 1;
    const margin = Math.round(Math.max(18, cropH * 0.28));
    const target = (phoneQuery.matches ? 210 : 170) * targetScale;
    const scale = Math.min(phoneQuery.matches ? 3.4 : 3, target / cropH);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round((cropW + margin * 2) * scale));
    out.height = Math.max(1, Math.round((cropH + margin * 2) * scale));
    const outCtx = out.getContext("2d");
    outCtx.fillStyle = "#fff";
    outCtx.fillRect(0, 0, out.width, out.height);
    outCtx.imageSmoothingEnabled = true;
    outCtx.drawImage(
      draft,
      left,
      top,
      cropW,
      cropH,
      margin * scale,
      margin * scale,
      cropW * scale,
      cropH * scale
    );
    const frame = outCtx.getImageData(0, 0, out.width, out.height);
    const data = frame.data;
    for (let i = 0; i < data.length; i += 4) {
      const on = data[i + 3] > 0 && data[i] < 176;
      data[i] = data[i + 1] = data[i + 2] = on ? 0 : 255;
      data[i + 3] = 255;
    }
    outCtx.putImageData(frame, 0, 0);
    return out;
  }

  function renderVariants(strokes) {
    return [
      renderInk(strokes, { thicknessScale: 1, targetScale: 1 }),
      renderInk(strokes, { thicknessScale: 1.35, targetScale: 1 }),
      renderInk(strokes, { thicknessScale: 0.78, targetScale: 1.18 }),
    ].filter(Boolean);
  }

  async function readStrokes(strokes, alive, settle) {
    const canvases = renderVariants(strokes);
    if (!canvases.length) return "";
    if (alive && !alive()) return "";
    await window.HanseoHand.prepare();
    if (alive && !alive()) return "";
    const texts = [];
    for (let i = 0; i < canvases.length; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (alive && !alive()) return "";
      const read = window.HanseoHand.readCanvasAsync
        ? await window.HanseoHand.readCanvasAsync(canvases[i], alive)
        : window.HanseoHand.readCanvas(canvases[i]);
      if (!read || (alive && !alive())) return "";
      if (read.text) texts.push(read.text);
    }
    const tags = await loadTags();
    if (alive && !alive()) return "";
    const session = writingSession(strokes).filter((stroke) => !stroke.erase);
    return window.HanseoTags.pickTag({
      texts,
      canvases: settle ? canvases : canvases.slice(0, 1),
      tags,
      settle,
      strokeCount: session.length,
    });
  }

  function cancel() {
    token += 1;
    clearTimeout(timer);
  }

  function seal(strokes) {
    (strokes || []).forEach((stroke) => {
      if (stroke) submitted.add(stroke);
    });
  }

  function boardOpen() {
    if (document.documentElement.classList.contains("intro-cover")) return true;
    const intro = document.getElementById("intro");
    return !!intro && !intro.classList.contains("is-leaving");
  }

  function publish(tag, snapshot, current) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (current !== token || !boardOpen()) return;
      snapshot.forEach((stroke) => submitted.add(stroke));
      window.dispatchEvent(new CustomEvent("hanseo-ink", { detail: { tag } }));
    }, CONFIRM_MS);
  }

  function schedule(strokes) {
    const snapshot = (strokes || []).filter((stroke) => stroke && !submitted.has(stroke));
    const current = ++token;
    clearTimeout(timer);
    if (!snapshot.length) return;
    const started = Date.now();
    const attempt = async (settle) => {
      try {
        if (current !== token) return;
        const tag = await readStrokes(snapshot, () => current === token, settle);
        if (current !== token || !boardOpen()) return;
        if (tag) {
          publish(tag, snapshot, current);
          return;
        }
        if (settle) return;
        const remain = PAUSE_MS - (Date.now() - started);
        if (remain > 40) timer = setTimeout(() => attempt(true), remain);
      } catch (error) {
        // Leave the drawing board in place when a word cannot be read.
      }
    };
    timer = setTimeout(() => attempt(false), CHECK_MS);
  }

  window.HanseoInk = { prepare, schedule, cancel, seal };
  let hash = "";
  try {
    hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  } catch (error) {
    hash = location.hash.replace(/^#/, "");
  }
  if (!hash || hash === "intro") prepare();
})();

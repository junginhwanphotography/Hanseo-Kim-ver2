(function () {
  function tagFromSrc(src) {
    let name = String(src || "").split("?")[0].split("/").pop() || "";
    try {
      name = decodeURIComponent(name);
    } catch (error) {
      // Keep the raw filename when the URL is not encoded.
    }
    const stem = name.replace(/\.[^.]+$/i, "");
    const match = stem.match(/_([A-Za-z]+)$/);
    return match ? match[1].toLowerCase() : "";
  }

  const softPair = {
    sc: 1,
    cs: 1,
    sg: 1,
    gs: 1,
    cg: 1,
    gc: 1,
    nm: 1,
    mn: 1,
    uv: 1,
    vu: 1,
    il: 1,
    li: 1,
    rn: 1,
    nr: 1,
    ec: 1,
    ce: 1,
    ao: 1,
    oa: 1,
    tf: 1,
    ft: 1,
    yv: 1,
    vy: 1,
    bp: 1,
    pb: 1,
    dq: 1,
    qd: 1,
  };

  function subCost(a, b) {
    if (a === b) return 0;
    return softPair[a + b] ? 0.4 : 1;
  }

  function distance(a, b) {
    const row = [];
    for (let j = 0; j <= b.length; j += 1) row[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      let previous = i - 1;
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const next =
          a[i - 1] === b[j - 1]
            ? previous
            : Math.min(previous + subCost(a[i - 1], b[j - 1]), row[j - 1] + 1, row[j] + 1);
        previous = row[j];
        row[j] = next;
      }
    }
    return row[b.length];
  }

  function lettersOf(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function windowScore(letters, tag) {
    if (!letters || !tag) return 0;
    if (letters.indexOf(tag) !== -1) return 1;
    if (letters.length < tag.length) return 0;
    let best = 0;
    const max = tag.length + 2;
    for (let len = tag.length; len <= max; len += 1) {
      if (letters.length < len) continue;
      for (let start = 0; start + len <= letters.length; start += 1) {
        const word = letters.slice(start, start + len);
        const cost = distance(word, tag);
        const score = 1 - cost / Math.max(tag.length, word.length);
        if (score > best) best = score;
      }
    }
    return best;
  }

  function inkMask(canvas, width, height) {
    const frame = document.createElement("canvas");
    frame.width = width;
    frame.height = height;
    const ctx = frame.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(canvas, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < mask.length; i += 1) mask[i] = pixels[i * 4] < 160 ? 1 : 0;
    return mask;
  }

  function maskScore(a, b) {
    let inter = 0;
    let union = 0;
    for (let i = 0; i < a.length; i += 1) {
      const left = a[i];
      const right = b[i];
      if (left | right) union += 1;
      if (left & right) inter += 1;
    }
    return union ? inter / union : 0;
  }

  const TAG_FONTS = [
    '700 28px "Segoe Script", "Apple Chancery", "Snell Roundhand", cursive',
    '28px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
    '700 29px "Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive',
    "700 28px Arial, Helvetica, sans-serif",
    "italic 700 28px Georgia, 'Times New Roman', serif",
    "600 28px Verdana, Geneva, sans-serif",
    "700 27px 'Trebuchet MS', sans-serif",
    "700 28px 'Palatino Linotype', Palatino, serif",
    "700 30px Impact, Haettenschweiler, sans-serif",
    "28px 'Courier New', Courier, monospace",
  ];

  function drawTagSample(tag, width, height, font, mode) {
    const frame = document.createElement("canvas");
    frame.width = width;
    frame.height = height;
    const ctx = frame.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font;
    if (mode === "stroke") {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.2;
      ctx.lineJoin = "round";
      ctx.strokeText(tag, width / 2, height / 2 + 2);
    } else {
      ctx.fillStyle = "#000000";
      ctx.fillText(tag, width / 2, height / 2 + 2);
    }
    return frame;
  }

  const MASK_W = 112;
  const MASK_H = 44;
  const maskCache = new Map();

  function tagMasks(tag) {
    let masks = maskCache.get(tag);
    if (masks) return masks;
    masks = [];
    TAG_FONTS.forEach((font) => {
      masks.push(inkMask(drawTagSample(tag, MASK_W, MASK_H, font, "fill"), MASK_W, MASK_H));
      masks.push(inkMask(drawTagSample(tag, MASK_W, MASK_H, font, "stroke"), MASK_W, MASK_H));
    });
    maskCache.set(tag, masks);
    return masks;
  }

  function warmTags(tags) {
    if (typeof document === "undefined") return;
    [...new Set((tags || []).map((tag) => String(tag).toLowerCase()).filter(Boolean))].forEach(tagMasks);
  }

  function imageScore(canvas, tag) {
    if (!canvas || !tag || typeof document === "undefined") return 0;
    const ink = inkMask(canvas, MASK_W, MASK_H);
    let best = 0;
    tagMasks(tag).forEach((mask) => {
      best = Math.max(best, maskScore(ink, mask));
    });
    return best;
  }

  function scoreTag(letters, tag, canvas) {
    if (!tag) return 0;
    if (letters && letters.indexOf(tag) !== -1) return 1;
    if (!letters || letters.length < tag.length) return 0;
    const text = windowScore(letters, tag);
    if (!canvas) return text;
    const image = imageScore(canvas, tag);
    return Math.max(text, text * 0.5 + image * 0.5);
  }

  function matchWord(text, tags, canvas, settle) {
    const known = [...new Set((tags || []).map((tag) => String(tag).toLowerCase()).filter(Boolean))];
    const letters = lettersOf(text);
    if (!known.length) return "";
    let exact = "";
    known.forEach((tag) => {
      if (letters.indexOf(tag) !== -1 && tag.length > exact.length) exact = tag;
    });
    if (exact) return exact;
    const ranked = known
      .map((tag) => ({ tag, score: scoreTag(letters, tag, canvas) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.tag.length - a.tag.length);
    const best = ranked[0];
    const second = ranked[1];
    if (!best || best.score < 0.54) return "";
    if (!settle && best.score < 0.72) return "";
    if (second && best.score - second.score < 0.045 && best.score < 0.8) return "";
    return best.tag;
  }

  function commandTag(text, tags, settle) {
    const typed = lettersOf(text);
    const known = [...new Set((tags || []).map((tag) => String(tag).toLowerCase()).filter(Boolean))];
    if (!typed) return "";
    let hit = "";
    known.forEach((tag) => {
      if (typed.indexOf(tag) !== -1 && tag.length > hit.length) hit = tag;
    });
    if (!hit) return "";
    if (!settle && known.some((tag) => tag.length > hit.length && tag.startsWith(hit))) return "";
    return hit;
  }

  window.HanseoTags = { tagFromSrc, matchWord, commandTag, scoreTag, warmTags };
})();

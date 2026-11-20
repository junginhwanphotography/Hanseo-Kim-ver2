(function () {
  function linkify(text, parent) {
    const pattern = /https?:\/\/[^\s]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(text))) {
      const raw = match[0];
      const visible = raw.replace(/[),.:;]+$/, "");
      if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      const anchor = document.createElement("a");
      anchor.textContent = visible;
      if (visible.includes("@") && !visible.startsWith("http")) anchor.href = "mailto:" + visible;
      else {
        anchor.href = visible;
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
      }
      parent.appendChild(anchor);
      if (visible.length < raw.length) parent.appendChild(document.createTextNode(raw.slice(visible.length)));
      last = match.index + raw.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function paragraphs(source) {
    return source
      .split(/\n\s*\n/)
      .map((block) => block.replace(/^\n+|\n+$/g, ""))
      .filter((block) => block.trim() !== "");
  }

  function fill(parent, blocks, labelFirst) {
    blocks.forEach((block, index) => {
      const el = document.createElement("p");
      if (labelFirst && index === 0 && !block.includes("\n") && !/@|https?:/.test(block)) {
        el.className = "info-label";
      }
      block.split("\n").forEach((line, lineIndex) => {
        if (lineIndex) el.appendChild(document.createElement("br"));
        linkify(line, el);
      });
      parent.appendChild(el);
    });
  }

  function split(source) {
    const buckets = { left: [], contact: [], note: [] };
    let key = "left";
    String(source || "")
      .split(/\n/)
      .forEach((line) => {
        const mark = line.trim();
        if (mark === "::contact") {
          key = "contact";
          return;
        }
        if (mark === "::note") {
          key = "note";
          return;
        }
        buckets[key].push(line);
      });
    return {
      left: paragraphs(buckets.left.join("\n")),
      contact: paragraphs(buckets.contact.join("\n")),
      note: paragraphs(buckets.note.join("\n")),
    };
  }

  function paintPlain(root, source) {
    const parts = split(source);
    const info = document.createElement("div");
    info.className = "info";
    const left = document.createElement("div");
    left.className = "info-col";
    const right = document.createElement("div");
    right.className = "info-col";
    fill(left, parts.left, false);
    fill(right, parts.contact, true);
    info.append(left, right);
    if (parts.note.length) {
      const note = document.createElement("div");
      note.className = "info-note";
      fill(note, parts.note, false);
      info.appendChild(note);
    }
    root.appendChild(info);
  }

  function rtfFonts(rtf) {
    const fonts = {};
    const table = rtf.match(/\{\\fonttbl([\s\S]*?)\}/);
    if (!table) return fonts;
    const pattern = /\\f(\d+)(?:\\[a-zA-Z]+\d*)*\s*([^;]+);/g;
    let match;
    while ((match = pattern.exec(table[1]))) fonts[match[1]] = match[2].trim();
    return fonts;
  }

  function rtfColors(rtf) {
    const colors = [""];
    const table = rtf.match(/\{\\colortbl([\s\S]*?)\}/);
    if (!table) return colors;
    table[1].split(";").forEach((entry) => {
      const red = entry.match(/\\red(\d+)/);
      const green = entry.match(/\\green(\d+)/);
      const blue = entry.match(/\\blue(\d+)/);
      if (!red || !green || !blue) return;
      colors.push("rgb(" + red[1] + ", " + green[1] + ", " + blue[1] + ")");
    });
    return colors;
  }

  function paintRtf(root, rtf) {
    const fonts = rtfFonts(rtf);
    const colors = rtfColors(rtf);
    const box = document.createElement("div");
    box.className = "info-rich";
    const style = { bold: false, italic: false, underline: false, size: "", family: "", color: "" };
    let buffer = "";
    const applyFont = (name) => {
      if (!name) return;
      if (/-bold$/i.test(name)) {
        style.bold = true;
        style.family = name.replace(/-bold$/i, "");
      } else if (/-italic$/i.test(name) || /-oblique$/i.test(name)) {
        style.italic = true;
        style.family = name.replace(/-(italic|oblique)$/i, "");
      } else {
        style.family = name;
      }
    };
    const flush = () => {
      if (!buffer) return;
      const span = document.createElement("span");
      if (style.bold) span.style.fontWeight = "700";
      if (style.italic) span.style.fontStyle = "italic";
      if (style.underline) span.style.textDecoration = "underline";
      if (style.size) span.style.fontSize = style.size;
      if (style.family) span.style.fontFamily = style.family;
      if (style.color) span.style.color = style.color;
      linkify(buffer, span);
      box.appendChild(span);
      buffer = "";
    };
    let source = rtf.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    source = source.replace(/\{\\fonttbl[\s\S]*?\}/g, "");
    source = source.replace(/\{\\colortbl[\s\S]*?\}/g, "");
    source = source.replace(/\{\\\*\\[^{}]*\}/g, "");
    source = source.replace(/\\\n/g, "\u0000");
    source = source.replace(/\n/g, "");
    let index = 0;
    while (index < source.length) {
      if (source[index] === "\u0000") {
        flush();
        box.appendChild(document.createElement("br"));
        index += 1;
        continue;
      }
      const hexRun = source.slice(index).match(/^(?:\\'[0-9a-fA-F]{2})+/);
      if (hexRun) {
        const bytes = hexRun[0].match(/[0-9a-fA-F]{2}/g).map((hex) => parseInt(hex, 16));
        try {
          buffer += new TextDecoder("euc-kr").decode(Uint8Array.from(bytes));
        } catch (error) {
          buffer += "";
        }
        index += hexRun[0].length;
        continue;
      }
      const unicode = source.slice(index).match(/^\\u(-?\d+)\??/);
      if (unicode) {
        let code = Number(unicode[1]);
        if (code < 0) code += 65536;
        buffer += String.fromCharCode(code);
        index += unicode[0].length;
        continue;
      }
      const control = source.slice(index).match(/^\\([a-zA-Z]+)(-?\d+)? ?/);
      if (control) {
        const name = control[1];
        const value = control[2];
        if (name === "b") {
          flush();
          style.bold = value !== "0";
        } else if (name === "i") {
          flush();
          style.italic = value !== "0";
        } else if (name === "ul" || name === "uldb" || name === "ulw") {
          flush();
          style.underline = value !== "0";
        } else if (name === "ulnone") {
          flush();
          style.underline = false;
        } else if (name === "fs" && value) {
          flush();
          style.size = Number(value) / 2 + "pt";
        } else if (name === "f" && value != null) {
          flush();
          applyFont(fonts[value]);
        } else if (name === "cf" && value && colors[Number(value)]) {
          flush();
          style.color = colors[Number(value)];
        } else if (name === "par" || name === "line") {
          flush();
          box.appendChild(document.createElement("br"));
        }
        index += control[0].length;
        continue;
      }
      if (source[index] === "\\" && "\\{}".includes(source[index + 1])) {
        buffer += source[index + 1];
        index += 2;
        continue;
      }
      if (source[index] === "{" || source[index] === "}") {
        index += 1;
        continue;
      }
      buffer += source[index];
      index += 1;
    }
    flush();
    root.appendChild(box);
  }

  function render(root, source) {
    let cancelled = false;
    root.replaceChildren();
    fetch("info/info.rtf", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("info");
        return res.text();
      })
      .then((rtf) => {
        if (cancelled || !rtf.trim()) return;
        root.replaceChildren();
        paintRtf(root, rtf);
      })
      .catch(() => {
        if (cancelled) return;
        root.replaceChildren();
        paintPlain(root, source);
      });
    return {
      destroy() {
        cancelled = true;
      },
    };
  }

  window.HanseoInfo = { render };
})();

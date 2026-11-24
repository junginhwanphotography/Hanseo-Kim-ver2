const fs = require("fs");
const path = require("path");
const {
  RECENT_WHITE_DIR,
  RECENT_BLACK_DIR,
  BOOKS_DIR,
  CONTACT_DIR,
  WEB,
  COLLECTIONS_URL_WHITE,
  COLLECTIONS_URL_BLACK,
} = require("./paths");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

function isPicture(name) {
  const ext = path.extname(name).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return false;
  const stem = path.basename(name, ext).toLowerCase();
  return stem !== "background" && stem !== "bsckground" && !stem.startsWith("bg-");
}

function readProjectText(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, "project.txt"), "utf8").replace(/^\uFEFF/, "");
    let created = null;
    const body = [];
    raw.split(/\r?\n/).forEach((line) => {
      const mark = line.match(/^created:\s*(.+)\s*$/i);
      if (mark && created == null) {
        const time = Date.parse(mark[1]);
        if (!Number.isNaN(time)) created = time;
        return;
      }
      body.push(line);
    });
    while (body.length && body[body.length - 1].trim() === "") body.pop();
    return {
      year: (body[0] || "").trim(),
      title: (body[1] || "").trim(),
      text: body.slice(2).join("\n").trim(),
      created,
    };
  } catch (error) {
    return null;
  }
}

function listImages(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && isPicture(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

function canon(id) {
  return String(id).normalize("NFC");
}

function readCreatedIndex() {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(WEB, "collections.json"), "utf8"));
    const index = new Map();
    if (!Array.isArray(list)) return index;
    list.forEach((item, order) => {
      if (!item || !item.id || !item.createdAt) return;
      const time = Date.parse(item.createdAt);
      if (Number.isNaN(time)) return;
      const record = { time, order };
      index.set(item.id, record);
      index.set(canon(item.id), record);
    });
    return index;
  } catch (error) {
    return new Map();
  }
}

function storedRecord(index, name) {
  if (!index) return null;
  return index.get(name) || index.get(canon(name)) || null;
}

function listProjects(dir, urlPrefix, createdIndex) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => {
      const folder = path.join(dir, entry.name);
      const meta = readProjectText(folder);
      const record = storedRecord(createdIndex, entry.name);
      const created = record ? record.time : (meta && meta.created) || null;
      const images = listImages(folder).map(
        (name) => `${urlPrefix}/${encodeURIComponent(entry.name)}/${encodeURIComponent(name)}`
      );
      return {
        id: entry.name,
        year: (meta && meta.year) || (created ? String(new Date(created).getFullYear()) : ""),
        title: (meta && meta.title) || entry.name,
        text: (meta && meta.text) || "",
        created,
        order: record ? record.order : Number.MAX_SAFE_INTEGER,
        images,
      };
    })
    .filter((project) => project.images.length)
    .sort((a, b) => {
      const aPinned = a.id.startsWith("_");
      const bPinned = b.id.startsWith("_");
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      const aKnown = a.created != null;
      const bKnown = b.created != null;
      if (aKnown !== bKnown) return aKnown ? 1 : -1;
      if (aKnown && a.created !== b.created) return b.created - a.created;
      return a.order - b.order;
    });
}

function fileNameOf(src) {
  try {
    return decodeURIComponent(String(src).split("/").pop() || "");
  } catch (error) {
    return String(src).split("/").pop() || "";
  }
}

function mergeRecent(createdIndex) {
  const white = listProjects(RECENT_WHITE_DIR, COLLECTIONS_URL_WHITE, createdIndex);
  const black = listProjects(RECENT_BLACK_DIR, COLLECTIONS_URL_BLACK, createdIndex);
  const byId = new Map();

  function take(list, theme) {
    list.forEach((project) => {
      let item = byId.get(project.id);
      if (!item) {
        item = {
          id: project.id,
          year: project.year,
          title: project.title,
          text: project.text,
          created: project.created,
          order: project.order,
          imagesWhite: [],
          imagesBlack: [],
        };
        byId.set(project.id, item);
      } else {
        if (!item.year && project.year) item.year = project.year;
        if ((!item.title || item.title === item.id) && project.title) item.title = project.title;
        if (!item.text && project.text) item.text = project.text;
        if (item.created == null && project.created != null) item.created = project.created;
        if (project.order < item.order) item.order = project.order;
      }
      if (theme === "white") item.imagesWhite = project.images;
      else item.imagesBlack = project.images;
    });
  }

  take(white, "white");
  take(black, "black");

  return [...byId.values()]
    .map((project) => {
      const images = [...project.imagesWhite, ...project.imagesBlack].sort((a, b) =>
        fileNameOf(a).localeCompare(fileNameOf(b), "en", { numeric: true })
      );
      return {
        id: project.id,
        year: project.year,
        title: project.title,
        text: project.text,
        created: project.created,
        order: project.order,
        images,
        imagesWhite: project.imagesWhite,
        imagesBlack: project.imagesBlack,
      };
    })
    .filter((project) => project.images.length)
    .sort((a, b) => {
      const aPinned = a.id.startsWith("_");
      const bPinned = b.id.startsWith("_");
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      const aKnown = a.created != null;
      const bKnown = b.created != null;
      if (aKnown !== bKnown) return aKnown ? 1 : -1;
      if (aKnown && a.created !== b.created) return b.created - a.created;
      return a.order - b.order;
    })
    .map(({ created, order, ...project }) => project);
}

function rtfPlain(rtf) {
  let source = String(rtf).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  source = source.replace(/\{\\fonttbl[\s\S]*?\}/g, "");
  source = source.replace(/\{\\colortbl[\s\S]*?\}/g, "");
  source = source.replace(/\{\\\*\\[^{}]*\}/g, "");
  source = source.replace(/\\\n/g, "\n");
  source = source.replace(/\n/g, "");
  let text = "";
  let index = 0;
  while (index < source.length) {
    const hexRun = source.slice(index).match(/^(?:\\'[0-9a-fA-F]{2})+/);
    if (hexRun) {
      const bytes = hexRun[0].match(/[0-9a-fA-F]{2}/g).map((hex) => parseInt(hex, 16));
      text += new TextDecoder("euc-kr").decode(Uint8Array.from(bytes));
      index += hexRun[0].length;
      continue;
    }
    const unicode = source.slice(index).match(/^\\u(-?\d+)\??/);
    if (unicode) {
      let code = Number(unicode[1]);
      if (code < 0) code += 65536;
      text += String.fromCharCode(code);
      index += unicode[0].length;
      continue;
    }
    const control = source.slice(index).match(/^\\([a-zA-Z]+)(-?\d+)? ?/);
    if (control) {
      if (control[1] === "par" || control[1] === "line") text += "\n";
      index += control[0].length;
      continue;
    }
    if (source[index] === "\\" && "\\{}".includes(source[index + 1])) {
      text += source[index + 1];
      index += 2;
      continue;
    }
    if (source[index] === "{" || source[index] === "}") {
      index += 1;
      continue;
    }
    text += source[index];
    index += 1;
  }
  return text.replace(/^\n+|\n+$/g, "").trim();
}

function readContact() {
  try {
    const rich = path.join(CONTACT_DIR, "contact.rtf");
    if (fs.existsSync(rich)) return rtfPlain(fs.readFileSync(rich, "utf8"));
    return fs
      .readFileSync(path.join(CONTACT_DIR, "contact.txt"), "utf8")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n")
      .trim();
  } catch (error) {
    return "";
  }
}

function buildCatalog() {
  const createdIndex = readCreatedIndex();
  return {
    recent: mergeRecent(createdIndex),
    books: listProjects(BOOKS_DIR, "books-and-printed-work", createdIndex).map(
      ({ created, order, ...project }) => project
    ),
    contact: readContact(),
  };
}

module.exports = { buildCatalog, isPicture };

const fs = require("fs");
const path = require("path");
const { RECENT_DIR, BOOKS_DIR, INFO_DIR, WEB } = require("./paths");

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
    })
    .map(({ created, order, ...project }) => project);
}

function readInfo() {
  try {
    return fs
      .readFileSync(path.join(INFO_DIR, "info.txt"), "utf8")
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
    recent: listProjects(RECENT_DIR, "recent-pictures", createdIndex),
    books: listProjects(BOOKS_DIR, "books-and-printed-work", createdIndex),
    info: readInfo(),
  };
}

module.exports = { buildCatalog, isPicture };

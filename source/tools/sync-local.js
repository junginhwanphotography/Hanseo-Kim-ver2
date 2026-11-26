/**
 * collections 변경 감지 → images.json·collections.json 갱신만 (Git/서버 없음)
 * 폴더 이름이 _ 로 시작하면 "맨 위 + 간격" 컬렉션으로 표시됩니다.
 */

const fs = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");
const { generateSitemap } = require("./generate-sitemap.js");

const {
  PROJECT: ROOT,
  WEB,
  RECENT_LIGHT_DIR,
  RECENT_DARK_DIR,
  COLLECTIONS_URL_LIGHT,
  COLLECTIONS_URL_DARK,
} = require("./paths");

const THEME_ROOTS = [
  { dir: RECENT_LIGHT_DIR, url: COLLECTIONS_URL_LIGHT },
  { dir: RECENT_DARK_DIR, url: COLLECTIONS_URL_DARK },
];
const {
  optimizeCollectionPhotos,
  summarize,
  loadOptCache,
  saveOptCache,
} = require("./optimize-photos");
const { buildAllWall } = require("./build-all-wall");
const { buildGridThumbs } = require("./build-grid-thumbs");
const { comparePhotoNames } = require("./photo-name");
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
/** 맨 위에 간격을 두는 컬렉션: 폴더 이름이 이 문자로 시작 */
const TOP_COLLECTION_PREFIX = "_";
/** Non-test collections always use the home scatter format. */
const COLLECTION_LAYOUT = "scatter";

function isLayoutTestCollection(id) {
  return /^레이아웃 테스트[1-6]$/.test(canon(id));
}

/** Stable seed so each collection's scatter pack differs; set once, never re-roll on file edits. */
function hashLayoutSeed(id, createdAt) {
  const text = String(id || "") + "|" + String(createdAt || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

function readLayoutSeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >>> 0;
}

function isImage(name) {
  return IMAGE_EXT.includes(path.extname(name).toLowerCase());
}

/** 파일명 stem이 background(오타 bsckground 포함)면 페이지 배경용 */
function isBackgroundFile(name) {
  const stem = path.parse(name).name.toLowerCase();
  return stem === "background" || stem === "bsckground";
}

/** bg- 접두사 씬 에셋(기차·랜드 등)은 갤러리에서 제외 */
function isSceneAssetFile(name) {
  const stem = path.parse(name).name.toLowerCase();
  return stem.startsWith("bg-");
}

function isGalleryExcludedFile(name) {
  return isBackgroundFile(name) || isSceneAssetFile(name);
}

/** bsckground.* → background.* 로 통일 (확장자 유지) */
async function normalizeBackgroundFilename(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const bgLike = entries.filter(
      (e) => e.isFile() && isImage(e.name) && isBackgroundFile(e.name)
    );
    if (!bgLike.length) return null;
    const canonical = bgLike.find(
      (e) => path.parse(e.name).name.toLowerCase() === "background"
    );
    const typo = bgLike.find(
      (e) => path.parse(e.name).name.toLowerCase() === "bsckground"
    );
    if (typo && !canonical) {
      const ext = path.extname(typo.name);
      const dest = path.join(dir, `background${ext}`);
      await fs.rename(path.join(dir, typo.name), dest);
      return `background${ext}`;
    }
    return canonical ? canonical.name : bgLike[0].name;
  } catch {
    return null;
  }
}

async function getCollectionDirs() {
  const names = new Set();
  for (const root of THEME_ROOTS) {
    try {
      const entries = await fs.readdir(root.dir, { withFileTypes: true });
      entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .forEach((e) => names.add(canon(e.name)));
    } catch {
      // theme folder may be missing
    }
  }
  return [...names];
}

function createdMsFromStat(stat) {
  const birth = (stat.birthtimeMs || (stat.birthtime && stat.birthtime.getTime()) || 0);
  const mtime = (stat.mtimeMs || (stat.mtime && stat.mtime.getTime()) || 0);
  if (birth > 0) return birth;
  return mtime;
}

function createdMsFromIso(value) {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

async function getCollectionCreatedMs() {
  const map = new Map();
  for (const root of THEME_ROOTS) {
    try {
      const entries = await fs.readdir(root.dir, { withFileTypes: true });
      await Promise.all(
        entries
          .filter((e) => e.isDirectory())
          .map(async (e) => {
            const stat = await fs.stat(path.join(root.dir, e.name));
            const ms = createdMsFromStat(stat);
            if (!map.has(e.name) || ms < map.get(e.name)) map.set(e.name, ms);
          })
      );
    } catch {
      // theme folder may be missing
    }
  }
  return map;
}

function canon(id) {
  return String(id).normalize("NFC");
}

function entryForFolder(byId, folderName, renameFrom) {
  if (byId.has(folderName)) return byId.get(folderName);
  const key = canon(folderName);
  for (const entry of byId.values()) {
    if (entry && canon(entry.id) === key) return entry;
  }
  const oldId = renameFrom && renameFrom.get(folderName);
  if (!oldId) return null;
  if (byId.has(oldId)) return byId.get(oldId);
  const oldKey = canon(oldId);
  for (const entry of byId.values()) {
    if (entry && canon(entry.id) === oldKey) return entry;
  }
  return null;
}

function detectRenames(oldIds, newIds) {
  const removed = oldIds.filter((id) => !newIds.includes(id));
  const added = newIds.filter((id) => !oldIds.includes(id));
  const map = new Map();
  if (removed.length === 1 && added.length === 1) {
    map.set(added[0], removed[0]);
  }
  return map;
}

async function getCollectionImageList(collectionId) {
  const names = new Set();
  for (const root of THEME_ROOTS) {
    const dir = path.join(root.dir, collectionId);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      entries
        .filter((e) => e.isFile() && e.name !== "images.json" && isImage(e.name) && !isGalleryExcludedFile(e.name))
        .forEach((e) => names.add(e.name));
    } catch {
      // missing theme copy
    }
  }
  return [...names].sort(comparePhotoNames);
}

async function getCollectionJsonList(collectionId) {
  const names = new Set();
  let saw = false;
  for (const root of THEME_ROOTS) {
    const file = path.join(root.dir, collectionId, "images.json");
    try {
      const raw = await fs.readFile(file, "utf8");
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : data.images || [];
      saw = true;
      (list || [])
        .filter((item) => item && item.src)
        .forEach((item) => names.add(path.basename(item.src)));
    } catch {
      // missing theme copy
    }
  }
  if (!saw) return null;
  return [...names].sort(comparePhotoNames);
}

/** images.json 안의 src가 모두 현재 폴더명(id)과 일치하는지 검사. 이름 변경 시 false */
async function imagesJsonPathsMatchId(collectionId) {
  for (const root of THEME_ROOTS) {
    const file = path.join(root.dir, collectionId, "images.json");
    try {
      const raw = await fs.readFile(file, "utf8");
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : data.images || [];
      const srcList = (list || []).filter((item) => item && item.src).map((item) => item.src);
      if (srcList.length === 0) continue;
      const prefix = `${root.url}/${collectionId}/`;
      if (!srcList.every((src) => src.startsWith(prefix))) return false;
    } catch {
      // missing theme copy
    }
  }
  return true;
}

function photoOrderForCollection() {
  return "asc";
}

function sortPhotoNames(names, order) {
  const copy = [...names];
  copy.sort(comparePhotoNames);
  if (order !== "asc") copy.reverse();
  return copy;
}

function arraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function loadCollectionsJson() {
  const file = path.join(WEB, "collections.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveCollectionsJson(list) {
  const file = path.join(WEB, "collections.json");
  await fs.writeFile(file, JSON.stringify(list, null, 2), "utf8");
}

function run(cmd, cwd = ROOT) {
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

/** 컬렉션 폴더의 사진 목록을 읽어 images.json 생성/갱신 (프로세스 분리 없이 직접 실행) */
async function generateCollectionImagesJson(collectionId, photoOrder = "asc", themeRoot) {
  const root = themeRoot || THEME_ROOTS[0];
  const dir = path.join(root.dir, collectionId);
  const outFile = path.join(dir, "images.json");
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {}
  const backgroundFile = await normalizeBackgroundFilename(dir);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = sortPhotoNames(
    entries
      .filter((e) => e.isFile() && e.name !== "images.json" && isImage(e.name) && !isGalleryExcludedFile(e.name))
      .map((e) => e.name),
    photoOrder
  );
  const images = files.map((file) => ({
    src: `${root.url}/${collectionId}/${file}`,
    alt: path.parse(file).name,
  }));
  const data = {
    background: backgroundFile ? `${root.url}/${collectionId}/${backgroundFile}` : null,
    images,
  };
  await fs.writeFile(outFile, JSON.stringify(data, null, 2), "utf8");
  return { count: images.length, background: backgroundFile };
}

async function runSync() {
  process.chdir(ROOT);
  console.log("📷 collections 동기화\n");
  console.log("   작업 폴더:", ROOT, "\n");

  let changed = false;

  const collectionDirs = await getCollectionDirs();
  let collections = await loadCollectionsJson();
  const byId = new Map(collections.map((c) => [c.id, c]));
  const renameFrom = detectRenames(
    collections.map((c) => c.id),
    collectionDirs
  );

  const folderKeys = new Set(collectionDirs.map((id) => canon(id)));
  const kept = collections.filter((c) => folderKeys.has(canon(c.id)));
  if (kept.length !== collections.length) {
    collections = kept;
    byId.clear();
    collections.forEach((c) => byId.set(c.id, c));
    changed = true;
    console.log("📁 삭제된 컬렉션 폴더 반영 (collections.json 정리)");
  }

  const newIds = new Set();
  for (const id of collectionDirs) {
    const existing = entryForFolder(byId, id, renameFrom);
    if (existing && existing.createdAt) continue;
    const oldId = renameFrom.get(id);
    newIds.add(id);
    byId.set(id, {
      id,
      name: id,
      path: `collection.html?collection=${encodeURIComponent(id)}`,
      photoOrder: "asc",
      createdAt: (existing && existing.createdAt) || new Date().toISOString(),
    });
    changed = true;
    if (oldId) {
      console.log(`📁 컬렉션 이름 변경: ${oldId} → ${id}`);
    } else {
      console.log(`📁 새 컬렉션 추가: ${id}`);
    }
  }

  // 한 번 기록한 createdAt만 순서를 정한다. 폴더 생성일·수정일·배포 시각은 쓰지 않는다.
  // Non-test collections always use home scatter; layoutSeed is set once and kept on file edits.
  const ordered = [];
  for (const id of collectionDirs) {
    const c = entryForFolder(byId, id, renameFrom);
    const createdAt = (c && c.createdAt) || new Date().toISOString();
    const entry = {
      ...c,
      id,
      name: (c && c.name) || id,
      path: `collection.html?collection=${encodeURIComponent(id)}`,
      photoOrder: photoOrderForCollection(c, newIds.has(id) && !renameFrom.has(id)),
      createdAt,
    };
    if (isLayoutTestCollection(id)) {
      delete entry.layout;
      delete entry.layoutSeed;
    } else {
      entry.layout = COLLECTION_LAYOUT;
      const keptSeed = readLayoutSeed(c && c.layoutSeed);
      if (keptSeed) {
        entry.layoutSeed = keptSeed;
      } else {
        entry.layoutSeed = hashLayoutSeed(id, createdAt);
        changed = true;
        console.log(`🧩 컬렉션 scatter 시드 배정: ${id} → ${entry.layoutSeed}`);
      }
      if (!c || c.layout !== COLLECTION_LAYOUT) {
        changed = true;
        console.log(`🧩 컬렉션 레이아웃: ${id} → ${COLLECTION_LAYOUT}`);
      }
    }
    byId.set(id, entry);
    ordered.push(entry);
  }
  ordered.sort((a, b) => {
    const aPrefix = a.id.startsWith(TOP_COLLECTION_PREFIX);
    const bPrefix = b.id.startsWith(TOP_COLLECTION_PREFIX);
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
    return createdMsFromIso(b.createdAt) - createdMsFromIso(a.createdAt);
  });
  await saveCollectionsJson(ordered);

  // 모든 컬렉션의 images.json을 매번 재생성 (사진 추가/삭제/변경 반영)
  const optCache = await loadOptCache();
  for (const id of collectionDirs) {
    const entry = byId.get(id);
    const photoOrder = photoOrderForCollection(entry, newIds.has(id));
    for (const root of THEME_ROOTS) {
      const themeDir = path.join(root.dir, id);
      try {
        await fs.access(themeDir);
      } catch {
        continue;
      }
      try {
        const compressed = await optimizeCollectionPhotos(themeDir, optCache);
        summarize(`${id}/${root.url}`, compressed);
        if (compressed.changed) changed = true;
        const { count, background } = await generateCollectionImagesJson(id, photoOrder, root);
        const bgNote = background ? `, 배경 ${background}` : "";
        console.log(`🖼 컬렉션 "${id}" (${root.url}) → images.json 갱신 (${count}개 이미지${bgNote})`);
        changed = true;
      } catch (err) {
        console.error(`❌ 컬렉션 "${id}" (${root.url}) images.json 생성 실패:`, err.message);
      }
    }
  }
  await saveOptCache(optCache);

  try {
    const wall = await buildAllWall(ordered);
    if (wall && wall.changed) changed = true;
  } catch (err) {
    console.error("❌ 전체 사진 벽 생성 실패:", err.message);
  }

  try {
    const thumbs = await buildGridThumbs();
    if (thumbs && thumbs.written) changed = true;
  } catch (err) {
    console.error("❌ 그리드 썸네일 생성 실패:", err.message);
  }

  if (!changed) {
    console.log("\n✅ 적용할 변경 없음 (컬렉션 폴더 없음).");
  } else {
    console.log("\n✅ 모든 컬렉션 갱신 완료.");
  }

  await generateSitemap({ bumpLastmod: changed });

  return changed;
}

module.exports = { runSync };

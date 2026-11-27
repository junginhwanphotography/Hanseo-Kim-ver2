/**
 * 그리드/홈 모자이크용 미리보기를 web/thumbs 에 만듭니다.
 * - .sm.webp : 모자이크용 (~800)
 * - .webp    : 라이트박스용 (~1440)
 * home.json 에 홈 목록 + 미리 계산된 스캐터 좌표를 넣습니다.
 */

const fs = require("fs");
const path = require("path");
const { WEB, RECENT_LIGHT_DIR, RECENT_DARK_DIR, BOOKS_DIR } = require("./paths");
const { packScatter } = require("./scatter-pack");
const { comparePhotoNames } = require("./photo-name");

const MOSAIC_WIDTH = 960;
const MOSAIC_QUALITY = 84;
const LIGHTBOX_WIDTH = 2560;
const LIGHTBOX_QUALITY = 92;
const BOOK_COVER_WIDTH = 900;
const BOOK_COVER_QUALITY = 82;
const THUMB_VERSION = 8;
const HOME_PIN = ["레이아웃 테스트6", "레이아웃 테스트5", "레이아웃 테스트4"];

function nfc(value) {
  return String(value || "").normalize("NFC");
}

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    return null;
  }
}

function isHiddenCollection(id) {
  return String(id || "").replace(/^_/, "").toUpperCase() === "WALL";
}

function isGalleryExcludedFile(name) {
  const stem = String(name || "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  return stem === "background" || stem === "bsckground" || stem.startsWith("bg-");
}

function isImage(name) {
  return /\.(jpe?g|png|gif|webp)$/i.test(name || "");
}

async function mapPool(items, limit, worker) {
  const queue = items.slice();
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function collectJobs() {
  const roots = [
    { dir: RECENT_LIGHT_DIR, theme: "light", prefix: "" },
    { dir: RECENT_DARK_DIR, theme: "dark", prefix: "" },
    { dir: BOOKS_DIR, theme: "books", prefix: "books/" },
  ];
  const jobs = [];
  const seen = new Set();

  roots.forEach((root) => {
    if (!fs.existsSync(root.dir)) return;
    fs.readdirSync(root.dir, { withFileTypes: true }).forEach((entry) => {
      if (!entry.isDirectory()) return;
      const folderId = nfc(entry.name);
      if (isHiddenCollection(folderId)) return;
      const collectionId = root.prefix + folderId;
      const dir = path.join(root.dir, entry.name);
      let files = [];
      try {
        files = fs.readdirSync(dir);
      } catch {
        return;
      }
      files.forEach((filename) => {
        if (!isImage(filename) || filename === "images.json" || isGalleryExcludedFile(filename)) return;
        const src = path.join(dir, filename);
        const key = collectionId + "/" + filename;
        if (seen.has(key)) return;
        seen.add(key);
        jobs.push({
          collectionId,
          filename,
          src,
          theme: root.theme,
          bookCover: root.theme === "books",
        });
      });
    });
  });

  return jobs;
}

async function writeVariant(sharp, src, dest, width, quality, srcMtime, force) {
  if (!force && fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= srcMtime) return false;
  await sharp(src)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toFile(dest);
  return true;
}

async function buildGridThumbs() {
  const sharp = loadSharp();
  if (!sharp) {
    console.warn("sharp 가 없어 그리드 미리보기를 만들지 않습니다.");
    return { written: 0, skipped: 0 };
  }

  const jobs = collectJobs();
  const outRoot = path.join(WEB, "thumbs");
  fs.mkdirSync(outRoot, { recursive: true });
  const stampPath = path.join(outRoot, `.v${THUMB_VERSION}`);
  const force = !fs.existsSync(stampPath);
  const manifest = {};
  let written = 0;
  let skipped = 0;

  await mapPool(jobs, 4, async (job) => {
    const destDir = path.join(outRoot, job.collectionId);
    fs.mkdirSync(destDir, { recursive: true });
    const stem = job.filename.replace(/\.[^.]+$/, "");
    const destLg = path.join(destDir, stem + ".webp");
    const destSm = path.join(destDir, stem + ".sm.webp");
    const srcStat = fs.statSync(job.src);
    const meta = await sharp(job.src).rotate().metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    manifest[job.collectionId + "/" + job.filename] = [width, height];
    if (job.bookCover) {
      // Books list only needs a cover-sized tile; skip the large lightbox twin.
      const wroteSm = await writeVariant(
        sharp,
        job.src,
        destSm,
        BOOK_COVER_WIDTH,
        BOOK_COVER_QUALITY,
        srcStat.mtimeMs,
        force
      );
      if (wroteSm) written += 1;
      else skipped += 1;
      return;
    }
    const wroteLg = await writeVariant(
      sharp,
      job.src,
      destLg,
      LIGHTBOX_WIDTH,
      LIGHTBOX_QUALITY,
      srcStat.mtimeMs,
      force
    );
    const wroteSm = await writeVariant(
      sharp,
      job.src,
      destSm,
      MOSAIC_WIDTH,
      MOSAIC_QUALITY,
      srcStat.mtimeMs,
      force
    );
    if (wroteLg || wroteSm) written += 1;
    else skipped += 1;
  });

  fs.writeFileSync(path.join(outRoot, "manifest.json"), JSON.stringify(manifest));
  fs.writeFileSync(stampPath, String(Date.now()));
  writeHomeIndex(manifest);
  console.log(`🖼 그리드 미리보기 ${written}장 갱신, ${skipped}장 유지 (jobs ${jobs.length})`);
  return { written, skipped };
}

function photosById(dir) {
  const map = new Map();
  if (!fs.existsSync(dir)) return map;
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (!entry.isDirectory()) return;
    const id = nfc(entry.name);
    if (isHiddenCollection(id)) return;
    const files = fs
      .readdirSync(path.join(dir, entry.name))
      .filter((name) => isImage(name) && !isGalleryExcludedFile(name))
      .sort(comparePhotoNames);
    map.set(id, files);
  });
  return map;
}

function thumbUrl(id, filename, kind) {
  const stem = filename.replace(/\.[^.]+$/, "");
  const file = kind === "sm" ? stem + ".sm.webp" : stem + ".webp";
  return "thumbs/" + id + "/" + file + "?v=" + THUMB_VERSION;
}

function collectionOrder() {
  let cols = [];
  try {
    cols = JSON.parse(fs.readFileSync(path.join(WEB, "collections.json"), "utf8"));
  } catch {
    cols = [];
  }
  const rest = cols
    .map((col) => nfc(col && col.id))
    .filter((id) => id && id.charAt(0) !== "_" && HOME_PIN.indexOf(id) === -1);
  return HOME_PIN.concat(rest);
}

function homeImagePaths(theme, lightMap, darkMap, order) {
  const root = theme === "dark" ? "photographs_dark/" : "photographs_light/";
  const paths = [];
  order.forEach((id) => {
    const light = lightMap.get(id) || [];
    const dark = darkMap.get(id) || [];
    let list = theme === "dark" ? dark : light;
    let folder = root + id + "/";
    if (!list.length && HOME_PIN.indexOf(id) !== -1) {
      list = dark.length ? dark : light;
      folder = "photographs_dark/" + id + "/";
    }
    list.forEach((filename) => paths.push(folder + filename));
  });
  return paths;
}

function layoutFor(paths, manifest, homeMobile, boardW) {
  const items = paths.map((src) => {
    const parts = src.split("/").filter(Boolean);
    const key = parts[1] + "/" + parts[parts.length - 1];
    const size = manifest[key];
    const ratio = size && size[0] ? size[1] / size[0] : 2 / 3;
    return { key, ratio };
  });
  const packed = packScatter(items, { boardW, homeMobile });
  return {
    boardW,
    height: packed.height,
    boxes: packed.boxes,
  };
}

function writeHomeIndex(manifest) {
  const order = collectionOrder();
  const lightMap = photosById(RECENT_LIGHT_DIR);
  const darkMap = photosById(RECENT_DARK_DIR);
  const lightPaths = homeImagePaths("light", lightMap, darkMap, order);
  const darkPaths = homeImagePaths("dark", lightMap, darkMap, order);

  const home = {
    light: {
      images: lightPaths,
      mosaic: lightPaths.map((src) => {
        const parts = src.split("/").filter(Boolean);
        return thumbUrl(parts[1], parts[parts.length - 1], "sm");
      }),
      layout: {
        mobile: layoutFor(lightPaths, manifest, true, 370),
        desktop: layoutFor(lightPaths, manifest, false, 1000),
      },
    },
    dark: {
      images: darkPaths,
      mosaic: darkPaths.map((src) => {
        const parts = src.split("/").filter(Boolean);
        return thumbUrl(parts[1], parts[parts.length - 1], "sm");
      }),
      layout: {
        mobile: layoutFor(darkPaths, manifest, true, 370),
        desktop: layoutFor(darkPaths, manifest, false, 1000),
      },
    },
  };

  fs.writeFileSync(path.join(WEB, "home.json"), JSON.stringify(home));

  const boot = {
    light: home.light.mosaic.slice(0, 12),
    dark: home.dark.mosaic.slice(0, 12),
  };
  fs.writeFileSync(path.join(WEB, "boot-thumbs.json"), JSON.stringify(boot));
  console.log(`🚀 홈 인덱스 ${lightPaths.length} / ${darkPaths.length}`);
}

if (require.main === module) {
  buildGridThumbs().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildGridThumbs };

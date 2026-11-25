/**
 * 그리드/홈 모자이크용 미리보기를 web/thumbs 에 만듭니다.
 * 원본 대신 이 파일을 먼저 받아 첫 화면을 빨리 그립니다.
 */

const fs = require("fs");
const path = require("path");
const { WEB, RECENT_WHITE_DIR, RECENT_BLACK_DIR } = require("./paths");

// Home mosaic cells are usually <400px wide — keep thumbs small for fast first paint.
const THUMB_WIDTH = 420;
const JPEG_QUALITY = 52;

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
    { dir: RECENT_WHITE_DIR },
    { dir: RECENT_BLACK_DIR },
  ];
  const jobs = [];
  const seen = new Set();

  roots.forEach((root) => {
    if (!fs.existsSync(root.dir)) return;
    fs.readdirSync(root.dir, { withFileTypes: true }).forEach((entry) => {
      if (!entry.isDirectory()) return;
      const collectionId = nfc(entry.name);
      if (isHiddenCollection(collectionId)) return;
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
        jobs.push({ collectionId, filename, src });
      });
    });
  });

  return jobs;
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
  const manifest = {};
  let written = 0;
  let skipped = 0;

  await mapPool(jobs, 4, async (job) => {
    const destDir = path.join(outRoot, job.collectionId);
    fs.mkdirSync(destDir, { recursive: true });
    const stem = job.filename.replace(/\.[^.]+$/, "");
    const dest = path.join(destDir, stem + ".jpg");
    const srcStat = fs.statSync(job.src);
    const meta = await sharp(job.src).rotate().metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    manifest[job.collectionId + "/" + job.filename] = [width, height];
    if (fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= srcStat.mtimeMs) {
      skipped += 1;
      return;
    }
    await sharp(job.src)
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(dest);
    written += 1;
  });

  fs.writeFileSync(path.join(outRoot, "manifest.json"), JSON.stringify(manifest));
  console.log(`🖼 그리드 미리보기 ${written}장 생성, ${skipped}장 유지 (jobs ${jobs.length})`);
  return { written, skipped };
}

if (require.main === module) {
  buildGridThumbs().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { buildGridThumbs };

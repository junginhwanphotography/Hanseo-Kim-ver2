/**
 * GitHub Pages에 올릴 공개 파일만 _site 로 모읍니다.
 * web 페이지는 사이트 루트로, 섹션 폴더의 사진을 함께 둡니다.
 */

const fs = require("fs");
const path = require("path");
const { WEB, SITE_OUT, RECENT_DIR, BOOKS_DIR, INFO_DIR } = require("./paths");
const { buildCatalog } = require("./catalog");
const { buildGridThumbs } = require("./build-grid-thumbs");

const dest = SITE_OUT;

async function preparePages() {
  await buildGridThumbs();
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(WEB, dest, { recursive: true });
  const sections = [
    [RECENT_DIR, "recent-pictures"],
    [BOOKS_DIR, "books-and-printed-work"],
    [INFO_DIR, "info"],
  ];
  for (const [src, name] of sections) {
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, name), { recursive: true, dereference: true });
  }
  fs.writeFileSync(path.join(dest, "catalog.json"), JSON.stringify(buildCatalog()));
  console.log("📦 GitHub Pages 준비:", dest);
}

if (require.main === module) {
  preparePages().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { preparePages };

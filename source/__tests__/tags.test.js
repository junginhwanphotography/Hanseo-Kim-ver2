const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadTags() {
  const context = { window: {}, decodeURIComponent };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../web/sections/tags.js"), "utf8"),
    context
  );
  return context.window.HanseoTags;
}

describe("사진 태그", () => {
  const tags = loadTags();

  it("파일 이름 맨 뒤의 영단어를 태그로 읽는다", () => {
    expect(tags.tagFromSrc("photographs/%EB%B0%94%EB%8B%A5/3_sun.jpg")).toBe("sun");
    expect(tags.tagFromSrc("photographs/shizuoka/16_sun.JPG")).toBe("sun");
    expect(tags.tagFromSrc("photographs/yeongwol/0601-13_sex.jpg")).toBe("sex");
    expect(tags.tagFromSrc("photographs/WALL/3-1_sun.jpg")).toBe("sun");
    expect(tags.tagFromSrc("photographs/folder/3_sun_sea.jpg")).toBe("sea");
    expect(tags.tagFromSrc("photographs/folder/IMG_2044.jpg")).toBe("");
    expect(tags.tagFromSrc("photographs/WALL/3-1.jpg")).toBe("");
    expect(tags.tagFromSrc("photographs/folder/0601-07.jpg")).toBe("");
    expect(tags.tagFromSrc("photographs/folder/1.jpg")).toBe("");
  });

  it("읽힌 글씨를 태그 중 가장 비슷한 것으로 고른다", () => {
    expect(tags.matchWord("sun", ["sun"])).toBe("sun");
    expect(tags.matchWord("s u n", ["sun"])).toBe("sun");
    expect(tags.matchWord("xxsunyy", ["sun", "sex"])).toBe("sun");
    expect(tags.matchWord("gsex", ["sun", "sex"])).toBe("sex");
    expect(tags.matchWord("gum", ["sun", "sex"], null, true)).toBe("sun");
    expect(tags.matchWord("gex", ["sun", "sex"], null, true)).toBe("sex");
    expect(tags.matchWord("sum", ["sun"], null, true)).toBe("sun");
    expect(tags.matchWord("se", ["sex"], null, false)).toBe("");
    expect(tags.matchWord("se", ["sex"], null, true)).toBe("");
    expect(tags.matchWord("su", ["sun", "sex"], null, false)).toBe("");
    expect(tags.matchWord("su", ["sun", "sex"], null, true)).toBe("");
    expect(tags.matchWord("s", ["sun", "sex"], null, true)).toBe("");
    expect(tags.matchWord("cat", ["sun"])).toBe("");
    expect(tags.matchWord("moon", ["sun", "moon"])).toBe("moon");
  });

  it("키보드로 친 단어가 태그와 같으면 고른다", () => {
    expect(tags.commandTag("sun", ["sun", "sex"])).toBe("sun");
    expect(tags.commandTag("SUN", ["sun"])).toBe("sun");
    expect(tags.commandTag("ssun", ["sun"])).toBe("sun");
    expect(tags.commandTag("su", ["sun"])).toBe("");
    expect(tags.commandTag("sex", ["sun", "sex"])).toBe("sex");
    expect(tags.commandTag("sun", ["sun", "sunny"])).toBe("");
    expect(tags.commandTag("sun", ["sun", "sunny"], true)).toBe("sun");
    expect(tags.commandTag("sunny", ["sun", "sunny"])).toBe("sunny");
  });
});

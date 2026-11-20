const fs = require("fs");
const path = require("path");
const hand = require("../web/sections/hand.js");

describe("손글씨 읽기", () => {
  it("학습된 모델과 같은 글자를 읽는다", () => {
    const root = path.join(__dirname, "..");
    const meta = JSON.parse(fs.readFileSync(path.join(root, "web/vendor/hand/model.json"), "utf8"));
    const weights = fs.readFileSync(path.join(root, "web/vendor/hand/weights.bin"));
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/hand-sample.json"), "utf8"));
    hand.load(meta, weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength));
    const read = hand.readInk(Float32Array.from(fixture.input), fixture.width);
    expect(read.text).toBe(fixture.text);
  });
});

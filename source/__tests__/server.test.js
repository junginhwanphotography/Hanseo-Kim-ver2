const request = require("supertest");
const server = require("../tools/server");

describe("HTTP 서버 기본 동작", () => {
  it("GET / 요청 시 200과 HTML을 반환한다", async () => {
    const response = await request(server).get("/");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("Hanseo Kim");
  });

  it("쿼리가 붙은 첫 페이지도 HTML을 반환한다", async () => {
    const response = await request(server).get("/?v=1");

    expect(response.status).toBe(200);
    expect(response.text).toContain("photographs");
  });

  it("컬렉션 JSON을 web에서 제공한다", async () => {
    const response = await request(server).get("/collections.json");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("이전 photos 경로와 contact 파일은 제공하지 않는다", async () => {
    const collections = await request(server).get(
      "/collections/paris%20to%20rome/images.json"
    );
    const contact = await request(server).get("/contact.rtf");

    expect(collections.status).toBe(404);
    expect(contact.status).toBe(404);
  });

  it("세 메뉴 목록과 사진 파일을 따로 제공한다", async () => {
    const response = await request(server).get("/catalog.json");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body.recent.map((item) => item.title)).toEqual([
      "영월",
      "바닥을 기어다니며",
      "paris to rome",
      "Mt.Fuji to Tokyo with BAHNO 1",
      "shizuoka",
      "okinawa",
      "WALL",
      "통신보안",
    ]);
    expect(response.body.recent[0].images[0]).toMatch(/^photographs_(white|black)\//);
    expect(response.body.recent[0].imagesWhite.length).toBeGreaterThan(0);
    expect(response.body.recent[0].imagesBlack.length).toBeGreaterThan(0);
    const tagged = [];
    response.body.recent.forEach((item) => {
      item.images.forEach((src) => {
        const name = decodeURIComponent(src.split("/").pop());
        if (/_(sun|sex|sea|lux)\./i.test(name)) tagged.push(name);
      });
    });
    expect(tagged).toEqual([
      "0601-12_lux.jpg",
      "0601-13_sex.jpg",
      "0602-05_lux.jpg",
      "3_sun.jpg",
      "10_sun.jpg",
      "11_sun.jpg",
      "10_sun.jpg",
      "14_sex.jpg",
      "16_sun.jpg",
      "3_sex.jpg",
      "16_sex.jpg",
    ]);
    expect(response.body.recent.some((item) => item.id === "_WALL")).toBe(false);
    expect(Array.isArray(response.body.books)).toBe(true);
    expect(response.body.contact).toContain("kimhanseo123@naver.com");
    expect(response.body.contact).toContain("For Contact:");

    const rich = await request(server).get("/contact/contact.rtf");
    const oldRich = await request(server).get("/info/info.rtf");
    expect(rich.status).toBe(200);
    expect(rich.text).toContain("kimhanseo123@naver.com");
    expect(oldRich.status).toBe(404);

    const image = await request(server).get("/" + response.body.recent[0].images[0]);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toContain("image/jpeg");
  });

  it("존재하지 않는 경로에 404를 반환한다", async () => {
    const response = await request(server).get("/__not_exists__.html");

    expect(response.status).toBe(404);
    expect(response.text).toContain("404 Not Found");
  });
});

const path = require("path");

const SITE = path.resolve(__dirname, "..");
const PROJECT = path.resolve(SITE, "..");
const WEB = path.join(SITE, "web");
const RECENT_WHITE_DIR = path.join(PROJECT, "photographs_white");
const RECENT_BLACK_DIR = path.join(PROJECT, "photographs_black");
const RECENT_DIR = RECENT_WHITE_DIR;
const BOOKS_DIR = path.join(PROJECT, "Books and Printed Work");
const CONTACT_DIR = path.join(PROJECT, "contact");
const COLLECTIONS_DIR = RECENT_WHITE_DIR;
const COLLECTIONS_URL = "photographs_white";
const COLLECTIONS_URL_WHITE = "photographs_white";
const COLLECTIONS_URL_BLACK = "photographs_black";
const SITE_OUT = path.join(SITE, "_site");

module.exports = {
  PROJECT,
  SITE,
  WEB,
  COLLECTIONS_DIR,
  RECENT_DIR,
  RECENT_WHITE_DIR,
  RECENT_BLACK_DIR,
  BOOKS_DIR,
  CONTACT_DIR,
  COLLECTIONS_URL,
  COLLECTIONS_URL_WHITE,
  COLLECTIONS_URL_BLACK,
  SITE_OUT,
};

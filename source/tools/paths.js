const path = require("path");

const SITE = path.resolve(__dirname, "..");
const PROJECT = path.resolve(SITE, "..");
const WEB = path.join(SITE, "web");
const RECENT_LIGHT_DIR = path.join(PROJECT, "photographs_light");
const RECENT_DARK_DIR = path.join(PROJECT, "photographs_dark");
const RECENT_DIR = RECENT_LIGHT_DIR;
const BOOKS_DIR = path.join(PROJECT, "Books and Printed Work");
const CONTACT_DIR = path.join(PROJECT, "contact");
const COLLECTIONS_DIR = RECENT_LIGHT_DIR;
const COLLECTIONS_URL = "photographs_light";
const COLLECTIONS_URL_LIGHT = "photographs_light";
const COLLECTIONS_URL_DARK = "photographs_dark";
const SITE_OUT = path.join(SITE, "_site");

module.exports = {
  PROJECT,
  SITE,
  WEB,
  COLLECTIONS_DIR,
  RECENT_DIR,
  RECENT_LIGHT_DIR,
  RECENT_DARK_DIR,
  BOOKS_DIR,
  CONTACT_DIR,
  COLLECTIONS_URL,
  COLLECTIONS_URL_LIGHT,
  COLLECTIONS_URL_DARK,
  SITE_OUT,
};

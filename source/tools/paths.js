const path = require("path");

const SITE = path.resolve(__dirname, "..");
const PROJECT = path.resolve(SITE, "..");
const WEB = path.join(SITE, "web");
const RECENT_DIR = path.join(PROJECT, "Recent Pictures");
const BOOKS_DIR = path.join(PROJECT, "Books and Printed Work");
const INFO_DIR = path.join(PROJECT, "Info");
const COLLECTIONS_DIR = RECENT_DIR;
const COLLECTIONS_URL = "recent-pictures";
const SITE_OUT = path.join(SITE, "_site");

module.exports = {
  PROJECT,
  SITE,
  WEB,
  COLLECTIONS_DIR,
  RECENT_DIR,
  BOOKS_DIR,
  INFO_DIR,
  COLLECTIONS_URL,
  SITE_OUT,
};

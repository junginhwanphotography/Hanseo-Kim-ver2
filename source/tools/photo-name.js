/**
 * Filename helpers for gallery photos.
 * Example: thumbnail_4_sex.jpg → cover marker + number 4 + tag sex
 */

function gallerySortName(name) {
  return String(name || "").replace(/^thumbnail_/i, "");
}

function comparePhotoNames(a, b) {
  return gallerySortName(a).localeCompare(gallerySortName(b), "en", { numeric: true });
}

function isThumbnailName(name) {
  return /^thumbnail_/i.test(String(name || ""));
}

module.exports = {
  gallerySortName,
  comparePhotoNames,
  isThumbnailName,
};

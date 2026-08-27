#!/usr/bin/env node
// GitHub Pages caches local .js/.css files for 10 minutes (Cache-Control: max-age=600),
// and browsers/edge caches have been observed holding on to them noticeably longer in
// practice - so a deploy can go live on the server while visitors still run stale JS
// until they hard-refresh. This appends/refreshes a "?v=<version>" query string on every
// local <script src> and <link rel="stylesheet" href> tag across the site's HTML files,
// so each deploy's URLs are new and browsers can't reuse a stale cached copy.
//
// Run this (from the repo root) any time you change a shared .js/.css file, right before
// committing: `node tools/bump-cache-version.js`. It edits the HTML files in place.
// External CDN URLs (https://...) are left untouched on purpose - the query string only
// needs to change when this repo's own files change.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const HTML_FILES = [
  "blocks.html",
  "breakout.html",
  "crossword.html",
  "flashcards.html",
  "hangman.html",
  "hanoi.html",
  "index.html",
  "maze.html",
  "memory.html",
  "pacman.html",
  "power.html",
  "smileyfind.html",
  "snake.html",
  "storybook.html",
  "sudoku.html",
  "tetris.html",
  "word-edit.html",
  "wordcards.html",
  "journeys/add.html",
  "journeys/index.html",
  "journeys/reader.html"
];

function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function defaultVersion() {
  const d = new Date();
  return (
    d.getFullYear() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    pad2(d.getHours()) +
    pad2(d.getMinutes())
  );
}

const version = process.argv[2] || defaultVersion();

// Matches src="path/to/file.js" or href="path/to/file.css" (optionally already
// carrying a ?v=... query string, which gets replaced), but never touches
// http(s):// URLs - those are external CDNs we don't control or need to bust.
const TAG_ATTR = /(\b(?:src|href)=")((?!https?:\/\/)[^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")/g;

let totalChanged = 0;

HTML_FILES.forEach((relPath) => {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) {
    console.log("skip (not found):", relPath);
    return;
  }
  const original = fs.readFileSync(filePath, "utf8");
  let changed = 0;
  const updated = original.replace(TAG_ATTR, function (match, prefix, url, suffix) {
    changed++;
    return prefix + url + "?v=" + version + suffix;
  });
  if (changed > 0 && updated !== original) {
    fs.writeFileSync(filePath, updated, "utf8");
    totalChanged += changed;
    console.log(relPath + ": " + changed + " tag(s) -> ?v=" + version);
  } else {
    console.log(relPath + ": no local script/link tags found");
  }
});

console.log("\nDone. " + totalChanged + " tag(s) updated to ?v=" + version + " across " + HTML_FILES.length + " file(s).");

# Hash → Magnet Converter

Static GitHub Pages site that converts a BitTorrent v1 info-hash into a magnet link.

## Files

- `index.html` — semantic page structure only.
- `styles.css` — all visual styling and responsive layout.
- `app.js` — hash parsing, state updates, clipboard handling, external opening, and torrent-cache download logic.

## How to use on GitHub Pages

1. Upload `index.html`, `styles.css`, and `app.js` to the root of a GitHub repository.
2. Go to **Settings → Pages**.
3. Choose the branch and root folder.
4. Open the GitHub Pages URL.

## Important limitation

A `.torrent` file cannot be generated from only an info-hash on a fully static page.
The download button opens a public torrent-cache URL. It only works when that cache already has metadata for the hash.

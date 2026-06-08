const fs = require('fs');
const path = require('path');

const MENU_PATH = path.join(__dirname, '..', 'data', 'menu.json');

let menuCache = null;

function load() {
  if (menuCache) return menuCache;
  try {
    const raw = fs.readFileSync(MENU_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('menu.json must contain an array');
    }
    menuCache = parsed;
    console.log(`✓ Loaded ${menuCache.length} menu items from data/menu.json`);
    return menuCache;
  } catch (err) {
    console.error('✗ Failed to load menu.json:', err.message);
    menuCache = [];
    return menuCache;
  }
}

// Load eagerly on require so we fail fast at boot
load();

exports.getAll = () => load();

exports.findById = (id) => load().find((item) => item.id === id) || null;

// Useful for testing — force a re-read from disk
exports.reload = () => {
  menuCache = null;
  return load();
};

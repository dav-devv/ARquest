const path = require('path');
const crypto = require('crypto');

function isLoopback(address) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
}

function resolvePublicFile(root, requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(requestPath); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.includes(':')) return null;
  const file = path.resolve(root, '.' + '/' + decoded);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!['.html', '.js', '.mjs', '.wasm', '.task', '.css', '.png', '.jpg', '.svg', '.ico'].includes(path.extname(file))) return null;
  return file;
}

function validToken(candidate, token) {
  return typeof candidate === 'string' && /^[a-f0-9]+$/.test(candidate) && candidate.length === token.length &&
    crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
}

module.exports = { isLoopback, resolvePublicFile, validToken };

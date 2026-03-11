const path = require('path');

function createPathValidator(root) {
  const resolvedRoot = path.resolve(root);

  return function safePath(userPath) {
    if (!userPath) return null;
    const resolved = path.resolve(userPath);
    if (!resolved.startsWith(resolvedRoot)) return null;
    return resolved;
  };
}

module.exports = { createPathValidator };

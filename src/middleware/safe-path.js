const path = require('path');

/**
 * Creates a path validator bound to a root directory.
 * Returns null if the resolved path escapes the root.
 */
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

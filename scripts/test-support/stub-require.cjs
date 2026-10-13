// Preload for DB-backed action tests outside Next.js:
//   node --require ./scripts/test-support/stub-require.cjs --import tsx <test.ts>
// Replaces only the session layer (src/lib/auth) and the `server-only` marker;
// the Server Actions, Prisma, and transactions under test stay real.
const Module = require("node:module");
const path = require("node:path");

const stubs = {
  serverOnly: path.join(__dirname, "stubs", "server-only.cjs"),
  auth: path.join(__dirname, "stubs", "auth.cjs"),
};
const authPattern = /[\\/]src[\\/]lib[\\/]auth(\.ts)?$/;

const original = Module._resolveFilename;
Module._resolveFilename = function resolveWithStubs(request, parent, isMain, options) {
  if (request === "server-only") return stubs.serverOnly;
  if (request === "@/lib/auth" || authPattern.test(request)) return stubs.auth;
  const resolved = original.call(this, request, parent, isMain, options);
  return authPattern.test(resolved) ? stubs.auth : resolved;
};

// Test stub for @/lib/auth: the acting user comes from TEST_USER_ID.
// Only for DB-backed action tests against a disposable database.
function testUser(role) {
  const id = Number(process.env.TEST_USER_ID);
  if (!Number.isInteger(id) || id <= 0) throw new Error("TEST_USER_ID belum di-set.");
  return { id, username: "test", nama: "Test User", role };
}

module.exports = {
  async requireRole(...roles) {
    return testUser(roles[0]);
  },
  async requireUser() {
    return testUser("ADMIN_KASIR");
  },
  async getSession() {
    return testUser("ADMIN_KASIR");
  },
};

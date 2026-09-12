import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { turso } from "../src/lib/turso";
import { createSessionToken, verifySessionToken } from "../src/lib/auth";

async function runAuthTests() {
  console.log("==================================================");
  console.log("TESTING FULL AUTHENTICATION & MANAGEMENT PIPELINE");
  console.log("==================================================");

  // 1. Verify Default Account Exists
  console.log("\n1. Testing Default Account Verification...");
  const defaultEmail = "uzeetechcare@gmail.com";
  const userRes = await turso.execute({
    sql: "SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1",
    args: [defaultEmail],
  });

  if (userRes.rows.length === 0) {
    throw new Error(`Default user ${defaultEmail} not found in database!`);
  }
  const user = userRes.rows[0];
  console.log(`✓ Found user ${user.email} (ID: ${user.id})`);

  // 2. Test Password Comparison
  console.log("\n2. Testing Password Verification...");
  const correctMatch = await bcrypt.compare("123456", String(user.password_hash));
  if (!correctMatch) {
    throw new Error("Default password '123456' failed bcrypt comparison!");
  }
  console.log("✓ Correct password '123456' verified successfully.");

  const wrongMatch = await bcrypt.compare("wrongpass", String(user.password_hash));
  if (wrongMatch) {
    throw new Error("Wrong password matched unexpectedly!");
  }
  console.log("✓ Invalid password correctly rejected.");

  // 3. Test JWT Session Creation & Verification
  console.log("\n3. Testing JWT Session Generation & Verification (jose)...");
  const { token, maxAge } = await createSessionToken(
    { id: String(user.id), email: String(user.email) },
    false
  );
  if (!token || maxAge !== 12 * 60 * 60) {
    throw new Error("createSessionToken failed to return expected token or maxAge");
  }
  console.log(`✓ Signed 12-hour session JWT: ${token.slice(0, 24)}...`);

  const decoded = await verifySessionToken(token);
  if (!decoded || decoded.id !== String(user.id) || decoded.email !== defaultEmail) {
    throw new Error("verifySessionToken failed to decode payload!");
  }
  console.log(`✓ Decoded session payload matches user: ${decoded.email}`);

  // Test 30-day "Remember Me" session
  const rememberSession = await createSessionToken(
    { id: String(user.id), email: String(user.email) },
    true
  );
  if (rememberSession.maxAge !== 30 * 24 * 60 * 60) {
    throw new Error("Remember Me session maxAge did not equal 30 days!");
  }
  console.log("✓ 30-day 'Remember Me' session maxAge verified.");

  // 4. Test Password Reset Pipeline
  console.log("\n4. Testing Self-Serve Password Reset Pipeline...");
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const resetTokenId = uuidv4();

  await turso.execute({
    sql: "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    args: [resetTokenId, String(user.id), tokenHash, expiresAt],
  });
  console.log("✓ Password reset token generated and inserted into Turso.");

  // Verify token lookup
  const tokenLookup = await turso.execute({
    sql: "SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1",
    args: [tokenHash],
  });
  if (tokenLookup.rows.length === 0) {
    throw new Error("Failed to look up password reset token by hash!");
  }
  console.log("✓ Token hash successfully verified in database.");

  // Perform password update
  const newPassword = "newpassword999";
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await turso.batch(
    [
      {
        sql: "UPDATE users SET password_hash = ? WHERE id = ?",
        args: [newPasswordHash, String(user.id)],
      },
      {
        sql: "DELETE FROM password_reset_tokens WHERE user_id = ?",
        args: [String(user.id)],
      },
    ],
    "write"
  );
  console.log("✓ Password reset transaction executed.");

  // Verify new password works and token was consumed
  const updatedUserRes = await turso.execute({
    sql: "SELECT password_hash FROM users WHERE id = ?",
    args: [String(user.id)],
  });
  const updatedHash = String(updatedUserRes.rows[0].password_hash);
  const newPassValid = await bcrypt.compare(newPassword, updatedHash);
  if (!newPassValid) {
    throw new Error("New password failed verification after reset!");
  }
  const oldPassInvalid = await bcrypt.compare("123456", updatedHash);
  if (oldPassInvalid) {
    throw new Error("Old password still validated after reset!");
  }
  console.log("✓ New password validates; old password rejected.");

  const tokensLeft = await turso.execute({
    sql: "SELECT COUNT(*) as count FROM password_reset_tokens WHERE user_id = ?",
    args: [String(user.id)],
  });
  if (Number(tokensLeft.rows[0].count) !== 0) {
    throw new Error("Reset token was not deleted after password reset!");
  }
  console.log("✓ Reset token consumed and deleted.");

  // Restore default password '123456'
  const restoredHash = await bcrypt.hash("123456", 10);
  await turso.execute({
    sql: "UPDATE users SET password_hash = ? WHERE id = ?",
    args: [restoredHash, String(user.id)],
  });
  console.log("✓ Restored default password '123456'.");

  // 5. Test Admin User Management (Create, List, Delete)
  console.log("\n5. Testing Admin User Management...");
  const testUserEmail = "testemployee@uzee.tech";
  const testUserPassword = "temporarypass123";
  const testUserHash = await bcrypt.hash(testUserPassword, 10);
  const testUserId = uuidv4();

  // Create user
  await turso.execute({
    sql: "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
    args: [testUserId, testUserEmail, testUserHash],
  });
  console.log(`✓ Added test user: ${testUserEmail}`);

  // List users
  const allUsersRes = await turso.execute("SELECT id, email FROM users");
  const foundTestUser = allUsersRes.rows.some((r) => String(r.email) === testUserEmail);
  if (!foundTestUser) {
    throw new Error("Created test user not found in users list!");
  }
  console.log(`✓ Users list contains ${allUsersRes.rows.length} accounts.`);

  // Delete user
  await turso.execute({
    sql: "DELETE FROM users WHERE id = ?",
    args: [testUserId],
  });
  const afterDeleteRes = await turso.execute({
    sql: "SELECT id FROM users WHERE id = ?",
    args: [testUserId],
  });
  if (afterDeleteRes.rows.length !== 0) {
    throw new Error("Test user was not deleted!");
  }
  console.log("✓ Test user deleted successfully.");

  console.log("\n==================================================");
  console.log("🎉 ALL AUTHENTICATION & MANAGEMENT TESTS PASSED!");
  console.log("==================================================");
}

runAuthTests().catch((err) => {
  console.error("❌ Auth test failure:", err);
  process.exit(1);
});

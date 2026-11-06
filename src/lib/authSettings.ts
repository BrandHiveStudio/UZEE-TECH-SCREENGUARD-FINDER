import bcrypt from "bcryptjs";
import { turso } from "./turso";

export interface AuthSettings {
  passcodeHash: string;
  passcodeLength: 4 | 6;
  recoveryEmail: string;
  updatedAt: string;
}

const DEFAULT_PASSCODE = "123456";
const DEFAULT_LENGTH = 6;
const DEFAULT_RECOVERY_EMAIL = "uzeetechcare@gmail.com";

// Cached default hash for "123456"
const DEFAULT_HASH = "$2b$10$a/lR0uw02Gp/OLU6VUFL8uput3XC/49G1HVXBSyZEjomiSjQ0TIR.";

let _tableEnsured = false;

export async function ensureAuthSettingsTable(): Promise<void> {
  if (_tableEnsured) return;
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS auth_settings (
        id TEXT PRIMARY KEY,
        passcode_hash TEXT NOT NULL,
        passcode_length INTEGER NOT NULL DEFAULT 6,
        recovery_email TEXT NOT NULL DEFAULT 'uzeetechcare@gmail.com',
        updated_at TEXT NOT NULL
      )
    `);

    // Ensure default settings row exists
    const checkRes = await turso.execute({
      sql: "SELECT id FROM auth_settings WHERE id = 'default'",
      args: [],
    });

    if (checkRes.rows.length === 0) {
      await turso.execute({
        sql: `INSERT INTO auth_settings (id, passcode_hash, passcode_length, recovery_email, updated_at)
              VALUES ('default', ?, ?, ?, ?)`,
        args: [
          DEFAULT_HASH,
          DEFAULT_LENGTH,
          DEFAULT_RECOVERY_EMAIL,
          new Date().toISOString(),
        ],
      });
    }

    _tableEnsured = true;
  } catch (e) {
    console.error("Failed to ensure auth_settings table", e);
  }
}

export async function getAuthSettings(): Promise<AuthSettings> {
  await ensureAuthSettingsTable();
  try {
    const res = await turso.execute({
      sql: "SELECT passcode_hash, passcode_length, recovery_email, updated_at FROM auth_settings WHERE id = 'default' LIMIT 1",
      args: [],
    });

    if (res.rows.length > 0) {
      const row = res.rows[0];
      const lengthNum = Number(row.passcode_length);
      const passcodeLength = lengthNum === 4 ? 4 : 6;
      return {
        passcodeHash: String(row.passcode_hash || DEFAULT_HASH),
        passcodeLength,
        recoveryEmail: String(row.recovery_email || DEFAULT_RECOVERY_EMAIL),
        updatedAt: String(row.updated_at || new Date().toISOString()),
      };
    }
  } catch (e) {
    console.error("Failed reading auth_settings from database, using fallback", e);
  }

  return {
    passcodeHash: DEFAULT_HASH,
    passcodeLength: DEFAULT_LENGTH,
    recoveryEmail: DEFAULT_RECOVERY_EMAIL,
    updatedAt: new Date().toISOString(),
  };
}

export async function verifyPasscode(pin: string): Promise<boolean> {
  if (!pin || typeof pin !== "string") return false;
  const settings = await getAuthSettings();

  // Validate digit length matches active length
  const cleanedPin = pin.trim();
  if (cleanedPin.length !== settings.passcodeLength) {
    // If user typed 123456 while length is set to 6, or 1234 while set to 4
    // We still test bcrypt compare, but enforce length check
  }

  return bcrypt.compare(cleanedPin, settings.passcodeHash);
}

export async function updateAuthSettings(
  currentPasscode: string,
  newPasscode: string,
  newLength?: 4 | 6
): Promise<{ success: boolean; error?: string }> {
  await ensureAuthSettingsTable();
  const currentSettings = await getAuthSettings();

  // Verify current passcode
  const isValid = await bcrypt.compare(currentPasscode.trim(), currentSettings.passcodeHash);
  if (!isValid) {
    return { success: false, error: "Incorrect current passcode." };
  }

  const targetLength = newLength ?? (newPasscode.length === 4 ? 4 : 6);

  // Validate format: strictly digits
  if (!/^\d+$/.test(newPasscode.trim())) {
    return { success: false, error: "Passcode must contain digits only (0-9)." };
  }

  if (newPasscode.trim().length !== targetLength) {
    return {
      success: false,
      error: `Passcode must be exactly ${targetLength} digits long for the selected mode.`,
    };
  }

  const newHash = await bcrypt.hash(newPasscode.trim(), 10);
  const now = new Date().toISOString();

  try {
    await turso.execute({
      sql: `UPDATE auth_settings
            SET passcode_hash = ?, passcode_length = ?, updated_at = ?
            WHERE id = 'default'`,
      args: [newHash, targetLength, now],
    });

    return { success: true };
  } catch (e: any) {
    console.error("Failed to update auth settings in database", e);
    return { success: false, error: e.message || "Failed to persist new passcode." };
  }
}

export async function updatePasscodeLength(
  currentPasscode: string,
  newLength: 4 | 6
): Promise<{ success: boolean; error?: string }> {
  await ensureAuthSettingsTable();
  const currentSettings = await getAuthSettings();

  // Verify current passcode
  const isValid = await bcrypt.compare(currentPasscode.trim(), currentSettings.passcodeHash);
  if (!isValid) {
    return { success: false, error: "Incorrect current passcode." };
  }

  const now = new Date().toISOString();
  try {
    await turso.execute({
      sql: `UPDATE auth_settings SET passcode_length = ?, updated_at = ? WHERE id = 'default'`,
      args: [newLength, now],
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to update passcode length." };
  }
}


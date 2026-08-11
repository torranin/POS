import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import { canAccess, roleLabels, type UserRole } from "@/lib/roles";

export type CurrentUser = { id: number; username: string; displayName: string; role: UserRole };
export { canAccess, roleLabels };
export type { UserRole };

const SESSION_COOKIE = "baan_chang_session";
const SESSION_DAYS = 7;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, storedHash] = stored.split(":");
  if (!salt || !storedHash) return false;
  const supplied = scryptSync(password, salt, 64);
  const expected = Buffer.from(storedHash, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await pool.execute("DELETE FROM user_sessions WHERE expires_at < NOW()");
  await pool.execute("INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)", [userId, tokenHash(token), expires]);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await pool.execute("DELETE FROM user_sessions WHERE token_hash = ?", [tokenHash(token)]);
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [rows] = await pool.execute<(RowDataPacket & CurrentUser)[]>(
    `SELECT u.id, u.username, u.display_name AS displayName, u.role
     FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.is_active = 1 LIMIT 1`,
    [tokenHash(token)]
  );
  return rows[0] ?? null;
}

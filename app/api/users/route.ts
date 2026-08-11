import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { canAccess, getCurrentUser, hashPassword, type UserRole } from "@/lib/auth";
import { pool } from "@/lib/db";

async function adminOnly() {
  const user = await getCurrentUser();
  return user && canAccess(user.role, "manage_users") ? user : null;
}

export async function GET() {
  if (!await adminOnly()) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการผู้ใช้" }, { status: 403 });
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id, username, display_name AS displayName, role, is_active AS isActive, last_login_at AS lastLoginAt, created_at AS createdAt FROM users ORDER BY id");
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการผู้ใช้" }, { status: 403 });
  try {
    const { username, displayName, password, role } = await request.json() as { username: string; displayName: string; password: string; role: UserRole };
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username) || !displayName?.trim() || password?.length < 8 || !["admin","manager","warehouse","user"].includes(role)) return NextResponse.json({ message: "ข้อมูลไม่ถูกต้อง รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    await pool.execute("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)", [username.toLowerCase(), hashPassword(password), displayName.trim(), role]);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const duplicate = error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY";
    return NextResponse.json({ message: duplicate ? "ชื่อผู้ใช้นี้มีอยู่แล้ว" : "เพิ่มผู้ใช้ไม่สำเร็จ" }, { status: duplicate ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการผู้ใช้" }, { status: 403 });
  const { id, isActive, password, role } = await request.json() as { id: number; isActive?: boolean; password?: string; role?: UserRole };
  if (!Number.isInteger(id)) return NextResponse.json({ message: "รหัสผู้ใช้ไม่ถูกต้อง" }, { status: 400 });
  if (password) {
    if (password.length < 8) return NextResponse.json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(password), id]);
  }
  if ((role || typeof isActive === "boolean") && id === admin.id) return NextResponse.json({ message: "ไม่สามารถเปลี่ยนสิทธิ์หรือระงับบัญชีที่กำลังใช้งาน" }, { status: 400 });
  if (role && ["admin","manager","warehouse","user"].includes(role)) await pool.execute("UPDATE users SET role = ? WHERE id = ?", [role, id]);
  if (typeof isActive === "boolean") {
    await pool.execute("UPDATE users SET is_active = ? WHERE id = ?", [isActive, id]);
    if (!isActive) await pool.execute("DELETE FROM user_sessions WHERE user_id = ?", [id]);
  }
  return NextResponse.json({ ok: true });
}

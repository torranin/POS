import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { createSession, verifyPassword } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (typeof username !== "string" || typeof password !== "string") return NextResponse.json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
    const [rows] = await pool.execute<(RowDataPacket & { id: number; password_hash: string; is_active: number })[]>(
      "SELECT id, password_hash, is_active FROM users WHERE username = ? LIMIT 1", [username.trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return NextResponse.json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }
    await createSession(user.id);
    await pool.execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "ไม่สามารถเข้าสู่ระบบได้" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { canAccess, getCurrentUser } from "@/lib/auth";
import { getCategories, pool } from "@/lib/db";

function cleanName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  return NextResponse.json(await getCategories());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user.role, "manage_settings")) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการหมวดสินค้า" }, { status: 403 });
  try {
    const body = await request.json();
    const name = cleanName(body.name);
    if (!name) return NextResponse.json({ message: "กรุณากรอกชื่อหมวดสินค้า" }, { status: 400 });
    await pool.execute<ResultSetHeader>("INSERT INTO categories (name) VALUES (?)", [name]);
    return NextResponse.json(await getCategories(), { status: 201 });
  } catch (error) {
    const duplicate = error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY";
    return NextResponse.json({ message: duplicate ? "มีหมวดสินค้านี้อยู่แล้ว" : "เพิ่มหมวดสินค้าไม่สำเร็จ" }, { status: duplicate ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user.role, "manage_settings")) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการหมวดสินค้า" }, { status: 403 });
  try {
    const body = await request.json();
    const id = Number(body.id);
    const name = cleanName(body.name);
    if (!Number.isInteger(id) || id <= 0 || !name) return NextResponse.json({ message: "ข้อมูลหมวดสินค้าไม่ถูกต้อง" }, { status: 400 });
    const [result] = await pool.execute<ResultSetHeader>("UPDATE categories SET name = ? WHERE id = ?", [name, id]);
    if (!result.affectedRows) return NextResponse.json({ message: "ไม่พบหมวดสินค้าที่ต้องการแก้ไข" }, { status: 404 });
    return NextResponse.json(await getCategories());
  } catch (error) {
    const duplicate = error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY";
    return NextResponse.json({ message: duplicate ? "มีหมวดสินค้านี้อยู่แล้ว" : "แก้ไขหมวดสินค้าไม่สำเร็จ" }, { status: duplicate ? 409 : 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user.role, "manage_settings")) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการหมวดสินค้า" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ message: "รหัสหมวดสินค้าไม่ถูกต้อง" }, { status: 400 });
  const [rows] = await pool.execute<(RowDataPacket & { productCount: number })[]>("SELECT COUNT(*) AS productCount FROM products WHERE category_id = ? AND is_active = 1", [id]);
  if (Number(rows[0]?.productCount ?? 0) > 0) return NextResponse.json({ message: "ลบไม่ได้ เพราะยังมีสินค้าอยู่ในหมวดนี้" }, { status: 409 });
  await pool.execute("DELETE FROM categories WHERE id = ?", [id]);
  return NextResponse.json(await getCategories());
}

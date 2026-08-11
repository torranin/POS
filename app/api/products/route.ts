import { NextResponse } from "next/server";
import type { ResultSetHeader } from "mysql2/promise";
import { canAccess, getCurrentUser } from "@/lib/auth";
import { getProducts, pool } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  return NextResponse.json(await getProducts());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user.role, "manage_products")) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการสินค้า" }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.sku?.trim() || !body.name?.trim() || !body.category?.trim() || !body.unit?.trim() || Number(body.price) < 0 || Number(body.stock) < 0) return NextResponse.json({ message: "กรุณากรอกข้อมูลสินค้าให้ครบ" }, { status: 400 });
    await pool.execute("INSERT IGNORE INTO categories (name) VALUES (?)", [body.category.trim()]);
    const [result] = await pool.execute<ResultSetHeader>(`INSERT INTO products (sku,name,category_id,unit,price,stock,color,icon) SELECT ?,?,id,?,?,?,?,? FROM categories WHERE name=?`, [body.sku.trim().toUpperCase(), body.name.trim(), body.unit.trim(), Number(body.price), Number(body.stock), "#e6ecec", "tool", body.category.trim()]);
    const products = await getProducts();
    return NextResponse.json(products.find((p)=>p.id===result.insertId), { status: 201 });
  } catch (error) {
    const duplicate = error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY";
    return NextResponse.json({ message: duplicate ? "รหัส SKU นี้มีอยู่แล้ว" : "เพิ่มสินค้าไม่สำเร็จ" }, { status: duplicate ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user.role, "manage_products")) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการสินค้า" }, { status: 403 });
  try {
    const body = await request.json();
    const id = Number(body.id);
    const sku = String(body.sku ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();
    const unit = String(body.unit ?? "").trim();
    const price = Number(body.price);
    const stock = Math.floor(Number(body.stock));
    if (!Number.isInteger(id) || id <= 0 || !sku || !name || !category || !unit || price < 0 || stock < 0) return NextResponse.json({ message: "ข้อมูลสินค้าไม่ถูกต้อง" }, { status: 400 });
    await pool.execute("INSERT IGNORE INTO categories (name) VALUES (?)", [category]);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE products p
       JOIN categories c ON c.name = ?
       SET p.sku = ?, p.name = ?, p.category_id = c.id, p.unit = ?, p.price = ?, p.stock = ?
       WHERE p.id = ? AND p.is_active = 1`,
      [category, sku, name, unit, price, stock, id]
    );
    if (!result.affectedRows) return NextResponse.json({ message: "ไม่พบสินค้าที่ต้องการแก้ไข" }, { status: 404 });
    const products = await getProducts();
    return NextResponse.json(products.find((p)=>p.id===id));
  } catch (error) {
    const duplicate = error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY";
    return NextResponse.json({ message: duplicate ? "รหัส SKU นี้มีอยู่แล้ว" : "แก้ไขสินค้าไม่สำเร็จ" }, { status: duplicate ? 409 : 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccess(user.role, "manage_products")) return NextResponse.json({ message: "ไม่มีสิทธิ์จัดการสินค้า" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ message: "รหัสสินค้าไม่ถูกต้อง" }, { status: 400 });
  await pool.execute("UPDATE products SET is_active = 0 WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}

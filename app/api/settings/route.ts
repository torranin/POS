import { NextResponse } from "next/server";
import { getSettings, pool, type StoreSettings } from "@/lib/db";
import { canAccess, getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    return NextResponse.json(await getSettings());
  } catch {
    return NextResponse.json({ message: "ไม่สามารถอ่านการตั้งค่าได้" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    if (!canAccess(user.role, "manage_settings")) return NextResponse.json({ message: "ไม่มีสิทธิ์ตั้งค่าระบบ" }, { status: 403 });
    const body = await request.json() as Partial<StoreSettings>;
    const values: Record<string, string> = {
      store_name: String(body.storeName ?? "").slice(0, 180),
      legal_name: String(body.legalName ?? "").slice(0, 220),
      branch_name: String(body.branchName ?? "").slice(0, 100),
      branch_code: String(body.branchCode ?? "00000").replace(/\D/g, "").slice(0, 5).padStart(5, "0"),
      tax_id: String(body.taxId ?? "").replace(/\D/g, "").slice(0, 13),
      phone: String(body.phone ?? "").slice(0, 30),
      email: String(body.email ?? "").slice(0, 180),
      line_id: String(body.lineId ?? "").slice(0, 80),
      business_hours: String(body.businessHours ?? "").slice(0, 180),
      address: String(body.address ?? "").slice(0, 500),
      vat_rate: String(Math.max(0, Math.min(20, Number(body.vatRate) || 0))),
      low_stock_threshold: String(Math.max(0, Math.min(9999, Number(body.lowStockThreshold) || 0))),
      receipt_prefix: String(body.receiptPrefix ?? "POS").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 12) || "POS",
      receipt_footer: String(body.receiptFooter ?? "").slice(0, 300),
      auto_print: body.autoPrint ? "1" : "0",
    };
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const [key, value] of Object.entries(values)) {
        await connection.execute(
          `INSERT INTO store_settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, value]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return NextResponse.json({ ok: true, settings: await getSettings() });
  } catch {
    return NextResponse.json({ message: "บันทึกการตั้งค่าไม่สำเร็จ" }, { status: 500 });
  }
}

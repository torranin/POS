import { NextResponse } from "next/server";
import { getSettings, pool, type StoreSettings } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(await getSettings());
  } catch {
    return NextResponse.json({ message: "ไม่สามารถอ่านการตั้งค่าได้" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Partial<StoreSettings>;
    const values: Record<string, string> = {
      store_name: String(body.storeName ?? "").slice(0, 180),
      tax_id: String(body.taxId ?? "").slice(0, 30),
      phone: String(body.phone ?? "").slice(0, 30),
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

import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, pool } from "@/lib/db";

type SaleItemInput = { productId: number; quantity: number };
type ProductRow = RowDataPacket & { id: number; sku: string; name: string; unit: string; price: number; stock: number };

const paymentLabels = { cash: "เงินสด", qr: "QR / โอนเงิน", card: "บัตรเครดิต/เดบิต" } as const;

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items as SaleItemInput[] : [];
    const paymentMethod = ["cash", "qr", "card"].includes(String(body.paymentMethod)) ? String(body.paymentMethod) as keyof typeof paymentLabels : "cash";
    const customerName = String(body.customerName || "ลูกค้าทั่วไป").trim().slice(0, 120) || "ลูกค้าทั่วไป";

    const normalizedItems = items
      .map((item) => ({ productId: Number(item.productId), quantity: Math.max(1, Math.floor(Number(item.quantity) || 0)) }))
      .filter((item) => Number.isInteger(item.productId) && item.productId > 0 && item.quantity > 0);
    if (!normalizedItems.length) return NextResponse.json({ message: "ยังไม่มีสินค้าในรายการขาย" }, { status: 400 });

    const settings = await getSettings();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const ids = [...new Set(normalizedItems.map((item) => item.productId))];
      const placeholders = ids.map(() => "?").join(",");
      const [productRows] = await connection.query<ProductRow[]>(
        `SELECT id, sku, name, unit, CAST(price AS DOUBLE) AS price, stock FROM products WHERE is_active = 1 AND id IN (${placeholders}) FOR UPDATE`,
        ids
      );
      if (productRows.length !== ids.length) throw new Error("PRODUCT_NOT_FOUND");

      const productMap = new Map(productRows.map((product) => [product.id, product]));
      for (const item of normalizedItems) {
        const product = productMap.get(item.productId);
        if (!product || product.stock < item.quantity) throw new Error("OUT_OF_STOCK");
      }

      const receiptItems = normalizedItems.map((item) => {
        const product = productMap.get(item.productId)!;
        const lineTotal = product.price * item.quantity;
        return { productId: product.id, sku: product.sku, name: product.name, unit: product.unit, quantity: item.quantity, unitPrice: product.price, lineTotal };
      });
      const subtotal = receiptItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const maxDiscount = settings.allowDiscount ? subtotal * (settings.maxDiscountPercent / 100) : 0;
      const discount = settings.allowDiscount ? Math.min(money(body.discount), maxDiscount) : 0;
      const taxableAmount = Math.max(0, subtotal - discount);
      const vat = settings.vatRate > 0 ? (settings.pricesIncludeVat ? taxableAmount * settings.vatRate / (100 + settings.vatRate) : taxableAmount * (settings.vatRate / 100)) : 0;
      const beforeRounding = settings.pricesIncludeVat ? taxableAmount : taxableAmount + vat;
      const total = settings.roundingMode === "whole" ? Math.round(beforeRounding) : beforeRounding;
      const rounding = total - beforeRounding;

      const today = new Date();
      const datePart = `${String(today.getFullYear()).slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const receiptPrefix = settings.receiptPrefix || "POS";
      const taxPrefix = settings.taxInvoicePrefix || "TAX";
      const [countRows] = await connection.query<(RowDataPacket & { total: number })[]>(
        "SELECT COUNT(*) AS total FROM sales WHERE DATE(created_at) = CURDATE()"
      );
      const runningNo = Number(countRows[0]?.total ?? 0) + 1;
      const receiptNo = `${receiptPrefix}-${datePart}-${String(runningNo).padStart(4, "0")}`;
      const taxInvoiceNo = settings.taxInvoiceEnabled ? `${taxPrefix}-${datePart}-${String(runningNo).padStart(4, "0")}` : "";

      const [saleResult] = await connection.execute<ResultSetHeader>(
        "INSERT INTO sales (receipt_no, subtotal, discount, vat, total, payment_method) VALUES (?, ?, ?, ?, ?, ?)",
        [receiptNo, subtotal, discount, vat, total, paymentMethod]
      );
      for (const item of receiptItems) {
        await connection.execute(
          "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
          [saleResult.insertId, item.productId, item.quantity, item.unitPrice]
        );
        await connection.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, item.productId]);
      }
      await connection.commit();

      return NextResponse.json({
        receipt: {
          id: saleResult.insertId,
          receiptNo,
          taxInvoiceNo,
          customerName,
          cashierName: user.displayName,
          createdAt: today.toISOString(),
          paymentMethod,
          paymentLabel: paymentLabels[paymentMethod],
          subtotal,
          discount,
          vat,
          rounding,
          total,
          settings,
          items: receiptItems,
        },
      }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      const message = error instanceof Error && error.message === "OUT_OF_STOCK" ? "จำนวนสินค้าในสต็อกไม่พอ" : "บันทึกใบเสร็จไม่สำเร็จ";
      return NextResponse.json({ message }, { status: message === "จำนวนสินค้าในสต็อกไม่พอ" ? 409 : 500 });
    } finally {
      connection.release();
    }
  } catch {
    return NextResponse.json({ message: "ข้อมูลใบเสร็จไม่ถูกต้อง" }, { status: 400 });
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, pool } from "@/lib/db";
import { canAccess } from "@/lib/roles";

const paymentLabels = { cash: "เงินสด", qr: "QR / โอนเงิน", card: "เครดิต" } as const;

type SaleItemInput = { productId: number; quantity: number };
type ProductRow = RowDataPacket & { id: number; sku: string; name: string; unit: string; price: number; stock: number };
type SaleRow = RowDataPacket & {
  id: number;
  receiptNo: string;
  taxInvoiceNo: string | null;
  customerName: string;
  cashierName: string;
  subtotal: number;
  discount: number;
  vat: number;
  rounding: number;
  total: number;
  amountReceived: number;
  changeDue: number;
  paymentMethod: keyof typeof paymentLabels;
  status: "completed" | "voided" | "refunded";
  createdAt: Date;
  itemCount: number;
};

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100) / 100) : 0;
}

function toSale(row: SaleRow) {
  return {
    id: Number(row.id),
    receiptNo: row.receiptNo,
    taxInvoiceNo: row.taxInvoiceNo || "",
    customerName: row.customerName,
    cashierName: row.cashierName,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    vat: Number(row.vat),
    rounding: Number(row.rounding),
    total: Number(row.total),
    amountReceived: Number(row.amountReceived),
    changeDue: Number(row.changeDue),
    paymentMethod: row.paymentMethod,
    paymentLabel: paymentLabels[row.paymentMethod] || row.paymentMethod,
    status: row.status,
    createdAt: row.createdAt,
    itemCount: Number(row.itemCount),
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!canAccess(user.role, "sales")) return NextResponse.json({ message: "ไม่มีสิทธิ์ดูรายการขาย" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const saleId = Number(searchParams.get("id"));
  const period = searchParams.get("period") || "today";
  const query = (searchParams.get("q") || "").trim().slice(0, 100);

  try {
    if (Number.isInteger(saleId) && saleId > 0) {
      const [saleRows] = await pool.execute<SaleRow[]>(
        `SELECT s.id, s.receipt_no AS receiptNo, s.tax_invoice_no AS taxInvoiceNo,
                s.customer_name AS customerName, s.cashier_name AS cashierName,
                CAST(s.subtotal AS DOUBLE) AS subtotal, CAST(s.discount AS DOUBLE) AS discount,
                CAST(s.vat AS DOUBLE) AS vat, CAST(s.rounding AS DOUBLE) AS rounding,
                CAST(s.total AS DOUBLE) AS total, CAST(s.amount_received AS DOUBLE) AS amountReceived,
                CAST(s.change_due AS DOUBLE) AS changeDue, s.payment_method AS paymentMethod,
                s.status, s.created_at AS createdAt, COUNT(si.id) AS itemCount
           FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
          WHERE s.id = ? GROUP BY s.id`,
        [saleId],
      );
      if (!saleRows.length) return NextResponse.json({ message: "ไม่พบรายการขาย" }, { status: 404 });

      const [items] = await pool.execute<(RowDataPacket & { productId: number; sku: string; name: string; unit: string; quantity: number; unitPrice: number; lineTotal: number })[]>(
        `SELECT si.product_id AS productId, p.sku, p.name, p.unit, si.quantity,
                CAST(si.unit_price AS DOUBLE) AS unitPrice,
                CAST(si.unit_price * si.quantity AS DOUBLE) AS lineTotal
           FROM sale_items si JOIN products p ON p.id = si.product_id
          WHERE si.sale_id = ? ORDER BY si.id`,
        [saleId],
      );
      const sale = toSale(saleRows[0]);
      const settings = await getSettings();
      return NextResponse.json({
        receipt: { ...sale, settings, items: items.map((item) => ({ ...item, productId: Number(item.productId), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), lineTotal: Number(item.lineTotal) })) },
      });
    }

    const conditions: string[] = [];
    const params: Array<string> = [];
    if (period === "7days") conditions.push("s.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)");
    else if (period === "month") conditions.push("s.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
    else conditions.push("s.created_at >= CURDATE() AND s.created_at < CURDATE() + INTERVAL 1 DAY");
    if (query) {
      conditions.push("(s.receipt_no LIKE ? OR s.customer_name LIKE ?)");
      params.push(`%${query}%`, `%${query}%`);
    }

    const [rows] = await pool.execute<SaleRow[]>(
      `SELECT s.id, s.receipt_no AS receiptNo, s.tax_invoice_no AS taxInvoiceNo,
              s.customer_name AS customerName, s.cashier_name AS cashierName,
              CAST(s.subtotal AS DOUBLE) AS subtotal, CAST(s.discount AS DOUBLE) AS discount,
              CAST(s.vat AS DOUBLE) AS vat, CAST(s.rounding AS DOUBLE) AS rounding,
              CAST(s.total AS DOUBLE) AS total, CAST(s.amount_received AS DOUBLE) AS amountReceived,
              CAST(s.change_due AS DOUBLE) AS changeDue, s.payment_method AS paymentMethod,
              s.status, s.created_at AS createdAt, COALESCE(SUM(si.quantity), 0) AS itemCount
         FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
        WHERE ${conditions.join(" AND ")}
        GROUP BY s.id ORDER BY s.created_at DESC LIMIT 200`,
      params,
    );
    const sales = rows.map(toSale);
    const completed = sales.filter((sale) => sale.status === "completed");
    const totalSales = completed.reduce((sum, sale) => sum + sale.total, 0);
    return NextResponse.json({
      sales,
      summary: {
        totalSales,
        billCount: completed.length,
        averagePerBill: completed.length ? totalSales / completed.length : 0,
        cashTotal: completed.filter((sale) => sale.paymentMethod === "cash").reduce((sum, sale) => sum + sale.total, 0),
      },
    });
  } catch (error) {
    console.error("GET /api/sales failed", error);
    return NextResponse.json({ message: "โหลดรายการขายไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items as SaleItemInput[] : [];
    const paymentMethod = ["cash", "qr", "card"].includes(String(body.paymentMethod)) ? String(body.paymentMethod) as keyof typeof paymentLabels : "cash";
    const customerName = String(body.customerName || "ลูกค้าทั่วไป").trim().slice(0, 120) || "ลูกค้าทั่วไป";
    const quantities = new Map<number, number>();
    for (const item of items) {
      const productId = Number(item.productId);
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
      if (Number.isInteger(productId) && productId > 0 && quantity > 0) quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }
    const normalizedItems = [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
    if (!normalizedItems.length) return NextResponse.json({ message: "ยังไม่มีสินค้าในรายการขาย" }, { status: 400 });

    const settings = await getSettings();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const ids = normalizedItems.map((item) => item.productId);
      const placeholders = ids.map(() => "?").join(",");
      const [productRows] = await connection.query<ProductRow[]>(
        `SELECT id, sku, name, unit, CAST(price AS DOUBLE) AS price, stock FROM products WHERE is_active = 1 AND id IN (${placeholders}) FOR UPDATE`,
        ids,
      );
      if (productRows.length !== ids.length) throw new Error("PRODUCT_NOT_FOUND");

      const productMap = new Map(productRows.map((product) => [product.id, product]));
      for (const item of normalizedItems) {
        const product = productMap.get(item.productId);
        if (!product || product.stock < item.quantity) throw new Error("OUT_OF_STOCK");
      }

      const receiptItems = normalizedItems.map((item) => {
        const product = productMap.get(item.productId)!;
        const lineTotal = money(product.price * item.quantity);
        return { productId: product.id, sku: product.sku, name: product.name, unit: product.unit, quantity: item.quantity, unitPrice: money(product.price), lineTotal };
      });
      const subtotal = money(receiptItems.reduce((sum, item) => sum + item.lineTotal, 0));
      const maxDiscount = settings.allowDiscount ? subtotal * (settings.maxDiscountPercent / 100) : 0;
      const discount = settings.allowDiscount ? Math.min(money(body.discount), maxDiscount) : 0;
      const taxableAmount = Math.max(0, subtotal - discount);
      const vat = money(settings.vatRate > 0 ? (settings.pricesIncludeVat ? taxableAmount * settings.vatRate / (100 + settings.vatRate) : taxableAmount * (settings.vatRate / 100)) : 0);
      const beforeRounding = settings.pricesIncludeVat ? taxableAmount : taxableAmount + vat;
      const total = money(settings.roundingMode === "whole" ? Math.round(beforeRounding) : beforeRounding);
      const rounding = Math.round((total - beforeRounding) * 100) / 100;
      const amountReceived = paymentMethod === "cash" ? money(body.amountReceived) : total;
      if (paymentMethod === "cash" && amountReceived + 0.001 < total) throw new Error("PAYMENT_SHORT");
      const changeDue = paymentMethod === "cash" ? money(amountReceived - total) : 0;

      const today = new Date();
      const datePart = `${String(today.getFullYear()).slice(-2)}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const receiptPrefix = settings.receiptPrefix || "POS";
      const taxPrefix = settings.taxInvoicePrefix || "TAX";
      const draftReceiptNo = `D-${randomUUID()}`;
      const [saleResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO sales
          (receipt_no, customer_name, cashier_id, cashier_name, subtotal, discount, vat, rounding, total, amount_received, change_due, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [draftReceiptNo, customerName, user.id, user.displayName, subtotal, discount, vat, rounding, total, amountReceived, changeDue, paymentMethod],
      );
      const receiptNo = `${receiptPrefix}-${datePart}-${String(saleResult.insertId).padStart(6, "0")}`;
      const taxInvoiceNo = settings.taxInvoiceEnabled ? `${taxPrefix}-${datePart}-${String(saleResult.insertId).padStart(6, "0")}` : "";
      await connection.execute("UPDATE sales SET receipt_no = ?, tax_invoice_no = ? WHERE id = ?", [receiptNo, taxInvoiceNo || null, saleResult.insertId]);

      for (const item of receiptItems) {
        await connection.execute(
          "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
          [saleResult.insertId, item.productId, item.quantity, item.unitPrice],
        );
        await connection.execute("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?", [item.quantity, item.productId, item.quantity]);
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
          amountReceived,
          changeDue,
          status: "completed",
          settings,
          items: receiptItems,
        },
      }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      console.error("POST /api/sales failed", error);
      const code = error instanceof Error ? error.message : "";
      const message = code === "OUT_OF_STOCK" ? "จำนวนสินค้าในสต็อกไม่พอ" : code === "PAYMENT_SHORT" ? "จำนวนเงินที่รับน้อยกว่ายอดชำระ" : code === "PRODUCT_NOT_FOUND" ? "ไม่พบสินค้าที่เลือก" : "บันทึกการขายไม่สำเร็จ";
      return NextResponse.json({ message }, { status: ["OUT_OF_STOCK", "PAYMENT_SHORT"].includes(code) ? 409 : 500 });
    } finally {
      connection.release();
    }
  } catch {
    return NextResponse.json({ message: "ข้อมูลการขายไม่ถูกต้อง" }, { status: 400 });
  }
}

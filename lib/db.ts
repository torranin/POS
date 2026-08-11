import mysql, { RowDataPacket } from "mysql2/promise";

export type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number;
  color: string;
  icon: string;
};

export type StoreSettings = {
  storeName: string;
  legalName: string;
  branchName: string;
  branchCode: string;
  taxId: string;
  phone: string;
  email: string;
  lineId: string;
  businessHours: string;
  address: string;
  vatRate: number;
  currency: string;
  pricesIncludeVat: boolean;
  taxInvoiceEnabled: boolean;
  taxInvoicePrefix: string;
  defaultPaymentMethod: "cash" | "qr" | "card";
  allowDiscount: boolean;
  maxDiscountPercent: number;
  roundingMode: "none" | "whole";
  lowStockThreshold: number;
  receiptPrefix: string;
  receiptFooter: string;
  autoPrint: boolean;
};

export const defaultSettings: StoreSettings = {
  storeName: "บ้านช่าง วัสดุก่อสร้าง",
  legalName: "บริษัท บ้านช่างวัสดุก่อสร้าง จำกัด",
  branchName: "สำนักงานใหญ่",
  branchCode: "00000",
  taxId: "0105566123456",
  phone: "02-123-4567",
  email: "contact@baanchang.co.th",
  lineId: "@baanchang",
  businessHours: "จันทร์–เสาร์ 07:30–18:00 น.",
  address: "99/9 ถนนร่มเกล้า กรุงเทพมหานคร 10520",
  vatRate: 7,
  currency: "THB",
  pricesIncludeVat: false,
  taxInvoiceEnabled: true,
  taxInvoicePrefix: "TAX",
  defaultPaymentMethod: "cash",
  allowDiscount: true,
  maxDiscountPercent: 20,
  roundingMode: "none",
  lowStockThreshold: 10,
  receiptPrefix: "POS",
  receiptFooter: "ขอบคุณที่ไว้วางใจบ้านช่าง",
  autoPrint: true,
};

const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };

export const pool = globalForDb.mysqlPool ?? mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 5,
  enableKeepAlive: true,
});

if (process.env.NODE_ENV !== "production") globalForDb.mysqlPool = pool;

export async function getProducts(): Promise<Product[]> {
  const [rows] = await pool.query<(RowDataPacket & Product)[]>(
    `SELECT p.id, p.sku, p.name, c.name AS category, p.unit,
      CAST(p.price AS DOUBLE) AS price, p.stock, p.color, p.icon
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = 1
     ORDER BY p.id`
  );
  return rows.map((row) => ({ ...row, price: Number(row.price), stock: Number(row.stock) }));
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function getSettings(): Promise<StoreSettings> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT setting_key, setting_value FROM store_settings");
  const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    storeName: values.store_name ?? defaultSettings.storeName,
    legalName: values.legal_name ?? defaultSettings.legalName,
    branchName: values.branch_name ?? defaultSettings.branchName,
    branchCode: values.branch_code ?? defaultSettings.branchCode,
    taxId: values.tax_id ?? defaultSettings.taxId,
    phone: values.phone ?? defaultSettings.phone,
    email: values.email ?? defaultSettings.email,
    lineId: values.line_id ?? defaultSettings.lineId,
    businessHours: values.business_hours ?? defaultSettings.businessHours,
    address: values.address ?? defaultSettings.address,
    vatRate: Number(values.vat_rate ?? defaultSettings.vatRate),
    currency: values.currency ?? defaultSettings.currency,
    pricesIncludeVat: (values.prices_include_vat ?? "0") === "1",
    taxInvoiceEnabled: (values.tax_invoice_enabled ?? "1") === "1",
    taxInvoicePrefix: values.tax_invoice_prefix ?? defaultSettings.taxInvoicePrefix,
    defaultPaymentMethod: (["cash","qr","card"].includes(values.default_payment_method) ? values.default_payment_method : defaultSettings.defaultPaymentMethod) as StoreSettings["defaultPaymentMethod"],
    allowDiscount: (values.allow_discount ?? "1") === "1",
    maxDiscountPercent: Number(values.max_discount_percent ?? defaultSettings.maxDiscountPercent),
    roundingMode: (values.rounding_mode === "whole" ? "whole" : "none"),
    lowStockThreshold: Number(values.low_stock_threshold ?? defaultSettings.lowStockThreshold),
    receiptPrefix: values.receipt_prefix ?? defaultSettings.receiptPrefix,
    receiptFooter: values.receipt_footer ?? defaultSettings.receiptFooter,
    autoPrint: (values.auto_print ?? "1") === "1",
  };
}

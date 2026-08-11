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
  taxId: string;
  phone: string;
  address: string;
  vatRate: number;
  lowStockThreshold: number;
  receiptPrefix: string;
  receiptFooter: string;
  autoPrint: boolean;
};

export const defaultSettings: StoreSettings = {
  storeName: "บ้านช่าง วัสดุก่อสร้าง",
  taxId: "0105566123456",
  phone: "02-123-4567",
  address: "99/9 ถนนร่มเกล้า กรุงเทพมหานคร 10520",
  vatRate: 7,
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
    taxId: values.tax_id ?? defaultSettings.taxId,
    phone: values.phone ?? defaultSettings.phone,
    address: values.address ?? defaultSettings.address,
    vatRate: Number(values.vat_rate ?? defaultSettings.vatRate),
    lowStockThreshold: Number(values.low_stock_threshold ?? defaultSettings.lowStockThreshold),
    receiptPrefix: values.receipt_prefix ?? defaultSettings.receiptPrefix,
    receiptFooter: values.receipt_footer ?? defaultSettings.receiptFooter,
    autoPrint: (values.auto_print ?? "1") === "1",
  };
}

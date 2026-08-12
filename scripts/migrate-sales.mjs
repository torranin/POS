import mysql from "mysql2/promise";

const database = process.env.MYSQL_DATABASE || "baan_chang_pos";
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Invalid database name");

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database,
});

async function ensureColumn(columnName, definition) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales' AND COLUMN_NAME = ?`,
    [database, columnName],
  );
  if (Number(rows[0]?.total || 0) === 0) {
    await connection.query(`ALTER TABLE sales ADD COLUMN \`${columnName}\` ${definition}`);
    console.log(`Added sales.${columnName}`);
  }
}

async function ensureIndex(indexName, columns) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS total
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales' AND INDEX_NAME = ?`,
    [database, indexName],
  );
  if (Number(rows[0]?.total || 0) === 0) {
    await connection.query(`ALTER TABLE sales ADD INDEX \`${indexName}\` (${columns})`);
    console.log(`Added sales index ${indexName}`);
  }
}

try {
  await ensureColumn("tax_invoice_no", "VARCHAR(40) NULL AFTER receipt_no");
  await ensureColumn("customer_name", "VARCHAR(120) NOT NULL DEFAULT 'ลูกค้าทั่วไป' AFTER tax_invoice_no");
  await ensureColumn("cashier_id", "INT NULL AFTER customer_name");
  await ensureColumn("cashier_name", "VARCHAR(120) NOT NULL DEFAULT '' AFTER cashier_id");
  await ensureColumn("rounding", "DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER vat");
  await ensureColumn("amount_received", "DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total");
  await ensureColumn("change_due", "DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER amount_received");
  await ensureColumn("status", "ENUM('completed','voided','refunded') NOT NULL DEFAULT 'completed' AFTER payment_method");
  await ensureIndex("idx_sales_created_at", "created_at");
  await ensureIndex("idx_sales_customer_name", "customer_name");
  console.log("Sales database migration completed.");
} finally {
  await connection.end();
}

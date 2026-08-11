import mysql from "mysql2/promise";
import { randomBytes, scryptSync } from "node:crypto";

const database = process.env.MYSQL_DATABASE || "baan_chang_pos";
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error("Invalid database name");

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  multipleStatements: true,
});

await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await connection.changeUser({ database });
await connection.query(`
  CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    category_id INT NOT NULL,
    unit VARCHAR(30) NOT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    color VARCHAR(20) NOT NULL DEFAULT '#e8ecef',
    icon VARCHAR(30) NOT NULL DEFAULT 'tool',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(id)
  );
  CREATE TABLE IF NOT EXISTS sales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    receipt_no VARCHAR(40) NOT NULL UNIQUE,
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    payment_method ENUM('cash','card','qr') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sale_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_item_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id)
  );
  CREATE TABLE IF NOT EXISTS store_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    role ENUM('admin','manager','warehouse','user') NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_expires (expires_at)
  );
`);

const settings = {
  store_name: "บ้านช่าง วัสดุก่อสร้าง",
  tax_id: "0105566123456",
  phone: "02-123-4567",
  address: "99/9 ถนนร่มเกล้า กรุงเทพมหานคร 10520",
  vat_rate: "7",
  low_stock_threshold: "10",
  receipt_prefix: "POS",
  receipt_footer: "ขอบคุณที่ไว้วางใจบ้านช่าง",
  auto_print: "1",
};
for (const [key, value] of Object.entries(settings)) {
  await connection.execute("INSERT IGNORE INTO store_settings (setting_key, setting_value) VALUES (?, ?)", [key, value]);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const initialUsers = [
  ["admin", "ผู้ดูแลระบบ", "admin", process.env.DEFAULT_ADMIN_PASSWORD || "Admin@1234"],
  ["manager", "ผู้จัดการร้าน", "manager", process.env.DEFAULT_MANAGER_PASSWORD || "Manager@1234"],
  ["warehouse", "เจ้าหน้าที่คลัง", "warehouse", process.env.DEFAULT_WAREHOUSE_PASSWORD || "Warehouse@1234"],
  ["cashier", "พนักงานขาย", "user", process.env.DEFAULT_CASHIER_PASSWORD || "Cashier@1234"],
];
for (const [username, displayName, role, password] of initialUsers) {
  await connection.execute(
    "INSERT IGNORE INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
    [username, hashPassword(password), displayName, role]
  );
}

const categoryNames = ["ปูนและซีเมนต์", "เหล็ก", "อิฐและบล็อก", "สีและเคมีภัณฑ์", "ประปา", "เครื่องมือช่าง", "วัสดุพื้นฐาน", "หลังคา"];
for (const name of categoryNames) {
  await connection.execute("INSERT IGNORE INTO categories (name) VALUES (?)", [name]);
}

const products = [
  ["CMT-001", "ปูนซีเมนต์ปอร์ตแลนด์", "ปูนและซีเมนต์", "ถุง", 145, 124, "#dce6ec", "cement"],
  ["STL-012", "เหล็กเส้นข้ออ้อย 12 มม.", "เหล็ก", "เส้น", 238, 86, "#e7e8e3", "steel"],
  ["BLK-007", "อิฐมวลเบา 7.5 ซม.", "อิฐและบล็อก", "ก้อน", 25, 540, "#f2e5d2", "brick"],
  ["PNT-901", "สีทาภายใน เบส A 2.5 กล.", "สีและเคมีภัณฑ์", "ถัง", 890, 18, "#e0eef0", "paint"],
  ["PVC-034", "ท่อ PVC ชั้น 8.5 ขนาด 1 นิ้ว", "ประปา", "เส้น", 72, 67, "#e2ebf4", "pipe"],
  ["TLS-223", "สว่านกระแทก 13 มม.", "เครื่องมือช่าง", "ตัว", 1590, 9, "#f6e8c8", "drill"],
  ["SND-050", "ทรายหยาบคัดพิเศษ", "วัสดุพื้นฐาน", "คิว", 620, 32, "#eee0c5", "sand"],
  ["ROF-760", "กระเบื้องลอนคู่ สีเทา", "หลังคา", "แผ่น", 78, 210, "#dfe4e3", "roof"]
];

for (const [sku, name, category, unit, price, stock, color, icon] of products) {
  await connection.execute(
    `INSERT INTO products (sku, name, category_id, unit, price, stock, color, icon)
     SELECT ?, ?, id, ?, ?, ?, ?, ? FROM categories WHERE name = ?
     ON DUPLICATE KEY UPDATE name=VALUES(name), category_id=VALUES(category_id), unit=VALUES(unit), price=VALUES(price), stock=VALUES(stock), color=VALUES(color), icon=VALUES(icon)`,
    [sku, name, unit, price, stock, color, icon, category]
  );
}

await connection.end();
console.log(`Database '${database}' is ready with ${products.length} products.`);

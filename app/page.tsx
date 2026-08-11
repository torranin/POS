import { checkDatabase, defaultSettings, getProducts, getSettings, type Product } from "@/lib/db";
import POSDashboard from "./pos-dashboard";

export const dynamic = "force-dynamic";

const fallbackProducts: Product[] = [
  { id: 1, sku: "CMT-001", name: "ปูนซีเมนต์ปอร์ตแลนด์", category: "ปูนและซีเมนต์", unit: "ถุง", price: 145, stock: 124, color: "#dce6ec", icon: "cement" },
  { id: 2, sku: "STL-012", name: "เหล็กเส้นข้ออ้อย 12 มม.", category: "เหล็ก", unit: "เส้น", price: 238, stock: 86, color: "#e7e8e3", icon: "steel" },
  { id: 3, sku: "BLK-007", name: "อิฐมวลเบา 7.5 ซม.", category: "อิฐและบล็อก", unit: "ก้อน", price: 25, stock: 540, color: "#f2e5d2", icon: "brick" },
  { id: 4, sku: "PNT-901", name: "สีทาภายใน เบส A 2.5 กล.", category: "สีและเคมีภัณฑ์", unit: "ถัง", price: 890, stock: 18, color: "#e0eef0", icon: "paint" },
  { id: 5, sku: "PVC-034", name: "ท่อ PVC ชั้น 8.5 ขนาด 1 นิ้ว", category: "ประปา", unit: "เส้น", price: 72, stock: 67, color: "#e2ebf4", icon: "pipe" },
  { id: 6, sku: "TLS-223", name: "สว่านกระแทก 13 มม.", category: "เครื่องมือช่าง", unit: "ตัว", price: 1590, stock: 9, color: "#f6e8c8", icon: "drill" },
  { id: 7, sku: "SND-050", name: "ทรายหยาบคัดพิเศษ", category: "วัสดุพื้นฐาน", unit: "คิว", price: 620, stock: 32, color: "#eee0c5", icon: "sand" },
  { id: 8, sku: "ROF-760", name: "กระเบื้องลอนคู่ สีเทา", category: "หลังคา", unit: "แผ่น", price: 78, stock: 210, color: "#dfe4e3", icon: "roof" },
];

export default async function Home() {
  let products = fallbackProducts;
  let settings = defaultSettings;
  let databaseConnected = false;
  try {
    databaseConnected = await checkDatabase();
    if (databaseConnected) {
      products = await getProducts();
      settings = await getSettings();
    }
  } catch {
    databaseConnected = false;
  }

  return <POSDashboard products={products} databaseConnected={databaseConnected} initialSettings={settings} />;
}

"use client";

import {
  BarChart3, Bell, Boxes, Building2, Check, ChevronDown, CircleUserRound,
  ClipboardList, CreditCard, FileText, Hammer, HardHat, LogOut, MapPin, Menu, Minus,
  PackageCheck, PackagePlus, PackageSearch, PanelLeftClose, PanelLeftOpen, Pencil, Phone, Plus, Printer,
  ReceiptText, RotateCcw, Save, Search, Settings, ShoppingCart, SlidersHorizontal,
  Store, Trash2, Truck, UserCog, WalletCards, Wifi, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Product, ProductCategory, StoreSettings } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { canAccess, roleLabels, type UserRole } from "@/lib/roles";

type CartItem = Product & { qty: number };
type PageKey = "pos" | "products" | "sales" | "delivery" | "reports" | "settings" | "users";
type SettingsSection = "store" | "sales" | "receipt" | "inventory" | "categories" | "users";
type Props = { products: Product[]; categories: ProductCategory[]; databaseConnected: boolean; initialSettings: StoreSettings; currentUser: CurrentUser };
type ManagedUser = { id: number; username: string; displayName: string; role: UserRole; isActive: number; lastLoginAt: string | null };
type ReceiptItem = { productId: number; sku: string; name: string; unit: string; quantity: number; unitPrice: number; lineTotal: number };
type ReceiptData = {
  id: number;
  receiptNo: string;
  taxInvoiceNo: string;
  customerName: string;
  cashierName: string;
  createdAt: string;
  paymentMethod: StoreSettings["defaultPaymentMethod"];
  paymentLabel: string;
  subtotal: number;
  discount: number;
  vat: number;
  rounding: number;
  total: number;
  settings: StoreSettings;
  items: ReceiptItem[];
};

const pageNames: Record<PageKey, string> = { pos: "ขายหน้าร้าน", products: "สินค้าและสต็อก", sales: "รายการขาย", delivery: "งานจัดส่ง", reports: "รายงานภาพรวม", settings: "ตั้งค่าระบบ", users: "จัดการผู้ใช้งาน" };
const sales = [
  { no: "POS-0826", time: "14:32", customer: "ลูกค้าทั่วไป", items: 3, payment: "เงินสด", total: 1856.35, status: "สำเร็จ" },
  { no: "POS-0825", time: "13:48", customer: "หจก. รุ่งเรืองก่อสร้าง", items: 12, payment: "โอน / QR", total: 12840, status: "สำเร็จ" },
  { no: "POS-0824", time: "11:05", customer: "คุณสมชาย ใจดี", items: 5, payment: "บัตรเครดิต", total: 4237.20, status: "สำเร็จ" },
  { no: "POS-0823", time: "10:16", customer: "บจก. เอส.พี.โฮม", items: 28, payment: "เงินสด", total: 28650, status: "รอชำระ" },
  { no: "POS-0822", time: "09:42", customer: "คุณวรรณา มีสุข", items: 2, payment: "โอน / QR", total: 962.50, status: "ยกเลิก" },
];
const deliveries = [
  { no: "DLV-0062", customer: "หจก. รุ่งเรืองก่อสร้าง", area: "มีนบุรี กทม.", time: "09:00–11:00", truck: "1ฒก 4582", status: "กำลังจัดส่ง", tone: "blue" },
  { no: "DLV-0063", customer: "บจก. เอส.พี.โฮม", area: "ลาดกระบัง กทม.", time: "11:00–13:00", truck: "2ฒข 7109", status: "เตรียมสินค้า", tone: "orange" },
  { no: "DLV-0064", customer: "คุณชาญชัย", area: "บางพลี สมุทรปราการ", time: "13:00–15:00", truck: "1ฒก 4582", status: "รอจัดคิว", tone: "gray" },
  { no: "DLV-0061", customer: "ร้านช่างเอก", area: "สะพานสูง กทม.", time: "08:30", truck: "2ฒข 7109", status: "ส่งสำเร็จ", tone: "green" },
];

function ProductArt({ icon }: { icon: string }) {
  return <div className={`product-art art-${icon}`} aria-hidden="true"><div className="art-shape"><Hammer size={34} strokeWidth={1.6} /></div></div>;
}

function Metric({ label, value, note, icon, tone = "navy" }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: string }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>;
}

function formatMoney(value: number) {
  return `฿${value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function POSDashboard({ products, categories: initialCategories, databaseConnected, initialSettings, currentUser }: Props) {
  const [activePage, setActivePage] = useState<PageKey>("pos");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [categoryList, setCategoryList] = useState<ProductCategory[]>(initialCategories);
  const [cart, setCart] = useState<CartItem[]>(() => products.slice(0, 2).map((p, i) => ({ ...p, qty: i + 1 })));
  const [discount, setDiscount] = useState(50);
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [paymentMethod, setPaymentMethod] = useState<StoreSettings["defaultPaymentMethod"]>(initialSettings.defaultPaymentMethod);
  const [customerName, setCustomerName] = useState("ลูกค้าทั่วไป");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [checkoutState, setCheckoutState] = useState<"idle" | "saving" | "error">("idle");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("store");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [inventoryProducts, setInventoryProducts] = useState(products);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("ทั้งหมด");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productDraft, setProductDraft] = useState({ sku: "", name: "", category: initialCategories[0]?.name ?? "", unit: "ชิ้น", price: 0, stock: 0 });
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userDraft, setUserDraft] = useState<{username:string;displayName:string;password:string;role:UserRole}>({ username: "", displayName: "", password: "", role: "user" });
  const [actionError, setActionError] = useState("");
  const canManageProducts = canAccess(currentUser.role, "manage_products");
  const categoryNames = useMemo(() => ["ทั้งหมด", ...categoryList.map((item) => item.name)], [categoryList]);

  useEffect(() => {
    if (activePage === "settings" && settingsSection === "users" && currentUser.role === "admin") fetch("/api/users").then((r)=>r.json()).then(setUsers).catch(()=>setActionError("โหลดรายชื่อผู้ใช้ไม่สำเร็จ"));
  }, [activePage, settingsSection, currentUser.role]);
  useEffect(() => {
    if (!categoryNames.includes(category)) setCategory("ทั้งหมด");
  }, [category, categoryNames]);

  const filtered = useMemo(() => inventoryProducts.filter((p) => {
    const matchesCategory = category === "ทั้งหมด" || p.category === category;
    const term = query.trim().toLowerCase();
    return matchesCategory && (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  }), [inventoryProducts, query, category]);
  const visibleInventoryProducts = useMemo(() => inventoryProducts.filter((product) => {
    const term = inventorySearch.trim().toLowerCase();
    const matchesTerm = !term || product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term) || product.category.toLowerCase().includes(term);
    const matchesCategory = inventoryCategory === "ทั้งหมด" || product.category === inventoryCategory;
    return matchesTerm && matchesCategory;
  }), [inventoryProducts, inventorySearch, inventoryCategory]);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const maxDiscount = subtotal * (settings.maxDiscountPercent / 100);
  const effectiveDiscount = settings.allowDiscount ? Math.min(discount, maxDiscount) : 0;
  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const vat = settings.vatRate > 0 ? (settings.pricesIncludeVat ? taxableAmount * settings.vatRate / (100 + settings.vatRate) : taxableAmount * (settings.vatRate / 100)) : 0;
  const unroundedTotal = settings.pricesIncludeVat ? taxableAmount : taxableAmount + vat;
  const total = settings.roundingMode === "whole" ? Math.round(unroundedTotal) : unroundedTotal;
  const previewBase = 1000;
  const previewVat = settings.vatRate > 0 ? (settings.pricesIncludeVat ? previewBase * settings.vatRate / (100 + settings.vatRate) : previewBase * (settings.vatRate / 100)) : 0;
  const previewBeforeRounding = settings.pricesIncludeVat ? previewBase : previewBase + previewVat;
  const previewTotal = settings.roundingMode === "whole" ? Math.round(previewBeforeRounding) : previewBeforeRounding;
  const lowStock = inventoryProducts.filter((p) => p.stock <= settings.lowStockThreshold).length;

  function addToCart(product: Product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found ? current.map((item) => item.id === product.id ? { ...item, qty: Math.min(item.qty + 1, item.stock) } : item) : [...current, { ...product, qty: 1 }];
    });
  }
  function changeQty(id: number, amount: number) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, qty: Math.max(0, Math.min(item.stock, item.qty + amount)) } : item).filter((item) => item.qty > 0));
  }
  async function checkout() {
    if (!cart.length || checkoutState === "saving") return;
    setActionError("");
    setCheckoutState("saving");
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          paymentMethod,
          discount: effectiveDiscount,
          items: cart.map((item) => ({ productId: item.id, quantity: item.qty })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "บันทึกใบเสร็จไม่สำเร็จ");
      const soldItems = cart;
      setReceipt(data.receipt);
      setShowReceipt(true);
      setCart([]);
      setInventoryProducts((items) => items.map((product) => {
        const sold = soldItems.find((item) => item.id === product.id);
        return sold ? { ...product, stock: Math.max(0, product.stock - sold.qty) } : product;
      }));
      setCheckoutState("idle");
      if (settings.autoPrint) window.setTimeout(() => window.print(), 350);
    } catch (error) {
      setCheckoutState("error");
      setActionError(error instanceof Error ? error.message : "บันทึกใบเสร็จไม่สำเร็จ");
    }
  }
  async function saveSettings() {
    const emailValid = !settings.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email);
    const taxPrefixValid = !settings.taxInvoiceEnabled || settings.taxInvoicePrefix.trim().length > 0;
    if (!settings.storeName.trim() || (settings.taxId && settings.taxId.length !== 13) || !emailValid || settings.vatRate < 0 || settings.vatRate > 20 || settings.lowStockThreshold < 0 || settings.maxDiscountPercent < 0 || settings.maxDiscountPercent > 100 || !taxPrefixValid) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSettings(data.settings);
      setSavedSettings(data.settings);
      setPaymentMethod(data.settings.defaultPaymentMethod);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2200);
    } catch { setSaveState("error"); }
  }
  function openProductForm(product?: Product) {
    setActionError("");
    if (product) {
      setEditingProductId(product.id);
      setProductDraft({ sku: product.sku, name: product.name, category: product.category, unit: product.unit, price: product.price, stock: product.stock });
    } else {
      setEditingProductId(null);
      setProductDraft({ sku: "", name: "", category: categoryList[0]?.name ?? "", unit: "ชิ้น", price: 0, stock: 0 });
    }
    setShowProductForm(true);
  }
  async function refreshCategories() {
    const response = await fetch("/api/categories");
    if (response.ok) setCategoryList(await response.json());
  }
  async function saveProduct(event: React.FormEvent) {
    event.preventDefault(); setActionError("");
    const response = await fetch("/api/products", { method: editingProductId ? "PATCH" : "POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(editingProductId ? { ...productDraft, id: editingProductId } : productDraft) });
    const data = await response.json(); if (!response.ok) { setActionError(data.message); return; }
    setInventoryProducts((items)=>editingProductId ? items.map((item)=>item.id===editingProductId?data:item) : [...items,data]);
    setCart((items)=>items.map((item)=>item.id===data.id?{...item,...data,qty:Math.min(item.qty,data.stock)}:item).filter((item)=>item.qty>0));
    setShowProductForm(false); setEditingProductId(null); setProductDraft({ sku:"",name:"",category:categoryList[0]?.name ?? "",unit:"ชิ้น",price:0,stock:0 });
    await refreshCategories();
  }
  async function adjustProductStock(product: Product, amount: number) {
    const nextStock = Math.max(0, product.stock + amount);
    setActionError("");
    const response = await fetch("/api/products", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...product, stock: nextStock }) });
    const data = await response.json(); if (!response.ok) { setActionError(data.message); return; }
    setInventoryProducts((items)=>items.map((item)=>item.id===product.id?data:item));
    setCart((items)=>items.map((item)=>item.id===product.id?{...item,...data,qty:Math.min(item.qty,data.stock)}:item).filter((item)=>item.qty>0));
  }
  async function removeProduct(id:number) {
    if (!window.confirm("ยืนยันการลบสินค้านี้ออกจากรายการขาย?")) return;
    const response = await fetch(`/api/products?id=${id}`,{method:"DELETE"});
    if (response.ok) { setInventoryProducts((items)=>items.filter((p)=>p.id!==id)); setCart((items)=>items.filter((p)=>p.id!==id)); await refreshCategories(); }
  }
  async function addUser(event:React.FormEvent) {
    event.preventDefault(); setActionError("");
    const response=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(userDraft)}); const data=await response.json();
    if(!response.ok){setActionError(data.message);return} setShowUserForm(false); setUserDraft({username:"",displayName:"",password:"",role:"user"});
    const refreshed=await fetch("/api/users").then(r=>r.json()); setUsers(refreshed);
  }
  async function toggleUser(user:ManagedUser) {
    const response=await fetch("/api/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:user.id,isActive:!user.isActive})});
    if(response.ok)setUsers(items=>items.map(item=>item.id===user.id?{...item,isActive:item.isActive?0:1}:item));
  }
  async function resetUserPassword(user:ManagedUser) {
    const password=window.prompt(`ตั้งรหัสผ่านใหม่สำหรับ ${user.displayName} (อย่างน้อย 8 ตัวอักษร)`); if(!password)return;
    const response=await fetch("/api/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:user.id,password})}); const data=await response.json();
    window.alert(response.ok?"เปลี่ยนรหัสผ่านเรียบร้อย":data.message);
  }
  async function addCategory(event: React.FormEvent) {
    event.preventDefault(); setActionError("");
    const response = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: categoryDraft }) });
    const data = await response.json();
    if (!response.ok) { setActionError(data.message); return; }
    setCategoryList(data); setCategoryDraft("");
    if (!productDraft.category && data[0]) setProductDraft((draft)=>({ ...draft, category: data[0].name }));
  }
  async function updateCategory(event: React.FormEvent) {
    event.preventDefault(); if (!editingCategory) return; setActionError("");
    const oldName = editingCategory.name;
    const response = await fetch("/api/categories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingCategory) });
    const data = await response.json();
    if (!response.ok) { setActionError(data.message); return; }
    setCategoryList(data); setEditingCategory(null);
    setInventoryProducts((items)=>items.map((item)=>item.category===oldName?{...item,category:editingCategory.name}:item));
    setCart((items)=>items.map((item)=>item.category===oldName?{...item,category:editingCategory.name}:item));
    if (category === oldName) setCategory(editingCategory.name);
    if (productDraft.category === oldName) setProductDraft((draft)=>({ ...draft, category: editingCategory.name }));
  }
  async function removeCategory(item: ProductCategory) {
    if (!window.confirm(`ยืนยันการลบหมวด "${item.name}"?`)) return;
    setActionError("");
    const response = await fetch(`/api/categories?id=${item.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) { setActionError(data.message); return; }
    setCategoryList(data);
    if (category === item.name) setCategory("ทั้งหมด");
    if (productDraft.category === item.name) setProductDraft((draft)=>({ ...draft, category: data[0]?.name ?? "" }));
  }

  const navItems = ([
    { key: "pos", label: "ขายสินค้า", icon: <ShoppingCart />, show: true },
    { key: "products", label: "สินค้า", icon: <Boxes />, show: true },
    { key: "sales", label: "รายการขาย", icon: <ClipboardList />, show: canAccess(currentUser.role,"sales") },
    { key: "delivery", label: "จัดส่ง", icon: <Truck />, show: canAccess(currentUser.role,"delivery") },
    { key: "reports", label: "รายงาน", icon: <BarChart3 />, show: canAccess(currentUser.role,"reports") },
  ] satisfies { key: PageKey; label: string; icon: React.ReactNode; show: boolean }[]).filter((item)=>item.show);

  return (
    <main className={`app-shell ${sidebarExpanded ? "sidebar-is-expanded" : "sidebar-is-collapsed"}`}>
      <aside className="sidebar">
        <div className="brand-mark"><HardHat size={26} /><div><strong title={settings.storeName}>{settings.storeName || "ชื่อร้าน"}</strong><span>{settings.branchName || "สำนักงานใหญ่"}</span></div></div>
        <nav aria-label="เมนูหลัก">{navItems.map((item) => <button key={item.key} title={sidebarExpanded ? undefined : item.label} className={`nav-item ${activePage === item.key ? "active" : ""}`} aria-label={item.label} onClick={() => setActivePage(item.key)}>{item.icon}<span>{item.label}</span></button>)}</nav>
        <div className="sidebar-bottom">
          {canAccess(currentUser.role,"manage_settings") && <button title={sidebarExpanded ? undefined : "ตั้งค่าระบบ"} className={`nav-item ${activePage === "settings" ? "active" : ""}`} aria-label="ตั้งค่าระบบ" onClick={() => setActivePage("settings")}><Settings /><span>ตั้งค่าระบบ</span></button>}
          <form className="logout-form" action="/api/auth/logout" method="post"><button type="submit" title={sidebarExpanded ? undefined : "ออกจากระบบ"} className="nav-item logout-item" aria-label="ออกจากระบบ"><LogOut/><span>ออกจากระบบ</span></button></form>
          <button className="nav-item sidebar-toggle" aria-label={sidebarExpanded ? "ย่อแถบเมนู" : "ขยายแถบเมนู"} aria-expanded={sidebarExpanded} onClick={() => setSidebarExpanded((value) => !value)}>{sidebarExpanded ? <PanelLeftClose /> : <PanelLeftOpen />}<span>ย่อแถบเมนู</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-menu" aria-label="เปิดเมนู"><Menu /></button>
          <div><p className="eyebrow">{settings.storeName.toUpperCase()}</p><h1>{pageNames[activePage]}</h1></div>
          <div className="topbar-actions">
            <span className={`db-pill ${databaseConnected ? "online" : "offline"}`}><Wifi size={14} /> {databaseConnected ? "ฐานข้อมูลพร้อมใช้" : "ข้อมูลตัวอย่าง"}</span>
            <button className="notification" aria-label="การแจ้งเตือน"><Bell size={18} /><i>{lowStock}</i></button>
            <div className="cashier"><CircleUserRound /><span><strong>{currentUser.displayName}</strong><small>{roleLabels[currentUser.role]}</small></span><ChevronDown size={16} /></div>
          </div>
        </header>

        {activePage === "pos" && <div className="content-grid">
          <section className="catalog">
            <div className="search-row"><label className="search-box"><Search size={20} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อสินค้า หรือสแกนบาร์โค้ด..." /><kbd>F2</kbd></label><button className="stock-button" onClick={() => setActivePage("products")}><PackageSearch size={19} /> เช็กสต็อก</button></div>
            <div className="category-row" aria-label="หมวดหมู่สินค้า">{categoryNames.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
            <div className="section-heading"><div><h2>{category === "ทั้งหมด" ? "สินค้าขายดี" : category}</h2><p>เลือกสินค้าเพื่อเพิ่มลงในรายการขาย</p></div><span>{filtered.length} รายการ</span></div>
            <div className="product-grid">{filtered.map((product) => <button className="product-card" key={product.id} onClick={() => addToCart(product)}><div className="art-wrap" style={{ background: product.color }}><ProductArt icon={product.icon} /><span className={product.stock <= settings.lowStockThreshold ? "stock low" : "stock"}>เหลือ {product.stock}</span></div><div className="product-info"><small>{product.sku}</small><h3>{product.name}</h3><div><strong>฿{product.price.toLocaleString("th-TH")}</strong><span>/ {product.unit}</span><i><Plus size={16} /></i></div></div></button>)}{filtered.length === 0 && <div className="empty-products"><PackageSearch size={38} /><p>ไม่พบสินค้าที่ค้นหา</p></div>}</div>
          </section>
          <aside className="order-panel">
            <div className="order-header"><div><span className="order-icon"><ReceiptText size={19} /></span><div><small>รายการขาย</small><h2>ออเดอร์ #{settings.receiptPrefix}-0826</h2></div></div><button onClick={() => setCart([])} aria-label="ล้างรายการ"><Trash2 size={17} /></button></div>
            <button className="customer-row" onClick={() => { const name = window.prompt("ชื่อลูกค้าในใบเสร็จ", customerName); if (name !== null) setCustomerName(name.trim() || "ลูกค้าทั่วไป"); }}><span><CircleUserRound size={20} /> {customerName}</span><Plus size={17} /></button>
            <div className="cart-list">{cart.map((item) => <article className="cart-item" key={item.id}><div className="cart-thumb" style={{ background: item.color }}><Hammer size={20} /></div><div className="cart-detail"><h3>{item.name}</h3><small>{item.sku} · ฿{item.price.toLocaleString("th-TH")}/{item.unit}</small><div className="qty-control"><button onClick={() => changeQty(item.id, -1)}><Minus size={14} /></button><span>{item.qty}</span><button onClick={() => changeQty(item.id, 1)}><Plus size={14} /></button></div></div><strong>฿{(item.price * item.qty).toLocaleString("th-TH")}</strong></article>)}{cart.length === 0 && <div className="empty-cart"><ShoppingCart size={34} /><p>ยังไม่มีสินค้าในรายการ</p><small>เลือกสินค้าจากด้านซ้ายเพื่อเริ่มขาย</small></div>}</div>
            <div className="summary"><div><span>ยอดรวม ({cart.reduce((s, i) => s + i.qty, 0)} ชิ้น)</span><strong>฿{subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div><div><span>ส่วนลด {settings.allowDiscount && <button onClick={() => setDiscount(discount ? 0 : Math.min(50, maxDiscount))}>แก้ไข</button>}</span><strong className="discount">-฿{effectiveDiscount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div><div><span>ภาษีมูลค่าเพิ่ม {settings.vatRate}% {settings.pricesIncludeVat ? "(รวมในราคา)" : ""}</span><strong>฿{vat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>{settings.roundingMode === "whole" && <div><span>ปัดเศษ</span><strong>฿{(total - unroundedTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>}<div className="grand-total"><span>ยอดชำระ</span><strong>฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div></div>
            <div className="payment-types"><button className={paymentMethod === "cash" ? "active" : ""} onClick={() => setPaymentMethod("cash")}><WalletCards size={18} /> เงินสด</button><button className={paymentMethod === "qr" ? "active" : ""} onClick={() => setPaymentMethod("qr")}><ReceiptText size={18} /> QR</button><button className={paymentMethod === "card" ? "active" : ""} onClick={() => setPaymentMethod("card")}><CreditCard size={18} /> บัตร</button></div>{checkoutState === "error" && <div className="checkout-error">{actionError}</div>}<button className="checkout" disabled={!cart.length || checkoutState === "saving"} onClick={checkout}><span>{checkoutState === "saving" ? "กำลังออกใบเสร็จ..." : settings.taxInvoiceEnabled ? `${settings.taxInvoicePrefix || "TAX"} / ชำระเงิน` : "ชำระเงิน"}</span><strong>฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></button><div className="shortcut"><span><kbd>F8</kbd> พักบิล</span><span><kbd>F10</kbd> ชำระเงิน</span></div>
          </aside>
        </div>}

        {activePage === "products" && <div className="page-content">
          <div className="page-actions"><div><p>{canManageProducts?"จัดการสินค้า ราคา และจำนวนคงเหลือ":"ดูรายการสินค้าและจำนวนคงเหลือ"}</p></div>{canManageProducts&&<><button className="outline-action"><FileText size={17} /> นำเข้า Excel</button><button className="primary-action" onClick={()=>openProductForm()}><PackagePlus size={17} /> เพิ่มสินค้าใหม่</button></>}</div>
          <div className="metrics"><Metric label="สินค้าทั้งหมด" value={`${inventoryProducts.length} รายการ`} note="ใช้งานอยู่ทั้งหมด" icon={<Boxes />} /><Metric label="มูลค่าสต็อก" value={`฿${inventoryProducts.reduce((s,p)=>s+p.price*p.stock,0).toLocaleString("th-TH")}`} note="ราคาขายโดยประมาณ" icon={<WalletCards />} tone="blue" /><Metric label="สต็อกใกล้หมด" value={`${inventoryProducts.filter(p=>p.stock<=settings.lowStockThreshold).length} รายการ`} note={`ต่ำกว่าหรือเท่ากับ ${settings.lowStockThreshold}`} icon={<Bell />} tone="orange" /><Metric label="หมวดหมู่" value={`${new Set(inventoryProducts.map(p=>p.category)).size} หมวด`} note="จัดหมวดหมู่แล้ว" icon={<SlidersHorizontal />} tone="green" /></div>
          <section className="data-panel"><div className="panel-toolbar"><label className="table-search"><Search size={17} /><input value={inventorySearch} onChange={e=>setInventorySearch(e.target.value)} placeholder="ค้นหาสินค้า SKU หรือหมวดหมู่" /></label><label className="table-select"><SlidersHorizontal size={16}/><select value={inventoryCategory} onChange={e=>setInventoryCategory(e.target.value)}>{categoryNames.map(item=><option key={item} value={item}>{item}</option>)}</select></label></div>{actionError&&<div className="table-error">{actionError}</div>}<div className="table-scroll"><table><thead><tr><th>สินค้า</th><th>หมวดหมู่</th><th>ราคาขาย</th><th>คงเหลือ</th><th>สถานะ</th>{canManageProducts&&<th>จัดการ</th>}</tr></thead><tbody>{visibleInventoryProducts.map(p=><tr key={p.id}><td><div className="product-cell"><span style={{background:p.color}}><Hammer size={18}/></span><div><strong>{p.name}</strong><small>{p.sku} · ต่อ{p.unit}</small></div></div></td><td>{p.category}</td><td><strong>฿{p.price.toLocaleString("th-TH")}</strong></td><td><div className="stock-adjust">{canManageProducts&&<button onClick={()=>adjustProductStock(p,-1)} aria-label="ลดสต็อก"><Minus size={13}/></button>}<strong>{p.stock.toLocaleString("th-TH")}</strong><span>{p.unit}</span>{canManageProducts&&<button onClick={()=>adjustProductStock(p,1)} aria-label="เพิ่มสต็อก"><Plus size={13}/></button>}</div></td><td><span className={`status-chip ${p.stock <= settings.lowStockThreshold ? "warning":"success"}`}>{p.stock <= settings.lowStockThreshold ? "ใกล้หมด":"พร้อมขาย"}</span></td>{canManageProducts&&<td><div className="row-actions"><button className="icon-button" aria-label="แก้ไข" onClick={()=>openProductForm(p)}><Pencil size={15}/></button><button className="icon-button danger-button" aria-label="ลบ" onClick={()=>removeProduct(p.id)}><Trash2 size={15}/></button></div></td>}</tr>)}</tbody></table></div>{visibleInventoryProducts.length===0&&<div className="empty-table">ไม่พบสินค้าที่ตรงกับการค้นหา</div>}</section>
        </div>}

        {activePage === "sales" && <div className="page-content">
          <div className="page-actions"><div><p>ตรวจสอบรายการขายและการชำระเงินทั้งหมด</p></div><button className="outline-action"><Printer size={17}/> พิมพ์รายงาน</button><button className="primary-action" onClick={()=>setActivePage("pos")}><Plus size={17}/> เปิดบิลใหม่</button></div>
          <div className="metrics"><Metric label="ยอดขายวันนี้" value="฿48,546.05" note="เพิ่มขึ้น 12.8%" icon={<WalletCards/>}/><Metric label="จำนวนบิล" value="42 บิล" note="เฉลี่ย ฿1,156 / บิล" icon={<ReceiptText/>} tone="blue"/><Metric label="รอชำระ" value="1 รายการ" note="มูลค่า ฿28,650" icon={<Bell/>} tone="orange"/><Metric label="คืนสินค้า" value="2 รายการ" note="มูลค่า ฿1,240" icon={<RotateCcw/>} tone="green"/></div>
          <section className="data-panel"><div className="panel-toolbar"><div className="segmented"><button className="active">วันนี้</button><button>7 วัน</button><button>เดือนนี้</button></div><label className="table-search compact"><Search size={17}/><input placeholder="ค้นหาเลขที่บิลหรือลูกค้า"/></label></div><div className="table-scroll"><table><thead><tr><th>เลขที่บิล</th><th>เวลา</th><th>ลูกค้า</th><th>สินค้า</th><th>ชำระโดย</th><th>ยอดสุทธิ</th><th>สถานะ</th></tr></thead><tbody>{sales.map(s=><tr key={s.no}><td><strong className="link-text">{s.no}</strong></td><td>{s.time}</td><td>{s.customer}</td><td>{s.items} รายการ</td><td>{s.payment}</td><td><strong>฿{s.total.toLocaleString("th-TH",{minimumFractionDigits:2})}</strong></td><td><span className={`status-chip ${s.status==="สำเร็จ"?"success":s.status==="รอชำระ"?"warning":"danger"}`}>{s.status}</span></td></tr>)}</tbody></table></div></section>
        </div>}

        {activePage === "delivery" && <div className="page-content">
          <div className="page-actions"><div><p>วางแผนคิวรถและติดตามสถานะการจัดส่ง</p></div><button className="outline-action"><MapPin size={17}/> ดูแผนที่</button><button className="primary-action"><Plus size={17}/> สร้างงานจัดส่ง</button></div>
          <div className="metrics"><Metric label="งานวันนี้" value="8 งาน" note="จัดส่งแล้ว 3 งาน" icon={<Truck/>}/><Metric label="กำลังจัดส่ง" value="2 คัน" note="รถพร้อมใช้งาน 1 คัน" icon={<MapPin/>} tone="blue"/><Metric label="รอจัดคิว" value="3 งาน" note="ต้องจัดก่อน 15:00" icon={<ClipboardList/>} tone="orange"/><Metric label="ตรงเวลา" value="96%" note="เฉลี่ย 42 นาที / งาน" icon={<PackageCheck/>} tone="green"/></div>
          <div className="delivery-layout"><section className="data-panel delivery-list"><div className="panel-title"><div><h2>คิวจัดส่งวันนี้</h2><p>วันอังคารที่ 11 สิงหาคม 2569</p></div><span>4 งาน</span></div>{deliveries.map((d,i)=><article className="delivery-card" key={d.no}><span className={`route-dot ${d.tone}`}>{i+1}</span><div className="delivery-main"><div><strong>{d.no} · {d.customer}</strong><span className={`status-chip ${d.tone}`}>{d.status}</span></div><p><MapPin size={14}/> {d.area} <span>•</span> {d.time}</p><small><Truck size={13}/> ทะเบียน {d.truck}</small></div><button className="icon-button"><ChevronDown size={16}/></button></article>)}</section><aside className="route-panel"><div className="map-mock"><MapPin size={32}/><strong>แผนที่เส้นทาง</strong><small>3 จุดส่ง · 42.8 กม.</small><div className="route-line"><i/><i/><i/></div></div><div className="driver-card"><CircleUserRound size={38}/><div><strong>คุณวิชัย ชำนาญทาง</strong><small>คนขับรถ · คันที่ 1</small><span><Phone size={12}/> 089-123-4567</span></div></div></aside></div>
        </div>}

        {activePage === "reports" && <div className="page-content">
          <div className="page-actions"><div><p>ข้อมูลสรุประหว่างวันที่ 1–11 สิงหาคม 2569</p></div><button className="outline-action"><FileText size={17}/> ส่งออก PDF</button><button className="primary-action"><Printer size={17}/> พิมพ์รายงาน</button></div>
          <div className="metrics"><Metric label="ยอดขายสุทธิ" value="฿486,250" note="เพิ่มขึ้น 18.4% จากเดือนก่อน" icon={<BarChart3/>}/><Metric label="กำไรขั้นต้น" value="฿127,480" note="คิดเป็น 26.2%" icon={<WalletCards/>} tone="blue"/><Metric label="จำนวนรายการ" value="426 บิล" note="เฉลี่ย 38 บิล / วัน" icon={<ReceiptText/>} tone="orange"/><Metric label="ลูกค้าใหม่" value="34 ราย" note="เพิ่มขึ้น 8 ราย" icon={<CircleUserRound/>} tone="green"/></div>
          <div className="report-grid"><section className="data-panel chart-panel"><div className="panel-title"><div><h2>ยอดขายรายวัน</h2><p>ยอดขายรวม ฿486,250</p></div><div className="legend"><i/> ยอดขาย</div></div><div className="bar-chart">{[42,56,48,70,64,82,58,76,92,68,86].map((h,i)=><div key={i}><span style={{height:`${h}%`}}/><small>{i+1} ส.ค.</small></div>)}</div></section><section className="data-panel category-report"><div className="panel-title"><div><h2>ยอดขายตามหมวดหมู่</h2><p>5 อันดับแรก</p></div></div>{[["ปูนและซีเมนต์",38,"฿184,775"],["เหล็ก",26,"฿126,425"],["สีและเคมีภัณฑ์",16,"฿77,800"],["อิฐและบล็อก",12,"฿58,350"],["ประปา",8,"฿38,900"]].map(([name,pct,value])=><div className="category-stat" key={name as string}><div><strong>{name}</strong><span>{value}</span></div><div><i style={{width:`${pct}%`}}/></div><small>{pct}%</small></div>)}</section></div>
        </div>}

        {activePage === "users" && currentUser.role === "admin" && <div className="page-content">
          <div className="page-actions"><div><p>เพิ่มผู้ใช้ กำหนดบทบาท และระงับการเข้าใช้งาน</p></div><button className="primary-action" onClick={()=>{setActionError("");setShowUserForm(true)}}><UserCog size={17}/> เพิ่มผู้ใช้งาน</button></div>
          <div className="metrics"><Metric label="ผู้ใช้ทั้งหมด" value={`${users.length} บัญชี`} note="รวมทุกบทบาท" icon={<UserCog/>}/><Metric label="กำลังใช้งาน" value={`${users.filter(u=>u.isActive).length} บัญชี`} note="สามารถเข้าสู่ระบบได้" icon={<Wifi/>} tone="green"/><Metric label="ผู้ดูแลและผู้จัดการ" value={`${users.filter(u=>u.role==="admin"||u.role==="manager").length} บัญชี`} note="เข้าถึงรายงานและตั้งค่า" icon={<Settings/>} tone="blue"/><Metric label="คลังและพนักงานขาย" value={`${users.filter(u=>u.role==="warehouse"||u.role==="user").length} บัญชี`} note="สิทธิ์ตามหน้าที่" icon={<CircleUserRound/>} tone="orange"/></div>
          <section className="data-panel"><div className="panel-toolbar"><label className="table-search"><Search size={17}/><input placeholder="ค้นหาชื่อหรือชื่อผู้ใช้"/></label></div><div className="table-scroll"><table><thead><tr><th>ผู้ใช้งาน</th><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>เข้าใช้ล่าสุด</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><div className="user-cell"><CircleUserRound/><strong>{user.displayName}</strong></div></td><td>@{user.username}</td><td><span className={`role-chip role-${user.role}`}>{roleLabels[user.role]}</span></td><td>{user.lastLoginAt?new Date(user.lastLoginAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"}):"ยังไม่เคยเข้าใช้"}</td><td><span className={`status-chip ${user.isActive?"success":"danger"}`}>{user.isActive?"ใช้งาน":"ระงับ"}</span></td><td><div className="row-actions"><button className="table-action" onClick={()=>resetUserPassword(user)}>ตั้งรหัสผ่าน</button><button className="table-action" disabled={user.id===currentUser.id} onClick={()=>toggleUser(user)}>{user.isActive?"ระงับบัญชี":"เปิดใช้งาน"}</button></div></td></tr>)}</tbody></table></div></section>
        </div>}

        {activePage === "settings" && <div className="page-content settings-page">
          <div className="page-actions"><div><p>กำหนดข้อมูลร้าน การขาย ใบเสร็จ และสต็อก</p></div>{saveState === "saved" && <span className="save-message success"><Check size={15}/> บันทึกเรียบร้อย</span>}{saveState === "error" && <span className="save-message error">บันทึกไม่สำเร็จ</span>}<button className="outline-action" onClick={()=>{setSettings(savedSettings);setSaveState("idle")}}><RotateCcw size={17}/> คืนค่าเดิม</button><button className="primary-action" onClick={saveSettings} disabled={saveState==="saving"}><Save size={17}/> {saveState==="saving"?"กำลังบันทึก...":"บันทึกการตั้งค่า"}</button></div>
          <div className="settings-layout"><nav className="settings-nav" aria-label="หมวดการตั้งค่า">
            <button className={settingsSection === "store" ? "active" : ""} onClick={() => setSettingsSection("store")}><Store size={17}/> ข้อมูลร้าน</button>
            <button className={settingsSection === "sales" ? "active" : ""} onClick={() => setSettingsSection("sales")}><ReceiptText size={17}/> การขายและภาษี</button>
            <button className={settingsSection === "receipt" ? "active" : ""} onClick={() => setSettingsSection("receipt")}><Printer size={17}/> ใบเสร็จ</button>
            <button className={settingsSection === "inventory" ? "active" : ""} onClick={() => setSettingsSection("inventory")}><Boxes size={17}/> สินค้าและสต็อก</button>
            <button className={settingsSection === "categories" ? "active" : ""} onClick={() => setSettingsSection("categories")}><PackageSearch size={17}/> หมวดสินค้า</button>
            {currentUser.role === "admin" && <button className={settingsSection === "users" ? "active" : ""} onClick={() => setSettingsSection("users")}><UserCog size={17}/> จัดการผู้ใช้งาน</button>}
          </nav><div className="settings-forms">
            {settingsSection === "store" && <section className="settings-card store-info-card">
              <div className="settings-card-title"><span><Building2/></span><div><h2>ข้อมูลร้านค้า</h2><p>ข้อมูลสำหรับใบเสร็จ เอกสารภาษี และช่องทางติดต่อร้าน</p></div></div>
              <div className="store-form-section"><h3>ข้อมูลทั่วไป</h3><div className="form-grid">
                <label>ชื่อร้าน <em>*</em><input required value={settings.storeName} onChange={e=>setSettings({...settings,storeName:e.target.value})}/><small>ชื่อที่ใช้แสดงบนเมนูและใบเสร็จ</small></label>
                <label>ชื่อกิจการตามกฎหมาย<input value={settings.legalName} onChange={e=>setSettings({...settings,legalName:e.target.value})}/></label>
                <label>ชื่อสาขา<input value={settings.branchName} onChange={e=>setSettings({...settings,branchName:e.target.value})}/></label>
                <label>รหัสสาขา<input inputMode="numeric" maxLength={5} value={settings.branchCode} onChange={e=>setSettings({...settings,branchCode:e.target.value.replace(/\D/g,"")})}/><small>สำนักงานใหญ่ใช้รหัส 00000</small></label>
                <label>เลขประจำตัวผู้เสียภาษี<input inputMode="numeric" maxLength={13} value={settings.taxId} onChange={e=>setSettings({...settings,taxId:e.target.value.replace(/\D/g,"")})}/><small>{settings.taxId.length === 13 ? "เลขผู้เสียภาษีครบ 13 หลัก" : `${settings.taxId.length}/13 หลัก`}</small></label>
                <label>เวลาทำการ<input value={settings.businessHours} onChange={e=>setSettings({...settings,businessHours:e.target.value})}/></label>
              </div></div>
              <div className="store-form-section"><h3>ข้อมูลติดต่อ</h3><div className="form-grid">
                <label>เบอร์โทรศัพท์<input type="tel" value={settings.phone} onChange={e=>setSettings({...settings,phone:e.target.value})}/></label>
                <label>อีเมล<input type="email" value={settings.email} onChange={e=>setSettings({...settings,email:e.target.value})}/></label>
                <label>LINE ID<input value={settings.lineId} onChange={e=>setSettings({...settings,lineId:e.target.value})}/></label>
                <label className="span-2">ที่อยู่ร้าน<textarea rows={4} value={settings.address} onChange={e=>setSettings({...settings,address:e.target.value})}/></label>
              </div></div>
              <div className="store-profile-preview"><div className="store-preview-logo"><HardHat/></div><div><small>ตัวอย่างข้อมูลร้าน</small><h3>{settings.storeName || "กรุณาระบุชื่อร้าน"}</h3><strong>{settings.legalName} · {settings.branchName} ({settings.branchCode})</strong><p>{settings.address}</p><span>{settings.phone} · {settings.email} · LINE {settings.lineId}</span><em>{settings.businessHours}</em></div></div>
            </section>}
            {settingsSection === "sales" && <section className="settings-card sales-tax-card">
              <div className="settings-card-title"><span><SlidersHorizontal/></span><div><h2>การขายและภาษี</h2><p>กำหนดวิธีคิดภาษี ใบกำกับภาษี การรับชำระ และส่วนลดหน้าร้าน</p></div></div>
              <div className="sales-setting-group"><h3>ภาษีและราคา</h3><div className="form-grid">
                <label>ภาษีมูลค่าเพิ่ม (%)<input type="number" min="0" max="20" step="0.01" value={settings.vatRate} onChange={e=>setSettings({...settings,vatRate:Number(e.target.value)})}/><small>กำหนดได้ระหว่าง 0–20%</small></label>
                <label>สกุลเงิน<select value={settings.currency} onChange={e=>setSettings({...settings,currency:e.target.value})}><option value="THB">บาทไทย (THB)</option></select><small>ใช้กับหน้าขาย ใบเสร็จ และรายงาน</small></label>
                <label className="switch-label"><div><strong>ราคาสินค้ารวม VAT แล้ว</strong><small>เปิดเมื่อราคาขายบนสินค้าเป็นราคาที่รวมภาษีแล้ว</small></div><button type="button" role="switch" aria-checked={settings.pricesIncludeVat} className={`switch ${settings.pricesIncludeVat?"on":""}`} onClick={()=>setSettings({...settings,pricesIncludeVat:!settings.pricesIncludeVat})}><i/></button></label>
                <label className="switch-label"><div><strong>เปิดใช้ใบกำกับภาษี</strong><small>แสดง prefix ใบกำกับภาษีในหน้าชำระเงิน</small></div><button type="button" role="switch" aria-checked={settings.taxInvoiceEnabled} className={`switch ${settings.taxInvoiceEnabled?"on":""}`} onClick={()=>setSettings({...settings,taxInvoiceEnabled:!settings.taxInvoiceEnabled})}><i/></button></label>
                <label>คำนำหน้าใบกำกับภาษี<input disabled={!settings.taxInvoiceEnabled} value={settings.taxInvoicePrefix} maxLength={12} onChange={e=>setSettings({...settings,taxInvoicePrefix:e.target.value.replace(/[^a-zA-Z0-9-]/g,"").toUpperCase()})}/><small>ตัวอย่าง: {(settings.taxInvoicePrefix || "TAX")}-000001</small></label>
              </div></div>
              <div className="sales-setting-group"><h3>การขายหน้าร้าน</h3><div className="form-grid">
                <label>วิธีชำระเงินเริ่มต้น<select value={settings.defaultPaymentMethod} onChange={e=>setSettings({...settings,defaultPaymentMethod:e.target.value as StoreSettings["defaultPaymentMethod"]})}><option value="cash">เงินสด</option><option value="qr">QR / โอนเงิน</option><option value="card">บัตรเครดิต/เดบิต</option></select><small>ใช้เป็นปุ่มที่ถูกเลือกไว้เมื่อเริ่มขาย</small></label>
                <label>การปัดเศษยอดชำระ<select value={settings.roundingMode} onChange={e=>setSettings({...settings,roundingMode:e.target.value as StoreSettings["roundingMode"]})}><option value="none">ไม่ปัดเศษ</option><option value="whole">ปัดเป็นบาทเต็ม</option></select><small>เหมาะกับร้านที่รับเงินสดและต้องการยอดสุทธิเป็นบาทถ้วน</small></label>
                <label className="switch-label"><div><strong>อนุญาตให้ให้ส่วนลด</strong><small>ปิดเพื่อซ่อน/ล็อกส่วนลดในหน้าขาย</small></div><button type="button" role="switch" aria-checked={settings.allowDiscount} className={`switch ${settings.allowDiscount?"on":""}`} onClick={()=>setSettings({...settings,allowDiscount:!settings.allowDiscount})}><i/></button></label>
                <label>ส่วนลดสูงสุด (%)<input disabled={!settings.allowDiscount} type="number" min="0" max="100" step="0.01" value={settings.maxDiscountPercent} onChange={e=>setSettings({...settings,maxDiscountPercent:Number(e.target.value)})}/><small>จำกัดส่วนลดต่อบิลไม่เกินเปอร์เซ็นต์นี้</small></label>
              </div></div>
              <div className="setting-preview calculation-preview">
                <div><span>ราคาสินค้าตัวอย่าง</span><strong>฿{previewBase.toLocaleString("th-TH",{minimumFractionDigits:2})}</strong></div>
                <div><span>VAT {settings.vatRate}% {settings.pricesIncludeVat ? "(รวมในราคา)" : "(บวกเพิ่ม)"}</span><strong>฿{previewVat.toLocaleString("th-TH",{minimumFractionDigits:2})}</strong></div>
                {settings.roundingMode === "whole" && <div><span>ปัดเศษ</span><strong>฿{(previewTotal - previewBeforeRounding).toLocaleString("th-TH",{minimumFractionDigits:2})}</strong></div>}
                <div><span>ยอดชำระตัวอย่าง</span><strong>฿{previewTotal.toLocaleString("th-TH",{minimumFractionDigits:2})}</strong></div>
              </div>
            </section>}
            {settingsSection === "receipt" && <section className="settings-card"><div className="settings-card-title"><span><ReceiptText/></span><div><h2>ใบเสร็จรับเงิน</h2><p>รูปแบบเลขที่และพฤติกรรมหลังชำระเงิน</p></div></div><div className="form-grid"><label>คำนำหน้าเลขที่ใบเสร็จ<input value={settings.receiptPrefix} maxLength={12} onChange={e=>setSettings({...settings,receiptPrefix:e.target.value.replace(/[^a-zA-Z0-9-]/g,"").toUpperCase()})}/><small>ตัวอย่าง: {settings.receiptPrefix || "POS"}-000001</small></label><label className="switch-label"><div><strong>พิมพ์ใบเสร็จอัตโนมัติ</strong><small>สั่งพิมพ์ทันทีหลังรับชำระ</small></div><button type="button" role="switch" aria-checked={settings.autoPrint} className={`switch ${settings.autoPrint?"on":""}`} onClick={()=>setSettings({...settings,autoPrint:!settings.autoPrint})}><i/></button></label><label className="span-2">ข้อความท้ายใบเสร็จ<textarea rows={3} value={settings.receiptFooter} onChange={e=>setSettings({...settings,receiptFooter:e.target.value})}/><small>สูงสุด 300 ตัวอักษร</small></label></div><div className="receipt-preview"><small>{settings.storeName}</small><strong>{settings.receiptPrefix || "POS"}-000001</strong><span>{settings.receiptFooter || "ขอบคุณที่ใช้บริการ"}</span></div></section>}
            {settingsSection === "inventory" && <section className="settings-card"><div className="settings-card-title"><span><Boxes/></span><div><h2>สินค้าและสต็อก</h2><p>ตั้งค่าเกณฑ์การแจ้งเตือนสินค้าที่ใกล้หมด</p></div></div><div className="form-grid"><label>แจ้งเตือนเมื่อเหลือไม่เกิน<input type="number" min="0" max="9999" value={settings.lowStockThreshold} onChange={e=>setSettings({...settings,lowStockThreshold:Number(e.target.value)})}/><small>ระบบจะขึ้นป้าย “ใกล้หมด” และแสดงจำนวนบนกระดิ่งแจ้งเตือน</small></label><label>หน่วยเริ่มต้น<select defaultValue="piece"><option value="piece">ชิ้น</option><option value="bag">ถุง</option><option value="bar">เส้น</option></select><small>เลือกใหม่ได้ตอนเพิ่มสินค้าแต่ละรายการ</small></label></div><div className="inventory-preview"><div><Bell size={20}/><span><strong>{lowStock} รายการ</strong><small>มีสต็อกต่ำกว่าหรือเท่ากับ {settings.lowStockThreshold}</small></span></div>{inventoryProducts.filter(p=>p.stock<=settings.lowStockThreshold).slice(0,3).map(p=><div key={p.id}><span>{p.name}</span><strong>{p.stock} {p.unit}</strong></div>)}{lowStock===0&&<p>ไม่มีสินค้าที่ต่ำกว่าเกณฑ์นี้</p>}</div></section>}
            {settingsSection === "categories" && <section className="settings-card category-settings-card">
              <div className="settings-card-title"><span><PackageSearch/></span><div><h2>หมวดสินค้า</h2><p>เพิ่ม แก้ไข และจัดระเบียบหมวดที่ใช้ในหน้าขายและฟอร์มสินค้า</p></div></div>
              {actionError && <div className="login-error">{actionError}</div>}
              <form className="category-manage-form" onSubmit={editingCategory ? updateCategory : addCategory}>
                <label>{editingCategory ? "แก้ไขชื่อหมวด" : "เพิ่มหมวดใหม่"}<input required value={editingCategory ? editingCategory.name : categoryDraft} onChange={e=>editingCategory?setEditingCategory({...editingCategory,name:e.target.value}):setCategoryDraft(e.target.value)} placeholder="เช่น ไฟฟ้า, สุขภัณฑ์, วัสดุปูพื้น" /></label>
                {editingCategory && <button type="button" className="outline-action" onClick={()=>setEditingCategory(null)}>ยกเลิก</button>}
                <button className="primary-action"><Save size={16}/> {editingCategory ? "บันทึกชื่อหมวด" : "เพิ่มหมวด"}</button>
              </form>
              <div className="category-admin-list">{categoryList.map((item)=><article key={item.id} className="category-admin-item"><div><strong>{item.name}</strong><small>{item.productCount.toLocaleString("th-TH")} รายการสินค้า</small></div><div className="row-actions"><button className="table-action" onClick={()=>setEditingCategory(item)}>แก้ไข</button><button className="table-action danger-button" disabled={item.productCount > 0} onClick={()=>removeCategory(item)}>ลบ</button></div></article>)}</div>
            </section>}
            {settingsSection === "users" && currentUser.role === "admin" && <section className="settings-card user-settings-card"><div className="settings-card-title"><span><UserCog/></span><div><h2>จัดการผู้ใช้งาน</h2><p>เพิ่มผู้ใช้ กำหนดบทบาท ตั้งรหัสผ่าน และระงับการเข้าใช้งาน</p></div><button className="primary-action user-add-button" onClick={()=>{setActionError("");setShowUserForm(true)}}><Plus size={16}/> เพิ่มผู้ใช้</button></div><div className="user-summary"><span><strong>{users.length}</strong> บัญชีทั้งหมด</span><span><strong>{users.filter(u=>u.isActive).length}</strong> กำลังใช้งาน</span><span><strong>{users.filter(u=>!u.isActive).length}</strong> ถูกระงับ</span></div><div className="table-scroll"><table><thead><tr><th>ผู้ใช้งาน</th><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><div className="user-cell"><CircleUserRound/><strong>{user.displayName}</strong></div></td><td>@{user.username}</td><td><span className={`role-chip role-${user.role}`}>{roleLabels[user.role]}</span></td><td><span className={`status-chip ${user.isActive?"success":"danger"}`}>{user.isActive?"ใช้งาน":"ระงับ"}</span></td><td><div className="row-actions"><button className="table-action" onClick={()=>resetUserPassword(user)}>ตั้งรหัสผ่าน</button><button className="table-action" disabled={user.id===currentUser.id} onClick={()=>toggleUser(user)}>{user.isActive?"ระงับบัญชี":"เปิดใช้งาน"}</button></div></td></tr>)}</tbody></table></div></section>}
          </div></div>
        </div>}

        {showReceipt && receipt && <div className="modal-backdrop receipt-backdrop" role="presentation" onMouseDown={() => setShowReceipt(false)}>
          <section className="app-modal receipt-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-title no-print"><div><h2>ใบเสร็จรับเงิน</h2><p>บันทึกการขายเรียบร้อยแล้ว สามารถพิมพ์หรือปิดเพื่อเริ่มบิลใหม่ได้</p></div><button type="button" onClick={() => setShowReceipt(false)}><X/></button></div>
            <div className="thermal-receipt">
              <div className="receipt-brand"><span><HardHat size={22}/></span><strong>{receipt.settings.storeName}</strong><small>{receipt.settings.legalName}</small></div>
              <div className="receipt-store-info"><span>{receipt.settings.address}</span><span>โทร {receipt.settings.phone} · LINE {receipt.settings.lineId}</span>{receipt.settings.taxId && <span>เลขประจำตัวผู้เสียภาษี {receipt.settings.taxId} สาขา {receipt.settings.branchCode}</span>}</div>
              <div className="receipt-divider"/>
              <div className="receipt-doc-title"><strong>{receipt.settings.taxInvoiceEnabled ? "ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ" : "ใบเสร็จรับเงิน"}</strong><span>{receipt.receiptNo}</span>{receipt.taxInvoiceNo && <small>{receipt.taxInvoiceNo}</small>}</div>
              <div className="receipt-meta"><span>วันที่</span><strong>{new Date(receipt.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</strong><span>ลูกค้า</span><strong>{receipt.customerName}</strong><span>พนักงาน</span><strong>{receipt.cashierName}</strong><span>ชำระโดย</span><strong>{receipt.paymentLabel}</strong></div>
              <div className="receipt-divider"/>
              <div className="receipt-items">{receipt.items.map((item) => <div key={`${receipt.id}-${item.productId}`}><span><strong>{item.name}</strong><small>{item.sku} · {item.quantity} {item.unit} x {formatMoney(item.unitPrice)}</small></span><b>{formatMoney(item.lineTotal)}</b></div>)}</div>
              <div className="receipt-divider"/>
              <div className="receipt-totals"><div><span>ยอดรวมสินค้า</span><strong>{formatMoney(receipt.subtotal)}</strong></div><div><span>ส่วนลด</span><strong>-{formatMoney(receipt.discount)}</strong></div><div><span>VAT {receipt.settings.vatRate}% {receipt.settings.pricesIncludeVat ? "(รวมในราคา)" : ""}</span><strong>{formatMoney(receipt.vat)}</strong></div>{Math.abs(receipt.rounding) >= 0.01 && <div><span>ปัดเศษ</span><strong>{formatMoney(receipt.rounding)}</strong></div>}<div className="receipt-grand-total"><span>ยอดชำระสุทธิ</span><strong>{formatMoney(receipt.total)}</strong></div></div>
              <div className="receipt-footer">{receipt.settings.receiptFooter || "ขอบคุณที่ใช้บริการ"}</div>
            </div>
            <div className="modal-actions receipt-actions no-print"><button type="button" className="outline-action" onClick={() => window.print()}><Printer size={16}/> พิมพ์ใบเสร็จ</button><button type="button" className="primary-action" onClick={() => { setShowReceipt(false); setReceipt(null); setCustomerName("ลูกค้าทั่วไป"); }}><Plus size={16}/> เปิดบิลใหม่</button></div>
          </section>
        </div>}

        {showProductForm && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowProductForm(false)}><form className="app-modal" onSubmit={saveProduct} onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>{editingProductId ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h2><p>{editingProductId ? "ปรับข้อมูล ราคา หมวด และจำนวนคงเหลือ" : "บันทึกสินค้าเข้าสู่คลังและหน้าขาย"}</p></div><button type="button" onClick={()=>setShowProductForm(false)}><X/></button></div>{actionError&&<div className="login-error">{actionError}</div>}<div className="form-grid"><label>รหัส SKU<input required value={productDraft.sku} onChange={e=>setProductDraft({...productDraft,sku:e.target.value})}/></label><label>ชื่อสินค้า<input required value={productDraft.name} onChange={e=>setProductDraft({...productDraft,name:e.target.value})}/></label><label>หมวดหมู่<select required value={productDraft.category} onChange={e=>setProductDraft({...productDraft,category:e.target.value})}>{categoryList.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label>หน่วย<input required value={productDraft.unit} onChange={e=>setProductDraft({...productDraft,unit:e.target.value})}/></label><label>ราคาขาย<input required type="number" min="0" step="0.01" value={productDraft.price} onChange={e=>setProductDraft({...productDraft,price:Number(e.target.value)})}/></label><label>จำนวนคงเหลือ<input required type="number" min="0" value={productDraft.stock} onChange={e=>setProductDraft({...productDraft,stock:Number(e.target.value)})}/></label></div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowProductForm(false)}>ยกเลิก</button><button className="primary-action"><Save size={16}/> {editingProductId ? "บันทึกการแก้ไข" : "บันทึกสินค้า"}</button></div></form></div>}

        {showUserForm && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowUserForm(false)}><form className="app-modal" onSubmit={addUser} onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>เพิ่มผู้ใช้งาน</h2><p>กำหนดบัญชีและสิทธิ์การเข้าใช้งาน</p></div><button type="button" onClick={()=>setShowUserForm(false)}><X/></button></div>{actionError&&<div className="login-error">{actionError}</div>}<div className="form-grid"><label>ชื่อ-นามสกุล<input required value={userDraft.displayName} onChange={e=>setUserDraft({...userDraft,displayName:e.target.value})}/></label><label>ชื่อผู้ใช้<input required minLength={3} pattern="[a-zA-Z0-9._-]+" value={userDraft.username} onChange={e=>setUserDraft({...userDraft,username:e.target.value})}/></label><label>รหัสผ่านเริ่มต้น<input required type="password" minLength={8} value={userDraft.password} onChange={e=>setUserDraft({...userDraft,password:e.target.value})}/><small>อย่างน้อย 8 ตัวอักษร</small></label><label>บทบาท<select value={userDraft.role} onChange={e=>setUserDraft({...userDraft,role:e.target.value as UserRole})}><option value="admin">ผู้ดูแลระบบ</option><option value="manager">ผู้จัดการ</option><option value="warehouse">เจ้าหน้าที่คลัง</option><option value="user">พนักงานขาย</option></select></label></div><div className="permission-note"><strong>สิทธิ์ของบทบาทนี้</strong><span>{userDraft.role==="admin"?"ใช้งานได้ทุกเมนู รวมถึงจัดการผู้ใช้":userDraft.role==="manager"?"ใช้งานได้ทุกเมนู ยกเว้นจัดการผู้ใช้":userDraft.role==="warehouse"?"ขายหน้าร้านและจัดการสินค้าในคลัง":"ขายหน้าร้านและดูรายการสินค้า"}</span></div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowUserForm(false)}>ยกเลิก</button><button className="primary-action"><Save size={16}/> เพิ่มผู้ใช้งาน</button></div></form></div>}
      </section>
    </main>
  );
}

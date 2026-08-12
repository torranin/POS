"use client";

import {
  BarChart3, Bell, Boxes, Building2, Check, ChevronDown, CircleUserRound,
  ClipboardList, CreditCard, FileText, Hammer, HardHat, LogOut, MapPin, Menu, Minus,
  PackageCheck, PackagePlus, PackageSearch, PanelLeftClose, PanelLeftOpen, Pencil, Phone, Plus, Printer,
  ReceiptText, RotateCcw, Save, Search, Settings, ShoppingCart, SlidersHorizontal,
  Store, Trash2, Truck, UserCog, WalletCards, Wifi, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, ProductCategory, StoreSettings } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { canAccess, roleLabels, type UserRole } from "@/lib/roles";

type CartItem = Product & { qty: number };
type PageKey = "pos" | "products" | "sales" | "delivery" | "customers" | "receivables" | "reports" | "settings" | "users";
type SettingsSection = "store" | "sales" | "receipt" | "inventory" | "categories" | "audit" | "users";
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
  amountReceived: number;
  changeDue: number;
  status: "completed" | "voided" | "refunded";
  settings: StoreSettings;
  items: ReceiptItem[];
};
type SaleRecord = {
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
  amountReceived: number;
  changeDue: number;
  itemCount: number;
  status: "completed" | "voided" | "refunded";
};
type SalesSummary = { totalSales: number; billCount: number; averagePerBill: number; cashTotal: number };
type AuditLog = { id: number; action: string; detail: string; module: string; actor: string; role: string; createdAt: string; severity: "info" | "success" | "warning" | "danger" };
type CreditPayment = { id: number; customerId: number; customerName: string; amount: number; method: "cash" | "transfer" | "cheque"; reference: string; note: string; createdAt: string; cashier: string };
type CustomerRecord = {
  id: number;
  name: string;
  phone: string;
  type: "ลูกค้าทั่วไป" | "ลูกค้าประจำ" | "ผู้รับเหมา" | "นิติบุคคล";
  contact: string;
  taxId: string;
  address: string;
  orders: number;
  total: number;
  creditLimit: number;
  creditUsed: number;
  creditTerm: number;
  lastOrder: string;
  status: "active" | "watch" | "inactive";
};
type DeliveryStatus = "รอจัดคิว" | "เตรียมสินค้า" | "กำลังจัดส่ง" | "ส่งสำเร็จ" | "ยกเลิก";
type DeliveryRecord = {
  id: number;
  no: string;
  customer: string;
  phone: string;
  area: string;
  address: string;
  time: string;
  truck: string;
  driver: string;
  driverPhone: string;
  items: number;
  amount: number;
  note: string;
  status: DeliveryStatus;
};

const pageNames: Record<PageKey, string> = { pos: "ขายหน้าร้าน", products: "สินค้าและสต็อก", sales: "รายการขาย", delivery: "งานจัดส่ง", customers: "ลูกค้า", receivables: "ลูกหนี้ / รับชำระเครดิต", reports: "รายงานภาพรวม", settings: "ตั้งค่าระบบ", users: "จัดการผู้ใช้งาน" };
const deliverySeeds: DeliveryRecord[] = [
  { id: 1, no: "DLV-0062", customer: "หจก. รุ่งเรืองก่อสร้าง", phone: "081-234-5566", area: "มีนบุรี กทม.", address: "ไซต์งานถนนร่มเกล้า มีนบุรี กรุงเทพฯ", time: "09:00–11:00", truck: "1ฒก 4582", driver: "คุณวิชัย ชำนาญทาง", driverPhone: "089-123-4567", items: 12, amount: 12840, note: "โทรก่อนถึง 20 นาที", status: "กำลังจัดส่ง" },
  { id: 2, no: "DLV-0063", customer: "บจก. เอส.พี.โฮม", phone: "089-772-1900", area: "ลาดกระบัง กทม.", address: "โครงการบ้านจัดสรร ลาดกระบัง กรุงเทพฯ", time: "11:00–13:00", truck: "2ฒข 7109", driver: "คุณสมพร ส่งไว", driverPhone: "086-222-7788", items: 28, amount: 28650, note: "เตรียมเอกสารวางบิลพร้อมสินค้า", status: "เตรียมสินค้า" },
  { id: 3, no: "DLV-0064", customer: "คุณชาญชัย", phone: "088-440-1200", area: "บางพลี สมุทรปราการ", address: "โกดังบางพลี สมุทรปราการ", time: "13:00–15:00", truck: "1ฒก 4582", driver: "คุณวิชัย ชำนาญทาง", driverPhone: "089-123-4567", items: 6, amount: 7850, note: "รอจัดรอบร่วมกับสายบางพลี", status: "รอจัดคิว" },
  { id: 4, no: "DLV-0061", customer: "ร้านช่างเอก", phone: "082-448-6110", area: "สะพานสูง กทม.", address: "ร้านช่างเอก สะพานสูง กรุงเทพฯ", time: "08:30", truck: "2ฒข 7109", driver: "คุณสมพร ส่งไว", driverPhone: "086-222-7788", items: 9, amount: 58350, note: "ส่งสำเร็จ ลูกค้ารับครบ", status: "ส่งสำเร็จ" },
];
const customerSeeds: CustomerRecord[] = [
  { id: 1, name: "หจก. รุ่งเรืองก่อสร้าง", phone: "081-234-5566", type: "ลูกค้าประจำ", contact: "คุณมานะ", taxId: "0105566123001", address: "มีนบุรี กรุงเทพฯ", orders: 18, total: 184775, creditLimit: 80000, creditUsed: 28500, creditTerm: 30, lastOrder: "วันนี้ 13:48", status: "active" },
  { id: 2, name: "บจก. เอส.พี.โฮม", phone: "089-772-1900", type: "ผู้รับเหมา", contact: "คุณศุภชัย", taxId: "0105566123002", address: "ลาดกระบัง กรุงเทพฯ", orders: 11, total: 126425, creditLimit: 120000, creditUsed: 84000, creditTerm: 45, lastOrder: "วันนี้ 10:16", status: "active" },
  { id: 3, name: "คุณสมชาย ใจดี", phone: "086-555-2048", type: "ลูกค้าทั่วไป", contact: "คุณสมชาย", taxId: "", address: "บางพลี สมุทรปราการ", orders: 5, total: 18650, creditLimit: 0, creditUsed: 0, creditTerm: 0, lastOrder: "11 ส.ค. 2569", status: "watch" },
  { id: 4, name: "ร้านช่างเอก", phone: "082-448-6110", type: "ลูกค้าประจำ", contact: "คุณเอก", taxId: "0105566123004", address: "สะพานสูง กรุงเทพฯ", orders: 9, total: 58350, creditLimit: 50000, creditUsed: 12500, creditTerm: 30, lastOrder: "10 ส.ค. 2569", status: "active" },
];
const creditPaymentSeeds: CreditPayment[] = [
  { id: 1, customerId: 1, customerName: "หจก. รุ่งเรืองก่อสร้าง", amount: 12000, method: "transfer", reference: "TR-0826-001", note: "โอนชำระบางส่วน", createdAt: new Date().toISOString(), cashier: "ระบบตัวอย่าง" },
  { id: 2, customerId: 4, customerName: "ร้านช่างเอก", amount: 5000, method: "cash", reference: "RCV-0826-002", note: "รับเงินสดหน้าร้าน", createdAt: new Date(Date.now() - 86400000).toISOString(), cashier: "ระบบตัวอย่าง" },
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [settings, setSettings] = useState(initialSettings);
  const [savedSettings, setSavedSettings] = useState(initialSettings);
  const [paymentMethod, setPaymentMethod] = useState<StoreSettings["defaultPaymentMethod"]>(initialSettings.defaultPaymentMethod);
  const [customerName, setCustomerName] = useState("ลูกค้าทั่วไป");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [posCustomerSearch, setPosCustomerSearch] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [checkoutState, setCheckoutState] = useState<"idle" | "saving" | "error">("idle");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("store");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [inventoryProducts, setInventoryProducts] = useState(products);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("ทั้งหมด");
  const [inventoryStatus, setInventoryStatus] = useState<"all" | "ready" | "low" | "out">("all");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productDraft, setProductDraft] = useState({ sku: "", name: "", category: initialCategories[0]?.name ?? "", unit: "ชิ้น", price: 0, stock: 0 });
  const [categoryDraft, setCategoryDraft] = useState("");
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userDraft, setUserDraft] = useState<{username:string;displayName:string;password:string;role:UserRole}>({ username: "", displayName: "", password: "", role: "user" });
  const [customerRecords, setCustomerRecords] = useState<CustomerRecord[]>(customerSeeds);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"ทั้งหมด" | CustomerRecord["type"]>("ทั้งหมด");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>(creditPaymentSeeds);
  const [receivableSearch, setReceivableSearch] = useState("");
  const [receivableFilter, setReceivableFilter] = useState<"all" | "due" | "overlimit">("all");
  const [showCreditPayment, setShowCreditPayment] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState<CustomerRecord | null>(null);
  const [creditPaymentDraft, setCreditPaymentDraft] = useState({ amount: 0, method: "transfer" as CreditPayment["method"], reference: "", note: "" });
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [customerDraft, setCustomerDraft] = useState<Omit<CustomerRecord, "id" | "orders" | "total" | "lastOrder">>({
    name: "",
    phone: "",
    type: "ลูกค้าทั่วไป",
    contact: "",
    taxId: "",
    address: "",
    creditLimit: 0,
    creditUsed: 0,
    creditTerm: 0,
    status: "active",
  });
  const [actionError, setActionError] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    { id: 1, action: "เข้าสู่ระบบ", detail: `${currentUser.displayName} เปิดใช้งานระบบ POS`, module: "ระบบ", actor: currentUser.displayName, role: roleLabels[currentUser.role], createdAt: new Date().toISOString(), severity: "success" },
  ]);
  const [saleRecords, setSaleRecords] = useState<SaleRecord[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary>({ totalSales: 0, billCount: 0, averagePerBill: 0, cashTotal: 0 });
  const [salesPeriod, setSalesPeriod] = useState<"today" | "7days" | "month">("today");
  const [reportPeriod, setReportPeriod] = useState<"today" | "7days" | "month">("month");
  const [salesQuery, setSalesQuery] = useState("");
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<"all" | StoreSettings["defaultPaymentMethod"]>("all");
  const [salesStatusFilter, setSalesStatusFilter] = useState<"all" | SaleRecord["status"]>("all");
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesReloadKey, setSalesReloadKey] = useState(0);
  const [deliveryRecords, setDeliveryRecords] = useState<DeliveryRecord[]>(deliverySeeds);
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<"ทั้งหมด" | DeliveryStatus>("ทั้งหมด");
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryRecord | null>(null);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryDraft, setDeliveryDraft] = useState<Omit<DeliveryRecord, "id" | "no">>({
    customer: "",
    phone: "",
    area: "",
    address: "",
    time: "",
    truck: "1ฒก 4582",
    driver: "คุณวิชัย ชำนาญทาง",
    driverPhone: "089-123-4567",
    items: 1,
    amount: 0,
    note: "",
    status: "รอจัดคิว",
  });
  const queryInputRef = useRef<HTMLInputElement>(null);
  const canManageProducts = canAccess(currentUser.role, "manage_products");
  const categoryNames = useMemo(() => ["ทั้งหมด", ...categoryList.map((item) => item.name)], [categoryList]);

  useEffect(() => {
    if (activePage === "settings" && settingsSection === "users" && currentUser.role === "admin") fetch("/api/users").then((r)=>r.json()).then(setUsers).catch(()=>setActionError("โหลดรายชื่อผู้ใช้ไม่สำเร็จ"));
  }, [activePage, settingsSection, currentUser.role]);
  useEffect(() => {
    if (!categoryNames.includes(category)) setCategory("ทั้งหมด");
  }, [category, categoryNames]);
  useEffect(() => {
    if (!["sales", "customers", "reports"].includes(activePage) || !canAccess(currentUser.role, "sales")) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSalesLoading(true);
      try {
        const params = new URLSearchParams({ period: activePage === "customers" ? "month" : activePage === "reports" ? reportPeriod : salesPeriod });
        if (activePage === "sales" && salesQuery.trim()) params.set("q", salesQuery.trim());
        const response = await fetch(`/api/sales?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "โหลดรายการขายไม่สำเร็จ");
        setSaleRecords(data.sales);
        setSalesSummary(data.summary);
      } catch (error) {
        if (!controller.signal.aborted) setActionError(error instanceof Error ? error.message : "โหลดรายการขายไม่สำเร็จ");
      } finally {
        if (!controller.signal.aborted) setSalesLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [activePage, currentUser.role, salesPeriod, reportPeriod, salesQuery, salesReloadKey]);

  const filtered = useMemo(() => inventoryProducts.filter((p) => {
    const matchesCategory = category === "ทั้งหมด" || p.category === category;
    const term = query.trim().toLowerCase();
    return matchesCategory && (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  }), [inventoryProducts, query, category]);
  const visibleInventoryProducts = useMemo(() => inventoryProducts.filter((product) => {
    const term = inventorySearch.trim().toLowerCase();
    const matchesTerm = !term || product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term) || product.category.toLowerCase().includes(term);
    const matchesCategory = inventoryCategory === "ทั้งหมด" || product.category === inventoryCategory;
    const matchesStatus =
      inventoryStatus === "all" ||
      (inventoryStatus === "ready" && product.stock > settings.lowStockThreshold) ||
      (inventoryStatus === "low" && product.stock > 0 && product.stock <= settings.lowStockThreshold) ||
      (inventoryStatus === "out" && product.stock <= 0);
    return matchesTerm && matchesCategory && matchesStatus;
  }), [inventoryProducts, inventorySearch, inventoryCategory, inventoryStatus, settings.lowStockThreshold]);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const maxDiscount = subtotal * (settings.maxDiscountPercent / 100);
  const effectiveDiscount = settings.allowDiscount ? Math.min(discount, maxDiscount) : 0;
  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const vat = settings.vatRate > 0 ? (settings.pricesIncludeVat ? taxableAmount * settings.vatRate / (100 + settings.vatRate) : taxableAmount * (settings.vatRate / 100)) : 0;
  const unroundedTotal = settings.pricesIncludeVat ? taxableAmount : taxableAmount + vat;
  const total = settings.roundingMode === "whole" ? Math.round(unroundedTotal) : unroundedTotal;
  const receivedValue = Number(amountReceived) || 0;
  const changeDue = paymentMethod === "cash" ? Math.max(0, receivedValue - total) : 0;
  const cashPresets = useMemo(() => {
    const values = [total, Math.ceil(total / 10) * 10, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500];
    return [...new Set(values.map((value) => Math.max(total, value)).filter((value) => value > 0))].slice(0, 4);
  }, [total]);
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        queryInputRef.current?.focus();
        queryInputRef.current?.select();
      }
      if (event.key === "F10" && activePage === "pos" && cart.length > 0 && !showPayment && !showReceipt) {
        event.preventDefault();
        beginCheckout();
      }
      if (event.key === "Escape" && showPayment && checkoutState !== "saving") setShowPayment(false);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activePage, cart.length, checkoutState, paymentMethod, showPayment, showReceipt, total]);
  const previewBase = 1000;
  const previewVat = settings.vatRate > 0 ? (settings.pricesIncludeVat ? previewBase * settings.vatRate / (100 + settings.vatRate) : previewBase * (settings.vatRate / 100)) : 0;
  const previewBeforeRounding = settings.pricesIncludeVat ? previewBase : previewBase + previewVat;
  const previewTotal = settings.roundingMode === "whole" ? Math.round(previewBeforeRounding) : previewBeforeRounding;
  const lowStock = inventoryProducts.filter((p) => p.stock <= settings.lowStockThreshold).length;
  const totalInventoryValue = inventoryProducts.reduce((sum, product) => sum + product.price * product.stock, 0);
  const outOfStock = inventoryProducts.filter((product) => product.stock <= 0).length;
  const lowStockProducts = inventoryProducts
    .filter((product) => product.stock <= settings.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 6);
  const categorySummary = categoryList
    .map((item) => {
      const productsInCategory = inventoryProducts.filter((product) => product.category === item.name);
      return {
        ...item,
        stock: productsInCategory.reduce((sum, product) => sum + product.stock, 0),
        value: productsInCategory.reduce((sum, product) => sum + product.price * product.stock, 0),
      };
    })
    .filter((item) => item.productCount > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const visibleSaleRecords = useMemo(() => saleRecords.filter((sale) => {
    const matchesPayment = salesPaymentFilter === "all" || sale.paymentMethod === salesPaymentFilter;
    const matchesStatus = salesStatusFilter === "all" || sale.status === salesStatusFilter;
    return matchesPayment && matchesStatus;
  }), [saleRecords, salesPaymentFilter, salesStatusFilter]);
  const completedVisibleSales = visibleSaleRecords.filter((sale) => sale.status === "completed");
  const visibleSalesTotal = completedVisibleSales.reduce((sum, sale) => sum + sale.total, 0);
  const visibleSalesVat = completedVisibleSales.reduce((sum, sale) => sum + sale.vat, 0);
  const visibleSalesDiscount = completedVisibleSales.reduce((sum, sale) => sum + sale.discount, 0);
  const largestSale = [...completedVisibleSales].sort((a, b) => b.total - a.total)[0];
  const latestSale = visibleSaleRecords[0];
  const paymentSummary = (["cash", "qr", "card"] as const).map((method) => ({
    method,
    label: method === "cash" ? "เงินสด" : method === "qr" ? "QR / โอน" : "เครดิต",
    total: completedVisibleSales.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + sale.total, 0),
    count: completedVisibleSales.filter((sale) => sale.paymentMethod === method).length,
  }));
  const reportCompletedSales = saleRecords.filter((sale) => sale.status === "completed");
  const reportRevenue = reportCompletedSales.reduce((sum, sale) => sum + sale.total, 0);
  const reportVat = reportCompletedSales.reduce((sum, sale) => sum + sale.vat, 0);
  const reportDiscount = reportCompletedSales.reduce((sum, sale) => sum + sale.discount, 0);
  const reportItemCount = reportCompletedSales.reduce((sum, sale) => sum + sale.itemCount, 0);
  const reportAverageBill = reportCompletedSales.length ? reportRevenue / reportCompletedSales.length : 0;
  const reportPeriodLabel = reportPeriod === "today" ? "วันนี้" : reportPeriod === "7days" ? "7 วันล่าสุด" : "เดือนนี้";
  const reportPaymentSummary = (["cash", "qr", "card"] as const).map((method) => ({
    method,
    label: method === "cash" ? "เงินสด" : method === "qr" ? "QR / โอน" : "เครดิต",
    total: reportCompletedSales.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + sale.total, 0),
    count: reportCompletedSales.filter((sale) => sale.paymentMethod === method).length,
  }));
  const reportDailyTotals = Array.from(reportCompletedSales.reduce((map, sale) => {
    const date = new Date(sale.createdAt);
    const key = date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    map.set(key, (map.get(key) || 0) + sale.total);
    return map;
  }, new Map<string, number>()).entries()).slice(-10);
  const reportMaxDaily = Math.max(1, ...reportDailyTotals.map(([, total]) => total));
  const reportLowStock = inventoryProducts
    .filter((product) => product.stock <= settings.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5);
  const reportTopCategories = categorySummary.map((item) => ({
    ...item,
    percent: totalInventoryValue ? Math.round((item.value / totalInventoryValue) * 100) : 0,
  }));
  const visibleCustomers = useMemo(() => customerRecords.filter((customer) => {
    const term = customerSearch.trim().toLowerCase();
    const matchesTerm = !term || customer.name.toLowerCase().includes(term) || customer.phone.toLowerCase().includes(term) || customer.type.toLowerCase().includes(term) || customer.contact.toLowerCase().includes(term) || customer.taxId.includes(term);
    const matchesType = customerTypeFilter === "ทั้งหมด" || customer.type === customerTypeFilter;
    return matchesTerm && matchesType;
  }), [customerRecords, customerSearch, customerTypeFilter]);
  const topCustomer = [...customerRecords].sort((a, b) => b.total - a.total)[0];
  const activeCustomers = customerRecords.filter((customer) => customer.status === "active").length;
  const totalCustomerSales = customerRecords.reduce((sum, customer) => sum + customer.total, 0);
  const totalCreditLimit = customerRecords.reduce((sum, customer) => sum + customer.creditLimit, 0);
  const totalCreditUsed = customerRecords.reduce((sum, customer) => sum + customer.creditUsed, 0);
  const debtorCustomers = useMemo(() => customerRecords.filter((customer) => customer.creditUsed > 0).filter((customer) => {
    const term = receivableSearch.trim().toLowerCase();
    const matchesTerm = !term || customer.name.toLowerCase().includes(term) || customer.phone.includes(term) || customer.contact.toLowerCase().includes(term) || customer.taxId.includes(term);
    const isDue = customer.creditTerm > 0 && customer.creditUsed > 0;
    const isOverLimit = customer.creditLimit > 0 && customer.creditUsed > customer.creditLimit;
    return matchesTerm && (receivableFilter === "all" || (receivableFilter === "due" && isDue) || (receivableFilter === "overlimit" && isOverLimit));
  }).sort((a, b) => b.creditUsed - a.creditUsed), [customerRecords, receivableSearch, receivableFilter]);
  const totalReceivable = customerRecords.reduce((sum, customer) => sum + customer.creditUsed, 0);
  const overLimitCustomers = customerRecords.filter((customer) => customer.creditLimit > 0 && customer.creditUsed > customer.creditLimit);
  const dueCustomers = customerRecords.filter((customer) => customer.creditUsed > 0 && customer.creditTerm > 0);
  const latestCreditPayments = creditPayments.slice(0, 8);
  const posCustomerMatches = useMemo(() => {
    const term = posCustomerSearch.trim().toLowerCase();
    return customerRecords.filter((customer) => !term || customer.name.toLowerCase().includes(term) || customer.phone.toLowerCase().includes(term) || customer.contact.toLowerCase().includes(term) || customer.taxId.includes(term)).slice(0, 10);
  }, [customerRecords, posCustomerSearch]);
  const customerSaleHistory = selectedCustomer
    ? saleRecords.filter((sale) => sale.customerName === selectedCustomer.name)
    : [];
  const displayedCustomerHistory = selectedCustomer ? (customerSaleHistory.length ? customerSaleHistory : [
    { id: -selectedCustomer.id, receiptNo: "MOCK-CREDIT", taxInvoiceNo: selectedCustomer.taxId ? "TAX-MOCK" : "", customerName: selectedCustomer.name, cashierName: "ระบบตัวอย่าง", createdAt: new Date().toISOString(), paymentMethod: "cash" as const, paymentLabel: "เครดิตลูกค้า", subtotal: selectedCustomer.creditUsed, discount: 0, vat: 0, rounding: 0, total: selectedCustomer.creditUsed, amountReceived: 0, changeDue: 0, itemCount: Math.max(1, selectedCustomer.orders), status: selectedCustomer.creditUsed > 0 ? "completed" as const : "voided" as const },
  ].filter((sale) => sale.total > 0)) : [];
  const selectedCustomerPayments = selectedCustomer ? creditPayments.filter((payment) => payment.customerId === selectedCustomer.id) : [];
  const deliveryTone = (status: DeliveryStatus) => status === "กำลังจัดส่ง" ? "blue" : status === "เตรียมสินค้า" ? "orange" : status === "ส่งสำเร็จ" ? "green" : status === "ยกเลิก" ? "danger" : "gray";
  const visibleDeliveries = useMemo(() => deliveryRecords.filter((delivery) => {
    const term = deliverySearch.trim().toLowerCase();
    const matchesTerm = !term || delivery.no.toLowerCase().includes(term) || delivery.customer.toLowerCase().includes(term) || delivery.phone.includes(term) || delivery.area.toLowerCase().includes(term) || delivery.truck.toLowerCase().includes(term) || delivery.driver.toLowerCase().includes(term);
    const matchesStatus = deliveryStatusFilter === "ทั้งหมด" || delivery.status === deliveryStatusFilter;
    return matchesTerm && matchesStatus;
  }), [deliveryRecords, deliverySearch, deliveryStatusFilter]);
  const activeDeliveries = deliveryRecords.filter((delivery) => ["รอจัดคิว","เตรียมสินค้า","กำลังจัดส่ง"].includes(delivery.status));
  const completedDeliveries = deliveryRecords.filter((delivery) => delivery.status === "ส่งสำเร็จ");
  const deliveryDrivers = [...new Set(deliveryRecords.map((delivery) => delivery.driver))];
  const selectedDeliveryDriver = deliveryRecords.find((delivery) => delivery.status === "กำลังจัดส่ง") || deliveryRecords[0];
  const urgentStockNotifications = lowStockProducts.slice(0, 5);
  const deliveryNotifications = activeDeliveries.slice(0, 5);
  const notificationCount = lowStock + activeDeliveries.length;
  const auditTodayCount = auditLogs.filter((log) => new Date(log.createdAt).toDateString() === new Date().toDateString()).length;
  const auditDangerCount = auditLogs.filter((log) => log.severity === "danger" || log.severity === "warning").length;
  const latestAuditLogs = auditLogs.slice(0, 12);

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      setActionError("สินค้านี้หมดสต็อก");
      return;
    }
    setActionError("");
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found ? current.map((item) => item.id === product.id ? { ...item, qty: Math.min(item.qty + 1, item.stock) } : item) : [...current, { ...product, qty: 1 }];
    });
  }
  function changeQty(id: number, amount: number) {
    setCart((current) => current.map((item) => item.id === id ? { ...item, qty: Math.max(0, Math.min(item.stock, item.qty + amount)) } : item).filter((item) => item.qty > 0));
  }
  function addAudit(action: string, detail: string, module: string, severity: AuditLog["severity"] = "info") {
    setAuditLogs((logs) => [{
      id: Date.now(),
      action,
      detail,
      module,
      actor: currentUser.displayName,
      role: roleLabels[currentUser.role],
      createdAt: new Date().toISOString(),
      severity,
    }, ...logs].slice(0, 200));
  }
  function downloadJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  function exportAuditLogs() {
    downloadJson(`audit-log-${new Date().toISOString().slice(0, 10)}.json`, { exportedAt: new Date().toISOString(), store: settings.storeName, logs: auditLogs });
    addAudit("ส่งออก Audit Log", `ดาวน์โหลดประวัติ ${auditLogs.length} รายการ`, "สำรองข้อมูล", "success");
  }
  function exportBackup() {
    downloadJson(`pos-backup-${new Date().toISOString().slice(0, 10)}.json`, {
      exportedAt: new Date().toISOString(),
      storeSettings: settings,
      products: inventoryProducts,
      categories: categoryList,
      customers: customerRecords,
      creditPayments,
      deliveries: deliveryRecords,
      visibleSales: saleRecords,
      auditLogs,
    });
    addAudit("สำรองข้อมูล", "ดาวน์โหลดไฟล์สำรองข้อมูลระบบ POS", "สำรองข้อมูล", "success");
  }
  function editDiscount() {
    if (!settings.allowDiscount || !cart.length) return;
    const value = window.prompt(`ระบุส่วนลด (สูงสุด ${formatMoney(maxDiscount)})`, String(effectiveDiscount));
    if (value === null) return;
    const nextDiscount = Number(value);
    if (!Number.isFinite(nextDiscount) || nextDiscount < 0) {
      setActionError("ส่วนลดต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป");
      return;
    }
    setDiscount(Math.min(nextDiscount, maxDiscount));
    setActionError(nextDiscount > maxDiscount ? `จำกัดส่วนลดสูงสุด ${settings.maxDiscountPercent}%` : "");
  }
  function choosePayment(method: StoreSettings["defaultPaymentMethod"]) {
    setPaymentMethod(method);
    setAmountReceived(method === "cash" ? total.toFixed(2) : "");
  }
  function beginCheckout() {
    if (!cart.length || checkoutState === "saving") return;
    setActionError("");
    setAmountReceived(paymentMethod === "cash" ? total.toFixed(2) : "");
    setShowPayment(true);
  }
  async function checkout() {
    if (!cart.length || checkoutState === "saving") return;
    if (paymentMethod === "cash" && receivedValue + 0.001 < total) {
      setCheckoutState("error");
      setActionError("จำนวนเงินที่รับน้อยกว่ายอดชำระ");
      return;
    }
    setActionError("");
    setCheckoutState("saving");
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          paymentMethod,
          amountReceived: paymentMethod === "cash" ? receivedValue : total,
          discount: effectiveDiscount,
          items: cart.map((item) => ({ productId: item.id, quantity: item.qty })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "บันทึกใบเสร็จไม่สำเร็จ");
      const soldItems = cart;
      setReceipt(data.receipt);
      setShowReceipt(true);
      setShowPayment(false);
      setCart([]);
      setDiscount(0);
      setAmountReceived("");
      setInventoryProducts((items) => items.map((product) => {
        const sold = soldItems.find((item) => item.id === product.id);
        return sold ? { ...product, stock: Math.max(0, product.stock - sold.qty) } : product;
      }));
      if (paymentMethod === "card") {
        setCustomerRecords((items) => items.map((customer) => customer.name === customerName ? { ...customer, creditUsed: customer.creditUsed + data.receipt.total, total: customer.total + data.receipt.total, orders: customer.orders + 1, lastOrder: "วันนี้" } : customer));
      }
      setCheckoutState("idle");
      setSalesReloadKey((value) => value + 1);
      addAudit("ขายสินค้า", `บันทึกบิล ${data.receipt.receiptNo} ลูกค้า ${customerName} ยอด ${formatMoney(data.receipt.total)}`, "ขายหน้าร้าน", "success");
      if (settings.autoPrint) window.setTimeout(() => window.print(), 350);
    } catch (error) {
      setCheckoutState("error");
      setActionError(error instanceof Error ? error.message : "บันทึกใบเสร็จไม่สำเร็จ");
    }
  }
  async function viewSale(id: number) {
    setActionError("");
    try {
      const response = await fetch(`/api/sales?id=${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "โหลดใบเสร็จไม่สำเร็จ");
      setReceipt(data.receipt);
      setShowReceipt(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "โหลดใบเสร็จไม่สำเร็จ");
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
      addAudit("บันทึกตั้งค่าระบบ", "แก้ไขข้อมูลร้าน/การขาย/ใบเสร็จ/สต็อก", "ตั้งค่าระบบ", "success");
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
    addAudit(editingProductId ? "แก้ไขสินค้า" : "เพิ่มสินค้า", `${data.sku} · ${data.name} คงเหลือ ${data.stock} ${data.unit}`, "สินค้าและสต็อก", editingProductId ? "info" : "success");
    await refreshCategories();
  }
  async function adjustProductStock(product: Product, amount: number) {
    const nextStock = Math.max(0, product.stock + amount);
    setActionError("");
    const response = await fetch("/api/products", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...product, stock: nextStock }) });
    const data = await response.json(); if (!response.ok) { setActionError(data.message); return; }
    setInventoryProducts((items)=>items.map((item)=>item.id===product.id?data:item));
    setCart((items)=>items.map((item)=>item.id===product.id?{...item,...data,qty:Math.min(item.qty,data.stock)}:item).filter((item)=>item.qty>0));
    addAudit("ปรับสต็อก", `${product.sku} · ${product.name}: ${product.stock} → ${data.stock} ${product.unit}`, "สินค้าและสต็อก", data.stock <= settings.lowStockThreshold ? "warning" : "info");
  }
  async function removeProduct(id:number) {
    if (!window.confirm("ยืนยันการลบสินค้านี้ออกจากรายการขาย?")) return;
    const response = await fetch(`/api/products?id=${id}`,{method:"DELETE"});
    if (response.ok) { const removed = inventoryProducts.find((product)=>product.id===id); setInventoryProducts((items)=>items.filter((p)=>p.id!==id)); setCart((items)=>items.filter((p)=>p.id!==id)); addAudit("ลบสินค้า", removed ? `${removed.sku} · ${removed.name}` : `รหัสสินค้า ${id}`, "สินค้าและสต็อก", "danger"); await refreshCategories(); }
  }
  async function addUser(event:React.FormEvent) {
    event.preventDefault(); setActionError("");
    const response=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(userDraft)}); const data=await response.json();
    if(!response.ok){setActionError(data.message);return} setShowUserForm(false); setUserDraft({username:"",displayName:"",password:"",role:"user"});
    const refreshed=await fetch("/api/users").then(r=>r.json()); setUsers(refreshed);
    addAudit("เพิ่มผู้ใช้งาน", `${data.displayName || userDraft.displayName} (${roleLabels[userDraft.role]})`, "จัดการผู้ใช้งาน", "success");
  }
  async function toggleUser(user:ManagedUser) {
    const response=await fetch("/api/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:user.id,isActive:!user.isActive})});
    if(response.ok){setUsers(items=>items.map(item=>item.id===user.id?{...item,isActive:item.isActive?0:1}:item)); addAudit(user.isActive ? "ระงับผู้ใช้งาน" : "เปิดใช้งานผู้ใช้", user.displayName, "จัดการผู้ใช้งาน", user.isActive ? "warning" : "success");}
  }
  async function resetUserPassword(user:ManagedUser) {
    const password=window.prompt(`ตั้งรหัสผ่านใหม่สำหรับ ${user.displayName} (อย่างน้อย 8 ตัวอักษร)`); if(!password)return;
    const response=await fetch("/api/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:user.id,password})}); const data=await response.json();
    window.alert(response.ok?"เปลี่ยนรหัสผ่านเรียบร้อย":data.message);
    if (response.ok) addAudit("ตั้งรหัสผ่านใหม่", user.displayName, "จัดการผู้ใช้งาน", "warning");
  }
  async function addCategory(event: React.FormEvent) {
    event.preventDefault(); setActionError("");
    const response = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: categoryDraft }) });
    const data = await response.json();
    if (!response.ok) { setActionError(data.message); return; }
    setCategoryList(data); setCategoryDraft("");
    if (!productDraft.category && data[0]) setProductDraft((draft)=>({ ...draft, category: data[0].name }));
    addAudit("เพิ่มหมวดสินค้า", categoryDraft.trim(), "หมวดสินค้า", "success");
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
    addAudit("แก้ไขหมวดสินค้า", `${oldName} → ${editingCategory.name}`, "หมวดสินค้า", "info");
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
    addAudit("ลบหมวดสินค้า", item.name, "หมวดสินค้า", "danger");
  }
  function openCustomerForm(customer?: CustomerRecord) {
    setActionError("");
    if (customer) {
      setEditingCustomerId(customer.id);
      setCustomerDraft({
        name: customer.name,
        phone: customer.phone,
        type: customer.type,
        contact: customer.contact,
        taxId: customer.taxId,
        address: customer.address,
        creditLimit: customer.creditLimit,
        creditUsed: customer.creditUsed,
        creditTerm: customer.creditTerm,
        status: customer.status,
      });
    } else {
      setEditingCustomerId(null);
      setCustomerDraft({ name: "", phone: "", type: "ลูกค้าทั่วไป", contact: "", taxId: "", address: "", creditLimit: 0, creditUsed: 0, creditTerm: 0, status: "active" });
    }
    setShowCustomerForm(true);
  }
  function saveCustomer(event: React.FormEvent) {
    event.preventDefault();
    const name = customerDraft.name.trim();
    const phone = customerDraft.phone.trim();
    if (!name || !phone) {
      setActionError("กรุณากรอกชื่อลูกค้าและเบอร์โทร");
      return;
    }
    const duplicate = customerRecords.some((customer) => customer.phone === phone && customer.id !== editingCustomerId);
    if (duplicate) {
      setActionError("เบอร์โทรนี้มีอยู่ในระบบลูกค้าแล้ว");
      return;
    }
    const payload = { ...customerDraft, name, phone, contact: customerDraft.contact.trim(), taxId: customerDraft.taxId.trim(), address: customerDraft.address.trim(), creditLimit: Math.max(0, Number(customerDraft.creditLimit) || 0), creditUsed: Math.max(0, Number(customerDraft.creditUsed) || 0), creditTerm: Math.max(0, Math.floor(Number(customerDraft.creditTerm) || 0)) };
    setCustomerRecords((items) => editingCustomerId
      ? items.map((item) => item.id === editingCustomerId ? { ...item, ...payload } : item)
      : [{ id: Date.now(), orders: 0, total: 0, lastOrder: "ยังไม่เคยซื้อ", ...payload }, ...items]);
    if (selectedCustomer?.id === editingCustomerId) setSelectedCustomer({ ...selectedCustomer, ...payload });
    setShowCustomerForm(false);
    setEditingCustomerId(null);
    setActionError("");
    addAudit(editingCustomerId ? "แก้ไขลูกค้า" : "เพิ่มลูกค้า", `${payload.name} · เครดิต ${formatMoney(payload.creditLimit)}`, "ลูกค้า", editingCustomerId ? "info" : "success");
  }
  function removeCustomer(customer: CustomerRecord) {
    if (!window.confirm(`ยืนยันการลบลูกค้า "${customer.name}"?`)) return;
    setCustomerRecords((items) => items.filter((item) => item.id !== customer.id));
    addAudit("ลบลูกค้า", customer.name, "ลูกค้า", "danger");
  }
  function choosePosCustomer(name: string) {
    setCustomerName(name.trim() || "ลูกค้าทั่วไป");
    setShowCustomerPicker(false);
    setPosCustomerSearch("");
  }
  function openCreditPayment(customer: CustomerRecord) {
    setSelectedDebtor(customer);
    setCreditPaymentDraft({ amount: customer.creditUsed, method: "transfer", reference: `RCV-${new Date().toISOString().slice(5, 10).replace("-", "")}-${String(creditPayments.length + 1).padStart(3, "0")}`, note: "" });
    setActionError("");
    setShowCreditPayment(true);
  }
  function receiveCreditPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDebtor) return;
    const amount = Math.min(selectedDebtor.creditUsed, Math.max(0, Number(creditPaymentDraft.amount) || 0));
    if (amount <= 0) {
      setActionError("กรุณาระบุยอดรับชำระมากกว่า 0");
      return;
    }
    const payment: CreditPayment = {
      id: Date.now(),
      customerId: selectedDebtor.id,
      customerName: selectedDebtor.name,
      amount,
      method: creditPaymentDraft.method,
      reference: creditPaymentDraft.reference.trim() || `RCV-${Date.now()}`,
      note: creditPaymentDraft.note.trim(),
      createdAt: new Date().toISOString(),
      cashier: currentUser.displayName,
    };
    setCreditPayments((items) => [payment, ...items]);
    setCustomerRecords((items) => items.map((customer) => customer.id === selectedDebtor.id ? { ...customer, creditUsed: Math.max(0, customer.creditUsed - amount) } : customer));
    setSelectedCustomer((customer) => customer?.id === selectedDebtor.id ? { ...customer, creditUsed: Math.max(0, customer.creditUsed - amount) } : customer);
    addAudit("รับชำระเครดิต", `${selectedDebtor.name} ชำระ ${formatMoney(amount)} เลขอ้างอิง ${payment.reference}`, "ลูกหนี้", "success");
    setShowCreditPayment(false);
    setSelectedDebtor(null);
    setActionError("");
  }
  function openDeliveryForm(customer?: CustomerRecord) {
    setActionError("");
    setDeliveryDraft({
      customer: customer?.name ?? "",
      phone: customer?.phone ?? "",
      area: customer?.address || "",
      address: customer?.address || "",
      time: "",
      truck: "1ฒก 4582",
      driver: "คุณวิชัย ชำนาญทาง",
      driverPhone: "089-123-4567",
      items: 1,
      amount: 0,
      note: "",
      status: "รอจัดคิว",
    });
    setShowDeliveryForm(true);
  }
  function saveDelivery(event: React.FormEvent) {
    event.preventDefault();
    const customer = deliveryDraft.customer.trim();
    const address = deliveryDraft.address.trim();
    if (!customer || !address || !deliveryDraft.time.trim()) {
      setActionError("กรุณากรอกลูกค้า ที่อยู่ และช่วงเวลาจัดส่ง");
      return;
    }
    const nextId = Math.max(0, ...deliveryRecords.map((delivery) => delivery.id)) + 1;
    const nextNo = `DLV-${String(60 + nextId).padStart(4, "0")}`;
    const payload: DeliveryRecord = {
      id: nextId,
      no: nextNo,
      ...deliveryDraft,
      customer,
      address,
      area: deliveryDraft.area.trim() || address,
      phone: deliveryDraft.phone.trim(),
      time: deliveryDraft.time.trim(),
      items: Math.max(1, Math.floor(Number(deliveryDraft.items) || 1)),
      amount: Math.max(0, Number(deliveryDraft.amount) || 0),
      note: deliveryDraft.note.trim(),
    };
    setDeliveryRecords((items) => [payload, ...items]);
    setShowDeliveryForm(false);
    setSelectedDelivery(payload);
    setActionError("");
    addAudit("สร้างงานจัดส่ง", `${payload.no} · ${payload.customer} · ${payload.area}`, "จัดส่ง", "success");
  }
  function updateDeliveryStatus(delivery: DeliveryRecord, status: DeliveryStatus) {
    setDeliveryRecords((items) => items.map((item) => item.id === delivery.id ? { ...item, status } : item));
    setSelectedDelivery((current) => current?.id === delivery.id ? { ...current, status } : current);
    addAudit("เปลี่ยนสถานะจัดส่ง", `${delivery.no}: ${delivery.status} → ${status}`, "จัดส่ง", status === "ยกเลิก" ? "warning" : "info");
  }
  function removeDelivery(delivery: DeliveryRecord) {
    if (!window.confirm(`ยืนยันการลบงานจัดส่ง ${delivery.no}?`)) return;
    setDeliveryRecords((items) => items.filter((item) => item.id !== delivery.id));
    setSelectedDelivery((current) => current?.id === delivery.id ? null : current);
    addAudit("ลบงานจัดส่ง", `${delivery.no} · ${delivery.customer}`, "จัดส่ง", "danger");
  }

  const navItems = ([
    { key: "pos", label: "ขายสินค้า", icon: <ShoppingCart />, show: true },
    { key: "products", label: "สินค้า", icon: <Boxes />, show: true },
    { key: "sales", label: "รายการขาย", icon: <ClipboardList />, show: canAccess(currentUser.role,"sales") },
    { key: "delivery", label: "จัดส่ง", icon: <Truck />, show: canAccess(currentUser.role,"delivery") },
    { key: "customers", label: "ลูกค้า", icon: <CircleUserRound />, show: true },
    { key: "receivables", label: "ลูกหนี้", icon: <CreditCard />, show: canAccess(currentUser.role,"sales") },
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
            <div className="notification-wrap">
              <button className={`notification ${showNotifications ? "active" : ""}`} aria-label="การแจ้งเตือน" aria-expanded={showNotifications} onClick={()=>setShowNotifications((open)=>!open)}><Bell size={18} />{notificationCount > 0 && <i>{notificationCount}</i>}</button>
              {showNotifications && <div className="notification-panel">
                <div className="notification-head"><div><strong>การแจ้งเตือน</strong><small>{notificationCount} รายการที่ต้องติดตาม</small></div><button onClick={()=>setShowNotifications(false)} aria-label="ปิดแจ้งเตือน"><X size={14}/></button></div>
                <section><h3><Bell size={14}/> สินค้าใกล้หมด</h3>{urgentStockNotifications.map((product)=><button key={product.id} onClick={()=>{setInventorySearch(product.sku);setActivePage("products");setShowNotifications(false)}}><span className={product.stock<=0?"danger":"warning"}>{product.stock<=0?"หมด":"ใกล้หมด"}</span><div><strong>{product.name}</strong><small>{product.sku} · เหลือ {product.stock.toLocaleString("th-TH")} {product.unit}</small></div></button>)}{urgentStockNotifications.length===0&&<p>สต็อกยังอยู่ในเกณฑ์ปกติ</p>}</section>
                <section><h3><Truck size={14}/> งานที่ต้องจัดส่ง</h3>{deliveryNotifications.map((delivery)=><button key={delivery.id} onClick={()=>{setDeliveryStatusFilter(delivery.status);setActivePage("delivery");setShowNotifications(false)}}><span className="blue">{delivery.status}</span><div><strong>{delivery.no} · {delivery.customer}</strong><small>{delivery.area} · {delivery.time} · {delivery.items} รายการ</small></div></button>)}{deliveryNotifications.length===0&&<p>ไม่มีงานจัดส่งค้างอยู่</p>}</section>
                <div className="notification-actions"><button onClick={()=>{setActivePage("products");setShowNotifications(false)}}>ดูสินค้าใกล้หมด</button><button onClick={()=>{setActivePage("delivery");setShowNotifications(false)}}>ดูงานจัดส่ง</button></div>
              </div>}
            </div>
            <div className="user-menu-wrap">
              <button className={`cashier ${showUserMenu ? "active" : ""}`} aria-label="เมนูผู้ใช้งาน" aria-expanded={showUserMenu} onClick={()=>{setShowUserMenu((open)=>!open);setShowNotifications(false)}}><CircleUserRound /><span><strong>{currentUser.displayName}</strong><small>{roleLabels[currentUser.role]}</small></span><ChevronDown size={16} /></button>
              {showUserMenu && <div className="user-dropdown">
                <button onClick={()=>{setShowProfile(true);setShowUserMenu(false)}}><CircleUserRound size={16}/><span><strong>ข้อมูลส่วนตัว</strong><small>ดูบัญชีและสิทธิ์การใช้งาน</small></span></button>
                <form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={16}/><span><strong>ออกจากระบบ</strong><small>ออกจากระบบ POS</small></span></button></form>
              </div>}
            </div>
          </div>
        </header>

        {activePage === "pos" && <div className="content-grid">
          <section className="catalog">
            <div className="search-row"><label className="search-box"><Search size={20} /><input ref={queryInputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const exact = inventoryProducts.find((product) => product.sku.toLowerCase() === query.trim().toLowerCase()); if (exact) { addToCart(exact); setQuery(""); } else if (query.trim()) setActionError("ไม่พบรหัสสินค้าที่สแกน"); } }} placeholder="ค้นหาชื่อสินค้า หรือสแกนบาร์โค้ด..." /><kbd>F2</kbd></label><button className="stock-button" onClick={() => setActivePage("products")}><PackageSearch size={19} /> เช็กสต็อก</button></div>
            <div className="category-row" aria-label="หมวดหมู่สินค้า">{categoryNames.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
            <div className="section-heading"><div><h2>{category === "ทั้งหมด" ? "สินค้าขายดี" : category}</h2><p>เลือกสินค้าเพื่อเพิ่มลงในรายการขาย</p></div><span>{filtered.length} รายการ</span></div>
            {actionError && checkoutState !== "error" && <div className="catalog-error">{actionError}</div>}
            <div className="product-grid">{filtered.map((product) => <button className="product-card" key={product.id} disabled={product.stock <= 0} onClick={() => addToCart(product)}><div className="art-wrap" style={{ background: product.color }}><ProductArt icon={product.icon} /><span className={product.stock <= settings.lowStockThreshold ? "stock low" : "stock"}>{product.stock <= 0 ? "หมดสต็อก" : `เหลือ ${product.stock}`}</span></div><div className="product-info"><small>{product.sku}</small><h3>{product.name}</h3><div><strong>฿{product.price.toLocaleString("th-TH")}</strong><span>/ {product.unit}</span><i><Plus size={16} /></i></div></div></button>)}{filtered.length === 0 && <div className="empty-products"><PackageSearch size={38} /><p>ไม่พบสินค้าที่ค้นหา</p></div>}</div>
          </section>
          <aside className="order-panel">
            <div className="order-header"><div><span className="order-icon"><ReceiptText size={19} /></span><div><small>รายการขาย</small><h2>บิลใหม่ · {cart.reduce((sum, item) => sum + item.qty, 0)} ชิ้น</h2></div></div><button onClick={() => { setCart([]); setDiscount(0); setActionError(""); }} aria-label="ล้างรายการ"><Trash2 size={17} /></button></div>
            <button className="customer-row" onClick={() => { setActionError(""); setPosCustomerSearch(customerName === "ลูกค้าทั่วไป" ? "" : customerName); setShowCustomerPicker(true); }}><span><CircleUserRound size={20} /> {customerName}</span><Search size={17} /></button>
            <div className="cart-list">{cart.map((item) => <article className="cart-item" key={item.id}><div className="cart-thumb" style={{ background: item.color }}><Hammer size={20} /></div><div className="cart-detail"><h3>{item.name}</h3><small>{item.sku} · ฿{item.price.toLocaleString("th-TH")}/{item.unit}</small><div className="qty-control"><button onClick={() => changeQty(item.id, -1)}><Minus size={14} /></button><span>{item.qty}</span><button onClick={() => changeQty(item.id, 1)}><Plus size={14} /></button></div></div><strong>฿{(item.price * item.qty).toLocaleString("th-TH")}</strong></article>)}{cart.length === 0 && <div className="empty-cart"><ShoppingCart size={34} /><p>ยังไม่มีสินค้าในรายการ</p><small>เลือกสินค้าจากด้านซ้ายเพื่อเริ่มขาย</small></div>}</div>
            <div className="summary"><div><span>ยอดรวม ({cart.reduce((s, i) => s + i.qty, 0)} ชิ้น)</span><strong>฿{subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div><div><span>ส่วนลด {settings.allowDiscount && <button onClick={editDiscount}>แก้ไข</button>}</span><strong className="discount">-฿{effectiveDiscount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div><div><span>ภาษีมูลค่าเพิ่ม {settings.vatRate}% {settings.pricesIncludeVat ? "(รวมในราคา)" : ""}</span><strong>฿{vat.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>{settings.roundingMode === "whole" && <div><span>ปัดเศษ</span><strong>฿{(total - unroundedTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div>}<div className="grand-total"><span>ยอดชำระ</span><strong>฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></div></div>
            <div className="payment-types"><button className={paymentMethod === "cash" ? "active" : ""} onClick={() => choosePayment("cash")}><WalletCards size={18} /> เงินสด</button><button className={paymentMethod === "qr" ? "active" : ""} onClick={() => choosePayment("qr")}><ReceiptText size={18} /> QR</button><button className={paymentMethod === "card" ? "active" : ""} onClick={() => choosePayment("card")}><CreditCard size={18} /> เครดิต</button></div>{checkoutState === "error" && <div className="checkout-error">{actionError}</div>}<button className="checkout" disabled={!cart.length || checkoutState === "saving"} onClick={beginCheckout}><span>{settings.taxInvoiceEnabled ? `${settings.taxInvoicePrefix || "TAX"} / ชำระเงิน` : "ชำระเงิน"}</span><strong>฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong></button><div className="shortcut"><span><kbd>F2</kbd> ค้นหาสินค้า</span><span><kbd>F10</kbd> ชำระเงิน</span></div>
          </aside>
        </div>}

        {activePage === "products" && <div className="page-content">
          <div className="page-actions"><div><p>{canManageProducts?"จัดการสินค้า ราคา คงเหลือ และสถานะคลัง":"ดูรายการสินค้า ราคา และจำนวนคงเหลือ"}</p></div>{canManageProducts&&<><button className="outline-action"><FileText size={17} /> นำเข้า Excel</button><button className="primary-action" onClick={()=>openProductForm()}><PackagePlus size={17} /> เพิ่มสินค้าใหม่</button></>}</div>
          <div className="metrics"><Metric label="สินค้าทั้งหมด" value={`${inventoryProducts.length} รายการ`} note="ใช้งานอยู่ทั้งหมด" icon={<Boxes />} /><Metric label="มูลค่าสต็อก" value={`฿${totalInventoryValue.toLocaleString("th-TH")}`} note="ราคาขายโดยประมาณ" icon={<WalletCards />} tone="blue" /><Metric label="สต็อกใกล้หมด" value={`${lowStock} รายการ`} note={`ต่ำกว่าหรือเท่ากับ ${settings.lowStockThreshold}`} icon={<Bell />} tone="orange" /><Metric label="สินค้าหมด" value={`${outOfStock} รายการ`} note="ต้องเติมก่อนขาย" icon={<PackageCheck />} tone={outOfStock ? "orange" : "green"} /></div>
          <div className="inventory-workbench">
            <section className="inventory-card urgent">
              <div className="inventory-card-title"><span><Bell size={18}/></span><div><h2>รายการต้องเติมสต็อก</h2><p>เรียงจากจำนวนคงเหลือน้อยที่สุด</p></div></div>
              <div className="inventory-alert-list">{lowStockProducts.map((product)=><article key={product.id}><div><strong>{product.name}</strong><small>{product.sku} · {product.category}</small></div><span className={product.stock <= 0 ? "danger" : ""}>{product.stock} {product.unit}</span>{canManageProducts&&<button className="table-action" onClick={()=>openProductForm(product)}>เติมสต็อก</button>}</article>)}{lowStockProducts.length===0&&<p>สต็อกทุกตัวอยู่ในเกณฑ์ปกติ</p>}</div>
            </section>
            <section className="inventory-card">
              <div className="inventory-card-title"><span><SlidersHorizontal size={18}/></span><div><h2>มูลค่าตามหมวดสินค้า</h2><p>ใช้ดูน้ำหนักสต็อกในคลัง</p></div></div>
              <div className="category-stock-list">{categorySummary.map((item)=><button key={item.id} onClick={()=>setInventoryCategory(item.name)}><div><strong>{item.name}</strong><small>{item.stock.toLocaleString("th-TH")} ชิ้น/หน่วยรวม</small></div><span>฿{item.value.toLocaleString("th-TH")}</span></button>)}{categorySummary.length===0&&<p>ยังไม่มีข้อมูลหมวดสินค้า</p>}</div>
            </section>
          </div>
          <section className="data-panel"><div className="panel-toolbar"><label className="table-search"><Search size={17} /><input value={inventorySearch} onChange={e=>setInventorySearch(e.target.value)} placeholder="ค้นหาสินค้า SKU หรือหมวดหมู่" /></label><label className="table-select"><SlidersHorizontal size={16}/><select value={inventoryCategory} onChange={e=>setInventoryCategory(e.target.value)}>{categoryNames.map(item=><option key={item} value={item}>{item}</option>)}</select></label><div className="segmented inventory-status-filter"><button className={inventoryStatus==="all"?"active":""} onClick={()=>setInventoryStatus("all")}>ทั้งหมด</button><button className={inventoryStatus==="ready"?"active":""} onClick={()=>setInventoryStatus("ready")}>พร้อมขาย</button><button className={inventoryStatus==="low"?"active":""} onClick={()=>setInventoryStatus("low")}>ใกล้หมด</button><button className={inventoryStatus==="out"?"active":""} onClick={()=>setInventoryStatus("out")}>หมด</button></div></div>{actionError&&<div className="table-error">{actionError}</div>}<div className="table-scroll"><table><thead><tr><th>สินค้า</th><th>หมวดหมู่</th><th>ราคาขาย</th><th>มูลค่าคงเหลือ</th><th>คงเหลือ</th><th>สถานะ</th>{canManageProducts&&<th>จัดการ</th>}</tr></thead><tbody>{visibleInventoryProducts.map(p=><tr key={p.id}><td><div className="product-cell"><span style={{background:p.color}}><Hammer size={18}/></span><div><strong>{p.name}</strong><small>{p.sku} · ต่อ{p.unit}</small></div></div></td><td>{p.category}</td><td><strong>฿{p.price.toLocaleString("th-TH")}</strong></td><td><strong>฿{(p.price*p.stock).toLocaleString("th-TH")}</strong></td><td><div className="stock-adjust">{canManageProducts&&<button onClick={()=>adjustProductStock(p,-1)} aria-label="ลดสต็อก"><Minus size={13}/></button>}<strong>{p.stock.toLocaleString("th-TH")}</strong><span>{p.unit}</span>{canManageProducts&&<button onClick={()=>adjustProductStock(p,1)} aria-label="เพิ่มสต็อก"><Plus size={13}/></button>}</div></td><td><span className={`status-chip ${p.stock <= 0 ? "danger" : p.stock <= settings.lowStockThreshold ? "warning":"success"}`}>{p.stock <= 0 ? "หมดสต็อก" : p.stock <= settings.lowStockThreshold ? "ใกล้หมด":"พร้อมขาย"}</span></td>{canManageProducts&&<td><div className="row-actions"><button className="icon-button" aria-label="แก้ไข" onClick={()=>openProductForm(p)}><Pencil size={15}/></button><button className="icon-button danger-button" aria-label="ลบ" onClick={()=>removeProduct(p.id)}><Trash2 size={15}/></button></div></td>}</tr>)}</tbody></table></div>{visibleInventoryProducts.length===0&&<div className="empty-table">ไม่พบสินค้าที่ตรงกับการค้นหา</div>}</section>
        </div>}

        {activePage === "sales" && <div className="page-content">
          <div className="page-actions"><div><p>ตรวจสอบรายการขายและการชำระเงินทั้งหมด</p></div><button className="outline-action"><Printer size={17}/> พิมพ์รายงาน</button><button className="primary-action" onClick={()=>setActivePage("pos")}><Plus size={17}/> เปิดบิลใหม่</button></div>
          <div className="metrics"><Metric label="ยอดขายที่แสดง" value={formatMoney(visibleSalesTotal)} note={`${completedVisibleSales.length} บิลที่ชำระสำเร็จ`} icon={<WalletCards/>}/><Metric label="ยอดก่อนกรอง" value={formatMoney(salesSummary.totalSales)} note={`${salesSummary.billCount} บิลในช่วงเวลา`} icon={<ReceiptText/>} tone="blue"/><Metric label="VAT / ส่วนลด" value={`${formatMoney(visibleSalesVat)} / ${formatMoney(visibleSalesDiscount)}`} note="รวมจากรายการที่แสดง" icon={<FileText/>} tone="orange"/><Metric label="รายการสินค้า" value={`${visibleSaleRecords.reduce((sum, sale) => sum + sale.itemCount, 0)} ชิ้น`} note="รวมสินค้าที่ขายในตาราง" icon={<Boxes/>} tone="green"/></div>
          <div className="sales-workbench">
            <section className="sales-card">
              <div className="sales-card-title"><span><WalletCards size={18}/></span><div><h2>แยกตามวิธีชำระ</h2><p>ยอดเฉพาะบิลสำเร็จที่ผ่านตัวกรอง</p></div></div>
              <div className="payment-summary-list">{paymentSummary.map((item)=><button key={item.method} className={salesPaymentFilter === item.method ? "active" : ""} onClick={()=>setSalesPaymentFilter(item.method)}><div><strong>{item.label}</strong><small>{item.count} บิล</small></div><span>{formatMoney(item.total)}</span></button>)}</div>
            </section>
            <section className="sales-card">
              <div className="sales-card-title"><span><ReceiptText size={18}/></span><div><h2>ภาพรวมบิล</h2><p>ตรวจบิลล่าสุดและบิลมูลค่าสูง</p></div></div>
              <div className="sales-highlight-list"><article><small>บิลล่าสุด</small>{latestSale?<><button className="sale-link" onClick={()=>viewSale(latestSale.id)}>{latestSale.receiptNo}</button><strong>{formatMoney(latestSale.total)}</strong></>:<span>ยังไม่มีข้อมูล</span>}</article><article><small>บิลสูงสุด</small>{largestSale?<><button className="sale-link" onClick={()=>viewSale(largestSale.id)}>{largestSale.receiptNo}</button><strong>{formatMoney(largestSale.total)}</strong></>:<span>ยังไม่มีข้อมูล</span>}</article></div>
            </section>
          </div>
          <section className="data-panel"><div className="panel-toolbar sales-toolbar"><div className="segmented"><button className={salesPeriod==="today"?"active":""} onClick={()=>setSalesPeriod("today")}>วันนี้</button><button className={salesPeriod==="7days"?"active":""} onClick={()=>setSalesPeriod("7days")}>7 วัน</button><button className={salesPeriod==="month"?"active":""} onClick={()=>setSalesPeriod("month")}>เดือนนี้</button></div><div className="segmented"><button className={salesStatusFilter==="all"?"active":""} onClick={()=>setSalesStatusFilter("all")}>ทุกสถานะ</button><button className={salesStatusFilter==="completed"?"active":""} onClick={()=>setSalesStatusFilter("completed")}>สำเร็จ</button><button className={salesStatusFilter==="refunded"?"active":""} onClick={()=>setSalesStatusFilter("refunded")}>คืนเงิน</button><button className={salesStatusFilter==="voided"?"active":""} onClick={()=>setSalesStatusFilter("voided")}>ยกเลิก</button></div><label className="table-select"><WalletCards size={16}/><select value={salesPaymentFilter} onChange={event=>setSalesPaymentFilter(event.target.value as typeof salesPaymentFilter)}><option value="all">ทุกวิธีชำระ</option><option value="cash">เงินสด</option><option value="qr">QR / โอน</option><option value="card">เครดิต</option></select></label><label className="table-search compact"><Search size={17}/><input value={salesQuery} onChange={event=>setSalesQuery(event.target.value)} placeholder="ค้นหาเลขที่บิลหรือลูกค้า"/></label></div>{actionError&&<div className="table-error">{actionError}</div>}<div className="table-scroll"><table><thead><tr><th>เลขที่บิล</th><th>ใบกำกับภาษี</th><th>วันเวลา</th><th>ลูกค้า</th><th>พนักงาน</th><th>สินค้า</th><th>ชำระโดย</th><th>ยอดก่อน VAT</th><th>VAT</th><th>ยอดสุทธิ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{visibleSaleRecords.map(sale=><tr key={sale.id}><td><button className="sale-link" onClick={()=>viewSale(sale.id)}>{sale.receiptNo}</button></td><td>{sale.taxInvoiceNo || "-"}</td><td>{new Date(sale.createdAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}</td><td>{sale.customerName}</td><td>{sale.cashierName || "-"}</td><td>{sale.itemCount} ชิ้น</td><td>{sale.paymentLabel}</td><td>{formatMoney(sale.subtotal - sale.discount)}</td><td>{formatMoney(sale.vat)}</td><td><strong>{formatMoney(sale.total)}</strong></td><td><span className={`status-chip ${sale.status==="completed"?"success":sale.status==="refunded"?"warning":"danger"}`}>{sale.status==="completed"?"สำเร็จ":sale.status==="refunded"?"คืนเงิน":"ยกเลิก"}</span></td><td><button className="table-action" onClick={()=>viewSale(sale.id)}>ดูใบเสร็จ</button></td></tr>)}</tbody></table></div>{salesLoading&&<div className="empty-table">กำลังโหลดรายการขาย...</div>}{!salesLoading&&saleRecords.length===0&&<div className="empty-table">ยังไม่มีรายการขายในช่วงเวลานี้</div>}{!salesLoading&&saleRecords.length>0&&visibleSaleRecords.length===0&&<div className="empty-table">ไม่พบรายการขายตามตัวกรองนี้</div>}</section>
        </div>}

        {activePage === "delivery" && <div className="page-content">
          <div className="page-actions"><div><p>วางแผนคิวรถ สร้างงานจัดส่ง และติดตามสถานะปลายทาง</p></div><button className="outline-action"><MapPin size={17}/> ดูแผนที่</button><button className="primary-action" onClick={()=>openDeliveryForm()}><Plus size={17}/> สร้างงานจัดส่ง</button></div>
          <div className="metrics"><Metric label="งานทั้งหมด" value={`${deliveryRecords.length} งาน`} note={`${completedDeliveries.length} งานส่งสำเร็จ`} icon={<Truck/>}/><Metric label="กำลังจัดส่ง" value={`${deliveryRecords.filter(d=>d.status==="กำลังจัดส่ง").length} งาน`} note={`${deliveryDrivers.length} คนขับในระบบ`} icon={<MapPin/>} tone="blue"/><Metric label="รอ/เตรียมสินค้า" value={`${deliveryRecords.filter(d=>d.status==="รอจัดคิว"||d.status==="เตรียมสินค้า").length} งาน`} note="ต้องจัดรอบและตรวจสินค้า" icon={<ClipboardList/>} tone="orange"/><Metric label="มูลค่าส่งวันนี้" value={formatMoney(deliveryRecords.reduce((sum,d)=>sum+d.amount,0))} note={`${activeDeliveries.length} งานยังเปิดอยู่`} icon={<PackageCheck/>} tone="green"/></div>
          <div className="delivery-layout">
            <section className="data-panel delivery-list">
              <div className="panel-toolbar delivery-toolbar"><label className="table-search"><Search size={17}/><input value={deliverySearch} onChange={event=>setDeliverySearch(event.target.value)} placeholder="ค้นหาเลขงาน ลูกค้า พื้นที่ คนขับ หรือทะเบียนรถ"/></label><div className="segmented delivery-status-filter">{(["ทั้งหมด","รอจัดคิว","เตรียมสินค้า","กำลังจัดส่ง","ส่งสำเร็จ"] as const).map(status=><button key={status} className={deliveryStatusFilter===status?"active":""} onClick={()=>setDeliveryStatusFilter(status)}>{status}</button>)}</div></div>
              {actionError&&<div className="table-error">{actionError}</div>}
              <div className="delivery-card-list">{visibleDeliveries.map((delivery,index)=><article className="delivery-card" key={delivery.id}><span className={`route-dot ${deliveryTone(delivery.status)}`}>{index+1}</span><div className="delivery-main"><div><strong>{delivery.no} · {delivery.customer}</strong><span className={`status-chip ${deliveryTone(delivery.status)}`}>{delivery.status}</span></div><p><MapPin size={14}/> {delivery.area} <span>•</span> {delivery.time}</p><small><Truck size={13}/> {delivery.truck} · {delivery.driver} · {delivery.items} รายการ · {formatMoney(delivery.amount)}</small></div><div className="row-actions"><button className="table-action" onClick={()=>setSelectedDelivery(delivery)}>รายละเอียด</button><button className="icon-button danger-button" aria-label="ลบงานจัดส่ง" onClick={()=>removeDelivery(delivery)}><Trash2 size={15}/></button></div></article>)}{visibleDeliveries.length===0&&<div className="empty-table">ไม่พบงานจัดส่งตามเงื่อนไขนี้</div>}</div>
            </section>
            <aside className="route-panel">
              <div className="map-mock"><MapPin size={32}/><strong>แผนที่เส้นทาง</strong><small>{activeDeliveries.length} จุดส่งที่ยังเปิดอยู่ · 42.8 กม.</small><div className="route-line"><i/><i/><i/></div></div>
              <div className="driver-card"><CircleUserRound size={38}/><div><strong>{selectedDeliveryDriver?.driver || "ยังไม่มีคนขับ"}</strong><small>{selectedDeliveryDriver?.truck || "ไม่มีรถที่กำลังใช้งาน"}</small><span><Phone size={12}/> {selectedDeliveryDriver?.driverPhone || "-"}</span></div></div>
              <section className="delivery-status-board">{(["รอจัดคิว","เตรียมสินค้า","กำลังจัดส่ง","ส่งสำเร็จ"] as const).map(status=><button key={status} onClick={()=>setDeliveryStatusFilter(status)}><span className={`route-dot ${deliveryTone(status)}`}>{deliveryRecords.filter(d=>d.status===status).length}</span><strong>{status}</strong></button>)}</section>
            </aside>
          </div>
        </div>}

        {activePage === "customers" && <div className="page-content">
          <div className="page-actions"><div><p>จัดการข้อมูลลูกค้า ประวัติการซื้อ ช่องทางติดต่อ และข้อมูลภาษี</p></div><button className="outline-action"><FileText size={17}/> ส่งออก Excel</button><button className="primary-action" onClick={()=>openCustomerForm()}><Plus size={17}/> เพิ่มลูกค้า</button></div>
          <div className="metrics"><Metric label="ลูกค้าทั้งหมด" value={`${customerRecords.length} ราย`} note={`${activeCustomers} รายกำลังใช้งาน`} icon={<CircleUserRound/>}/><Metric label="ลูกค้าประจำ" value={`${customerRecords.filter(c=>c.type==="ลูกค้าประจำ").length} ราย`} note="ซื้อซ้ำต่อเนื่อง" icon={<Check/>} tone="green"/><Metric label="ยอดซื้อรวม" value={formatMoney(totalCustomerSales)} note="จากข้อมูลลูกค้าในระบบ" icon={<WalletCards/>} tone="blue"/><Metric label="เครดิตคงเหลือ" value={formatMoney(Math.max(0,totalCreditLimit-totalCreditUsed))} note={`ใช้ไป ${formatMoney(totalCreditUsed)}`} icon={<CreditCard/>} tone="orange"/></div>
          <div className="customer-workbench">
            <section className="customer-profile-card">
              <div className="customer-profile-head"><span><CircleUserRound size={24}/></span><div><small>ลูกค้ามูลค่าสูงสุด</small><h2>{topCustomer?.name || "ยังไม่มีข้อมูล"}</h2><p>{topCustomer ? `${topCustomer.type} · ${topCustomer.orders} บิล` : "-"}</p></div></div>
              {topCustomer && <div className="customer-profile-body"><div><span>ยอดซื้อรวม</span><strong>{formatMoney(topCustomer.total)}</strong></div><div><span>ผู้ติดต่อ</span><strong>{topCustomer.contact || "-"}</strong></div><div><span>เครดิตคงเหลือ</span><strong>{formatMoney(Math.max(0, topCustomer.creditLimit - topCustomer.creditUsed))}</strong></div><div><span>เทอมเครดิต</span><strong>{topCustomer.creditTerm || 0} วัน</strong></div></div>}
            </section>
            <section className="customer-card">
              <div className="sales-card-title"><span><SlidersHorizontal size={18}/></span><div><h2>กลุ่มลูกค้า</h2><p>กดเพื่อกรองรายการในตาราง</p></div></div>
              <div className="customer-type-list">{(["ทั้งหมด","ลูกค้าทั่วไป","ลูกค้าประจำ","ผู้รับเหมา","นิติบุคคล"] as const).map((type)=><button key={type} className={customerTypeFilter===type?"active":""} onClick={()=>setCustomerTypeFilter(type)}><strong>{type}</strong><span>{type==="ทั้งหมด"?customerRecords.length:customerRecords.filter(c=>c.type===type).length} ราย</span></button>)}</div>
            </section>
          </div>
          <section className="data-panel"><div className="panel-toolbar"><label className="table-search"><Search size={17}/><input value={customerSearch} onChange={event=>setCustomerSearch(event.target.value)} placeholder="ค้นหาชื่อลูกค้า เบอร์โทร ผู้ติดต่อ หรือเลขภาษี"/></label><label className="table-select"><SlidersHorizontal size={16}/><select value={customerTypeFilter} onChange={event=>setCustomerTypeFilter(event.target.value as typeof customerTypeFilter)}><option value="ทั้งหมด">ทุกกลุ่มลูกค้า</option><option value="ลูกค้าทั่วไป">ลูกค้าทั่วไป</option><option value="ลูกค้าประจำ">ลูกค้าประจำ</option><option value="ผู้รับเหมา">ผู้รับเหมา</option><option value="นิติบุคคล">นิติบุคคล</option></select></label></div>{actionError&&<div className="table-error">{actionError}</div>}<div className="table-scroll"><table><thead><tr><th>ลูกค้า</th><th>ผู้ติดต่อ</th><th>เบอร์โทร</th><th>ประเภท</th><th>จำนวนบิล</th><th>ยอดซื้อรวม</th><th>วงเงิน</th><th>ใช้เครดิต</th><th>คงเหลือ</th><th>เทอม</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{visibleCustomers.map(customer=>{ const creditRemain = Math.max(0, customer.creditLimit - customer.creditUsed); const creditPercent = customer.creditLimit ? Math.min(100, Math.round((customer.creditUsed / customer.creditLimit) * 100)) : 0; return <tr key={customer.id}><td><div className="user-cell"><CircleUserRound/><div><strong>{customer.name}</strong><small>{customer.address || customer.taxId || "-"}</small></div></div></td><td>{customer.contact || "-"}</td><td>{customer.phone}</td><td><span className="status-chip blue">{customer.type}</span></td><td>{customer.orders} บิล</td><td><strong>{formatMoney(customer.total)}</strong></td><td>{formatMoney(customer.creditLimit)}</td><td><div className="credit-meter"><strong>{formatMoney(customer.creditUsed)}</strong><span><i style={{width:`${creditPercent}%`}}/></span></div></td><td><strong>{formatMoney(creditRemain)}</strong></td><td>{customer.creditTerm || 0} วัน</td><td><span className={`status-chip ${customer.status==="active"?"success":customer.status==="watch"?"warning":"gray"}`}>{customer.status==="active"?"ใช้งาน":customer.status==="watch"?"ติดตาม":"ไม่ใช้งาน"}</span></td><td><div className="row-actions"><button className="table-action" onClick={()=>setSelectedCustomer(customer)}>ดูรายการ</button><button className="table-action" onClick={()=>{setCustomerName(customer.name);setActivePage("pos")}}>เปิดบิล</button><button className="icon-button" aria-label="แก้ไขลูกค้า" onClick={()=>openCustomerForm(customer)}><Pencil size={15}/></button><button className="icon-button danger-button" aria-label="ลบลูกค้า" onClick={()=>removeCustomer(customer)}><Trash2 size={15}/></button></div></td></tr>})}</tbody></table></div>{visibleCustomers.length===0&&<div className="empty-table">ไม่พบลูกค้าตามเงื่อนไขที่เลือก</div>}</section>
        </div>}

        {activePage === "receivables" && <div className="page-content">
          <div className="page-actions"><div><p>ติดตามลูกหนี้เครดิต รับชำระบางส่วนหรือปิดยอดเต็มจำนวน</p></div><button className="outline-action" onClick={()=>setActivePage("customers")}><CircleUserRound size={17}/> ดูข้อมูลลูกค้า</button><button className="primary-action" onClick={()=>{const debtor=debtorCustomers[0]; if(debtor) openCreditPayment(debtor)}} disabled={debtorCustomers.length===0}><WalletCards size={17}/> รับชำระด่วน</button></div>
          <div className="metrics"><Metric label="ยอดลูกหนี้รวม" value={formatMoney(totalReceivable)} note={`${debtorCustomers.length} รายมียอดค้าง`} icon={<CreditCard/>}/><Metric label="ครบกำหนด/มีเทอม" value={`${dueCustomers.length} ราย`} note="ต้องติดตามการวางบิล" icon={<Bell/>} tone="orange"/><Metric label="เกินวงเงิน" value={`${overLimitCustomers.length} ราย`} note={overLimitCustomers[0]?.name || "ไม่มีลูกค้าเกินวงเงิน"} icon={<SlidersHorizontal/>} tone={overLimitCustomers.length?"orange":"green"}/><Metric label="รับชำระล่าสุด" value={latestCreditPayments[0] ? formatMoney(latestCreditPayments[0].amount) : "฿0.00"} note={latestCreditPayments[0]?.customerName || "ยังไม่มีรายการ"} icon={<WalletCards/>} tone="green"/></div>
          <div className="receivable-layout">
            <section className="data-panel"><div className="panel-toolbar receivable-toolbar"><label className="table-search"><Search size={17}/><input value={receivableSearch} onChange={event=>setReceivableSearch(event.target.value)} placeholder="ค้นหาลูกหนี้ ชื่อ เบอร์โทร หรือเลขภาษี"/></label><div className="segmented"><button className={receivableFilter==="all"?"active":""} onClick={()=>setReceivableFilter("all")}>ทั้งหมด</button><button className={receivableFilter==="due"?"active":""} onClick={()=>setReceivableFilter("due")}>มีเทอมเครดิต</button><button className={receivableFilter==="overlimit"?"active":""} onClick={()=>setReceivableFilter("overlimit")}>เกินวงเงิน</button></div></div><div className="table-scroll"><table><thead><tr><th>ลูกหนี้</th><th>วงเงิน</th><th>ยอดค้าง</th><th>เครดิตคงเหลือ</th><th>เทอม</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{debtorCustomers.map(customer=>{ const remain=customer.creditLimit-customer.creditUsed; const over=customer.creditLimit>0&&customer.creditUsed>customer.creditLimit; return <tr key={customer.id}><td><div className="user-cell"><CircleUserRound/><div><strong>{customer.name}</strong><small>{customer.phone} · {customer.contact || customer.type}</small></div></div></td><td>{formatMoney(customer.creditLimit)}</td><td><strong>{formatMoney(customer.creditUsed)}</strong></td><td><strong className={remain<0?"debt-danger":""}>{formatMoney(Math.max(0,remain))}</strong></td><td>{customer.creditTerm || 0} วัน</td><td><span className={`status-chip ${over?"danger":customer.creditTerm?"warning":"success"}`}>{over?"เกินวงเงิน":customer.creditTerm?"รอติดตาม":"ปกติ"}</span></td><td><div className="row-actions"><button className="table-action" onClick={()=>openCreditPayment(customer)}>รับชำระ</button><button className="table-action" onClick={()=>setSelectedCustomer(customer)}>ดูรายการ</button></div></td></tr>})}</tbody></table></div>{debtorCustomers.length===0&&<div className="empty-table">ไม่พบลูกหนี้ตามเงื่อนไขนี้</div>}</section>
            <aside className="receivable-side"><section className="sales-card"><div className="sales-card-title"><span><WalletCards size={18}/></span><div><h2>ประวัติรับชำระล่าสุด</h2><p>เงินสด / โอน / เช็ค</p></div></div><div className="credit-payment-list">{latestCreditPayments.map(payment=><button key={payment.id} onClick={()=>setSelectedCustomer(customerRecords.find(c=>c.id===payment.customerId) || null)}><div><strong>{payment.customerName}</strong><small>{payment.reference} · {payment.method==="cash"?"เงินสด":payment.method==="transfer"?"โอนเงิน":"เช็ค"}</small></div><span>{formatMoney(payment.amount)}</span></button>)}{latestCreditPayments.length===0&&<p>ยังไม่มีประวัติรับชำระ</p>}</div></section></aside>
          </div>
        </div>}

        {activePage === "reports" && <div className="page-content">
          <div className="page-actions"><div><p>รายงานภาพรวม {reportPeriodLabel} จากรายการขาย สต็อก และลูกค้าในระบบ</p></div><div className="segmented"><button className={reportPeriod==="today"?"active":""} onClick={()=>setReportPeriod("today")}>วันนี้</button><button className={reportPeriod==="7days"?"active":""} onClick={()=>setReportPeriod("7days")}>7 วัน</button><button className={reportPeriod==="month"?"active":""} onClick={()=>setReportPeriod("month")}>เดือนนี้</button></div><button className="outline-action"><FileText size={17}/> ส่งออก PDF</button><button className="primary-action"><Printer size={17}/> พิมพ์รายงาน</button></div>
          <div className="metrics"><Metric label="ยอดขายสุทธิ" value={formatMoney(reportRevenue)} note={`${reportCompletedSales.length} บิลสำเร็จ · เฉลี่ย ${formatMoney(reportAverageBill)}`} icon={<BarChart3/>}/><Metric label="VAT / ส่วนลด" value={`${formatMoney(reportVat)} / ${formatMoney(reportDiscount)}`} note={`ยอดตามช่วง ${reportPeriodLabel}`} icon={<FileText/>} tone="blue"/><Metric label="จำนวนสินค้าในบิล" value={`${reportItemCount.toLocaleString("th-TH")} ชิ้น`} note="รวมจากบิลขายที่สำเร็จ" icon={<ReceiptText/>} tone="orange"/><Metric label="มูลค่าสต็อก" value={formatMoney(totalInventoryValue)} note={`${lowStock} รายการใกล้หมด · ${outOfStock} รายการหมด`} icon={<Boxes/>} tone="green"/></div>
          <div className="report-grid"><section className="data-panel chart-panel"><div className="panel-title"><div><h2>ยอดขายรายวัน</h2><p>ยอดขายรวม {formatMoney(reportRevenue)}</p></div><div className="legend"><i/> ยอดขาย</div></div><div className="bar-chart">{reportDailyTotals.length ? reportDailyTotals.map(([label,total])=><div key={label}><span title={formatMoney(total)} style={{height:`${Math.max(6, Math.round((total/reportMaxDaily)*100))}%`}}/><small>{label}</small></div>) : <div className="report-empty-chart"><span style={{height:"6%"}}/><small>ไม่มีข้อมูล</small></div>}</div></section><section className="data-panel category-report"><div className="panel-title"><div><h2>มูลค่าสต็อกตามหมวด</h2><p>5 อันดับแรก</p></div></div>{reportTopCategories.map((item)=><div className="category-stat" key={item.id}><div><strong>{item.name}</strong><span>{formatMoney(item.value)}</span></div><div><i style={{width:`${Math.max(4,item.percent)}%`}}/></div><small>{item.percent}% · {item.stock.toLocaleString("th-TH")} หน่วย</small></div>)}{reportTopCategories.length===0&&<div className="empty-table">ยังไม่มีข้อมูลหมวดสินค้า</div>}</section></div>
          <div className="sales-workbench report-workbench"><section className="sales-card"><div className="sales-card-title"><span><WalletCards size={18}/></span><div><h2>แยกตามวิธีชำระ</h2><p>เงินสด QR/โอน และเครดิต</p></div></div><div className="payment-summary-list">{reportPaymentSummary.map((item)=><button key={item.method}><div><strong>{item.label}</strong><small>{item.count} บิล</small></div><span>{formatMoney(item.total)}</span></button>)}</div></section><section className="sales-card"><div className="sales-card-title"><span><PackageSearch size={18}/></span><div><h2>สินค้าใกล้หมด</h2><p>อ้างอิงจุดเตือนในตั้งค่าระบบ</p></div></div><div className="inventory-alert-list">{reportLowStock.map((product)=><article key={product.id}><div><strong>{product.name}</strong><small>{product.sku} · {product.category}</small></div><span className={product.stock<=0?"danger":""}>{product.stock.toLocaleString("th-TH")} {product.unit}</span><button className="table-action" onClick={()=>{setInventorySearch(product.sku);setActivePage("products")}}>ดูสต็อก</button></article>)}{reportLowStock.length===0&&<p>ไม่มีสินค้าใกล้หมด</p>}</div></section></div>
          <section className="data-panel"><div className="panel-title"><div><h2>รายการขายล่าสุดในรายงาน</h2><p>{salesLoading ? "กำลังโหลดข้อมูล..." : `${saleRecords.length} รายการในช่วง ${reportPeriodLabel}`}</p></div></div><div className="table-scroll"><table><thead><tr><th>เลขที่บิล</th><th>วันเวลา</th><th>ลูกค้า</th><th>ชำระโดย</th><th>สินค้า</th><th>VAT</th><th>ยอดสุทธิ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{saleRecords.slice(0,10).map((sale)=><tr key={sale.id}><td><button className="sale-link" onClick={()=>viewSale(sale.id)}>{sale.receiptNo}</button></td><td>{new Date(sale.createdAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}</td><td>{sale.customerName}</td><td>{sale.paymentLabel}</td><td>{sale.itemCount} ชิ้น</td><td>{formatMoney(sale.vat)}</td><td><strong>{formatMoney(sale.total)}</strong></td><td><span className={`status-chip ${sale.status==="completed"?"success":sale.status==="refunded"?"warning":"danger"}`}>{sale.status==="completed"?"สำเร็จ":sale.status==="refunded"?"คืนเงิน":"ยกเลิก"}</span></td><td><button className="table-action" onClick={()=>viewSale(sale.id)}>ดูใบเสร็จ</button></td></tr>)}</tbody></table></div>{!salesLoading&&saleRecords.length===0&&<div className="empty-table">ยังไม่มีรายการขายในช่วงเวลานี้</div>}</section>
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
            <button className={settingsSection === "audit" ? "active" : ""} onClick={() => setSettingsSection("audit")}><FileText size={17}/> สำรองข้อมูล / Audit Log</button>
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
                <label>วิธีชำระเงินเริ่มต้น<select value={settings.defaultPaymentMethod} onChange={e=>setSettings({...settings,defaultPaymentMethod:e.target.value as StoreSettings["defaultPaymentMethod"]})}><option value="cash">เงินสด</option><option value="qr">QR / โอนเงิน</option><option value="card">เครดิต</option></select><small>ใช้เป็นปุ่มที่ถูกเลือกไว้เมื่อเริ่มขาย</small></label>
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
            {settingsSection === "audit" && <section className="settings-card audit-settings-card">
              <div className="settings-card-title"><span><FileText/></span><div><h2>สำรองข้อมูล / Audit Log</h2><p>ติดตามการทำงานสำคัญของผู้ใช้ และดาวน์โหลดไฟล์สำรองข้อมูลระบบ</p></div></div>
              <div className="audit-summary-grid"><article><span>เหตุการณ์ทั้งหมด</span><strong>{auditLogs.length}</strong><small>เก็บล่าสุดสูงสุด 200 รายการ</small></article><article><span>วันนี้</span><strong>{auditTodayCount}</strong><small>รายการที่เกิดขึ้นวันนี้</small></article><article><span>ต้องตรวจสอบ</span><strong>{auditDangerCount}</strong><small>warning / danger</small></article><article><span>ข้อมูลสำรอง</span><strong>{inventoryProducts.length + customerRecords.length + deliveryRecords.length}</strong><small>สินค้า + ลูกค้า + จัดส่ง</small></article></div>
              <div className="backup-actions"><button className="primary-action" onClick={exportBackup}><Save size={16}/> ดาวน์โหลด Backup</button><button className="outline-action" onClick={exportAuditLogs}><FileText size={16}/> Export Audit Log</button><div><strong>ข้อมูลที่รวมใน backup</strong><small>ตั้งค่าร้าน, สินค้า, หมวดสินค้า, ลูกค้า, งานจัดส่ง, รายการขายที่โหลดอยู่ และ Audit Log</small></div></div>
              <div className="audit-log-list">{latestAuditLogs.map((log)=><article key={log.id} className={`audit-item ${log.severity}`}><span>{log.module}</span><div><strong>{log.action}</strong><small>{log.detail}</small></div><em>{log.actor} · {log.role}<br/>{new Date(log.createdAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}</em></article>)}{latestAuditLogs.length===0&&<p>ยังไม่มี Audit Log</p>}</div>
            </section>}
            {settingsSection === "users" && currentUser.role === "admin" && <section className="settings-card user-settings-card"><div className="settings-card-title"><span><UserCog/></span><div><h2>จัดการผู้ใช้งาน</h2><p>เพิ่มผู้ใช้ กำหนดบทบาท ตั้งรหัสผ่าน และระงับการเข้าใช้งาน</p></div><button className="primary-action user-add-button" onClick={()=>{setActionError("");setShowUserForm(true)}}><Plus size={16}/> เพิ่มผู้ใช้</button></div><div className="user-summary"><span><strong>{users.length}</strong> บัญชีทั้งหมด</span><span><strong>{users.filter(u=>u.isActive).length}</strong> กำลังใช้งาน</span><span><strong>{users.filter(u=>!u.isActive).length}</strong> ถูกระงับ</span></div><div className="table-scroll"><table><thead><tr><th>ผู้ใช้งาน</th><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td><div className="user-cell"><CircleUserRound/><strong>{user.displayName}</strong></div></td><td>@{user.username}</td><td><span className={`role-chip role-${user.role}`}>{roleLabels[user.role]}</span></td><td><span className={`status-chip ${user.isActive?"success":"danger"}`}>{user.isActive?"ใช้งาน":"ระงับ"}</span></td><td><div className="row-actions"><button className="table-action" onClick={()=>resetUserPassword(user)}>ตั้งรหัสผ่าน</button><button className="table-action" disabled={user.id===currentUser.id} onClick={()=>toggleUser(user)}>{user.isActive?"ระงับบัญชี":"เปิดใช้งาน"}</button></div></td></tr>)}</tbody></table></div></section>}
          </div></div>
        </div>}

        {showProfile && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowProfile(false)}>
          <section className="app-modal profile-modal" onMouseDown={(event)=>event.stopPropagation()}>
            <div className="modal-title"><div><h2>ข้อมูลส่วนตัว</h2><p>รายละเอียดบัญชีผู้ใช้งานและสิทธิ์ในระบบ POS</p></div><button type="button" onClick={()=>setShowProfile(false)}><X/></button></div>
            <div className="profile-card"><span><CircleUserRound size={42}/></span><div><small>ผู้ใช้งานปัจจุบัน</small><strong>{currentUser.displayName}</strong><em>@{currentUser.username}</em></div></div>
            <div className="profile-detail-grid"><article><span>รหัสผู้ใช้</span><strong>#{currentUser.id}</strong></article><article><span>บทบาท</span><strong>{roleLabels[currentUser.role]}</strong></article><article><span>สิทธิ์สินค้า</span><strong>{canAccess(currentUser.role,"manage_products") ? "จัดการได้" : "ดูได้"}</strong></article><article><span>สิทธิ์รายงาน</span><strong>{canAccess(currentUser.role,"reports") ? "ดูได้" : "ไม่มีสิทธิ์"}</strong></article></div>
            <div className="permission-note"><strong>สิทธิ์ของบัญชีนี้</strong><span>{currentUser.role==="admin"?"ใช้งานได้ทุกเมนู รวมถึงจัดการผู้ใช้งาน":currentUser.role==="manager"?"ใช้งานได้ทุกเมนู ยกเว้นจัดการผู้ใช้งาน":currentUser.role==="warehouse"?"จัดการคลัง เพิ่ม-ลบสินค้า และขายหน้าร้านได้":"ขายหน้าร้านและดูรายการสินค้าได้"}</span></div>
            <div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowProfile(false)}>ปิด</button><form action="/api/auth/logout" method="post"><button className="primary-action"><LogOut size={16}/> ออกจากระบบ</button></form></div>
          </section>
        </div>}

        {showPayment && <div className="modal-backdrop payment-backdrop" role="presentation" onMouseDown={() => checkoutState !== "saving" && setShowPayment(false)}>
          <form className="app-modal payment-modal" onSubmit={(event) => { event.preventDefault(); void checkout(); }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-title"><div><h2>รับชำระเงิน</h2><p>ตรวจสอบยอด เลือกวิธีชำระ และยืนยันการขาย</p></div><button type="button" disabled={checkoutState === "saving"} onClick={() => setShowPayment(false)}><X/></button></div>
            <div className="payment-total-card"><span>ยอดที่ต้องชำระ</span><strong>{formatMoney(total)}</strong><small>{cart.reduce((sum, item) => sum + item.qty, 0)} ชิ้น · ลูกค้า {customerName}</small></div>
            <div className="payment-method-grid" role="group" aria-label="วิธีชำระเงิน"><button type="button" className={paymentMethod === "cash" ? "active" : ""} onClick={() => choosePayment("cash")}><WalletCards/>เงินสด</button><button type="button" className={paymentMethod === "qr" ? "active" : ""} onClick={() => choosePayment("qr")}><ReceiptText/>QR / โอน</button><button type="button" className={paymentMethod === "card" ? "active" : ""} onClick={() => choosePayment("card")}><CreditCard/>เครดิต</button></div>
            {paymentMethod === "cash" ? <div className="cash-payment"><label>จำนวนเงินที่รับ<input autoFocus required type="number" inputMode="decimal" min={total} step="0.01" value={amountReceived} onChange={(event) => { setAmountReceived(event.target.value); setCheckoutState("idle"); setActionError(""); }}/></label><div className="cash-presets">{cashPresets.map((value) => <button type="button" key={value} onClick={() => setAmountReceived(value.toFixed(2))}>{value === total ? "รับพอดี" : formatMoney(value)}</button>)}</div><div className="change-card"><span>เงินทอน</span><strong>{formatMoney(changeDue)}</strong></div></div> : <div className="electronic-payment"><span className="payment-ready"><Check/></span><div><strong>{paymentMethod === "qr" ? "ยืนยันว่าได้รับยอดโอนแล้ว" : "ยืนยันการขายแบบเครดิต"}</strong><small>ยอดชำระ {formatMoney(total)} จะถูกบันทึกเต็มจำนวน</small></div></div>}
            {checkoutState === "error" && <div className="checkout-error">{actionError}</div>}
            <div className="modal-actions"><button type="button" className="outline-action" disabled={checkoutState === "saving"} onClick={() => setShowPayment(false)}>ย้อนกลับ</button><button className="primary-action payment-confirm" disabled={checkoutState === "saving" || (paymentMethod === "cash" && receivedValue < total)}><Check size={17}/>{checkoutState === "saving" ? "กำลังบันทึกการขาย..." : `ยืนยันรับชำระ ${formatMoney(total)}`}</button></div>
          </form>
        </div>}

        {showCustomerPicker && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowCustomerPicker(false)}><section className="app-modal customer-picker-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>เลือกลูกค้า</h2><p>ค้นหาจากชื่อลูกค้า เบอร์โทร ผู้ติดต่อ หรือเลขภาษี</p></div><button type="button" onClick={()=>setShowCustomerPicker(false)}><X/></button></div><label className="customer-picker-search"><Search size={18}/><input autoFocus value={posCustomerSearch} onChange={e=>setPosCustomerSearch(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" && posCustomerMatches[0]) { e.preventDefault(); choosePosCustomer(posCustomerMatches[0].name); } }} placeholder="พิมพ์ชื่อลูกค้า เช่น รุ่งเรือง, เอส.พี.โฮม, เบอร์โทร..." /></label><div className="customer-picker-list"><button className={customerName==="ลูกค้าทั่วไป"?"active":""} onClick={()=>choosePosCustomer("ลูกค้าทั่วไป")}><span><CircleUserRound size={20}/></span><div><strong>ลูกค้าทั่วไป</strong><small>ขายแบบไม่ผูกประวัติลูกค้า</small></div><i>เลือก</i></button>{posCustomerMatches.map(customer=>{ const creditRemain = Math.max(0, customer.creditLimit - customer.creditUsed); return <button key={customer.id} className={customerName===customer.name?"active":""} onClick={()=>choosePosCustomer(customer.name)}><span><CircleUserRound size={20}/></span><div><strong>{customer.name}</strong><small>{customer.phone} · {customer.contact || customer.type} · เครดิตคงเหลือ {formatMoney(creditRemain)}</small></div><i>เลือก</i></button>})}{posCustomerMatches.length===0&&<div className="empty-table">ไม่พบลูกค้าที่ค้นหา</div>}</div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>openCustomerForm()}><Plus size={16}/> เพิ่มลูกค้าใหม่</button><button type="button" className="primary-action" onClick={()=>choosePosCustomer(posCustomerSearch)} disabled={!posCustomerSearch.trim()}><Save size={16}/> ใช้ชื่อนี้ในบิล</button></div></section></div>}

        {selectedDelivery && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setSelectedDelivery(null)}><section className="app-modal delivery-detail-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>{selectedDelivery.no} · {selectedDelivery.customer}</h2><p>{selectedDelivery.area} · {selectedDelivery.time} · {selectedDelivery.truck}</p></div><button type="button" onClick={()=>setSelectedDelivery(null)}><X/></button></div><div className="delivery-detail-grid"><article><span>สถานะ</span><strong><span className={`status-chip ${deliveryTone(selectedDelivery.status)}`}>{selectedDelivery.status}</span></strong></article><article><span>มูลค่าสินค้า</span><strong>{formatMoney(selectedDelivery.amount)}</strong></article><article><span>จำนวนรายการ</span><strong>{selectedDelivery.items} รายการ</strong></article><article><span>เบอร์ลูกค้า</span><strong>{selectedDelivery.phone || "-"}</strong></article></div><div className="delivery-detail-body"><section><h3>ปลายทาง</h3><p><MapPin size={15}/> {selectedDelivery.address}</p><small>{selectedDelivery.note || "ไม่มีหมายเหตุเพิ่มเติม"}</small></section><section><h3>รถและคนขับ</h3><p><Truck size={15}/> {selectedDelivery.truck} · {selectedDelivery.driver}</p><small><Phone size={13}/> {selectedDelivery.driverPhone}</small></section></div><div className="delivery-status-actions">{(["รอจัดคิว","เตรียมสินค้า","กำลังจัดส่ง","ส่งสำเร็จ","ยกเลิก"] as const).map(status=><button key={status} className={selectedDelivery.status===status?"active":""} onClick={()=>updateDeliveryStatus(selectedDelivery,status)}>{status}</button>)}</div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setSelectedDelivery(null)}>ปิด</button><button type="button" className="primary-action" onClick={()=>{setCustomerName(selectedDelivery.customer);setSelectedDelivery(null);setActivePage("pos")}}><Plus size={16}/> เปิดบิลลูกค้านี้</button></div></section></div>}

        {showDeliveryForm && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowDeliveryForm(false)}><form className="app-modal delivery-form-modal" onSubmit={saveDelivery} onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>สร้างงานจัดส่ง</h2><p>กรอกข้อมูลลูกค้า ปลายทาง ช่วงเวลา และรถจัดส่ง</p></div><button type="button" onClick={()=>setShowDeliveryForm(false)}><X/></button></div>{actionError&&<div className="login-error">{actionError}</div>}<div className="form-grid"><label>ลูกค้า <em>*</em><input required value={deliveryDraft.customer} onChange={e=>setDeliveryDraft({...deliveryDraft,customer:e.target.value})}/></label><label>เบอร์โทร<input type="tel" value={deliveryDraft.phone} onChange={e=>setDeliveryDraft({...deliveryDraft,phone:e.target.value})}/></label><label>พื้นที่/เขต<input value={deliveryDraft.area} onChange={e=>setDeliveryDraft({...deliveryDraft,area:e.target.value})}/></label><label>ช่วงเวลาจัดส่ง <em>*</em><input required placeholder="เช่น 13:00–15:00" value={deliveryDraft.time} onChange={e=>setDeliveryDraft({...deliveryDraft,time:e.target.value})}/></label><label>ทะเบียนรถ<select value={deliveryDraft.truck} onChange={e=>setDeliveryDraft({...deliveryDraft,truck:e.target.value})}><option value="1ฒก 4582">1ฒก 4582</option><option value="2ฒข 7109">2ฒข 7109</option><option value="3ฒค 2240">3ฒค 2240</option></select></label><label>คนขับ<select value={deliveryDraft.driver} onChange={e=>setDeliveryDraft({...deliveryDraft,driver:e.target.value,driverPhone:e.target.value==="คุณสมพร ส่งไว"?"086-222-7788":"089-123-4567"})}><option value="คุณวิชัย ชำนาญทาง">คุณวิชัย ชำนาญทาง</option><option value="คุณสมพร ส่งไว">คุณสมพร ส่งไว</option></select></label><label>จำนวนรายการ<input type="number" min="1" value={deliveryDraft.items} onChange={e=>setDeliveryDraft({...deliveryDraft,items:Number(e.target.value)})}/></label><label>มูลค่าสินค้า<input type="number" min="0" step="0.01" value={deliveryDraft.amount} onChange={e=>setDeliveryDraft({...deliveryDraft,amount:Number(e.target.value)})}/></label><label className="span-2">ที่อยู่ปลายทาง <em>*</em><textarea required rows={3} value={deliveryDraft.address} onChange={e=>setDeliveryDraft({...deliveryDraft,address:e.target.value})}/></label><label className="span-2">หมายเหตุ<textarea rows={2} value={deliveryDraft.note} onChange={e=>setDeliveryDraft({...deliveryDraft,note:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowDeliveryForm(false)}>ยกเลิก</button><button className="primary-action"><Save size={16}/> บันทึกงานจัดส่ง</button></div></form></div>}

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
              <div className="receipt-totals"><div><span>ยอดรวมสินค้า</span><strong>{formatMoney(receipt.subtotal)}</strong></div><div><span>ส่วนลด</span><strong>-{formatMoney(receipt.discount)}</strong></div><div><span>VAT {receipt.settings.vatRate}% {receipt.settings.pricesIncludeVat ? "(รวมในราคา)" : ""}</span><strong>{formatMoney(receipt.vat)}</strong></div>{Math.abs(receipt.rounding) >= 0.01 && <div><span>ปัดเศษ</span><strong>{formatMoney(receipt.rounding)}</strong></div>}<div className="receipt-grand-total"><span>ยอดชำระสุทธิ</span><strong>{formatMoney(receipt.total)}</strong></div>{receipt.paymentMethod === "cash" && <><div><span>รับเงิน</span><strong>{formatMoney(receipt.amountReceived)}</strong></div><div><span>เงินทอน</span><strong>{formatMoney(receipt.changeDue)}</strong></div></>}</div>
              <div className="receipt-footer">{receipt.settings.receiptFooter || "ขอบคุณที่ใช้บริการ"}</div>
            </div>
            <div className="modal-actions receipt-actions no-print"><button type="button" className="outline-action" onClick={() => window.print()}><Printer size={16}/> พิมพ์ใบเสร็จ</button><button type="button" className="primary-action" onClick={() => { setShowReceipt(false); setReceipt(null); setCustomerName("ลูกค้าทั่วไป"); }}><Plus size={16}/> เปิดบิลใหม่</button></div>
          </section>
        </div>}

        {showProductForm && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowProductForm(false)}><form className="app-modal" onSubmit={saveProduct} onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>{editingProductId ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</h2><p>{editingProductId ? "ปรับข้อมูล ราคา หมวด และจำนวนคงเหลือ" : "บันทึกสินค้าเข้าสู่คลังและหน้าขาย"}</p></div><button type="button" onClick={()=>setShowProductForm(false)}><X/></button></div>{actionError&&<div className="login-error">{actionError}</div>}<div className="form-grid"><label>รหัส SKU<input required value={productDraft.sku} onChange={e=>setProductDraft({...productDraft,sku:e.target.value})}/></label><label>ชื่อสินค้า<input required value={productDraft.name} onChange={e=>setProductDraft({...productDraft,name:e.target.value})}/></label><label>หมวดหมู่<select required value={productDraft.category} onChange={e=>setProductDraft({...productDraft,category:e.target.value})}>{categoryList.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label>หน่วย<input required value={productDraft.unit} onChange={e=>setProductDraft({...productDraft,unit:e.target.value})}/></label><label>ราคาขาย<input required type="number" min="0" step="0.01" value={productDraft.price} onChange={e=>setProductDraft({...productDraft,price:Number(e.target.value)})}/></label><label>จำนวนคงเหลือ<input required type="number" min="0" value={productDraft.stock} onChange={e=>setProductDraft({...productDraft,stock:Number(e.target.value)})}/></label></div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowProductForm(false)}>ยกเลิก</button><button className="primary-action"><Save size={16}/> {editingProductId ? "บันทึกการแก้ไข" : "บันทึกสินค้า"}</button></div></form></div>}

        {showCustomerForm && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowCustomerForm(false)}><form className="app-modal" onSubmit={saveCustomer} onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>{editingCustomerId ? "แก้ไขลูกค้า" : "เพิ่มลูกค้าใหม่"}</h2><p>บันทึกข้อมูลติดต่อ ประเภทลูกค้า เลขภาษี และวงเงินเครดิต</p></div><button type="button" onClick={()=>setShowCustomerForm(false)}><X/></button></div>{actionError&&<div className="login-error">{actionError}</div>}<div className="form-grid"><label>ชื่อลูกค้า <em>*</em><input required value={customerDraft.name} onChange={e=>setCustomerDraft({...customerDraft,name:e.target.value})}/></label><label>เบอร์โทร <em>*</em><input required type="tel" value={customerDraft.phone} onChange={e=>setCustomerDraft({...customerDraft,phone:e.target.value})}/></label><label>ผู้ติดต่อ<input value={customerDraft.contact} onChange={e=>setCustomerDraft({...customerDraft,contact:e.target.value})}/></label><label>ประเภทลูกค้า<select value={customerDraft.type} onChange={e=>setCustomerDraft({...customerDraft,type:e.target.value as CustomerRecord["type"]})}><option value="ลูกค้าทั่วไป">ลูกค้าทั่วไป</option><option value="ลูกค้าประจำ">ลูกค้าประจำ</option><option value="ผู้รับเหมา">ผู้รับเหมา</option><option value="นิติบุคคล">นิติบุคคล</option></select></label><label>เลขประจำตัวผู้เสียภาษี<input inputMode="numeric" maxLength={13} value={customerDraft.taxId} onChange={e=>setCustomerDraft({...customerDraft,taxId:e.target.value.replace(/\D/g,"")})}/><small>{customerDraft.taxId ? `${customerDraft.taxId.length}/13 หลัก` : "เว้นว่างได้สำหรับลูกค้าทั่วไป"}</small></label><label>วงเงินเครดิต<input type="number" min="0" step="100" value={customerDraft.creditLimit} onChange={e=>setCustomerDraft({...customerDraft,creditLimit:Number(e.target.value)})}/></label><label>ใช้เครดิตแล้ว<input type="number" min="0" step="100" value={customerDraft.creditUsed} onChange={e=>setCustomerDraft({...customerDraft,creditUsed:Number(e.target.value)})}/></label><label>เทอมเครดิต (วัน)<input type="number" min="0" max="365" value={customerDraft.creditTerm} onChange={e=>setCustomerDraft({...customerDraft,creditTerm:Number(e.target.value)})}/></label><label>สถานะ<select value={customerDraft.status} onChange={e=>setCustomerDraft({...customerDraft,status:e.target.value as CustomerRecord["status"]})}><option value="active">ใช้งาน</option><option value="watch">ติดตาม</option><option value="inactive">ไม่ใช้งาน</option></select></label><label className="span-2">ที่อยู่<textarea rows={3} value={customerDraft.address} onChange={e=>setCustomerDraft({...customerDraft,address:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowCustomerForm(false)}>ยกเลิก</button><button className="primary-action"><Save size={16}/> {editingCustomerId ? "บันทึกการแก้ไข" : "บันทึกลูกค้า"}</button></div></form></div>}

        {showCreditPayment && selectedDebtor && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowCreditPayment(false)}><form className="app-modal credit-payment-modal" onSubmit={receiveCreditPayment} onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>รับชำระเครดิตลูกค้า</h2><p>{selectedDebtor.name} · ยอดค้าง {formatMoney(selectedDebtor.creditUsed)}</p></div><button type="button" onClick={()=>setShowCreditPayment(false)}><X/></button></div>{actionError&&<div className="login-error">{actionError}</div>}<div className="payment-total-card"><span>ยอดค้างปัจจุบัน</span><strong>{formatMoney(selectedDebtor.creditUsed)}</strong><small>วงเงิน {formatMoney(selectedDebtor.creditLimit)} · เทอม {selectedDebtor.creditTerm || 0} วัน</small></div><div className="form-grid"><label>ยอดรับชำระ <em>*</em><input autoFocus required type="number" min="0.01" max={selectedDebtor.creditUsed} step="0.01" value={creditPaymentDraft.amount} onChange={e=>setCreditPaymentDraft({...creditPaymentDraft,amount:Number(e.target.value)})}/><small>รับได้สูงสุด {formatMoney(selectedDebtor.creditUsed)}</small></label><label>วิธีรับชำระ<select value={creditPaymentDraft.method} onChange={e=>setCreditPaymentDraft({...creditPaymentDraft,method:e.target.value as CreditPayment["method"]})}><option value="transfer">โอนเงิน</option><option value="cash">เงินสด</option><option value="cheque">เช็ค</option></select></label><label>เลขอ้างอิง<input value={creditPaymentDraft.reference} onChange={e=>setCreditPaymentDraft({...creditPaymentDraft,reference:e.target.value})}/><small>เช่น เลขสลิป เลขใบรับเงิน หรือเลขเช็ค</small></label><label>ยอดค้างหลังรับ<input readOnly value={formatMoney(Math.max(0, selectedDebtor.creditUsed - (Number(creditPaymentDraft.amount) || 0)))}/></label><label className="span-2">หมายเหตุ<textarea rows={3} value={creditPaymentDraft.note} onChange={e=>setCreditPaymentDraft({...creditPaymentDraft,note:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowCreditPayment(false)}>ยกเลิก</button><button className="primary-action"><Check size={16}/> บันทึกรับชำระ</button></div></form></div>}

        {selectedCustomer && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setSelectedCustomer(null)}><section className="app-modal customer-detail-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>{selectedCustomer.name}</h2><p>{selectedCustomer.type} · {selectedCustomer.phone} · ผู้ติดต่อ {selectedCustomer.contact || "-"}</p></div><button type="button" onClick={()=>setSelectedCustomer(null)}><X/></button></div><div className="credit-summary-grid"><article><span>วงเงินเครดิต</span><strong>{formatMoney(selectedCustomer.creditLimit)}</strong><small>{selectedCustomer.creditTerm || 0} วัน</small></article><article><span>ใช้เครดิต</span><strong>{formatMoney(selectedCustomer.creditUsed)}</strong><small>{selectedCustomer.creditLimit ? `${Math.min(100, Math.round((selectedCustomer.creditUsed / selectedCustomer.creditLimit) * 100))}% ของวงเงิน` : "ไม่มีวงเงิน"}</small></article><article><span>เครดิตคงเหลือ</span><strong>{formatMoney(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.creditUsed))}</strong><small>{selectedCustomer.creditUsed > selectedCustomer.creditLimit ? "เกินวงเงิน" : "พร้อมใช้งาน"}</small></article></div><section className="data-panel customer-history-panel"><div className="panel-title"><div><h2>รายการของลูกค้า</h2><p>ประวัติจากรายการขายที่บันทึกไว้ หรือข้อมูลเครดิตตัวอย่าง</p></div><span>{displayedCustomerHistory.length} รายการ</span></div><div className="table-scroll"><table><thead><tr><th>เลขที่บิล</th><th>วันเวลา</th><th>พนักงาน</th><th>สินค้า</th><th>ชำระโดย</th><th>ยอดสุทธิ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{displayedCustomerHistory.map(sale=><tr key={sale.id}><td>{sale.id > 0 ? <button className="sale-link" onClick={()=>viewSale(sale.id)}>{sale.receiptNo}</button> : <strong>{sale.receiptNo}</strong>}</td><td>{new Date(sale.createdAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}</td><td>{sale.cashierName || "-"}</td><td>{sale.itemCount} ชิ้น</td><td>{sale.paymentLabel}</td><td><strong>{formatMoney(sale.total)}</strong></td><td><span className={`status-chip ${sale.status==="completed"?"success":sale.status==="refunded"?"warning":"danger"}`}>{sale.status==="completed"?"สำเร็จ":sale.status==="refunded"?"คืนเงิน":"ยกเลิก"}</span></td><td>{sale.id > 0 ? <button className="table-action" onClick={()=>viewSale(sale.id)}>ดูใบเสร็จ</button> : "-"}</td></tr>)}</tbody></table></div>{displayedCustomerHistory.length===0&&<div className="empty-table">ยังไม่มีรายการขายของลูกค้ารายนี้</div>}</section><section className="data-panel customer-history-panel"><div className="panel-title"><div><h2>ประวัติรับชำระเครดิต</h2><p>รายการรับเงินจากลูกหนี้รายนี้</p></div><span>{selectedCustomerPayments.length} รายการ</span></div><div className="credit-payment-list customer-payment-history">{selectedCustomerPayments.map(payment=><button key={payment.id}><div><strong>{payment.reference}</strong><small>{new Date(payment.createdAt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})} · {payment.method==="cash"?"เงินสด":payment.method==="transfer"?"โอนเงิน":"เช็ค"} · {payment.cashier}</small></div><span>{formatMoney(payment.amount)}</span></button>)}{selectedCustomerPayments.length===0&&<p>ยังไม่มีประวัติรับชำระ</p>}</div></section><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>openCustomerForm(selectedCustomer)}><Pencil size={16}/> แก้ไขเครดิต</button><button type="button" className="outline-action" onClick={()=>openCreditPayment(selectedCustomer)} disabled={selectedCustomer.creditUsed<=0}><WalletCards size={16}/> รับชำระเครดิต</button><button type="button" className="primary-action" onClick={()=>{setCustomerName(selectedCustomer.name);setSelectedCustomer(null);setActivePage("pos")}}><Plus size={16}/> เปิดบิลให้ลูกค้านี้</button></div></section></div>}

        {showUserForm && <div className="modal-backdrop" role="presentation" onMouseDown={()=>setShowUserForm(false)}><form className="app-modal" onSubmit={addUser} onMouseDown={e=>e.stopPropagation()}><div className="modal-title"><div><h2>เพิ่มผู้ใช้งาน</h2><p>กำหนดบัญชีและสิทธิ์การเข้าใช้งาน</p></div><button type="button" onClick={()=>setShowUserForm(false)}><X/></button></div>{actionError&&<div className="login-error">{actionError}</div>}<div className="form-grid"><label>ชื่อ-นามสกุล<input required value={userDraft.displayName} onChange={e=>setUserDraft({...userDraft,displayName:e.target.value})}/></label><label>ชื่อผู้ใช้<input required minLength={3} pattern="[a-zA-Z0-9._-]+" value={userDraft.username} onChange={e=>setUserDraft({...userDraft,username:e.target.value})}/></label><label>รหัสผ่านเริ่มต้น<input required type="password" minLength={8} value={userDraft.password} onChange={e=>setUserDraft({...userDraft,password:e.target.value})}/><small>อย่างน้อย 8 ตัวอักษร</small></label><label>บทบาท<select value={userDraft.role} onChange={e=>setUserDraft({...userDraft,role:e.target.value as UserRole})}><option value="admin">ผู้ดูแลระบบ</option><option value="manager">ผู้จัดการ</option><option value="warehouse">เจ้าหน้าที่คลัง</option><option value="user">พนักงานขาย</option></select></label></div><div className="permission-note"><strong>สิทธิ์ของบทบาทนี้</strong><span>{userDraft.role==="admin"?"ใช้งานได้ทุกเมนู รวมถึงจัดการผู้ใช้":userDraft.role==="manager"?"ใช้งานได้ทุกเมนู ยกเว้นจัดการผู้ใช้":userDraft.role==="warehouse"?"ขายหน้าร้านและจัดการสินค้าในคลัง":"ขายหน้าร้านและดูรายการสินค้า"}</span></div><div className="modal-actions"><button type="button" className="outline-action" onClick={()=>setShowUserForm(false)}>ยกเลิก</button><button className="primary-action"><Save size={16}/> เพิ่มผู้ใช้งาน</button></div></form></div>}
      </section>
    </main>
  );
}

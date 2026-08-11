"use client";

import { Eye, EyeOff, HardHat, LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { storeName: string; branchName: string; legalName: string };

export default function LoginForm({ storeName, branchName, legalName }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      router.push("/"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ"); }
    finally { setLoading(false); }
  }

  return <main className="login-page">
    <section className="login-visual"><div className="login-brand"><span><HardHat/></span><div><strong title={storeName}>{storeName || "ชื่อร้าน"}</strong><small>{branchName || "สำนักงานใหญ่"}</small></div></div><div className="login-copy"><p>BUILD • STOCK • SELL</p><h1>จัดการ {storeName || "ร้านวัสดุก่อสร้าง"}<br/>ได้ครบในระบบเดียว</h1><span>{legalName} · ขายหน้าร้าน · สต็อกสินค้า · จัดส่ง · รายงาน</span></div><div className="blueprint-lines" aria-hidden="true"><i/><i/><i/></div></section>
    <section className="login-panel"><form className="login-card" onSubmit={submit}><div className="login-heading"><div className="login-mobile-logo"><HardHat/></div><p>ยินดีต้อนรับกลับ</p><h2>เข้าสู่ระบบ</h2><span>กรอกข้อมูลบัญชีเพื่อเข้าใช้งานระบบ POS</span></div><label>ชื่อผู้ใช้<div className="login-input"><UserRound/><input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="ชื่อผู้ใช้" required/></div></label><label>รหัสผ่าน<div className="login-input"><LockKeyhole/><input type={showPassword?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="รหัสผ่าน" required/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน"}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>{error&&<div className="login-error">{error}</div>}<button className="login-submit" disabled={loading}>{loading?"กำลังตรวจสอบ...":"เข้าสู่ระบบ"}</button><div className="login-security"><LockKeyhole/> Session ปลอดภัยและออกจากระบบอัตโนมัติใน 7 วัน</div></form></section>
  </main>;
}

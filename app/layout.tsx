import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "บ้านช่าง POS | ระบบขายหน้าร้าน",
  description: "ระบบขายหน้าร้านสำหรับร้านวัสดุก่อสร้าง",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

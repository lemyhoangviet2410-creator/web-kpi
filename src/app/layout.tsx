import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web quản lý KPI",
  description: "Web quản lý KPI cho Team SS Lê Mỵ Hoàng Việt",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}

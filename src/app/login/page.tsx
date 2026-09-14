"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function TrangDangNhap() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  async function xuLyDangNhap(e: React.FormEvent) {
    e.preventDefault();
    setDangXuLy(true);
    setLoi(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: matKhau });
    setDangXuLy(false);
    if (error) {
      setLoi(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Đăng nhập — Web quản lý KPI</h1>
      <form onSubmit={xuLyDangNhap} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", padding: "6px 8px", marginTop: 4 }}
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            required
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            style={{ display: "block", width: "100%", padding: "6px 8px", marginTop: 4 }}
          />
        </label>
        {loi && <p style={{ color: "crimson", fontSize: "0.9rem" }}>{loi}</p>}
        <button type="submit" disabled={dangXuLy} style={{ padding: "8px 12px", cursor: "pointer" }}>
          {dangXuLy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Chưa có tài khoản? <Link href="/signup">Đăng ký</Link>
      </p>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NhanVien = { ma_nv: string; ten_nv: string };

export default function GanMaNhanVien({ userId }: { userId: string }) {
  const router = useRouter();
  const [danhSachNv, setDanhSachNv] = useState<NhanVien[]>([]);
  const [maNv, setMaNv] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [dangXuLy, setDangXuLy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("nhan_vien")
      .select("ma_nv, ten_nv")
      .order("ten_nv")
      .then(({ data }) => setDanhSachNv(data ?? []));
  }, []);

  async function xuLy(e: React.FormEvent) {
    e.preventDefault();
    setDangXuLy(true);
    setLoi(null);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").upsert({ id: userId, ma_nv: maNv });
    setDangXuLy(false);
    if (error) {
      setLoi(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Hoàn tất hồ sơ</h1>
      <p style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        Tài khoản của bạn chưa được gắn với 1 mã nhân viên trong team. Chọn tên của bạn bên dưới:
      </p>
      <form onSubmit={xuLy} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <select
          required
          value={maNv}
          onChange={(e) => setMaNv(e.target.value)}
          style={{ padding: "6px 8px" }}
        >
          <option value="" disabled>
            -- Chọn tên trong danh sách --
          </option>
          {danhSachNv.map((nv) => (
            <option key={nv.ma_nv} value={nv.ma_nv}>
              {nv.ten_nv} ({nv.ma_nv})
            </option>
          ))}
        </select>
        {loi && <p style={{ color: "crimson", fontSize: "0.9rem" }}>{loi}</p>}
        <button type="submit" disabled={dangXuLy} style={{ padding: "8px 12px", cursor: "pointer" }}>
          {dangXuLy ? "Đang lưu..." : "Xác nhận"}
        </button>
      </form>
    </main>
  );
}

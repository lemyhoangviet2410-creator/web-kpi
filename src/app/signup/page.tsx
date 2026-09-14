"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type NhanVien = { ma_nv: string; ten_nv: string };

export default function TrangDangKy() {
  const router = useRouter();
  const [danhSachNv, setDanhSachNv] = useState<NhanVien[]>([]);
  const [email, setEmail] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [maNv, setMaNv] = useState("");
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("nhan_vien")
      .select("ma_nv, ten_nv")
      .order("ten_nv")
      .then(({ data }) => setDanhSachNv(data ?? []));
  }, []);

  async function xuLyDangKy(e: React.FormEvent) {
    e.preventDefault();
    setDangXuLy(true);
    setLoi(null);
    setThongBao(null);
    const supabase = createClient();

    const { data: signUpData, error: loiDangKy } = await supabase.auth.signUp({
      email,
      password: matKhau,
    });
    if (loiDangKy) {
      setLoi(loiDangKy.message);
      setDangXuLy(false);
      return;
    }

    // Nếu project bật xác nhận email, chưa có session ngay -> chỉ báo kiểm tra email,
    // việc gắn mã NV vào hồ sơ sẽ làm khi đăng nhập lần đầu (trang chủ sẽ nhắc lại).
    if (!signUpData.session) {
      setThongBao(
        "Đăng ký thành công. Vui lòng kiểm tra email để xác nhận, sau đó quay lại đăng nhập."
      );
      setDangXuLy(false);
      return;
    }

    const { error: loiHoSo } = await supabase.from("profiles").upsert({
      id: signUpData.user!.id,
      ma_nv: maNv,
    });
    setDangXuLy(false);
    if (loiHoSo) {
      setLoi(`Tạo tài khoản thành công nhưng gắn mã NV bị lỗi: ${loiHoSo.message}`);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Đăng ký — Web quản lý KPI</h1>
      <form onSubmit={xuLyDangKy} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Bạn là
          <select
            required
            value={maNv}
            onChange={(e) => setMaNv(e.target.value)}
            style={{ display: "block", width: "100%", padding: "6px 8px", marginTop: 4 }}
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
        </label>
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
          Mật khẩu (tối thiểu 6 ký tự)
          <input
            type="password"
            required
            minLength={6}
            value={matKhau}
            onChange={(e) => setMatKhau(e.target.value)}
            style={{ display: "block", width: "100%", padding: "6px 8px", marginTop: 4 }}
          />
        </label>
        {loi && <p style={{ color: "crimson", fontSize: "0.9rem" }}>{loi}</p>}
        {thongBao && <p style={{ color: "green", fontSize: "0.9rem" }}>{thongBao}</p>}
        <button type="submit" disabled={dangXuLy} style={{ padding: "8px 12px", cursor: "pointer" }}>
          {dangXuLy ? "Đang đăng ký..." : "Đăng ký"}
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
      </p>
    </main>
  );
}

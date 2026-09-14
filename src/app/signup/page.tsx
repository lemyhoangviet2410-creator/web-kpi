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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Đăng ký tài khoản</h1>
        </div>

        <form
          onSubmit={xuLyDangKy}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Bạn là</span>
            <select
              required
              value={maNv}
              onChange={(e) => setMaNv(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Mật khẩu (tối thiểu 6 ký tự)</span>
            <input
              type="password"
              required
              minLength={6}
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          {loi && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loi}</p>
          )}
          {thongBao && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {thongBao}
            </p>
          )}

          <button
            type="submit"
            disabled={dangXuLy}
            className="mt-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dangXuLy ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}

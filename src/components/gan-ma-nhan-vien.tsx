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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Hoàn tất hồ sơ</h1>
        </div>

        <form
          onSubmit={xuLy}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <p className="text-sm text-slate-600">
            Tài khoản của bạn chưa được gắn với 1 mã nhân viên trong team. Chọn tên của bạn bên dưới:
          </p>
          <select
            required
            value={maNv}
            onChange={(e) => setMaNv(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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

          {loi && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loi}</p>
          )}

          <button
            type="submit"
            disabled={dangXuLy}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dangXuLy ? "Đang lưu..." : "Xác nhận"}
          </button>
        </form>
      </div>
    </main>
  );
}

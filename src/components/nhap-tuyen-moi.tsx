"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NhapTuyenMoi({ maNv, thang, giaTriHienTai }: { maNv: string; thang: string; giaTriHienTai: number }) {
  const router = useRouter();
  const [giaTri, setGiaTri] = useState(String(giaTriHienTai));
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [daLuu, setDaLuu] = useState(false);

  async function luu() {
    setDangLuu(true);
    setLoi(null);
    setDaLuu(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("nhan_su_thuc_hien")
      .upsert({ ma_nv: maNv, thang, tuyen_moi_th: Number(giaTri) || 0 });
    setDangLuu(false);
    if (error) {
      setLoi(error.message);
      return;
    }
    setDaLuu(true);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={giaTri}
        onChange={(e) => {
          setGiaTri(e.target.value);
          setDaLuu(false);
        }}
        className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <button
        onClick={luu}
        disabled={dangLuu}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {dangLuu ? "Đang lưu..." : "Lưu"}
      </button>
      {daLuu ? <span className="text-xs text-emerald-600">Đã lưu</span> : null}
      {loi ? <span className="text-xs text-rose-600">{loi}</span> : null}
    </div>
  );
}

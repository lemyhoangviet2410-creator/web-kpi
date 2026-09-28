import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Visit = {
  ma_nv: string | null;
  ten_nv: string | null;
  ten_nhiem_vu: string | null;
  ma_to_chuc: string | null;
  ten_to_chuc: string | null;
  tg_checkin: string;
  bao_cao: string | null;
  trang_thai_call: string | null;
};

type Order = {
  ma_to_chuc: string | null;
  ngay_chung_tu: string;
  tong_tien: number | null;
};

export default async function TrangCallCungTuyen() {
  const supabase = await createClient();

  const homNay = new Date();
  const dauThang = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth(), 1)).toISOString().slice(0, 10);
  const dauThangSau = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  const tenThang = `${homNay.getMonth() + 1}/${homNay.getFullYear()}`;

  const [{ data: dsVisit }, { data: dsDon }] = await Promise.all([
    supabase
      .from("visits")
      .select("ma_nv, ten_nv, ten_nhiem_vu, ma_to_chuc, ten_to_chuc, tg_checkin, bao_cao, trang_thai_call")
      .gte("tg_checkin", dauThang)
      .lt("tg_checkin", dauThangSau)
      .order("tg_checkin", { ascending: true }),
    supabase
      .from("orders")
      .select("ma_to_chuc, ngay_chung_tu, tong_tien")
      .gte("ngay_chung_tu", dauThang)
      .lt("ngay_chung_tu", dauThangSau),
  ]);

  const visits = (dsVisit ?? []) as Visit[];
  const orders = (dsDon ?? []) as Order[];

  const donTheoKhach = new Map<string, { soLuong: number; tongTien: number }>();
  for (const d of orders) {
    if (!d.ma_to_chuc) continue;
    const hien = donTheoKhach.get(d.ma_to_chuc) ?? { soLuong: 0, tongTien: 0 };
    hien.soLuong += 1;
    hien.tongTien += d.tong_tien ?? 0;
    donTheoKhach.set(d.ma_to_chuc, hien);
  }

  type ThongTinKhach = {
    maToChuc: string;
    tenToChuc: string;
    soLuotCall: number;
    ngayDau: string;
    ngayCuoi: string;
    cungTuyen: Set<string>;
    coDon: boolean;
  };

  type ThongTinNv = {
    maNv: string;
    tenNv: string;
    khach: Map<string, ThongTinKhach>;
  };

  const theoNv = new Map<string, ThongTinNv>();
  for (const v of visits) {
    if (v.trang_thai_call !== "Đã duyệt") continue;
    if (!v.ma_nv || !v.ma_to_chuc) continue;
    if (!theoNv.has(v.ma_nv)) {
      theoNv.set(v.ma_nv, { maNv: v.ma_nv, tenNv: v.ten_nv ?? v.ma_nv, khach: new Map() });
    }
    const nv = theoNv.get(v.ma_nv)!;
    if (!nv.khach.has(v.ma_to_chuc)) {
      nv.khach.set(v.ma_to_chuc, {
        maToChuc: v.ma_to_chuc,
        tenToChuc: v.ten_to_chuc ?? v.ma_to_chuc,
        soLuotCall: 0,
        ngayDau: v.tg_checkin,
        ngayCuoi: v.tg_checkin,
        cungTuyen: new Set(),
        coDon: donTheoKhach.has(v.ma_to_chuc),
      });
    }
    const kh = nv.khach.get(v.ma_to_chuc)!;
    kh.soLuotCall += 1;
    if (v.tg_checkin < kh.ngayDau) kh.ngayDau = v.tg_checkin;
    if (v.tg_checkin > kh.ngayCuoi) kh.ngayCuoi = v.tg_checkin;
    if (v.ten_nhiem_vu) kh.cungTuyen.add(v.ten_nhiem_vu);
  }

  const dsNv = [...theoNv.values()]
    .map((nv) => {
      const dsKhach = [...nv.khach.values()].sort((a, b) => b.soLuotCall - a.soLuotCall);
      const soKhach = dsKhach.length;
      const tongLuotCall = dsKhach.reduce((s, k) => s + k.soLuotCall, 0);
      const soKhachCoDon = dsKhach.filter((k) => k.coDon).length;
      const tiLe = soKhach > 0 ? (soKhachCoDon / soKhach) * 100 : 0;
      return { ...nv, dsKhach, soKhach, tongLuotCall, soKhachCoDon, tiLe };
    })
    .sort((a, b) => b.tiLe - a.tiLe);

  const tongSoKhach = dsNv.reduce((s, nv) => s + nv.soKhach, 0);
  const tongLuotCall = dsNv.reduce((s, nv) => s + nv.tongLuotCall, 0);
  const tongKhachCoDon = dsNv.reduce((s, nv) => s + nv.soKhachCoDon, 0);

  function formatNgay(iso: string) {
    return new Date(iso).toLocaleDateString("vi-VN");
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
            <h1 className="text-xl font-semibold text-slate-900">Call - Cung tuyến — tháng {tenThang}</h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← Về Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Khách đã call</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tongSoKhach}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Tổng lượt call</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tongLuotCall}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Khách có đơn</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{tongKhachCoDon}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Tỷ lệ call → đơn</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-700">
              {tongSoKhach > 0 ? Math.round((tongKhachCoDon / tongSoKhach) * 100) : 0}%
            </p>
          </div>
        </section>

        {dsNv.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Chưa có dữ liệu Call - Cung tuyến tháng này.
          </p>
        ) : null}

        <div className="flex flex-col gap-8">
          {dsNv.map((nv) => (
            <section key={nv.maNv}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  {nv.tenNv} <span className="font-normal text-slate-500">({nv.soKhach} khách, {nv.tongLuotCall} lượt call)</span>
                </h2>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  {nv.soKhachCoDon}/{nv.soKhach} khách có đơn — {Math.round(nv.tiLe)}%
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="px-3 py-2">Khách hàng</th>
                      <th className="px-3 py-2 text-right">Lượt call</th>
                      <th className="px-3 py-2">Ngày đầu — cuối</th>
                      <th className="px-3 py-2">Cung tuyến</th>
                      <th className="px-3 py-2">Đơn hàng tháng này</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nv.dsKhach.map((kh) => (
                      <tr key={kh.maToChuc} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-900">{kh.tenToChuc}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{kh.soLuotCall}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {formatNgay(kh.ngayDau)} — {formatNgay(kh.ngayCuoi)}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{[...kh.cungTuyen].join(", ") || "—"}</td>
                        <td className="px-3 py-2">
                          {kh.coDon ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Đã có đơn
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Chưa phát sinh đơn
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

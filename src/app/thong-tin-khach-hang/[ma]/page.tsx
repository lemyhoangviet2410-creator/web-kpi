import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function TrangChiTietKhachHang({
  params,
}: {
  params: Promise<{ ma: string }>;
}) {
  const { ma } = await params;
  const maToChuc = decodeURIComponent(ma);
  const supabase = await createClient();

  const [{ data: khachHang }, { data: dsDon }, { data: dsCall }] = await Promise.all([
    supabase.from("customers").select("ma_to_chuc, ten_to_chuc, tinh_tp, dia_chi").eq("ma_to_chuc", maToChuc).maybeSingle(),
    supabase
      .from("orders")
      .select("ngay_chung_tu, ma_chung_tu, ma_sp, so_luong, don_vi, tong_tien, ma_nv, products(ten_sp)")
      .eq("ma_to_chuc", maToChuc)
      .order("ngay_chung_tu", { ascending: false }),
    supabase
      .from("visits")
      .select("tg_checkin, ten_nv, ten_nhiem_vu, bao_cao, trang_thai_call")
      .eq("ma_to_chuc", maToChuc)
      .order("tg_checkin", { ascending: false }),
  ]);

  if (!khachHang) {
    notFound();
  }

  const donHang = dsDon ?? [];
  const lichSuCall = dsCall ?? [];

  const tongDoanhThu = donHang.reduce((s, d) => s + (d.tong_tien ?? 0), 0);
  const soLuotCallDaDuyet = lichSuCall.filter((c) => c.trang_thai_call === "Đã duyệt").length;
  const lanCallGanNhat = lichSuCall[0]?.tg_checkin ?? null;
  const lanMuaGanNhat = donHang[0]?.ngay_chung_tu ?? null;

  function formatTien(v: number) {
    return v.toLocaleString("vi-VN") + "đ";
  }
  function formatNgayCall(iso: string) {
    return new Date(iso).toLocaleString("vi-VN");
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
            <h1 className="text-xl font-semibold text-slate-900">{khachHang.ten_to_chuc}</h1>
          </div>
          <Link
            href="/thong-tin-khach-hang"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← Danh sách khách hàng
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <section className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-sm text-slate-500">
            Mã: <span className="font-medium text-slate-900">{khachHang.ma_to_chuc}</span>
            {khachHang.tinh_tp ? (
              <>
                {" "}
                · Tỉnh/TP: <span className="font-medium text-slate-900">{khachHang.tinh_tp}</span>
              </>
            ) : null}
          </p>
          {khachHang.dia_chi ? <p className="mt-1 text-sm text-slate-500">Địa chỉ: {khachHang.dia_chi}</p> : null}
        </section>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Tổng doanh thu</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatTien(tongDoanhThu)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Số đơn hàng</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{donHang.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Lượt call đã duyệt</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{soLuotCallDaDuyet}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Mua gần nhất</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{lanMuaGanNhat ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Call gần nhất</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {lanCallGanNhat ? new Date(lanCallGanNhat).toLocaleDateString("vi-VN") : "—"}
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Lịch sử đơn hàng ({donHang.length})</h2>
          {donHang.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Chưa có đơn hàng nào.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="px-3 py-2">Ngày</th>
                    <th className="px-3 py-2">Mã chứng từ</th>
                    <th className="px-3 py-2">Sản phẩm</th>
                    <th className="px-3 py-2 text-right">Số lượng</th>
                    <th className="px-3 py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {donHang.map((d, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-500">{d.ngay_chung_tu}</td>
                      <td className="px-3 py-2 text-slate-500">{d.ma_chung_tu}</td>
                      <td className="px-3 py-2 text-slate-900">
                        {(Array.isArray(d.products) ? d.products[0]?.ten_sp : (d.products as { ten_sp: string | null } | null)?.ten_sp) ?? d.ma_sp}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {d.so_luong?.toLocaleString("vi-VN")} {d.don_vi}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{formatTien(d.tong_tien ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Lịch sử viếng thăm / call ({lichSuCall.length})
          </h2>
          {lichSuCall.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Chưa có lượt call nào ghi nhận (dữ liệu call chỉ có từ tháng 9/2026 trở đi).
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="px-3 py-2">Thời gian</th>
                    <th className="px-3 py-2">Nhân viên</th>
                    <th className="px-3 py-2">Cung tuyến</th>
                    <th className="px-3 py-2">Báo cáo</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {lichSuCall.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-500">{formatNgayCall(c.tg_checkin)}</td>
                      <td className="px-3 py-2 text-slate-900">{c.ten_nv}</td>
                      <td className="px-3 py-2 text-slate-500">{c.ten_nhiem_vu ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{c.bao_cao ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            c.trang_thai_call === "Đã duyệt"
                              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                              : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                          }
                        >
                          {c.trang_thai_call ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

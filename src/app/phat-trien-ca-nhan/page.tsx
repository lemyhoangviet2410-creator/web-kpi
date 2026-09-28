import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TEN_COOKIE_MA_NV } from "@/lib/gate";

function themThang(ngay: Date, soThang: number): Date {
  return new Date(Date.UTC(ngay.getUTCFullYear(), ngay.getUTCMonth() + soThang, ngay.getUTCDate()));
}

export default async function TrangPhatTrienCaNhan({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; loi?: string }>;
}) {
  const { ok, loi } = await searchParams;
  const supabase = await createClient();

  const homNay = new Date();
  const dauThang = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth(), 1)).toISOString().slice(0, 10);
  const dauThangSau = themThang(new Date(dauThang), 1).toISOString().slice(0, 10);
  const dauThangTruoc = themThang(new Date(dauThang), -1).toISOString().slice(0, 10);
  const tenThang = `${homNay.getMonth() + 1}/${homNay.getFullYear()}`;

  const [
    { data: donThangNay },
    { data: donThangTruoc },
    { data: nvSS },
    { data: dsGhiChu },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("tong_tien, so_luong, ma_nv, products(nhom_trong_tam)")
      .gte("ngay_chung_tu", dauThang)
      .lt("ngay_chung_tu", dauThangSau),
    supabase.from("orders").select("tong_tien").gte("ngay_chung_tu", dauThangTruoc).lt("ngay_chung_tu", dauThang),
    supabase.from("nhan_vien").select("ma_nv, ten_nv").eq("vai_tro", "ss").maybeSingle(),
    supabase.from("ghi_chu_phat_trien").select("thang, noi_dung, cap_nhat_luc").order("thang", { ascending: false }),
  ]);

  const maNvDangXem = (await cookies()).get(TEN_COOKIE_MA_NV)?.value;
  const laSS = Boolean(nvSS && maNvDangXem === nvSS.ma_nv);

  const { data: dsNhanVien } = await supabase.from("nhan_vien").select("ma_nv, ten_nv");
  const tenNvTheoMa = new Map((dsNhanVien ?? []).map((nv) => [nv.ma_nv, nv.ten_nv]));

  const doanhSoThangNay = (donThangNay ?? []).reduce((s, d) => s + (d.tong_tien ?? 0), 0);
  const doanhSoThangTruoc = (donThangTruoc ?? []).reduce((s, d) => s + (d.tong_tien ?? 0), 0);
  const phanTramSoThangTruoc =
    doanhSoThangTruoc > 0 ? ((doanhSoThangNay - doanhSoThangTruoc) / doanhSoThangTruoc) * 100 : null;

  const doanhSoTheoNv = new Map<string, number>();
  for (const d of donThangNay ?? []) {
    if (!d.ma_nv) continue;
    doanhSoTheoNv.set(d.ma_nv, (doanhSoTheoNv.get(d.ma_nv) ?? 0) + (d.tong_tien ?? 0));
  }
  const bangXepHangNv = [...doanhSoTheoNv.entries()]
    .map(([maNv, doanhSo]) => ({ maNv, tenNv: tenNvTheoMa.get(maNv) ?? maNv, doanhSo }))
    .sort((a, b) => b.doanhSo - a.doanhSo)
    .slice(0, 3);

  const slTheoNhomTrongTam = new Map<string, number>();
  for (const d of donThangNay ?? []) {
    const nhom = (d.products as { nhom_trong_tam: string | null } | { nhom_trong_tam: string | null }[] | null);
    const tenNhom = Array.isArray(nhom) ? nhom[0]?.nhom_trong_tam : nhom?.nhom_trong_tam;
    if (!tenNhom) continue;
    slTheoNhomTrongTam.set(tenNhom, (slTheoNhomTrongTam.get(tenNhom) ?? 0) + (d.so_luong ?? 0));
  }

  function formatTien(v: number) {
    return v.toLocaleString("vi-VN") + "đ";
  }

  const ghiChuThangNay = (dsGhiChu ?? []).find((g) => g.thang === dauThang);

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
            <h1 className="text-xl font-semibold text-slate-900">Phát triển cá nhân (SS) — tháng {tenThang}</h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← Về Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {ok ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Đã lưu ghi chú tháng này.
          </p>
        ) : null}
        {loi === "quyen" ? (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Chỉ SS mới có quyền ghi chú mục này.
          </p>
        ) : null}

        <p className="mb-6 text-xs text-slate-500">
          Trang này chỉ tổng hợp mục 2 (Kết quả kinh doanh) và mục 3 (Kiến thức/kinh nghiệm) của báo cáo tăng
          trưởng cá nhân hàng tháng — mục 1 (Thu nhập) không đưa lên web vì có số liệu lương cá nhân, vẫn làm
          riêng như trước.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Kết quả kinh doanh tháng này</h2>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Doanh số tháng này</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatTien(doanhSoThangNay)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">So với tháng trước</p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  phanTramSoThangTruoc == null
                    ? "text-slate-900"
                    : phanTramSoThangTruoc >= 0
                      ? "text-emerald-700"
                      : "text-rose-700"
                }`}
              >
                {phanTramSoThangTruoc == null
                  ? "—"
                  : `${phanTramSoThangTruoc >= 0 ? "+" : ""}${phanTramSoThangTruoc.toFixed(1)}%`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">Doanh số tháng trước</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{formatTien(doanhSoThangTruoc)}</p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="mb-2 text-sm font-medium text-slate-900">Sản lượng theo sản phẩm trọng tâm</p>
            {slTheoNhomTrongTam.size === 0 ? (
              <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-3">
                {[...slTheoNhomTrongTam.entries()].map(([nhom, sl]) => (
                  <li key={nhom}>
                    {nhom}: <span className="font-medium text-slate-900">{sl.toLocaleString("vi-VN")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="mb-2 text-sm font-medium text-slate-900">Điểm sáng — Top nhân viên theo doanh số</p>
            {bangXepHangNv.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {bangXepHangNv.map((nv) => (
                  <li key={nv.maNv}>
                    {nv.tenNv} — {formatTien(nv.doanhSo)}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Xem chi tiết đầy đủ % đạt KPI của từng hạng mục ở{" "}
            <Link href="/" className="text-indigo-600 hover:underline">
              trang Dashboard
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Kiến thức / kinh nghiệm quản lý tháng này</h2>
          {laSS ? (
            <form action="/api/luu-phat-trien-ca-nhan" method="POST" className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <input type="hidden" name="thang" value={dauThang} />
              <textarea
                name="noi_dung"
                defaultValue={ghiChuThangNay?.noi_dung ?? ""}
                rows={6}
                placeholder="Ví dụ: nhân rộng cách làm của nhân viên hiệu quả nhất, coaching nhân viên yếu, phát hiện bất thường dữ liệu, kinh nghiệm quản lý dựa trên dữ liệu..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="submit"
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Lưu ghi chú tháng {tenThang}
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {ghiChuThangNay?.noi_dung || "Chưa có ghi chú cho tháng này."}
              </p>
            </div>
          )}
        </section>

        {(dsGhiChu ?? []).filter((g) => g.thang !== dauThang).length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Lịch sử các tháng trước</h2>
            <div className="flex flex-col gap-3">
              {(dsGhiChu ?? [])
                .filter((g) => g.thang !== dauThang)
                .map((g) => (
                  <div key={g.thang} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="mb-1 text-xs font-medium text-slate-500">
                      Tháng {new Date(g.thang).getMonth() + 1}/{new Date(g.thang).getFullYear()}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{g.noi_dung || "—"}</p>
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

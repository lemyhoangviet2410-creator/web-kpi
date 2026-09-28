import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TEN_COOKIE_MA_NV } from "@/lib/gate";

type HopDong = {
  id: number;
  khu_vuc: string;
  so_hd: string;
  ngay_bat_dau: string | null;
  ngay_het_han: string | null;
  ten_khach: string | null;
  tinh: string | null;
  ten_mat_hang: string | null;
  sl_ke_hoach: number | null;
  sl_thuc_hien: number | null;
  sl_con_lai: number | null;
  ty_le_thuc_hien: number | null;
  ten_nv_trien_khai: string | null;
  ma_nv: string | null;
};

type TrangThai = "Hoàn thành" | "Đã quá hạn" | "Sắp hết hạn" | "Chậm tiến độ" | "Bình thường";

const MAU_TRANG_THAI: Record<TrangThai, string> = {
  "Đã quá hạn": "bg-rose-50 text-rose-700 border-rose-200",
  "Sắp hết hạn": "bg-amber-50 text-amber-700 border-amber-200",
  "Chậm tiến độ": "bg-orange-50 text-orange-700 border-orange-200",
  "Bình thường": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Hoàn thành": "bg-sky-50 text-sky-700 border-sky-200",
};

function tinhTrangThai(hd: HopDong, homNay: Date): TrangThai {
  if ((hd.sl_con_lai ?? 0) <= 0) return "Hoàn thành";
  if (!hd.ngay_het_han) return "Bình thường";
  const ngayHetHan = new Date(hd.ngay_het_han + "T00:00:00");
  if (ngayHetHan.getTime() < homNay.getTime()) return "Đã quá hạn";
  const soNgayConLai = Math.round((ngayHetHan.getTime() - homNay.getTime()) / (1000 * 60 * 60 * 24));
  if (soNgayConLai <= 30) return "Sắp hết hạn";
  if (hd.ngay_bat_dau) {
    const ngayBatDau = new Date(hd.ngay_bat_dau + "T00:00:00");
    const tongThoiGian = ngayHetHan.getTime() - ngayBatDau.getTime();
    const daTrai = homNay.getTime() - ngayBatDau.getTime();
    const tiLeThoiGian = tongThoiGian > 0 ? Math.min(Math.max((daTrai / tongThoiGian) * 100, 0), 100) : 0;
    if ((hd.ty_le_thuc_hien ?? 0) < tiLeThoiGian - 15) return "Chậm tiến độ";
  }
  return "Bình thường";
}

export default async function TrangTienDoThau({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; loi?: string }>;
}) {
  const { ok, loi } = await searchParams;
  const supabase = await createClient();

  const [{ data: dsHopDong }, { data: nvSS }] = await Promise.all([
    supabase
      .from("thau_hop_dong")
      .select(
        "id, khu_vuc, so_hd, ngay_bat_dau, ngay_het_han, ten_khach, tinh, ten_mat_hang, sl_ke_hoach, sl_thuc_hien, sl_con_lai, ty_le_thuc_hien, ten_nv_trien_khai, ma_nv"
      )
      .order("ngay_het_han", { ascending: true }),
    supabase.from("nhan_vien").select("ma_nv, ten_nv").eq("vai_tro", "ss").maybeSingle(),
  ]);

  const maNvDangXem = (await cookies()).get(TEN_COOKIE_MA_NV)?.value;
  const laSS = Boolean(nvSS && maNvDangXem === nvSS.ma_nv);

  const homNay = new Date();
  homNay.setHours(0, 0, 0, 0);

  const hopDongDaTinh = (dsHopDong ?? []).map((hd) => ({ ...hd, trangThai: tinhTrangThai(hd, homNay) }));

  const tongTheoTrangThai = new Map<TrangThai, number>();
  for (const hd of hopDongDaTinh) {
    tongTheoTrangThai.set(hd.trangThai, (tongTheoTrangThai.get(hd.trangThai) ?? 0) + 1);
  }

  const nhomTheoNv = new Map<string, typeof hopDongDaTinh>();
  for (const hd of hopDongDaTinh) {
    const ten = hd.ten_nv_trien_khai ?? "Chưa phân công";
    if (!nhomTheoNv.has(ten)) nhomTheoNv.set(ten, []);
    nhomTheoNv.get(ten)!.push(hd);
  }
  const dsNhomTheoNv = [...nhomTheoNv.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const canhBao = hopDongDaTinh.filter((hd) => hd.trangThai === "Đã quá hạn" || hd.trangThai === "Sắp hết hạn");

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
            <h1 className="text-xl font-semibold text-slate-900">Tiến độ thầu</h1>
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
        {ok ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Đã cập nhật dữ liệu thầu thành công.
          </p>
        ) : null}
        {loi === "quyen" ? (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Bạn không có quyền tải lên file này — chỉ SS mới được cập nhật.
          </p>
        ) : null}
        {loi === "file" || loi === "trong" || loi === "luu" ? (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Không đọc được file hoặc file không đúng định dạng — kiểm tra lại file &quot;Báo cáo thầu.xlsx&quot;.
          </p>
        ) : null}

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Tổng hợp đồng</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{hopDongDaTinh.length}</p>
          </div>
          {(["Đã quá hạn", "Sắp hết hạn", "Chậm tiến độ", "Bình thường", "Hoàn thành"] as TrangThai[]).map((tt) => (
            <div key={tt} className={`rounded-xl border px-4 py-3 ${MAU_TRANG_THAI[tt]}`}>
              <p className="text-xs opacity-80">{tt}</p>
              <p className="mt-1 text-2xl font-semibold">{tongTheoTrangThai.get(tt) ?? 0}</p>
            </div>
          ))}
        </section>

        {canhBao.length > 0 ? (
          <section className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="mb-2 text-sm font-semibold text-rose-800">⚠ Cần xử lý ngay ({canhBao.length})</p>
            <ul className="space-y-1 text-sm text-rose-700">
              {canhBao.map((hd) => (
                <li key={hd.id}>
                  {hd.ten_khach} — {hd.ten_mat_hang} ({hd.so_hd}) — hết hạn {hd.ngay_het_han} —{" "}
                  {hd.ten_nv_trien_khai ?? "Chưa phân công"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {laSS ? (
          <section className="mb-8 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="mb-2 text-sm font-semibold text-slate-900">Cập nhật dữ liệu thầu</p>
            <p className="mb-3 text-xs text-slate-500">
              Khi phòng thầu gửi file mới, tải file &quot;Báo cáo thầu.xlsx&quot; lên đây để làm mới toàn bộ dữ liệu.
            </p>
            <form action="/api/tai-len-thau" method="POST" encType="multipart/form-data" className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                name="file"
                accept=".xlsx"
                required
                className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-indigo-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Tải lên & làm mới
              </button>
            </form>
          </section>
        ) : null}

        <div className="flex flex-col gap-8">
          {dsNhomTheoNv.map(([tenNv, dsHd]) => (
            <section key={tenNv}>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">
                {tenNv} <span className="font-normal text-slate-500">({dsHd.length} hợp đồng)</span>
              </h2>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="px-3 py-2">Khách hàng</th>
                      <th className="px-3 py-2">Sản phẩm</th>
                      <th className="px-3 py-2">Số HĐ</th>
                      <th className="px-3 py-2">Hết hạn</th>
                      <th className="px-3 py-2 text-right">SL kế hoạch</th>
                      <th className="px-3 py-2 text-right">SL thực hiện</th>
                      <th className="px-3 py-2 text-right">% thực hiện</th>
                      <th className="px-3 py-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsHd.map((hd) => (
                      <tr key={hd.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-900">{hd.ten_khach}</td>
                        <td className="px-3 py-2 text-slate-600">{hd.ten_mat_hang}</td>
                        <td className="px-3 py-2 text-slate-500">{hd.so_hd}</td>
                        <td className="px-3 py-2 text-slate-500">{hd.ngay_het_han}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{hd.sl_ke_hoach?.toLocaleString("vi-VN")}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{hd.sl_thuc_hien?.toLocaleString("vi-VN")}</td>
                        <td className="px-3 py-2 text-right text-slate-600">
                          {hd.ty_le_thuc_hien != null ? `${hd.ty_le_thuc_hien}%` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${MAU_TRANG_THAI[hd.trangThai]}`}>
                            {hd.trangThai}
                          </span>
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

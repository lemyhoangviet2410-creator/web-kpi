import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TEN_COOKIE_MA_NV } from "@/lib/gate";

function themThang(ngay: Date, soThang: number): Date {
  return new Date(Date.UTC(ngay.getUTCFullYear(), ngay.getUTCMonth() + soThang, ngay.getUTCDate()));
}

type DonHangGon = {
  ma_to_chuc: string | null;
  ma_nv: string | null;
  ma_chung_tu: string;
  ngay_chung_tu: string;
};

async function layToanBoDonHang(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DonHangGon[]> {
  const KICH_THUOC_TRANG = 1000;
  const ketQua: DonHangGon[] = [];
  let trang = 0;
  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("ma_to_chuc, ma_nv, ma_chung_tu, ngay_chung_tu")
      .order("ngay_chung_tu", { ascending: true })
      .order("id", { ascending: true })
      .range(trang * KICH_THUOC_TRANG, trang * KICH_THUOC_TRANG + KICH_THUOC_TRANG - 1);
    if (error || !data || data.length === 0) break;
    ketQua.push(...(data as DonHangGon[]));
    if (data.length < KICH_THUOC_TRANG) break;
    trang += 1;
  }
  return ketQua;
}

export default async function TrangXacNhanCodeMoi({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const { loi } = await searchParams;
  const supabase = await createClient();

  const homNay = new Date();
  const dauThang = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const dauThangSau = themThang(new Date(dauThang), 1).toISOString().slice(0, 10);

  const [donHangToanBo, { data: dsNhanVien }, { data: dsKhachHang }, { data: dsXacNhan }] =
    await Promise.all([
      layToanBoDonHang(supabase),
      supabase.from("nhan_vien").select("ma_nv, ten_nv, vai_tro"),
      supabase.from("customers").select("ma_to_chuc, ten_to_chuc"),
      supabase
        .from("new_code_confirmations")
        .select("ma_to_chuc, trang_thai, nguoi_duyet, ngay_duyet"),
    ]);

  const tenNvTheoMa = new Map((dsNhanVien ?? []).map((nv) => [nv.ma_nv, nv.ten_nv]));
  const tenKhTheoMa = new Map((dsKhachHang ?? []).map((kh) => [kh.ma_to_chuc, kh.ten_to_chuc]));
  const xacNhanTheoMa = new Map((dsXacNhan ?? []).map((x) => [x.ma_to_chuc, x]));

  const nvSS = (dsNhanVien ?? []).find((nv) => nv.vai_tro === "ss");
  const maNvDangXem = (await cookies()).get(TEN_COOKIE_MA_NV)?.value;
  const laSS = Boolean(nvSS && maNvDangXem === nvSS.ma_nv);

  // Đơn đầu tiên (sớm nhất) của mỗi khách — do danh sách đã sắp xếp tăng dần theo ngày.
  const donDauTienTheoKhach = new Map<string, DonHangGon>();
  for (const don of donHangToanBo) {
    if (!don.ma_to_chuc) continue;
    if (!donDauTienTheoKhach.has(don.ma_to_chuc)) {
      donDauTienTheoKhach.set(don.ma_to_chuc, don);
    }
  }

  // Khách "code mới" của tháng này = đơn đầu tiên trong lịch sử rơi vào tháng này.
  const ungVien = [...donDauTienTheoKhach.values()]
    .filter((don) => don.ngay_chung_tu >= dauThang && don.ngay_chung_tu < dauThangSau)
    .sort((a, b) => a.ngay_chung_tu.localeCompare(b.ngay_chung_tu));

  const choXuLy = ungVien.filter((don) => !xacNhanTheoMa.has(don.ma_to_chuc!));
  const daXuLy = ungVien
    .filter((don) => xacNhanTheoMa.has(don.ma_to_chuc!))
    .map((don) => ({ don, xacNhan: xacNhanTheoMa.get(don.ma_to_chuc!)! }));

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
            <h1 className="text-xl font-semibold text-slate-900">Xác nhận Code mới</h1>
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
        {loi ? (
          <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Không xử lý được — thiếu thông tin, hoặc bạn không có quyền duyệt Code mới.
          </p>
        ) : null}

        <p className="mb-6 text-sm text-slate-500">
          Danh sách khách hàng có đơn hàng <span className="font-medium text-slate-700">đầu tiên trong lịch sử</span>{" "}
          rơi vào tháng này — đây là các ứng viên Code mới cần xác nhận.
        </p>

        {!laSS ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Chỉ {nvSS?.ten_nv ?? "SS"} mới có quyền Duyệt/Từ chối Code mới. Quay lại màn chọn tên và chọn{" "}
            {nvSS?.ten_nv ?? "SS"} để duyệt.
          </p>
        ) : null}

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Chờ duyệt ({choXuLy.length})
          </h2>
          {choXuLy.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Không có khách hàng nào đang chờ duyệt.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {choXuLy.map((don) => (
                <div
                  key={don.ma_to_chuc}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {tenKhTheoMa.get(don.ma_to_chuc!) ?? don.ma_to_chuc} ({don.ma_to_chuc})
                    </p>
                    <p className="text-xs text-slate-500">
                      NV phụ trách: {tenNvTheoMa.get(don.ma_nv ?? "") ?? don.ma_nv ?? "—"} · Đơn đầu tiên:{" "}
                      {don.ma_chung_tu} ngày {don.ngay_chung_tu}
                    </p>
                  </div>
                  {laSS ? (
                    <div className="flex gap-2">
                      <form action="/api/xac-nhan-code-moi" method="POST">
                        <input type="hidden" name="ma_to_chuc" value={don.ma_to_chuc ?? ""} />
                        <input type="hidden" name="ma_nv" value={don.ma_nv ?? ""} />
                        <input type="hidden" name="ma_chung_tu_dau_tien" value={don.ma_chung_tu} />
                        <input type="hidden" name="ngay_phat_hien" value={don.ngay_chung_tu} />
                        <input type="hidden" name="quyet_dinh" value="da_duyet" />
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500"
                        >
                          Duyệt
                        </button>
                      </form>
                      <form action="/api/xac-nhan-code-moi" method="POST">
                        <input type="hidden" name="ma_to_chuc" value={don.ma_to_chuc ?? ""} />
                        <input type="hidden" name="ma_nv" value={don.ma_nv ?? ""} />
                        <input type="hidden" name="ma_chung_tu_dau_tien" value={don.ma_chung_tu} />
                        <input type="hidden" name="ngay_phat_hien" value={don.ngay_chung_tu} />
                        <input type="hidden" name="quyet_dinh" value="tu_choi" />
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Từ chối
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Đã xử lý tháng này ({daXuLy.length})
          </h2>
          {daXuLy.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Chưa xử lý khách hàng nào.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {daXuLy.map(({ don, xacNhan }) => (
                <div
                  key={don.ma_to_chuc}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {tenKhTheoMa.get(don.ma_to_chuc!) ?? don.ma_to_chuc} ({don.ma_to_chuc})
                    </p>
                    <p className="text-xs text-slate-500">
                      NV phụ trách: {tenNvTheoMa.get(don.ma_nv ?? "") ?? don.ma_nv ?? "—"}
                    </p>
                  </div>
                  <span
                    className={
                      xacNhan.trang_thai === "da_duyet"
                        ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                    }
                  >
                    {xacNhan.trang_thai === "da_duyet" ? "Đã duyệt" : "Đã từ chối"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

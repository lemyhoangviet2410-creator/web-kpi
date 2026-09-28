import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function TrangThongTinKhachHang({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const tuKhoa = (q ?? "").trim();
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("ma_to_chuc, ten_to_chuc, tinh_tp")
    .order("ten_to_chuc", { ascending: true })
    .limit(200);

  if (tuKhoa) {
    query = query.or(`ten_to_chuc.ilike.%${tuKhoa}%,ma_to_chuc.ilike.%${tuKhoa}%`);
  }

  const { data: dsKhachHang } = await query;

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
            <h1 className="text-xl font-semibold text-slate-900">Thông tin khách hàng</h1>
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
        <form action="/thong-tin-khach-hang" method="GET" className="mb-6 flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={tuKhoa}
            placeholder="Tìm theo tên hoặc mã khách hàng..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Tìm
          </button>
        </form>

        {!tuKhoa ? (
          <p className="mb-4 text-xs text-slate-500">
            Gõ tên hoặc mã khách hàng để tìm — đang hiện {dsKhachHang?.length ?? 0} khách hàng gần nhất theo tên.
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(dsKhachHang ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Không tìm thấy khách hàng nào.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(dsKhachHang ?? []).map((kh) => (
                <li key={kh.ma_to_chuc}>
                  <Link
                    href={`/thong-tin-khach-hang/${encodeURIComponent(kh.ma_to_chuc)}`}
                    className="flex items-center justify-between px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{kh.ten_to_chuc}</p>
                      <p className="text-xs text-slate-500">
                        {kh.ma_to_chuc}
                        {kh.tinh_tp ? ` · ${kh.tinh_tp}` : ""}
                      </p>
                    </div>
                    <span className="text-slate-400">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

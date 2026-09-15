import { createClient } from "@/lib/supabase/server";

export default async function TrangVaoWeb({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const { loi } = await searchParams;

  const supabase = await createClient();
  const { data: dsNhanVien } = await supabase
    .from("nhan_vien")
    .select("ma_nv, ten_nv")
    .eq("active", true)
    .order("ten_nv");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Chọn tên và nhập mật khẩu</h1>
        </div>
        <form
          action="/api/vao-web"
          method="POST"
          className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Bạn là</span>
            <select
              name="ma_nv"
              defaultValue=""
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">-- Chỉ xem (sếp / khách), không cần chọn tên --</option>
              {(dsNhanVien ?? []).map((nv) => (
                <option key={nv.ma_nv} value={nv.ma_nv}>
                  {nv.ten_nv} ({nv.ma_nv})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Mật khẩu</span>
            <input
              type="password"
              name="mat_khau"
              required
              autoFocus
              className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          {loi ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Sai mật khẩu, thử lại nhé.
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Vào xem
          </button>
        </form>
      </div>
    </main>
  );
}

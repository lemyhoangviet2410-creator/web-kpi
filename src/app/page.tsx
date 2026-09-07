import { createClient } from "@/lib/supabase/server";

const BANG_CAN_KIEM_TRA = [
  "profiles",
  "customers",
  "products",
  "orders",
  "visits",
  "kpi_targets",
  "focus_products",
  "new_code_confirmations",
] as const;

export default async function Home() {
  const supabase = await createClient();

  const ketQua = await Promise.all(
    BANG_CAN_KIEM_TRA.map(async (ten_bang) => {
      const { count, error } = await supabase
        .from(ten_bang)
        .select("*", { count: "exact", head: true });
      return { ten_bang, count, error: error?.message ?? null };
    })
  );

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Web quản lý KPI — kiểm tra kết nối Supabase</h1>
      <p>Nếu bạn thấy danh sách 8 bảng bên dưới (không có dòng lỗi màu đỏ), nghĩa là web đã kết nối được database thành công.</p>
      <table style={{ borderCollapse: "collapse", marginTop: "1rem" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "4px 12px" }}>Bảng</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "4px 12px" }}>Số dòng</th>
          </tr>
        </thead>
        <tbody>
          {ketQua.map((r) => (
            <tr key={r.ten_bang}>
              <td style={{ padding: "4px 12px" }}>{r.ten_bang}</td>
              <td style={{ padding: "4px 12px", color: r.error ? "crimson" : "inherit" }}>
                {r.error ? `Lỗi: ${r.error}` : r.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NutDangXuat from "@/components/nut-dang-xuat";
import GanMaNhanVien from "@/components/gan-ma-nhan-vien";

function dinhDangTien(so: number) {
  return so.toLocaleString("vi-VN") + " đ";
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: hoSo } = await supabase
    .from("profiles")
    .select("ma_nv")
    .eq("id", user.id)
    .maybeSingle();

  if (!hoSo?.ma_nv) {
    return <GanMaNhanVien userId={user.id} />;
  }

  // Khoảng thời gian: tháng hiện tại (theo ngày chứng từ)
  const homNay = new Date();
  const dauThang = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const dauThangSau = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  const tenThang = `${homNay.getMonth() + 1}/${homNay.getFullYear()}`;

  const [{ data: dsNhanVien }, { data: donHang }, { count: soChiTieu }] = await Promise.all([
    supabase.from("nhan_vien").select("ma_nv, ten_nv").eq("active", true).order("ten_nv"),
    supabase
      .from("orders")
      .select("ma_nv, ma_vu_viec, tong_tien")
      .gte("ngay_chung_tu", dauThang)
      .lt("ngay_chung_tu", dauThangSau),
    supabase.from("kpi_targets").select("*", { count: "exact", head: true }),
  ]);

  // ---- Logic tính KPI hạng mục 1: Doanh số theo kênh ----
  // Kênh xác định qua cột "Mã vụ việc":
  //  - "TH"          => Thầu (trần điểm 120%)
  //  - còn lại       => Kê đơn / Phòng mạch gộp chung (PM, KM, KD-PM, 1KD, MINIAPP, WEB, ONLINE...)
  //    (gộp vì dữ liệu thực tế không tách rõ 2 kênh này bằng 1 mã riêng — theo quyết định của Việt)
  type Tong = { thau: number; keDonPhongMach: number };
  const tongTheoNv = new Map<string, Tong>();

  for (const dong of donHang ?? []) {
    const hienTai = tongTheoNv.get(dong.ma_nv) ?? { thau: 0, keDonPhongMach: 0 };
    if (dong.ma_vu_viec === "TH") {
      hienTai.thau += Number(dong.tong_tien);
    } else {
      hienTai.keDonPhongMach += Number(dong.tong_tien);
    }
    tongTheoNv.set(dong.ma_nv, hienTai);
  }

  const hangMuc = (dsNhanVien ?? []).map((nv) => {
    const t = tongTheoNv.get(nv.ma_nv) ?? { thau: 0, keDonPhongMach: 0 };
    return { ...nv, ...t, tongCong: t.thau + t.keDonPhongMach };
  });

  const tongDoanhThuThau = hangMuc.reduce((s, x) => s + x.thau, 0);
  const tongDoanhThuKdPm = hangMuc.reduce((s, x) => s + x.keDonPhongMach, 0);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.4rem" }}>Doanh số theo kênh — tháng {tenThang}</h1>
        <NutDangXuat />
      </div>

      <p style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.5rem", lineHeight: 1.5 }}>
        Kênh <b>Thầu</b> = các dòng đơn có Mã vụ việc = &quot;TH&quot; (trần điểm 120%).
        <br />
        Kênh <b>Kê đơn / Phòng mạch</b> = gộp tất cả mã vụ việc còn lại (PM, KM, KD-PM, 1KD, MINIAPP, WEB, ONLINE...) vì
        dữ liệu nguồn không có mã riêng tách 2 kênh này (không giới hạn trần).
        <br />
        Các dòng chiết khấu/voucher (mã SP VOCHER-CTBH, số tiền âm) đã được cộng dồn vào doanh số theo đúng dấu của nó.
      </p>

      {!soChiTieu ? (
        <p
          style={{
            background: "#fff8e1",
            border: "1px solid #ffe082",
            padding: "0.6rem 0.8rem",
            borderRadius: 4,
            fontSize: "0.85rem",
            marginTop: "1rem",
          }}
        >
          Chưa có dữ liệu chỉ tiêu KPI tháng này trong hệ thống (bảng kpi_targets đang trống) — bảng dưới đây mới chỉ
          hiển thị <b>doanh số thực tế</b>, chưa tính được % đạt chỉ tiêu. Khi có file chỉ tiêu công ty gửi, sẽ nạp vào
          để tính tiếp %.
        </p>
      ) : null}

      <table style={{ borderCollapse: "collapse", marginTop: "1rem", width: "100%" }}>
        <thead>
          <tr>
            <th style={oThead}>Nhân viên</th>
            <th style={oThead}>Kê đơn / Phòng mạch</th>
            <th style={oThead}>Thầu</th>
            <th style={oThead}>Tổng doanh thu</th>
          </tr>
        </thead>
        <tbody>
          {hangMuc.map((nv) => (
            <tr key={nv.ma_nv}>
              <td style={oTd}>
                {nv.ten_nv} <span style={{ color: "#999" }}>({nv.ma_nv})</span>
              </td>
              <td style={oTd}>{dinhDangTien(nv.keDonPhongMach)}</td>
              <td style={oTd}>{dinhDangTien(nv.thau)}</td>
              <td style={{ ...oTd, fontWeight: 600 }}>{dinhDangTien(nv.tongCong)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...oTd, fontWeight: 700, borderTop: "2px solid #333" }}>Tổng team</td>
            <td style={{ ...oTd, fontWeight: 700, borderTop: "2px solid #333" }}>
              {dinhDangTien(tongDoanhThuKdPm)}
            </td>
            <td style={{ ...oTd, fontWeight: 700, borderTop: "2px solid #333" }}>
              {dinhDangTien(tongDoanhThuThau)}
            </td>
            <td style={{ ...oTd, fontWeight: 700, borderTop: "2px solid #333" }}>
              {dinhDangTien(tongDoanhThuThau + tongDoanhThuKdPm)}
            </td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}

const oThead: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ccc",
  padding: "6px 12px",
  fontSize: "0.85rem",
  color: "#555",
};
const oTd: React.CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid #eee",
  fontSize: "0.9rem",
};

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NutDangXuat from "@/components/nut-dang-xuat";
import GanMaNhanVien from "@/components/gan-ma-nhan-vien";

function dinhDangTien(so: number) {
  return so.toLocaleString("vi-VN") + " đ";
}

function themThang(ngay: Date, soThang: number): Date {
  return new Date(Date.UTC(ngay.getUTCFullYear(), ngay.getUTCMonth() + soThang, ngay.getUTCDate()));
}

// Danh sách "sản phẩm trọng tâm" hiện tại — khớp với cột products.nhom_trong_tam.
// Danh sách này có thể đổi theo quý (xem đề bài mục 2, 15) — khi đổi, cập nhật ở đây và
// trong dữ liệu cột nhom_trong_tam.
const NHOM_SAN_PHAM_TRONG_TAM = ["Fosmitic", "Progermila", "Tranfast"] as const;

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

  // Lấy TOÀN BỘ lịch sử đơn hàng của 3 sản phẩm trọng tâm (không giới hạn theo tháng) để tính
  // hạng mục "Mở mới" — cần biết đúng ngày mua gần nhất trước đó và NV nào đã từng bán cho đúng
  // cặp (khách hàng, nhóm sản phẩm) này. Phân trang vì Supabase giới hạn tối đa 1000 dòng/lần gọi.
  async function layDonHangLichSuChoMoMoi() {
    const KICH_THUOC_TRANG = 1000;
    const ketQua: {
      id: number;
      ma_nv: string | null;
      ma_to_chuc: string | null;
      ngay_chung_tu: string;
      tong_tien: number;
      products: { nhom_trong_tam: string | null } | null;
    }[] = [];
    let trang = 0;
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, ma_nv, ma_to_chuc, ngay_chung_tu, tong_tien, products(nhom_trong_tam)")
        .order("ngay_chung_tu", { ascending: true })
        .order("id", { ascending: true })
        .range(trang * KICH_THUOC_TRANG, trang * KICH_THUOC_TRANG + KICH_THUOC_TRANG - 1);
      if (error || !data || data.length === 0) break;
      ketQua.push(...(data as unknown as (typeof ketQua)));
      if (data.length < KICH_THUOC_TRANG) break;
      trang += 1;
    }
    return ketQua;
  }

  const [{ data: dsNhanVien }, { data: donHang }, donHangToanBo, { count: soChiTieu }] = await Promise.all([
    supabase.from("nhan_vien").select("ma_nv, ten_nv").eq("active", true).order("ten_nv"),
    supabase
      .from("orders")
      .select("ma_nv, ma_vu_viec, tong_tien")
      .gte("ngay_chung_tu", dauThang)
      .lt("ngay_chung_tu", dauThangSau),
    layDonHangLichSuChoMoMoi(),
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

  // ---- Logic tính KPI hạng mục "Mở mới" ----
  // Quy tắc đã chốt với Việt ngày 14/9/2026 (xem đề bài mục 14-15). CHỈ áp dụng cho các sản phẩm
  // thuộc danh sách "sản phẩm trọng tâm" hiện tại (Fosmitic, Progermila, Tranfast — cột
  // products.nhom_trong_tam, danh sách này có thể đổi theo quý). Nhiều mã SP khác nhau của cùng
  // 1 tên thuốc (do đổi mã/quy cách đóng gói theo thời gian) được GỘP LẠI thành 1 qua cột này —
  // vd Fosmitic có cả mã F00550 và TH00940, đều tính là "Fosmitic".
  //
  // Với mỗi cặp (khách hàng, nhóm sản phẩm trọng tâm), xét các đơn hàng theo đúng thứ tự thời
  // gian. 1 đơn được tính "Mở mới" nếu CẢ 2 điều kiện sau đều đúng:
  //  1) Đây là lần mua ĐẦU TIÊN TUYỆT ĐỐI của cặp này (chưa có đơn nào trước đó trong lịch sử),
  //     HOẶC khoảng cách tới lần mua gần nhất trước đó của đúng cặp này > 4 tháng (tính theo
  //     đúng ngày, không phải theo tháng lịch — vd mua 11/1, đến sau 11/5 mới mua lại mới tính).
  //  2) NV đứng đơn lần này CHƯA TỪNG bán đúng nhóm sản phẩm đó cho đúng khách hàng này trước đây
  //     (so với TẤT CẢ NV đã từng bán, không chỉ đơn liền trước) — nếu trùng đúng NV cũ, đơn đó
  //     chỉ tính vào doanh số bình thường, không tính Mở mới cho ai.
  // Nếu trong tháng có nhiều đơn khác nhau đều thỏa 2 điều kiện trên cho cùng 1 cặp, tất cả đều
  // được cộng vào doanh số Mở mới (không giới hạn 1 lần/cặp/tháng).
  // Lưu ý dữ liệu: lịch sử đơn hàng trong hệ thống chỉ có từ 1/10/2025 — với cặp nào có lần mua
  // đầu tiên thật sự trước mốc này, hệ thống sẽ nhầm là "lần đầu tuyệt đối".
  const donHopLe = donHangToanBo.filter(
    (d) => !!d.products?.nhom_trong_tam && d.ma_to_chuc && d.ma_nv
  );

  const theoCapKhNhom = new Map<string, typeof donHopLe>();
  for (const dong of donHopLe) {
    const khoa = `${dong.ma_to_chuc}|${dong.products?.nhom_trong_tam}`;
    const ds = theoCapKhNhom.get(khoa) ?? [];
    ds.push(dong);
    theoCapKhNhom.set(khoa, ds);
  }
  // Mỗi mảng trong theoCapKhNhom đã đúng thứ tự thời gian nhờ câu query .order() ở trên.

  // Chi tiết từng đơn Mở mới hợp lệ trong tháng — dùng để: (a) cộng tổng theo NV, (b) hiển thị
  // rõ NV đó mở được sản phẩm trọng tâm nào (Việt yêu cầu 14/9/2026), (c) bảng chi tiết bên dưới.
  type DonMoMoi = { maNv: string; maToChuc: string; nhom: string; ngay: string; tongTien: number };
  const cacDonMoMoi: DonMoMoi[] = [];

  for (const ds of theoCapKhNhom.values()) {
    const nvDaBan = new Set<string>();
    let ngayTruoc: Date | null = null;

    for (const dong of ds) {
      const maNv = dong.ma_nv as string;
      const nhom = dong.products?.nhom_trong_tam as string;
      const ngayHienTai = new Date(dong.ngay_chung_tu + "T00:00:00Z");
      const laLanDauTuyetDoi = ngayTruoc === null;
      const duKhoangNghi = ngayTruoc !== null && ngayHienTai.getTime() > themThang(ngayTruoc, 4).getTime();
      const nvChuaTungBan = !nvDaBan.has(maNv);

      if ((laLanDauTuyetDoi || duKhoangNghi) && nvChuaTungBan) {
        if (dong.ngay_chung_tu >= dauThang && dong.ngay_chung_tu < dauThangSau) {
          cacDonMoMoi.push({
            maNv,
            maToChuc: dong.ma_to_chuc as string,
            nhom,
            ngay: dong.ngay_chung_tu,
            tongTien: Number(dong.tong_tien),
          });
        }
      }

      nvDaBan.add(maNv);
      ngayTruoc = ngayHienTai;
    }
  }

  type ThongKe = { soDon: number; doanhSo: number };
  const tongMoMoiTheoNv = new Map<
    string,
    { tong: ThongKe; theoNhom: Map<string, ThongKe> }
  >();

  for (const don of cacDonMoMoi) {
    const hienTai = tongMoMoiTheoNv.get(don.maNv) ?? { tong: { soDon: 0, doanhSo: 0 }, theoNhom: new Map() };
    hienTai.tong.soDon += 1;
    hienTai.tong.doanhSo += don.tongTien;
    const nhomHienTai = hienTai.theoNhom.get(don.nhom) ?? { soDon: 0, doanhSo: 0 };
    nhomHienTai.soDon += 1;
    nhomHienTai.doanhSo += don.tongTien;
    hienTai.theoNhom.set(don.nhom, nhomHienTai);
    tongMoMoiTheoNv.set(don.maNv, hienTai);
  }

  const hangMucMoMoi = (dsNhanVien ?? []).map((nv) => {
    const t = tongMoMoiTheoNv.get(nv.ma_nv);
    return {
      ...nv,
      soDonMoMoi: t?.tong.soDon ?? 0,
      doanhSoMoMoi: t?.tong.doanhSo ?? 0,
      theoNhom: NHOM_SAN_PHAM_TRONG_TAM.map((nhom) => ({
        nhom,
        ...(t?.theoNhom.get(nhom) ?? { soDon: 0, doanhSo: 0 }),
      })),
    };
  });

  const tongDoanhSoMoMoi = hangMucMoMoi.reduce((s, x) => s + x.doanhSoMoMoi, 0);
  const tongSoDonMoMoi = hangMucMoMoi.reduce((s, x) => s + x.soDonMoMoi, 0);
  const tongTheoNhomChung = NHOM_SAN_PHAM_TRONG_TAM.map((nhom) => ({
    nhom,
    soDon: hangMucMoMoi.reduce((s, x) => s + (x.theoNhom.find((n) => n.nhom === nhom)?.soDon ?? 0), 0),
    doanhSo: hangMucMoMoi.reduce((s, x) => s + (x.theoNhom.find((n) => n.nhom === nhom)?.doanhSo ?? 0), 0),
  }));

  // Danh sách khách hàng để hiển thị tên trong bảng chi tiết (thay vì chỉ mã tổ chức)
  const maKhCanTra = Array.from(new Set(cacDonMoMoi.map((d) => d.maToChuc)));
  const { data: dsKhachHang } =
    maKhCanTra.length > 0
      ? await supabase.from("customers").select("ma_to_chuc, ten_to_chuc").in("ma_to_chuc", maKhCanTra)
      : { data: [] as { ma_to_chuc: string; ten_to_chuc: string }[] };
  const tenKhTheoMa = new Map((dsKhachHang ?? []).map((kh) => [kh.ma_to_chuc, kh.ten_to_chuc]));
  const tenNvTheoMa = new Map((dsNhanVien ?? []).map((nv) => [nv.ma_nv, nv.ten_nv]));

  const chiTietMoMoi = [...cacDonMoMoi].sort((a, b) => (a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0));

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

      <h2 style={{ fontSize: "1.2rem", marginTop: "2.5rem" }}>Mở mới sản phẩm — tháng {tenThang}</h2>

      <p style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.5rem", lineHeight: 1.5 }}>
        Chỉ áp dụng cho <b>3 sản phẩm trọng tâm hiện tại: Fosmitic, Progermila, Tranfast</b> (danh sách có thể đổi
        theo quý — nhiều mã SP khác nhau của cùng 1 tên thuốc được gộp làm 1 khi xét).
        <br />
        <b>Mở mới</b> = khách hàng mua lại 1 trong 3 sản phẩm này sau khi đã <b>quá 4 tháng</b> (tính theo đúng ngày
        mua gần nhất, không theo tháng lịch) không mua — hoặc đây là lần đầu tiên khách mua sản phẩm đó — <b>và</b>{" "}
        NV đứng đơn lần này <b>chưa từng bán đúng sản phẩm đó cho đúng khách hàng này trước đây</b>. Nếu vẫn là NV cũ
        đứng đơn, đơn đó chỉ tính vào doanh số, không tính Mở mới (trần điểm 150%).
        <br />
        Dữ liệu lịch sử trong hệ thống chỉ có từ 1/10/2025 nên với các cặp mua lần đầu thật sự trước mốc này, hệ
        thống có thể nhầm là &quot;lần đầu tuyệt đối&quot;.
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
          hiển thị <b>doanh số Mở mới thực tế</b>, chưa tính được % đạt chỉ tiêu (trần 150%).
        </p>
      ) : null}

      <table style={{ borderCollapse: "collapse", marginTop: "1rem", width: "100%" }}>
        <thead>
          <tr>
            <th style={oThead}>Nhân viên</th>
            {NHOM_SAN_PHAM_TRONG_TAM.map((nhom) => (
              <th key={nhom} style={oThead}>
                {nhom}
              </th>
            ))}
            <th style={oThead}>Tổng số đơn</th>
            <th style={oThead}>Tổng doanh số</th>
          </tr>
        </thead>
        <tbody>
          {hangMucMoMoi.map((nv) => (
            <tr key={nv.ma_nv}>
              <td style={oTd}>
                {nv.ten_nv} <span style={{ color: "#999" }}>({nv.ma_nv})</span>
              </td>
              {nv.theoNhom.map((n) => (
                <td style={oTd} key={n.nhom}>
                  {n.soDon > 0 ? `${n.soDon} (${dinhDangTien(n.doanhSo)})` : "–"}
                </td>
              ))}
              <td style={oTd}>{nv.soDonMoMoi}</td>
              <td style={{ ...oTd, fontWeight: 600 }}>{dinhDangTien(nv.doanhSoMoMoi)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...oTd, fontWeight: 700, borderTop: "2px solid #333" }}>Tổng team</td>
            {tongTheoNhomChung.map((n) => (
              <td style={{ ...oTd, fontWeight: 700, borderTop: "2px solid #333" }} key={n.nhom}>
                {n.soDon > 0 ? `${n.soDon} (${dinhDangTien(n.doanhSo)})` : "–"}
              </td>
            ))}
            <td style={{ ...oTd, fontWeight: 700, borderTop: "2px solid #333" }}>{tongSoDonMoMoi}</td>
            <td style={{ ...oTd, fontWeight: 700, borderTop: "2px solid #333" }}>
              {dinhDangTien(tongDoanhSoMoMoi)}
            </td>
          </tr>
        </tfoot>
      </table>

      {chiTietMoMoi.length > 0 ? (
        <details style={{ marginTop: "1rem" }}>
          <summary style={{ fontSize: "0.85rem", color: "#555", cursor: "pointer" }}>
            Xem chi tiết từng đơn Mở mới ({chiTietMoMoi.length} đơn)
          </summary>
          <table style={{ borderCollapse: "collapse", marginTop: "0.75rem", width: "100%" }}>
            <thead>
              <tr>
                <th style={oThead}>Ngày</th>
                <th style={oThead}>Nhân viên</th>
                <th style={oThead}>Khách hàng</th>
                <th style={oThead}>Sản phẩm</th>
                <th style={oThead}>Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {chiTietMoMoi.map((don, i) => (
                <tr key={i}>
                  <td style={oTd}>{don.ngay}</td>
                  <td style={oTd}>
                    {tenNvTheoMa.get(don.maNv) ?? don.maNv} <span style={{ color: "#999" }}>({don.maNv})</span>
                  </td>
                  <td style={oTd}>
                    {tenKhTheoMa.get(don.maToChuc) ?? don.maToChuc}{" "}
                    <span style={{ color: "#999" }}>({don.maToChuc})</span>
                  </td>
                  <td style={oTd}>{don.nhom}</td>
                  <td style={oTd}>{dinhDangTien(don.tongTien)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
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

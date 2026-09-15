import { createClient } from "@/lib/supabase/server";
import NutDangXuat from "@/components/nut-dang-xuat";
import ChonNhanVienXemKpi from "@/components/chon-nhan-vien-xem-kpi";
import { NHOM_SAN_PHAM_TRONG_TAM } from "@/lib/sptt";

function themThang(ngay: Date, soThang: number): Date {
  return new Date(Date.UTC(ngay.getUTCFullYear(), ngay.getUTCMonth() + soThang, ngay.getUTCDate()));
}

export default async function Home() {
  const supabase = await createClient();

  // Khoảng thời gian: tháng hiện tại (theo ngày chứng từ)
  const homNay = new Date();
  const dauThang = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const dauThangSau = new Date(Date.UTC(homNay.getFullYear(), homNay.getMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  const tenThang = `${homNay.getMonth() + 1}/${homNay.getFullYear()}`;

  // Lấy TOÀN BỘ lịch sử đơn hàng của các sản phẩm trọng tâm (không giới hạn theo tháng) để tính
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
      so_luong: number | null;
      ma_vu_viec: string | null;
      products: { nhom_trong_tam: string | null; san_pham_thi_truong: string | null } | null;
    }[] = [];
    let trang = 0;
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, ma_nv, ma_to_chuc, ngay_chung_tu, tong_tien, so_luong, ma_vu_viec, products(nhom_trong_tam, san_pham_thi_truong)")
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

  const [
    { data: dsNhanVien },
    { data: donHang },
    donHangToanBo,
    { count: soChiTieu },
    { data: mucTieuDuyTri },
    { data: donHangSoLuongThangNay },
    { data: mucTieuDoanhSo },
    { data: mucTieuMoMoi },
    { data: mucTieuCodeMoi },
    { data: codeMoiDaDuyet },
    { data: nhanSuThucHien },
  ] = await Promise.all([
    supabase.from("nhan_vien").select("ma_nv, ten_nv, vai_tro").eq("active", true).order("ten_nv"),
    supabase
      .from("orders")
      .select("ma_nv, ma_vu_viec, tong_tien")
      .gte("ngay_chung_tu", dauThang)
      .lt("ngay_chung_tu", dauThangSau),
    layDonHangLichSuChoMoMoi(),
    supabase.from("kpi_targets").select("*", { count: "exact", head: true }),
    supabase
      .from("kpi_targets")
      .select("ma_nv, ma_to_chuc, ma_sp, chi_tieu, diem_kh, customers(ten_to_chuc), products(nhom_trong_tam)")
      .eq("loai_kpi", "duy_tri")
      .eq("thang", dauThang),
    supabase
      .from("orders")
      .select("ma_nv, ma_to_chuc, ma_vu_viec, so_luong, products(nhom_trong_tam)")
      .gte("ngay_chung_tu", dauThang)
      .lt("ngay_chung_tu", dauThangSau),
    supabase
      .from("kpi_targets")
      .select("ma_nv, loai_kpi, chi_tieu, diem_kh")
      .in("loai_kpi", ["ke_don_phong_mach", "thau"])
      .eq("thang", dauThang),
    supabase
      .from("kpi_targets")
      .select("ma_nv, chi_tieu, diem_kh, products(nhom_trong_tam)")
      .eq("loai_kpi", "mo_moi")
      .eq("thang", dauThang),
    supabase
      .from("kpi_targets")
      .select("ma_nv, chi_tieu, diem_kh")
      .eq("loai_kpi", "code_moi")
      .eq("thang", dauThang),
    supabase
      .from("new_code_confirmations")
      .select("ma_nv")
      .eq("trang_thai", "da_duyet")
      .gte("ngay_duyet", dauThang)
      .lt("ngay_duyet", dauThangSau),
    supabase.from("nhan_su_thuc_hien").select("ma_nv, tuyen_moi_th").eq("thang", dauThang),
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

  // Chỉ tiêu doanh số (VNĐ) + điểm KH nạp từ file KPI công ty — xem skill kpi-analyst Phần 3: DS
  // Kê đơn+Phòng mạch không giới hạn trần, DS Thầu trần 120%.
  const chiTieuKdPmTheoNv = new Map<string, number>();
  const chiTieuThauTheoNv = new Map<string, number>();
  const diemKhKdPmTheoNv = new Map<string, number>();
  const diemKhThauTheoNv = new Map<string, number>();
  for (const mt of mucTieuDoanhSo ?? []) {
    if (mt.loai_kpi === "ke_don_phong_mach") {
      chiTieuKdPmTheoNv.set(mt.ma_nv, Number(mt.chi_tieu));
      diemKhKdPmTheoNv.set(mt.ma_nv, Number(mt.diem_kh ?? 0));
    }
    if (mt.loai_kpi === "thau") {
      chiTieuThauTheoNv.set(mt.ma_nv, Number(mt.chi_tieu));
      diemKhThauTheoNv.set(mt.ma_nv, Number(mt.diem_kh ?? 0));
    }
  }

  const hangMuc = (dsNhanVien ?? []).map((nv) => {
    const t = tongTheoNv.get(nv.ma_nv) ?? { thau: 0, keDonPhongMach: 0 };
    const chiTieuKdPm = chiTieuKdPmTheoNv.get(nv.ma_nv) ?? 0;
    const chiTieuThau = chiTieuThauTheoNv.get(nv.ma_nv) ?? 0;
    const diemKhKdPm = diemKhKdPmTheoNv.get(nv.ma_nv) ?? 0;
    const diemKhThau = diemKhThauTheoNv.get(nv.ma_nv) ?? 0;
    const tiLeKdPm = chiTieuKdPm > 0 ? t.keDonPhongMach / chiTieuKdPm : null;
    const tiLeThau = chiTieuThau > 0 ? t.thau / chiTieuThau : null;
    return {
      ...nv,
      ...t,
      tongCong: t.thau + t.keDonPhongMach,
      chiTieuKdPm,
      chiTieuThau,
      phanTramKdPm: tiLeKdPm !== null ? tiLeKdPm * 100 : null,
      phanTramThau: tiLeThau !== null ? Math.min(tiLeThau, 1.2) * 100 : null,
      diemKhKdPm,
      diemThKdPm: tiLeKdPm !== null ? tiLeKdPm * diemKhKdPm : 0,
      diemKhThau,
      diemThThau: tiLeThau !== null ? Math.min(tiLeThau, 1.2) * diemKhThau : 0,
    };
  });

  // ---- Logic tính KPI hạng mục "Mở mới" ----
  // Quy tắc chuẩn theo skill mo-moi-sptt (đối chiếu với Việt ngày 14/9/2026, xem đề bài mục
  // 14-15). CHỈ áp dụng cho các sản phẩm thuộc danh sách "sản phẩm trọng tâm" hiện tại (Fosmitic,
  // Progermila, Tranfast — cột products.nhom_trong_tam, danh sách này có thể đổi theo quý). Nhiều
  // mã SP khác nhau của cùng 1 tên thuốc (do đổi mã/quy cách đóng gói theo thời gian) được GỘP LẠI
  // thành 1 qua cột này — vd Fosmitic có cả mã F00550 và TH00940, đều tính là "Fosmitic".
  //
  // Đơn vị xét là cặp (khách hàng, nhóm sản phẩm trọng tâm, KÊNH) — cùng khách cùng sản phẩm nhưng
  // bán qua kênh khác (Thầu vs Kê đơn/Phòng mạch) vẫn là 1 cặp mới, tính Mở mới riêng (skill
  // mo-moi-sptt: "KH B đã mua SP A kênh KD trước đây, nay mua SP A kênh PM → vẫn tính MM").
  //
  // Với mỗi cặp, xét các đơn hàng theo đúng thứ tự thời gian. 1 đơn được tính "Mở mới" nếu CẢ 2
  // điều kiện sau đều đúng:
  //  1) Đây là lần mua ĐẦU TIÊN TUYỆT ĐỐI của cặp này (chưa có đơn nào trước đó trong lịch sử),
  //     HOẶC khoảng cách tới lần mua gần nhất trước đó của đúng cặp này > 4 tháng (tính theo
  //     đúng ngày, không phải theo tháng lịch — vd mua 11/1, đến sau 11/5 mới mua lại mới tính).
  //  2) NV đứng đơn lần này CHƯA TỪNG bán đúng nhóm sản phẩm đó, qua đúng kênh đó, cho đúng khách
  //     hàng này trước đây (so với TẤT CẢ NV đã từng bán, không chỉ đơn liền trước) — nếu trùng
  //     đúng NV cũ, đơn đó chỉ tính vào doanh số bình thường, không tính Mở mới cho ai.
  // Nếu trong tháng có nhiều đơn khác nhau đều thỏa 2 điều kiện trên cho cùng 1 cặp, tất cả đều
  // được cộng vào doanh số Mở mới (không giới hạn 1 lần/cặp/tháng).
  // Lưu ý dữ liệu: lịch sử đơn hàng trong hệ thống chỉ có từ 1/10/2025 — với cặp nào có lần mua
  // đầu tiên thật sự trước mốc này, hệ thống sẽ nhầm là "lần đầu tuyệt đối".
  function xacDinhKenh(maVuViec: string | null): "Thầu" | "Kê đơn/Phòng mạch" {
    return maVuViec === "TH" ? "Thầu" : "Kê đơn/Phòng mạch";
  }

  // Đơn khách hàng web / đơn online (Việt yêu cầu 14/9/2026): KHÔNG tính vào Mở mới/Duy trì,
  // chỉ tính vào doanh số theo kênh (donHang ở trên không lọc các mã này).
  const MA_VU_VIEC_WEB_ONLINE = new Set(["WEB", "ONLINE"]);

  const donHopLe = donHangToanBo.filter(
    (d) =>
      !!d.products?.nhom_trong_tam &&
      d.ma_to_chuc &&
      d.ma_nv &&
      !MA_VU_VIEC_WEB_ONLINE.has(d.ma_vu_viec ?? "")
  );

  const theoCapKhNhom = new Map<string, typeof donHopLe>();
  for (const dong of donHopLe) {
    const khoa = `${dong.ma_to_chuc}|${dong.products?.nhom_trong_tam}|${xacDinhKenh(dong.ma_vu_viec)}`;
    const ds = theoCapKhNhom.get(khoa) ?? [];
    ds.push(dong);
    theoCapKhNhom.set(khoa, ds);
  }
  // Mỗi mảng trong theoCapKhNhom đã đúng thứ tự thời gian nhờ câu query .order() ở trên.

  // Chi tiết từng đơn Mở mới hợp lệ trong tháng — dùng để: (a) cộng tổng theo NV, (b) hiển thị
  // rõ NV đó mở được sản phẩm trọng tâm nào (Việt yêu cầu 14/9/2026), (c) bảng chi tiết bên dưới.
  type DonMoMoi = {
    maNv: string;
    maToChuc: string;
    nhom: string;
    kenh: string;
    ngay: string;
    tongTien: number;
    soLuong: number;
  };
  const cacDonMoMoi: DonMoMoi[] = [];

  for (const ds of theoCapKhNhom.values()) {
    const nvDaBan = new Set<string>();
    let ngayTruoc: Date | null = null;

    for (const dong of ds) {
      const maNv = dong.ma_nv as string;
      const nhom = dong.products?.nhom_trong_tam as string;
      const kenh = xacDinhKenh(dong.ma_vu_viec);
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
            kenh,
            ngay: dong.ngay_chung_tu,
            tongTien: Number(dong.tong_tien),
            soLuong: Number(dong.so_luong ?? 0),
          });
        }
      }

      nvDaBan.add(maNv);
      ngayTruoc = ngayHienTai;
    }
  }

  // ---- "Sản phẩm thị trường" (chỉ tiêu Mở mới riêng cho NV thử việc) ----
  // Danh sách 2 sản phẩm được phép chọn (OR) cho từng NV thử việc — lấy từ sheet "Chi tiết SP Thị
  // Trường T9" tháng 9/2026. Đây là 1 nhóm SP HOÀN TOÀN KHÁC 7 SPTT (Mucome Baby Spray, Bixazol,
  // Liproin, Viên đặt pH.Balance — cột products.san_pham_thi_truong), mỗi NV thử việc chỉ cần mở
  // mới 1 khách hàng ở MỘT TRONG 2 sản phẩm được giao là đạt chỉ tiêu. Danh sách này gắn với người
  // + tháng cụ thể trong file công ty — cần cập nhật lại nếu công ty đổi sản phẩm giao hoặc có NV
  // thử việc mới. SS (016328) cũng có 50 điểm SP thị trường riêng nhưng KHÔNG có breakdown sản
  // phẩm/khách hàng cụ thể trong file nên không tính được thực hiện cho phần đó (xem ghi chú ở
  // khối "KPI của SS = KPI của cả nhóm" phía dưới).
  const NHOM_SP_THI_TRUONG_THEO_NV: Record<string, string[]> = {
    "020143": ["Mucome Baby Spray", "Bixazol"], // Nguyễn Anh Đức
    "020336": ["Mucome Baby Spray", "Bixazol"], // Phạm Minh Diệp
    "020044": ["Liproin", "Viên đặt pH.Balance"], // Đặng Hà Giang
  };
  const DIEM_KH_SP_THI_TRUONG_MOI_NGUOI = 200; // điểm KH mỗi NV thử việc — từ file công ty

  const donHopLeSpThiTruong = donHangToanBo.filter(
    (d) =>
      !!d.products?.san_pham_thi_truong &&
      d.ma_to_chuc &&
      d.ma_nv &&
      d.ma_vu_viec !== "TH" &&
      !MA_VU_VIEC_WEB_ONLINE.has(d.ma_vu_viec ?? "")
  );
  const theoCapKhNhomSpThiTruong = new Map<string, typeof donHopLeSpThiTruong>();
  for (const dong of donHopLeSpThiTruong) {
    const khoa = `${dong.ma_to_chuc}|${dong.products?.san_pham_thi_truong}`;
    const ds = theoCapKhNhomSpThiTruong.get(khoa) ?? [];
    ds.push(dong);
    theoCapKhNhomSpThiTruong.set(khoa, ds);
  }

  const soKhachMoiSpThiTruongTheoNv = new Map<string, Set<string>>(); // ma_nv -> set ma_to_chuc đạt

  for (const ds of theoCapKhNhomSpThiTruong.values()) {
    const nvDaBan = new Set<string>();
    let ngayTruoc: Date | null = null;

    for (const dong of ds) {
      const maNv = dong.ma_nv as string;
      const nhom = dong.products?.san_pham_thi_truong as string;
      const ngayHienTai = new Date(dong.ngay_chung_tu + "T00:00:00Z");
      const laLanDauTuyetDoi = ngayTruoc === null;
      const duKhoangNghi = ngayTruoc !== null && ngayHienTai.getTime() > themThang(ngayTruoc, 4).getTime();
      const nvChuaTungBan = !nvDaBan.has(maNv);

      if ((laLanDauTuyetDoi || duKhoangNghi) && nvChuaTungBan) {
        if (dong.ngay_chung_tu >= dauThang && dong.ngay_chung_tu < dauThangSau) {
          const nhomChoPhep = NHOM_SP_THI_TRUONG_THEO_NV[maNv];
          if (nhomChoPhep?.includes(nhom)) {
            const ds2 = soKhachMoiSpThiTruongTheoNv.get(maNv) ?? new Set<string>();
            ds2.add(dong.ma_to_chuc as string);
            soKhachMoiSpThiTruongTheoNv.set(maNv, ds2);
          }
        }
      }

      nvDaBan.add(maNv);
      ngayTruoc = ngayHienTai;
    }
  }

  const hangMucSpThiTruong = Object.keys(NHOM_SP_THI_TRUONG_THEO_NV).map((maNv) => {
    const soKhachDat = soKhachMoiSpThiTruongTheoNv.get(maNv)?.size ?? 0;
    const tiLe = Math.min(soKhachDat / 1, 1.5); // chỉ tiêu luôn là 1 khách mới/người
    return {
      ma_nv: maNv,
      soKhachDat,
      chiTieu: 1,
      diemKh: DIEM_KH_SP_THI_TRUONG_MOI_NGUOI,
      phanTram: tiLe * 100,
      diemTh: tiLe * DIEM_KH_SP_THI_TRUONG_MOI_NGUOI,
    };
  });

  type ThongKe = { soDon: number; doanhSo: number };
  const tongMoMoiTheoNv = new Map<
    string,
    { tong: ThongKe; theoNhom: Map<string, ThongKe> }
  >();

  // Số khách hàng mới ĐẠT (distinct, không đếm trùng khi 1 khách có nhiều đơn Mở mới hợp lệ
  // trong tháng) theo (NV, nhóm SP) — dùng để so với chỉ tiêu "số khách mới cần mở" (mo_moi
  // trong kpi_targets). Công thức skill kpi-analyst Phần 3: min(số_khách_đạt/sl_kh, 1.5) × điểm.
  const khachMoiTheoKhoa = new Map<string, Set<string>>();
  for (const don of cacDonMoMoi) {
    const khoa = `${don.maNv}|${don.nhom}`;
    const ds = khachMoiTheoKhoa.get(khoa) ?? new Set<string>();
    ds.add(don.maToChuc);
    khachMoiTheoKhoa.set(khoa, ds);
  }

  type MucTieuMoMoi = {
    ma_nv: string;
    chi_tieu: number;
    diem_kh: number | null;
    products: { nhom_trong_tam: string | null } | null;
  };
  const chiTieuMoMoiTheoKhoa = new Map<string, number>();
  const diemKhMoMoiTheoKhoa = new Map<string, number>();
  for (const mt of (mucTieuMoMoi ?? []) as unknown as MucTieuMoMoi[]) {
    const nhom = mt.products?.nhom_trong_tam;
    if (!nhom) continue;
    const khoa = `${mt.ma_nv}|${nhom}`;
    chiTieuMoMoiTheoKhoa.set(khoa, (chiTieuMoMoiTheoKhoa.get(khoa) ?? 0) + Number(mt.chi_tieu));
    diemKhMoMoiTheoKhoa.set(khoa, (diemKhMoMoiTheoKhoa.get(khoa) ?? 0) + Number(mt.diem_kh ?? 0));
  }

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
      theoNhom: NHOM_SAN_PHAM_TRONG_TAM.map((nhom) => {
        const khoa = `${nv.ma_nv}|${nhom}`;
        const soKhachDat = khachMoiTheoKhoa.get(khoa)?.size ?? 0;
        const chiTieu = chiTieuMoMoiTheoKhoa.get(khoa) ?? 0;
        const diemKh = diemKhMoMoiTheoKhoa.get(khoa) ?? 0;
        const tiLe = chiTieu > 0 ? soKhachDat / chiTieu : null;
        return {
          nhom,
          ...(t?.theoNhom.get(nhom) ?? { soDon: 0, doanhSo: 0 }),
          soKhachDat,
          chiTieuSoKhach: chiTieu,
          phanTram: tiLe !== null ? Math.min(tiLe, 1.5) * 100 : null,
          diemKh,
          diemTh: tiLe !== null ? Math.min(tiLe, 1.5) * diemKh : 0,
        };
      }),
    };
  });

  // Danh sách khách hàng để hiển thị tên trong bảng chi tiết (thay vì chỉ mã tổ chức)
  const maKhCanTra = Array.from(new Set(cacDonMoMoi.map((d) => d.maToChuc)));
  const { data: dsKhachHang } =
    maKhCanTra.length > 0
      ? await supabase.from("customers").select("ma_to_chuc, ten_to_chuc").in("ma_to_chuc", maKhCanTra)
      : { data: [] as { ma_to_chuc: string; ten_to_chuc: string }[] };
  const tenKhTheoMa = new Map((dsKhachHang ?? []).map((kh) => [kh.ma_to_chuc, kh.ten_to_chuc]));

  const chiTietMoMoi = [...cacDonMoMoi].sort((a, b) => (a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0));

  // ---- Logic tính KPI hạng mục "Duy trì" ----
  // Theo skill kpi-analyst (Phần 0-3, Bước 4): Duy trì tính theo sản lượng (số lượng, không phải
  // tiền) mỗi NV bán được cho từng nhóm sản phẩm trọng tâm, đối chiếu với sản lượng mục tiêu nạp
  // qua bảng kpi_targets (loai_kpi='duy_tri', chi_tieu = sản lượng mục tiêu). % đạt = min(TH/KH,
  // 1) — trần 100% (không có "vượt" cho Duy trì, khác với Mở mới). Bước 4 của skill so khớp CHỈ
  // theo (Mã nhân viên, nhóm SP) — không lọc theo kênh — nên khi công ty giao chỉ tiêu tách riêng
  // Kê đơn/Phòng mạch cho cùng 1 SP, phải cộng gộp 2 dòng đó lại trước khi nạp vào chi_tieu.
  // Nếu công ty có giao khách hàng mục tiêu cụ thể (ma_to_chuc khác NULL trong kpi_targets) thì
  // đối chiếu đúng khách đó; nếu không (đa số trường hợp hiện tại — team chưa có breakdown theo
  // từng khách trong file chỉ tiêu) thì đối chiếu tổng sản lượng của NV đó cho nhóm SP đó, gộp mọi
  // khách hàng trong tháng.
  type DonSoLuongDuyTri = {
    ma_nv: string | null;
    ma_to_chuc: string | null;
    ma_vu_viec: string | null;
    so_luong: number | null;
    products: { nhom_trong_tam: string | null } | null;
  };
  type MucTieuDuyTri = {
    ma_nv: string;
    ma_to_chuc: string | null;
    ma_sp: string | null;
    chi_tieu: number;
    diem_kh: number | null;
    customers: { ten_to_chuc: string } | null;
    products: { nhom_trong_tam: string | null } | null;
  };

  const soLuongTheoKhachDuyTri = new Map<string, number>();
  const soLuongTheoNvNhomDuyTri = new Map<string, number>();
  for (const dong of (donHangSoLuongThangNay ?? []) as unknown as DonSoLuongDuyTri[]) {
    const nhom = dong.products?.nhom_trong_tam;
    if (!nhom || !dong.ma_nv || MA_VU_VIEC_WEB_ONLINE.has(dong.ma_vu_viec ?? "")) continue;
    const soLuong = Number(dong.so_luong ?? 0);
    const khoaNvNhom = `${dong.ma_nv}|${nhom}`;
    soLuongTheoNvNhomDuyTri.set(khoaNvNhom, (soLuongTheoNvNhomDuyTri.get(khoaNvNhom) ?? 0) + soLuong);
    if (dong.ma_to_chuc) {
      const khoaKhach = `${dong.ma_nv}|${dong.ma_to_chuc}|${nhom}`;
      soLuongTheoKhachDuyTri.set(khoaKhach, (soLuongTheoKhachDuyTri.get(khoaKhach) ?? 0) + soLuong);
    }
  }

  const chiTietDuyTri = ((mucTieuDuyTri ?? []) as unknown as MucTieuDuyTri[]).map((mt) => {
    const nhom = mt.products?.nhom_trong_tam ?? mt.ma_sp ?? "—";
    const th = mt.ma_to_chuc
      ? soLuongTheoKhachDuyTri.get(`${mt.ma_nv}|${mt.ma_to_chuc}|${nhom}`) ?? 0
      : soLuongTheoNvNhomDuyTri.get(`${mt.ma_nv}|${nhom}`) ?? 0;
    const kh = Number(mt.chi_tieu);
    const tiLe = kh > 0 ? th / kh : 0;
    const phanTram = Math.min(tiLe, 1) * 100;
    const diemKh = Number(mt.diem_kh ?? 0);
    return {
      maNv: mt.ma_nv,
      tenKh: mt.customers?.ten_to_chuc ?? mt.ma_to_chuc ?? "Toàn bộ khách hàng",
      maToChuc: mt.ma_to_chuc,
      nhom,
      th,
      kh,
      phanTram,
      dat: phanTram >= 100,
      diemKh,
      diemTh: Math.min(tiLe, 1) * diemKh,
    };
  });

  type TongKetDuyTri = { tongKhachMucTieu: number; soKhachDat: number };
  const tongKetDuyTriTheoNv = new Map<string, TongKetDuyTri>();
  for (const ct of chiTietDuyTri) {
    const hienTai = tongKetDuyTriTheoNv.get(ct.maNv) ?? { tongKhachMucTieu: 0, soKhachDat: 0 };
    hienTai.tongKhachMucTieu += 1;
    if (ct.dat) hienTai.soKhachDat += 1;
    tongKetDuyTriTheoNv.set(ct.maNv, hienTai);
  }

  const hangMucDuyTri = (dsNhanVien ?? []).map((nv) => {
    const t = tongKetDuyTriTheoNv.get(nv.ma_nv) ?? { tongKhachMucTieu: 0, soKhachDat: 0 };
    return {
      ...nv,
      ...t,
      tyLeDat: t.tongKhachMucTieu > 0 ? (t.soKhachDat / t.tongKhachMucTieu) * 100 : 0,
    };
  });

  // ---- Code mới ----
  // Chỉ tiêu (chi_tieu = số mã KH mới cần mở, diem_kh) nạp từ file KPI công ty — chỉ những NV có
  // dòng loai_kpi='code_moi' mới bị áp chỉ tiêu này (đa số NV không bị áp tháng này). Thực hiện
  // lấy từ bảng new_code_confirmations (trang_thai='da_duyet') — bảng này dùng cho quy trình xác
  // nhận code mới, hiện chưa có ai nhập nên TH sẽ là 0 cho tới khi quy trình đó được dùng.
  const chiTieuCodeMoiTheoNv = new Map<string, number>();
  const diemKhCodeMoiTheoNv = new Map<string, number>();
  for (const mt of mucTieuCodeMoi ?? []) {
    chiTieuCodeMoiTheoNv.set(mt.ma_nv, Number(mt.chi_tieu));
    diemKhCodeMoiTheoNv.set(mt.ma_nv, Number(mt.diem_kh ?? 0));
  }
  const thCodeMoiTheoNv = new Map<string, number>();
  for (const dong of codeMoiDaDuyet ?? []) {
    thCodeMoiTheoNv.set(dong.ma_nv, (thCodeMoiTheoNv.get(dong.ma_nv) ?? 0) + 1);
  }

  const hangMucCodeMoi = (dsNhanVien ?? []).map((nv) => {
    const chiTieu = chiTieuCodeMoiTheoNv.get(nv.ma_nv) ?? 0;
    const diemKh = diemKhCodeMoiTheoNv.get(nv.ma_nv) ?? 0;
    const th = thCodeMoiTheoNv.get(nv.ma_nv) ?? 0;
    const tiLe = chiTieu > 0 ? th / chiTieu : null;
    return {
      ...nv,
      apDung: chiTieu > 0,
      chiTieu,
      th,
      phanTram: tiLe !== null ? tiLe * 100 : null,
      diemKh,
      diemTh: tiLe !== null ? tiLe * diemKh : 0,
    };
  });

  // ---- KPI của SS = KPI của cả nhóm ----
  // Việt xác nhận 14-15/9/2026: KPI "cả nhóm" chính là dòng KPI của SS, KHÔNG PHẢI đơn hàng cá nhân
  // của SS — VÀ tổng điểm KẾ HOẠCH của SS (hay cả nhóm) luôn luôn đúng 1000 điểm, không hơn, giống
  // hệt mọi nhân viên khác (đây là 1 bộ 1000 điểm ĐỘC LẬP của riêng SS, không phải phép cộng dồn
  // 1000 điểm của từng người trong team). Vì vậy:
  //  - Kế hoạch (Đ.KH) mỗi hạng mục của SS LUÔN LÀ số trong đúng dòng KPI riêng của SS trong file
  //    công ty (KHÔNG cộng dồn từ chỉ tiêu của từng NV) — xem hằng số DIEM_KH_SS_RIENG bên dưới.
  //  - Thực hiện (TH) mỗi hạng mục của SS = TỔNG thực hiện của TẤT CẢ nhân viên trong team (kể cả
  //    đơn hàng/hoạt động cá nhân của SS, nếu có) — đúng công thức skill kpi-analyst: "DS của SS =
  //    tổng Thực hiện 9 TDV + Thực hiện cá nhân của SS", áp dụng tương tự cho SPTT/Code mới. Vì KH
  //    giữ nguyên nhỏ trong khi TH cộng dồn cả team nên % có thể vượt xa 100% — đây là điều bình
  //    thường (giống cách DS Kê đơn/Phòng mạch không giới hạn trần).
  const DIEM_KH_SS_RIENG = { codeMoi: 100, sptt: 550, spThiTruong: 50 }; // từ đúng dòng KPI riêng của SS, file tháng 9/2026 — cập nhật lại mỗi tháng
  const teamKdPmTh = hangMuc.reduce((s, x) => s + x.keDonPhongMach, 0);
  const teamThauTh = hangMuc.reduce((s, x) => s + x.thau, 0);
  // Bảng hiển thị top-level (Mở mới/Duy trì) cho SS vẫn dùng số lượng khách/doanh số cộng dồn cả
  // team để xem tổng quan hoạt động — KHÔNG liên quan tới cách tính điểm SPTT của riêng SS ở dưới.
  const teamTheoNhomSptt = NHOM_SAN_PHAM_TRONG_TAM.map((nhom) => {
    const soKhachDat = hangMucMoMoi.reduce((s, x) => s + (x.theoNhom.find((n) => n.nhom === nhom)?.soKhachDat ?? 0), 0);
    const chiTieuSoKhach = hangMucMoMoi.reduce(
      (s, x) => s + (x.theoNhom.find((n) => n.nhom === nhom)?.chiTieuSoKhach ?? 0),
      0
    );
    const soDon = hangMucMoMoi.reduce((s, x) => s + (x.theoNhom.find((n) => n.nhom === nhom)?.soDon ?? 0), 0);
    const doanhSo = hangMucMoMoi.reduce((s, x) => s + (x.theoNhom.find((n) => n.nhom === nhom)?.doanhSo ?? 0), 0);
    const tiLe = chiTieuSoKhach > 0 ? soKhachDat / chiTieuSoKhach : null;
    const phanTram = tiLe !== null ? Math.min(tiLe, 1.5) * 100 : null;
    // diemKh/diemTh không dùng cho SS nữa (xem chiTietDiemSpttSS) — giữ =0 chỉ để khớp kiểu dữ liệu.
    return { nhom, soDon, doanhSo, soKhachDat, chiTieuSoKhach, phanTram, diemKh: 0, diemTh: 0 };
  });
  const teamDuyTriDat = hangMucDuyTri.reduce((s, x) => s + x.soKhachDat, 0);
  const teamDuyTriTong = hangMucDuyTri.reduce((s, x) => s + x.tongKhachMucTieu, 0);
  const teamThCodeMoi = hangMucCodeMoi.reduce((s, x) => s + x.th, 0);

  // ---- Điểm SPTT của riêng SS — tính theo ĐÚNG 9 dòng chỉ tiêu riêng của SS (Việt xác nhận
  // 15/9/2026) ----
  // KHÔNG dùng điểm đã tính sẵn của từng TDV (khác thang điểm — mỗi TDV có bộ 1000 điểm riêng).
  // Mỗi dòng của SS có 1 "Sản lượng KH" (chỉ tiêu SẢN LƯỢNG, không phải số khách) + 1 Điểm KH riêng
  // — lấy từ sheet "Chi tiết SPTT T9", cộng gộp 2 dòng Kê đơn+Phòng mạch của cùng (sản phẩm, loại)
  // lại vì đơn hàng không tách được 2 kênh này. Ví dụ minh hoạ theo đúng công thức Việt cho: mục
  // tiêu Mở mới Fosmitic của SS là X điểm ứng với sản lượng kế hoạch Y; team thực hiện được Z sản
  // lượng → điểm đạt = min(Z/Y, trần) × X (trần 150% cho Mở mới, 100% cho Duy trì — không vượt).
  // CẦN CẬP NHẬT LẠI 9 dòng này mỗi tháng theo đúng file chỉ tiêu mới.
  const SS_SPTT_LINES: { nhom: string; loai: "duy_tri" | "mo_moi"; diemKh: number; slKh: number }[] = [
    { nhom: "Progermila", loai: "duy_tri", diemKh: 100, slKh: 4400 + 7800 },
    { nhom: "Progermila", loai: "mo_moi", diemKh: 75, slKh: 6610 },
    { nhom: "Tranfast", loai: "mo_moi", diemKh: 50, slKh: 150 + 500 },
    { nhom: "Tranfast", loai: "duy_tri", diemKh: 100, slKh: 15511.2 + 4100 },
    { nhom: "Fosmitic", loai: "duy_tri", diemKh: 100, slKh: 400 + 1760 },
    { nhom: "Fosmitic", loai: "mo_moi", diemKh: 50, slKh: 310 },
    { nhom: "Biosoft", loai: "duy_tri", diemKh: 25, slKh: 9900 },
    { nhom: "Hepaphagen", loai: "duy_tri", diemKh: 25, slKh: 750 },
    { nhom: "Kalira", loai: "duy_tri", diemKh: 25, slKh: 1800 },
  ];

  // Sản lượng Duy trì thực hiện CẢ TEAM theo từng nhóm SP (không phân biệt NV nào bán).
  const soLuongDuyTriCaTeamTheoNhom = new Map<string, number>();
  for (const [khoa, sl] of soLuongTheoNvNhomDuyTri) {
    const nhom = khoa.split("|")[1];
    soLuongDuyTriCaTeamTheoNhom.set(nhom, (soLuongDuyTriCaTeamTheoNhom.get(nhom) ?? 0) + sl);
  }
  // Sản lượng của các đơn Mở mới HỢP LỆ thực hiện CẢ TEAM theo từng nhóm SP tháng này.
  const soLuongMoMoiCaTeamTheoNhom = new Map<string, number>();
  for (const don of cacDonMoMoi) {
    soLuongMoMoiCaTeamTheoNhom.set(don.nhom, (soLuongMoMoiCaTeamTheoNhom.get(don.nhom) ?? 0) + don.soLuong);
  }

  const chiTietDiemSpttSS = SS_SPTT_LINES.map((line) => {
    const thTeam =
      line.loai === "duy_tri"
        ? soLuongDuyTriCaTeamTheoNhom.get(line.nhom) ?? 0
        : soLuongMoMoiCaTeamTheoNhom.get(line.nhom) ?? 0;
    const tran = line.loai === "duy_tri" ? 1 : 1.5;
    const tiLe = line.slKh > 0 ? thTeam / line.slKh : 0;
    const phanTram = Math.min(tiLe, tran) * 100;
    return { ...line, thTeam, phanTram, diemTh: Math.min(tiLe, tran) * line.diemKh };
  });
  const teamDiemThSptt = chiTietDiemSpttSS.reduce((s, l) => s + l.diemTh, 0);

  const idxSS = (dsNhanVien ?? []).findIndex((nv) => nv.vai_tro === "ss");
  const maSS = idxSS >= 0 ? (dsNhanVien ?? [])[idxSS].ma_nv : null;

  if (maSS) {
    const idxDs = hangMuc.findIndex((x) => x.ma_nv === maSS);
    if (idxDs >= 0) {
      const muc = hangMuc[idxDs];
      const tiLeKdPm = muc.chiTieuKdPm > 0 ? teamKdPmTh / muc.chiTieuKdPm : null;
      const tiLeThau = muc.chiTieuThau > 0 ? teamThauTh / muc.chiTieuThau : null;
      hangMuc[idxDs] = {
        ...muc,
        keDonPhongMach: teamKdPmTh,
        thau: teamThauTh,
        tongCong: teamKdPmTh + teamThauTh,
        phanTramKdPm: tiLeKdPm !== null ? tiLeKdPm * 100 : null,
        phanTramThau: tiLeThau !== null ? Math.min(tiLeThau, 1.2) * 100 : null,
        diemThKdPm: tiLeKdPm !== null ? tiLeKdPm * muc.diemKhKdPm : 0,
        diemThThau: tiLeThau !== null ? Math.min(tiLeThau, 1.2) * muc.diemKhThau : 0,
      };
    }

    const idxMoMoi = hangMucMoMoi.findIndex((x) => x.ma_nv === maSS);
    if (idxMoMoi >= 0) {
      hangMucMoMoi[idxMoMoi] = {
        ...hangMucMoMoi[idxMoMoi],
        soDonMoMoi: teamTheoNhomSptt.reduce((s, n) => s + n.soDon, 0),
        doanhSoMoMoi: teamTheoNhomSptt.reduce((s, n) => s + n.doanhSo, 0),
        theoNhom: teamTheoNhomSptt,
      };
    }

    const idxDuyTri = hangMucDuyTri.findIndex((x) => x.ma_nv === maSS);
    if (idxDuyTri >= 0) {
      hangMucDuyTri[idxDuyTri] = {
        ...hangMucDuyTri[idxDuyTri],
        soKhachDat: teamDuyTriDat,
        tongKhachMucTieu: teamDuyTriTong,
        tyLeDat: teamDuyTriTong > 0 ? (teamDuyTriDat / teamDuyTriTong) * 100 : 0,
      };
    }

    const idxCodeMoi = hangMucCodeMoi.findIndex((x) => x.ma_nv === maSS);
    if (idxCodeMoi >= 0) {
      // Chỉ tiêu (chiTieu) và Điểm KH giữ đúng dòng riêng của SS — chỉ Thực hiện cộng dồn cả team.
      const muc = hangMucCodeMoi[idxCodeMoi];
      const tiLeCodeMoi = muc.chiTieu > 0 ? teamThCodeMoi / muc.chiTieu : null;
      hangMucCodeMoi[idxCodeMoi] = {
        ...muc,
        th: teamThCodeMoi,
        phanTram: tiLeCodeMoi !== null ? tiLeCodeMoi * 100 : null,
        diemTh: tiLeCodeMoi !== null ? tiLeCodeMoi * muc.diemKh : 0,
      };
    }
  }

  // ---- Nhân sự (chỉ tiêu riêng của SS) ----
  // Chỉ tiêu tháng 9/2026 lấy từ cột "TD mới SL KH" / "DT NS KH" / "Đ.KH tổng" sheet "KH KPIs
  // tháng 9": Tuyển mới KH=1 người, Duy trì nhân sự KH=9 người, tổng 100 điểm — Việt xác nhận
  // 15/9/2026: Tuyển mới chiếm 30% (30 điểm), Duy trì chiếm 70% (70 điểm) trong 100 điểm kế hoạch.
  // CẦN CẬP NHẬT LẠI các số này mỗi tháng theo đúng file chỉ tiêu mới (tỉ lệ 30/70 giữ nguyên trừ
  // khi công ty đổi).
  // Duy trì nhân sự TH = số NV đang active KHÔNG TÍNH SS (Việt xác nhận 15/9/2026: nhóm hiện có 8
  // bạn NV). Tuyển mới TH nhập tay qua bảng nhan_su_thuc_hien (hệ thống không có dữ liệu ngày
  // tuyển nên không tự tính được).
  const CHI_TIEU_NHAN_SU_THANG_NAY = {
    tuyenMoiKh: 1,
    duyTriKh: 9,
    diemKhTuyenMoi: 30,
    diemKhDuyTri: 70,
    get diemKh() {
      return this.diemKhTuyenMoi + this.diemKhDuyTri;
    },
  };
  const tuyenMoiTh = maSS ? Number((nhanSuThucHien ?? []).find((r) => r.ma_nv === maSS)?.tuyen_moi_th ?? 0) : 0;
  const duyTriNsTh = (dsNhanVien ?? []).filter((nv) => nv.vai_tro !== "ss").length;
  const tiLeTuyenMoi = Math.min(tuyenMoiTh / CHI_TIEU_NHAN_SU_THANG_NAY.tuyenMoiKh, 1);
  const tiLeDuyTriNs = Math.min(duyTriNsTh / CHI_TIEU_NHAN_SU_THANG_NAY.duyTriKh, 1);
  const diemThNhanSu =
    tiLeTuyenMoi * CHI_TIEU_NHAN_SU_THANG_NAY.diemKhTuyenMoi + tiLeDuyTriNs * CHI_TIEU_NHAN_SU_THANG_NAY.diemKhDuyTri;
  const phanTramNhanSu = (diemThNhanSu / CHI_TIEU_NHAN_SU_THANG_NAY.diemKh) * 100;

  // ---- Sản phẩm thị trường — điểm của SS (Việt xác nhận 15/9/2026) ----
  // Cách tính GIỐNG Sản phẩm trọng tâm: tỉ lệ = (tổng thực hiện cả nhóm / tổng chỉ tiêu cả nhóm),
  // trần 150% (SP thị trường của team hiện toàn loại "Mở mới"), nhân với Điểm KH RIÊNG của SS (50
  // điểm, DIEM_KH_SS_RIENG.spThiTruong — KHÔNG đổi, vì SS không có breakdown sản phẩm/khách hàng
  // riêng cho mục này trong file). Khác với SPTT (SS có sẵn 9 dòng chỉ tiêu riêng của chính SS),
  // SP thị trường SS không có chỉ tiêu số lượng riêng trong file — nên chỉ tiêu số lượng (mẫu số)
  // phải lấy bằng tổng chỉ tiêu của các NV thử việc bị áp mục này (khác với cách làm ở SPTT).
  const spThiTruongChiTieuTeam = hangMucSpThiTruong.reduce((s, x) => s + x.chiTieu, 0);
  const spThiTruongDatTeam = hangMucSpThiTruong.reduce((s, x) => s + x.soKhachDat, 0);
  const tiLeSpThiTruongTeam = spThiTruongChiTieuTeam > 0 ? spThiTruongDatTeam / spThiTruongChiTieuTeam : 0;
  const teamPhanTramSpThiTruong = Math.min(tiLeSpThiTruongTeam, 1.5) * 100;
  const teamDiemThSpThiTruong = Math.min(tiLeSpThiTruongTeam, 1.5) * DIEM_KH_SS_RIENG.spThiTruong;

  // ---- Tổng điểm KPI (thang 1000, chia 6 hạng mục theo đúng cơ cấu công ty) ----
  // 1. Doanh số Kê đơn/Phòng mạch  2. Doanh số Thầu  3. Code mới
  // 4. Nhân sự (chỉ áp cho SS)     5. Sản phẩm trọng tâm (SPTT = Duy trì + Mở mới cộng lại)
  // 6. SP thị trường (chỉ áp cho SS và NV thử việc)
  // "Điểm KH" mỗi mục nạp từ file công ty. Mục nào NV không bị áp ("Không áp") thì bỏ qua, không
  // tính vào tổng và không xét rule "dưới 50%". Mục nào NV có bị áp nhưng hệ thống CHƯA có nguồn dữ
  // liệu để tính (Nhân sự, SP thị trường) thì đánh dấu "chưa theo dõi" — không tự suy đoán là đạt.
  //
  // Danh sách NV thử việc (HĐ=TV) lấy từ file chỉ tiêu tháng 9/2026 — DB chưa có cột lưu trạng thái
  // hợp đồng nên tạm hard-code ở đây; cần cập nhật lại khi có người đổi trạng thái hoặc NV mới.
  const MA_NV_THU_VIEC = new Set(["020044", "020143", "020336"]); // Đặng Hà Giang, Nguyễn Anh Đức, Phạm Minh Diệp

  type MucKpi = {
    ten: string;
    apDung: boolean;
    theoDoi: boolean;
    phanTram: number | null;
    diemKh: number;
    diemTh: number;
  };
  type DiemKpi = {
    ma_nv: string;
    ten_nv: string;
    mucs: MucKpi[];
    diemKhTong: number;
    diemThTong: number;
    duoi50: { ten: string; phanTram: number }[];
    chuaTheoDoi: string[];
  };

  const diemKhDuyTriTheoNv = new Map<string, number>();
  const diemThDuyTriTheoNv = new Map<string, number>();
  for (const ct of chiTietDuyTri) {
    diemKhDuyTriTheoNv.set(ct.maNv, (diemKhDuyTriTheoNv.get(ct.maNv) ?? 0) + ct.diemKh);
    diemThDuyTriTheoNv.set(ct.maNv, (diemThDuyTriTheoNv.get(ct.maNv) ?? 0) + ct.diemTh);
  }
  const diemKhMoMoiTheoNv = new Map<string, number>();
  const diemThMoMoiTheoNv = new Map<string, number>();
  for (const nv of hangMucMoMoi) {
    for (const n of nv.theoNhom) {
      diemKhMoMoiTheoNv.set(nv.ma_nv, (diemKhMoMoiTheoNv.get(nv.ma_nv) ?? 0) + n.diemKh);
      diemThMoMoiTheoNv.set(nv.ma_nv, (diemThMoMoiTheoNv.get(nv.ma_nv) ?? 0) + n.diemTh);
    }
  }

  const diemKpi: DiemKpi[] = (dsNhanVien ?? []).map((nv) => {
    const laSS = nv.vai_tro === "ss";
    const laThuViec = MA_NV_THU_VIEC.has(nv.ma_nv);
    const ds = hangMuc.find((x) => x.ma_nv === nv.ma_nv);
    const cm = hangMucCodeMoi.find((x) => x.ma_nv === nv.ma_nv);
    // SPTT của SS: Điểm KH giữ đúng 550 điểm riêng của SS (không cộng dồn chỉ tiêu từng NV — xem
    // giải thích ở khối "KPI của SS = KPI của cả nhóm" phía trên); Điểm TH = tổng cả team.
    const diemKhSptt = laSS
      ? DIEM_KH_SS_RIENG.sptt
      : (diemKhDuyTriTheoNv.get(nv.ma_nv) ?? 0) + (diemKhMoMoiTheoNv.get(nv.ma_nv) ?? 0);
    const diemThSptt = laSS
      ? teamDiemThSptt
      : (diemThDuyTriTheoNv.get(nv.ma_nv) ?? 0) + (diemThMoMoiTheoNv.get(nv.ma_nv) ?? 0);

    const mucs: MucKpi[] = [
      {
        ten: "Doanh số Kê đơn/Phòng mạch",
        apDung: (ds?.chiTieuKdPm ?? 0) > 0,
        theoDoi: true,
        phanTram: ds?.phanTramKdPm ?? null,
        diemKh: ds?.diemKhKdPm ?? 0,
        diemTh: ds?.diemThKdPm ?? 0,
      },
      {
        ten: "Doanh số Thầu",
        apDung: (ds?.chiTieuThau ?? 0) > 0,
        theoDoi: true,
        phanTram: ds?.phanTramThau ?? null,
        diemKh: ds?.diemKhThau ?? 0,
        diemTh: ds?.diemThThau ?? 0,
      },
      {
        ten: "Code mới",
        apDung: cm?.apDung ?? false,
        theoDoi: true,
        phanTram: cm?.phanTram ?? null,
        diemKh: cm?.diemKh ?? 0,
        diemTh: cm?.diemTh ?? 0,
      },
      {
        ten: "Nhân sự",
        apDung: laSS,
        theoDoi: true,
        phanTram: laSS ? phanTramNhanSu : null,
        diemKh: laSS ? CHI_TIEU_NHAN_SU_THANG_NAY.diemKh : 0,
        diemTh: laSS ? diemThNhanSu : 0,
      },
      {
        ten: "Sản phẩm trọng tâm (Duy trì + Mở mới)",
        apDung: diemKhSptt > 0,
        theoDoi: true,
        phanTram: diemKhSptt > 0 ? (diemThSptt / diemKhSptt) * 100 : null,
        diemKh: diemKhSptt,
        diemTh: diemThSptt,
      },
      (() => {
        if (laSS) {
          return {
            ten: "Sản phẩm thị trường",
            apDung: true,
            theoDoi: true,
            phanTram: teamPhanTramSpThiTruong,
            diemKh: DIEM_KH_SS_RIENG.spThiTruong,
            diemTh: teamDiemThSpThiTruong,
          };
        }
        const sptt = hangMucSpThiTruong.find((x) => x.ma_nv === nv.ma_nv);
        return {
          ten: "Sản phẩm thị trường",
          apDung: laThuViec,
          theoDoi: true,
          phanTram: sptt?.phanTram ?? null,
          diemKh: sptt?.diemKh ?? 0,
          diemTh: sptt?.diemTh ?? 0,
        };
      })(),
    ];

    const mucApDung = mucs.filter((m) => m.apDung);
    const mucTheoDoi = mucApDung.filter((m) => m.theoDoi);
    return {
      ma_nv: nv.ma_nv,
      ten_nv: nv.ten_nv,
      mucs: mucApDung,
      diemKhTong: mucTheoDoi.reduce((s, m) => s + m.diemKh, 0),
      diemThTong: mucTheoDoi.reduce((s, m) => s + m.diemTh, 0),
      duoi50: mucTheoDoi.filter((m) => m.phanTram !== null && m.phanTram < 50).map((m) => ({ ten: m.ten, phanTram: m.phanTram as number })),
      chuaTheoDoi: mucApDung.filter((m) => !m.theoDoi).map((m) => m.ten),
    };
  });

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-indigo-600">Web quản lý KPI</p>
            <h1 className="text-xl font-semibold text-slate-900">Team — tháng {tenThang}</h1>
          </div>
          <NutDangXuat />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <ChonNhanVienXemKpi
          soChiTieu={soChiTieu}
          dsNhanVien={dsNhanVien ?? []}
          maNvMacDinh={maSS ?? (dsNhanVien ?? [])[0]?.ma_nv ?? ""}
          hangMuc={hangMuc}
          hangMucMoMoi={hangMucMoMoi}
          hangMucDuyTri={hangMucDuyTri}
          hangMucCodeMoi={hangMucCodeMoi}
          hangMucSpThiTruong={hangMucSpThiTruong}
          chiTietMoMoi={chiTietMoMoi}
          chiTietDuyTri={chiTietDuyTri}
          tenKhTheoMa={Object.fromEntries(tenKhTheoMa)}
          diemKpi={diemKpi}
          nhanSu={{
            thang: dauThang,
            tuyenMoiKh: CHI_TIEU_NHAN_SU_THANG_NAY.tuyenMoiKh,
            tuyenMoiTh,
            duyTriKh: CHI_TIEU_NHAN_SU_THANG_NAY.duyTriKh,
            duyTriTh: duyTriNsTh,
            phanTram: phanTramNhanSu,
          }}
        />
      </div>
    </main>
  );
}

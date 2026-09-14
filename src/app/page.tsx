import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NutDangXuat from "@/components/nut-dang-xuat";
import GanMaNhanVien from "@/components/gan-ma-nhan-vien";
import ChonNhanVienXemKpi from "@/components/chon-nhan-vien-xem-kpi";
import { NHOM_SAN_PHAM_TRONG_TAM } from "@/lib/sptt";

function themThang(ngay: Date, soThang: number): Date {
  return new Date(Date.UTC(ngay.getUTCFullYear(), ngay.getUTCMonth() + soThang, ngay.getUTCDate()));
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
      ma_vu_viec: string | null;
      products: { nhom_trong_tam: string | null } | null;
    }[] = [];
    let trang = 0;
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, ma_nv, ma_to_chuc, ngay_chung_tu, tong_tien, ma_vu_viec, products(nhom_trong_tam)")
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
  ] = await Promise.all([
    supabase.from("nhan_vien").select("ma_nv, ten_nv").eq("active", true).order("ten_nv"),
    supabase
      .from("orders")
      .select("ma_nv, ma_vu_viec, tong_tien")
      .gte("ngay_chung_tu", dauThang)
      .lt("ngay_chung_tu", dauThangSau),
    layDonHangLichSuChoMoMoi(),
    supabase.from("kpi_targets").select("*", { count: "exact", head: true }),
    supabase
      .from("kpi_targets")
      .select("ma_nv, ma_to_chuc, ma_sp, chi_tieu, customers(ten_to_chuc), products(nhom_trong_tam)")
      .eq("loai_kpi", "duy_tri")
      .eq("thang", dauThang),
    supabase
      .from("orders")
      .select("ma_nv, ma_to_chuc, so_luong, products(nhom_trong_tam)")
      .gte("ngay_chung_tu", dauThang)
      .lt("ngay_chung_tu", dauThangSau),
    supabase
      .from("kpi_targets")
      .select("ma_nv, loai_kpi, chi_tieu")
      .in("loai_kpi", ["ke_don_phong_mach", "thau"])
      .eq("thang", dauThang),
    supabase
      .from("kpi_targets")
      .select("ma_nv, chi_tieu, products(nhom_trong_tam)")
      .eq("loai_kpi", "mo_moi")
      .eq("thang", dauThang),
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

  // Chỉ tiêu doanh số (VNĐ) nạp từ file KPI công ty — xem skill kpi-analyst Phần 3: DS Kê đơn+
  // Phòng mạch không giới hạn trần, DS Thầu trần 120%.
  const chiTieuKdPmTheoNv = new Map<string, number>();
  const chiTieuThauTheoNv = new Map<string, number>();
  for (const mt of mucTieuDoanhSo ?? []) {
    if (mt.loai_kpi === "ke_don_phong_mach") chiTieuKdPmTheoNv.set(mt.ma_nv, Number(mt.chi_tieu));
    if (mt.loai_kpi === "thau") chiTieuThauTheoNv.set(mt.ma_nv, Number(mt.chi_tieu));
  }

  const hangMuc = (dsNhanVien ?? []).map((nv) => {
    const t = tongTheoNv.get(nv.ma_nv) ?? { thau: 0, keDonPhongMach: 0 };
    const chiTieuKdPm = chiTieuKdPmTheoNv.get(nv.ma_nv) ?? 0;
    const chiTieuThau = chiTieuThauTheoNv.get(nv.ma_nv) ?? 0;
    return {
      ...nv,
      ...t,
      tongCong: t.thau + t.keDonPhongMach,
      phanTramKdPm: chiTieuKdPm > 0 ? (t.keDonPhongMach / chiTieuKdPm) * 100 : null,
      phanTramThau: chiTieuThau > 0 ? Math.min(t.thau / chiTieuThau, 1.2) * 100 : null,
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

  const donHopLe = donHangToanBo.filter(
    (d) => !!d.products?.nhom_trong_tam && d.ma_to_chuc && d.ma_nv
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

  type MucTieuMoMoi = { ma_nv: string; chi_tieu: number; products: { nhom_trong_tam: string | null } | null };
  const chiTieuMoMoiTheoKhoa = new Map<string, number>();
  for (const mt of (mucTieuMoMoi ?? []) as unknown as MucTieuMoMoi[]) {
    const nhom = mt.products?.nhom_trong_tam;
    if (!nhom) continue;
    const khoa = `${mt.ma_nv}|${nhom}`;
    chiTieuMoMoiTheoKhoa.set(khoa, (chiTieuMoMoiTheoKhoa.get(khoa) ?? 0) + Number(mt.chi_tieu));
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
        return {
          nhom,
          ...(t?.theoNhom.get(nhom) ?? { soDon: 0, doanhSo: 0 }),
          soKhachDat,
          chiTieuSoKhach: chiTieu,
          phanTram: chiTieu > 0 ? Math.min(soKhachDat / chiTieu, 1.5) * 100 : null,
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
    so_luong: number | null;
    products: { nhom_trong_tam: string | null } | null;
  };
  type MucTieuDuyTri = {
    ma_nv: string;
    ma_to_chuc: string | null;
    ma_sp: string | null;
    chi_tieu: number;
    customers: { ten_to_chuc: string } | null;
    products: { nhom_trong_tam: string | null } | null;
  };

  const soLuongTheoKhachDuyTri = new Map<string, number>();
  const soLuongTheoNvNhomDuyTri = new Map<string, number>();
  for (const dong of (donHangSoLuongThangNay ?? []) as unknown as DonSoLuongDuyTri[]) {
    const nhom = dong.products?.nhom_trong_tam;
    if (!nhom || !dong.ma_nv) continue;
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
    const phanTram = kh > 0 ? Math.min(th / kh, 1) * 100 : 0;
    return {
      maNv: mt.ma_nv,
      tenKh: mt.customers?.ten_to_chuc ?? mt.ma_to_chuc ?? "Toàn bộ khách hàng",
      maToChuc: mt.ma_to_chuc,
      nhom,
      th,
      kh,
      phanTram,
      dat: phanTram >= 100,
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
          maNvMacDinh={hoSo.ma_nv}
          hangMuc={hangMuc}
          hangMucMoMoi={hangMucMoMoi}
          hangMucDuyTri={hangMucDuyTri}
          chiTietMoMoi={chiTietMoMoi}
          chiTietDuyTri={chiTietDuyTri}
          tenKhTheoMa={Object.fromEntries(tenKhTheoMa)}
        />
      </div>
    </main>
  );
}

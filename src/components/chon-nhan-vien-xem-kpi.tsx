"use client";

import { useState } from "react";
import { NHOM_SAN_PHAM_TRONG_TAM } from "@/lib/sptt";
import NhapTuyenMoi from "@/components/nhap-tuyen-moi";

function dinhDangTien(so: number) {
  return so.toLocaleString("vi-VN") + " đ";
}

type NhanVien = { ma_nv: string; ten_nv: string; vai_tro: string };

type HangMucDoanhSo = {
  ma_nv: string;
  ten_nv: string;
  thau: number;
  keDonPhongMach: number;
  tongCong: number;
  chiTieuKdPm: number;
  chiTieuThau: number;
  phanTramKdPm: number | null;
  phanTramThau: number | null;
};

type TheoNhomMoMoi = {
  nhom: string;
  soDon: number;
  doanhSo: number;
  soKhachDat: number;
  chiTieuSoKhach: number;
  phanTram: number | null;
};

type HangMucMoMoi = {
  ma_nv: string;
  ten_nv: string;
  soDonMoMoi: number;
  doanhSoMoMoi: number;
  theoNhom: TheoNhomMoMoi[];
};

type HangMucDuyTri = {
  ma_nv: string;
  ten_nv: string;
  tongKhachMucTieu: number;
  soKhachDat: number;
  tyLeDat: number;
};

type HangMucCodeMoi = {
  ma_nv: string;
  ten_nv: string;
  apDung: boolean;
  chiTieu: number;
  th: number;
  phanTram: number | null;
};

type HangMucSpThiTruong = {
  ma_nv: string;
  soKhachDat: number;
  chiTieu: number;
  diemKh: number;
  phanTram: number;
  diemTh: number;
};

type NhanSuInfo = {
  thang: string;
  tuyenMoiKh: number;
  tuyenMoiTh: number;
  duyTriKh: number;
  duyTriTh: number;
  phanTram: number;
};

type DonMoMoi = {
  maNv: string;
  maToChuc: string;
  nhom: string;
  kenh: string;
  ngay: string;
  tongTien: number;
};

type ChiTietDuyTri = {
  maNv: string;
  tenKh: string;
  maToChuc: string | null;
  nhom: string;
  th: number;
  kh: number;
  phanTram: number;
  dat: boolean;
};

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

type Props = {
  soChiTieu: number | null;
  dsNhanVien: NhanVien[];
  maNvMacDinh: string;
  hangMuc: HangMucDoanhSo[];
  hangMucMoMoi: HangMucMoMoi[];
  hangMucDuyTri: HangMucDuyTri[];
  hangMucCodeMoi: HangMucCodeMoi[];
  hangMucSpThiTruong: HangMucSpThiTruong[];
  chiTietMoMoi: DonMoMoi[];
  chiTietDuyTri: ChiTietDuyTri[];
  tenKhTheoMa: Record<string, string>;
  diemKpi: DiemKpi[];
  nhanSu: NhanSuInfo;
};

const thBase = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const tdBase = "px-4 py-3 text-sm text-slate-700";

function CanhBao({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
      {children}
    </div>
  );
}

function PhanTram({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-slate-300">–</span>;
  }
  const mau =
    value >= 100
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      : value >= 50
        ? "bg-amber-50 text-amber-700 ring-amber-600/20"
        : "bg-rose-50 text-rose-700 ring-rose-600/20";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${mau}`}>
      {value.toFixed(0)}%
    </span>
  );
}

function KhongAp() {
  return <span className="italic text-slate-400">Không áp</span>;
}

function ChuaTheoDoi() {
  return <span className="italic text-slate-400">Chưa theo dõi</span>;
}

function TheThongKe({
  nhan,
  giaTri,
  phanTram,
  keHoach,
}: {
  nhan: string;
  giaTri: string;
  phanTram?: number | null;
  keHoach?: { giaTri: number; ap: boolean; dinhDang: (n: number) => string };
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{nhan}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums text-slate-900">{giaTri}</span>
        {phanTram !== undefined ? <PhanTram value={phanTram} /> : null}
      </div>
      {keHoach ? (
        <p className="mt-1 text-xs text-slate-400">
          Kế hoạch: {keHoach.ap ? <span className="tabular-nums">{keHoach.dinhDang(keHoach.giaTri)}</span> : <KhongAp />}
        </p>
      ) : null}
    </div>
  );
}

export default function ChonNhanVienXemKpi({
  soChiTieu,
  dsNhanVien,
  maNvMacDinh,
  hangMuc,
  hangMucMoMoi,
  hangMucDuyTri,
  hangMucCodeMoi,
  hangMucSpThiTruong,
  chiTietMoMoi,
  chiTietDuyTri,
  tenKhTheoMa,
  diemKpi,
  nhanSu,
}: Props) {
  const [maNvDangChon, setMaNvDangChon] = useState<string>(maNvMacDinh);

  const nvChon = dsNhanVien.find((x) => x.ma_nv === maNvDangChon);
  const laSS = nvChon?.vai_tro === "ss";
  const nvDoanhSo = hangMuc.find((x) => x.ma_nv === maNvDangChon);
  const nvMoMoi = hangMucMoMoi.find((x) => x.ma_nv === maNvDangChon);
  const nvDuyTri = hangMucDuyTri.find((x) => x.ma_nv === maNvDangChon);
  const nvCodeMoi = hangMucCodeMoi.find((x) => x.ma_nv === maNvDangChon);
  const nvSpThiTruong = hangMucSpThiTruong.find((x) => x.ma_nv === maNvDangChon);
  const nvDiemKpi = diemKpi.find((x) => x.ma_nv === maNvDangChon);
  const spThiTruongApDung = laSS ? true : !!nvSpThiTruong;
  const donMoMoiCuaNv = chiTietMoMoi
    .filter((d) => d.maNv === maNvDangChon)
    .sort((a, b) => (a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0));
  const khachDuyTriCuaNv = chiTietDuyTri.filter((d) => d.maNv === maNvDangChon);

  const duyTriDat = nvDuyTri?.soKhachDat ?? 0;
  const duyTriTong = nvDuyTri?.tongKhachMucTieu ?? 0;
  const duyTriPct = duyTriTong > 0 ? (duyTriDat / duyTriTong) * 100 : null;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">Xem KPI của</label>
        <select
          value={maNvDangChon}
          onChange={(e) => setMaNvDangChon(e.target.value)}
          className="mt-1.5 block w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:w-auto"
        >
          {dsNhanVien.map((nv) => (
            <option key={nv.ma_nv} value={nv.ma_nv}>
              {nv.ten_nv} ({nv.ma_nv}){nv.vai_tro === "ss" ? " — SS, KPI cả nhóm" : ""}
            </option>
          ))}
        </select>
        {laSS ? (
          <p className="mt-2 text-xs text-slate-400">
            KPI của cả nhóm chính là KPI của SS — không phải tổng cộng số của từng nhân viên.
          </p>
        ) : null}
      </div>

      {/* ---- Doanh số theo kênh ---- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />
          <h2 className="text-lg font-semibold text-slate-900">Doanh số theo kênh</h2>
        </div>

        {!soChiTieu ? (
          <CanhBao>
            Chưa có dữ liệu chỉ tiêu KPI tháng này trong hệ thống — số dưới đây mới chỉ là{" "}
            <b>doanh số thực tế</b>, chưa tính được % đạt chỉ tiêu.
          </CanhBao>
        ) : null}

        <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-3">
          <TheThongKe
            nhan="Kê đơn / Phòng mạch"
            giaTri={dinhDangTien(nvDoanhSo?.keDonPhongMach ?? 0)}
            phanTram={nvDoanhSo?.phanTramKdPm ?? null}
            keHoach={{ giaTri: nvDoanhSo?.chiTieuKdPm ?? 0, ap: (nvDoanhSo?.chiTieuKdPm ?? 0) > 0, dinhDang: dinhDangTien }}
          />
          <TheThongKe
            nhan="Thầu (trần 120%)"
            giaTri={dinhDangTien(nvDoanhSo?.thau ?? 0)}
            phanTram={nvDoanhSo?.phanTramThau ?? null}
            keHoach={{ giaTri: nvDoanhSo?.chiTieuThau ?? 0, ap: (nvDoanhSo?.chiTieuThau ?? 0) > 0, dinhDang: dinhDangTien }}
          />
          <TheThongKe nhan="Tổng doanh thu" giaTri={dinhDangTien(nvDoanhSo?.tongCong ?? 0)} />
        </div>
        <p className="px-6 pb-5 text-xs text-slate-400">
          Đơn khách hàng web / đơn online vẫn được tính vào doanh số ở đây, nhưng không tính vào Mở mới hay Duy trì.
        </p>
      </section>

      {/* ---- Mở mới sản phẩm ---- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <h2 className="text-lg font-semibold text-slate-900">Mở mới sản phẩm</h2>
        </div>

        {!soChiTieu ? (
          <CanhBao>
            Chưa có dữ liệu chỉ tiêu KPI tháng này trong hệ thống — số dưới đây mới chỉ là{" "}
            <b>doanh số Mở mới thực tế</b>, chưa tính được % đạt chỉ tiêu.
          </CanhBao>
        ) : null}

        <div className="grid grid-cols-1 gap-3 px-6 pt-6 sm:grid-cols-2">
          <TheThongKe nhan="Tổng số đơn Mở mới" giaTri={String(nvMoMoi?.soDonMoMoi ?? 0)} />
          <TheThongKe nhan="Tổng doanh số Mở mới" giaTri={dinhDangTien(nvMoMoi?.doanhSoMoMoi ?? 0)} />
        </div>

        <div className="overflow-x-auto p-6">
          <table className="w-full min-w-[520px] border-collapse overflow-hidden rounded-xl border border-slate-200">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className={thBase}>Sản phẩm</th>
                <th className={thBase}>Khách đạt / mục tiêu</th>
                <th className={`${thBase} text-right`}>% đạt</th>
                <th className={`${thBase} text-right`}>Doanh số</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {NHOM_SAN_PHAM_TRONG_TAM.map((nhom) => {
                const n = nvMoMoi?.theoNhom.find((x) => x.nhom === nhom);
                const coApDung = n && n.chiTieuSoKhach > 0;
                const coHoatDong = n && n.soDon > 0;
                if (!coApDung && !coHoatDong) return null; // ẩn SP không áp & không có hoạt động
                return (
                  <tr key={nhom} className="hover:bg-slate-50/60">
                    <td className={`${tdBase} font-medium text-slate-900`}>{nhom}</td>
                    <td className={`${tdBase} tabular-nums`}>
                      {coApDung ? `${n!.soKhachDat}/${n!.chiTieuSoKhach} khách` : <KhongAp />}
                    </td>
                    <td className={`${tdBase} text-right`}>
                      {coApDung ? <PhanTram value={n!.phanTram} /> : <KhongAp />}
                    </td>
                    <td className={`${tdBase} text-right tabular-nums`}>{dinhDangTien(n?.doanhSo ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {donMoMoiCuaNv.length > 0 ? (
          <div className="border-t border-slate-100 px-6 py-5">
            <p className="mb-3 text-sm font-medium text-slate-700">
              Chi tiết từng đơn Mở mới ({donMoMoiCuaNv.length} đơn)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={thBase}>Ngày</th>
                    <th className={thBase}>Khách hàng</th>
                    <th className={thBase}>Sản phẩm</th>
                    <th className={thBase}>Kênh</th>
                    <th className={`${thBase} text-right`}>Số tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {donMoMoiCuaNv.map((don, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className={tdBase}>{don.ngay}</td>
                      <td className={tdBase}>
                        {tenKhTheoMa[don.maToChuc] ?? don.maToChuc}{" "}
                        <span className="text-slate-400">({don.maToChuc})</span>
                      </td>
                      <td className={tdBase}>{don.nhom}</td>
                      <td className={tdBase}>{don.kenh}</td>
                      <td className={`${tdBase} text-right tabular-nums`}>{dinhDangTien(don.tongTien)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* ---- Duy trì sản phẩm ---- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
          <span className="h-2 w-2 rounded-full bg-violet-500" />
          <h2 className="text-lg font-semibold text-slate-900">Duy trì sản phẩm</h2>
        </div>

        {duyTriTong === 0 ? (
          <CanhBao>Chưa có danh sách khách hàng mục tiêu + chỉ tiêu sản lượng Duy trì tháng này cho nhân viên này.</CanhBao>
        ) : null}

        <div className="p-6">
          <TheThongKe nhan="Khách hàng đạt chỉ tiêu" giaTri={`${duyTriDat} / ${duyTriTong}`} phanTram={duyTriTong > 0 ? duyTriPct : null} />
        </div>

        {khachDuyTriCuaNv.length > 0 ? (
          <div className="border-t border-slate-100 px-6 py-5">
            <p className="mb-3 text-sm font-medium text-slate-700">
              Chi tiết từng khách hàng mục tiêu ({khachDuyTriCuaNv.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={thBase}>Khách hàng</th>
                    <th className={thBase}>Sản phẩm</th>
                    <th className={`${thBase} text-right`}>Chỉ tiêu (SL)</th>
                    <th className={`${thBase} text-right`}>Thực hiện (SL)</th>
                    <th className={`${thBase} text-right`}>% đạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {khachDuyTriCuaNv.map((ct, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className={tdBase}>
                        {ct.tenKh}
                        {ct.maToChuc ? <span className="text-slate-400"> ({ct.maToChuc})</span> : null}
                      </td>
                      <td className={tdBase}>{ct.nhom}</td>
                      <td className={`${tdBase} text-right tabular-nums`}>{ct.kh}</td>
                      <td className={`${tdBase} text-right tabular-nums`}>{ct.th}</td>
                      <td className={`${tdBase} text-right`}>
                        <PhanTram value={ct.phanTram} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* ---- Code mới ---- */}
      {nvCodeMoi?.apDung ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <h2 className="text-lg font-semibold text-slate-900">Code mới</h2>
          </div>
          <div className="p-6">
            <TheThongKe
              nhan="Mã khách hàng mới đã duyệt"
              giaTri={`${nvCodeMoi.th} / ${nvCodeMoi.chiTieu}`}
              phanTram={nvCodeMoi.phanTram}
            />
            <p className="mt-3 text-xs text-slate-400">
              Số thực hiện lấy từ danh sách đã được duyệt trong hệ thống (chưa có ai duyệt thì sẽ là 0).
            </p>
          </div>
        </section>
      ) : null}

      {/* ---- Nhân sự (chỉ SS) ---- */}
      {laSS ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <h2 className="text-lg font-semibold text-slate-900">Nhân sự</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tuyển mới</p>
              <p className="mt-1.5 text-lg font-semibold tabular-nums text-slate-900">
                {nhanSu.tuyenMoiTh} / {nhanSu.tuyenMoiKh} người
              </p>
              <div className="mt-2">
                <NhapTuyenMoi maNv={maNvDangChon} thang={nhanSu.thang} giaTriHienTai={nhanSu.tuyenMoiTh} />
              </div>
            </div>
            <TheThongKe nhan="Duy trì nhân sự" giaTri={`${nhanSu.duyTriTh} / ${nhanSu.duyTriKh} người`} />
          </div>
          <div className="px-6 pb-5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">% Nhân sự tổng hợp:</span>
              <PhanTram value={nhanSu.phanTram} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Duy trì nhân sự tự tính = số nhân viên đang active (không tính SS). Tuyển mới cần nhập tay vì hệ thống
              không có dữ liệu ngày tuyển. Điểm Nhân sự = Tuyển mới (30% · 30 điểm) + Duy trì (70% · 70 điểm), mỗi
              phần trần 100%.
            </p>
          </div>
        </section>
      ) : null}

      {/* ---- Sản phẩm thị trường (SS + NV thử việc) ---- */}
      {spThiTruongApDung ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
            <h2 className="text-lg font-semibold text-slate-900">Sản phẩm thị trường</h2>
          </div>
          <div className="p-6">
            {laSS ? (
              (() => {
                const muc = nvDiemKpi?.mucs.find((m) => m.ten === "Sản phẩm thị trường");
                return (
                  <>
                    <TheThongKe
                      nhan="Điểm đã đạt (cả nhóm)"
                      giaTri={`${(muc?.diemTh ?? 0).toFixed(0)} / ${(muc?.diemKh ?? 0).toFixed(0)} điểm`}
                      phanTram={muc?.phanTram ?? null}
                    />
                    <p className="mt-3 text-xs text-slate-400">
                      Tổng điểm khả dụng của cả nhóm bao gồm cả 50 điểm riêng của SS — phần này chưa có breakdown sản
                      phẩm/khách hàng cụ thể trong file công ty nên chưa tính được thực hiện.
                    </p>
                  </>
                );
              })()
            ) : (
              <TheThongKe
                nhan="Khách hàng mới đạt"
                giaTri={`${nvSpThiTruong?.soKhachDat ?? 0} / ${nvSpThiTruong?.chiTieu ?? 1} khách`}
                phanTram={nvSpThiTruong?.phanTram ?? null}
              />
            )}
          </div>
        </section>
      ) : null}

      {/* ---- Điểm KPI tổng ---- */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <h2 className="text-lg font-semibold text-slate-900">Điểm KPI tổng</h2>
        </div>

        <div className="p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Điểm đã đạt (các mục hệ thống đang theo dõi)
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums text-slate-900">
                {(nvDiemKpi?.diemThTong ?? 0).toFixed(0)} / {(nvDiemKpi?.diemKhTong ?? 0).toFixed(0)} điểm
              </span>
              {(nvDiemKpi?.diemKhTong ?? 0) > 0 ? (
                <PhanTram value={((nvDiemKpi?.diemThTong ?? 0) / (nvDiemKpi?.diemKhTong ?? 1)) * 100} />
              ) : null}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse overflow-hidden rounded-xl border border-slate-200">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className={thBase}>Hạng mục</th>
                  <th className={`${thBase} text-right`}>% đạt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(nvDiemKpi?.mucs ?? []).map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className={tdBase}>{m.ten}</td>
                    <td className={`${tdBase} text-right`}>
                      {m.theoDoi ? <PhanTram value={m.phanTram} /> : <ChuaTheoDoi />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Tổng điểm chính thức của công ty là <b>1000 điểm</b>, chia 6 hạng mục như trên. Cần đạt <b>≥850 điểm</b>{" "}
            và <b>không có hạng mục nào dưới 50%</b> mới tính đạt KPI.
          </p>

          {nvDiemKpi && nvDiemKpi.chuaTheoDoi.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              Hệ thống chưa có dữ liệu cho: <b>{nvDiemKpi.chuaTheoDoi.join(", ")}</b> — chưa thể kết luận đạt/không
              đạt KPI chính thức cho tới khi có dữ liệu các mục này.
            </div>
          ) : (
            <div
              className={`mt-3 rounded-lg border px-3.5 py-2.5 text-sm ${
                (nvDiemKpi?.diemThTong ?? 0) >= 850 && (nvDiemKpi?.duoi50.length ?? 0) === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {(nvDiemKpi?.diemThTong ?? 0) >= 850 && (nvDiemKpi?.duoi50.length ?? 0) === 0
                ? "✅ Đạt KPI."
                : "❌ Chưa đạt KPI."}
            </div>
          )}

          {nvDiemKpi && nvDiemKpi.duoi50.length > 0 ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-slate-700">Hạng mục đang dưới 50% (auto không đạt KPI):</p>
              <ul className="mt-1.5 space-y-1">
                {nvDiemKpi.duoi50.map((m, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-slate-600">
                    <span>{m.ten}</span>
                    <PhanTram value={m.phanTram} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

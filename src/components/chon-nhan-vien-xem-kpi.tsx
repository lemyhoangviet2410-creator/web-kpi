"use client";

import { useState } from "react";
import { NHOM_SAN_PHAM_TRONG_TAM } from "@/lib/sptt";

function dinhDangTien(so: number) {
  return so.toLocaleString("vi-VN") + " đ";
}

const MA_CA_NHOM = "__ca_nhom__";

type NhanVien = { ma_nv: string; ten_nv: string };

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

type MucDuoi50 = { ten: string; phanTram: number };
type DiemKpi = { ma_nv: string; ten_nv: string; diemKhTong: number; diemThTong: number; duoi50: MucDuoi50[] };

type TongCaNhom = {
  tongDoanhThuKdPm: number;
  tongChiTieuKdPm: number;
  tongDoanhThuThau: number;
  tongChiTieuThau: number;
  tongTheoNhomChung: TheoNhomMoMoi[];
  tongSoDonMoMoi: number;
  tongDoanhSoMoMoi: number;
  tongKhachDatChung: number;
  tongKhachMucTieuChung: number;
};

type Props = {
  soChiTieu: number | null;
  dsNhanVien: NhanVien[];
  maNvMacDinh: string;
  hangMuc: HangMucDoanhSo[];
  hangMucMoMoi: HangMucMoMoi[];
  hangMucDuyTri: HangMucDuyTri[];
  chiTietMoMoi: DonMoMoi[];
  chiTietDuyTri: ChiTietDuyTri[];
  tenKhTheoMa: Record<string, string>;
  diemKpi: DiemKpi[];
  tongCaNhom: TongCaNhom;
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
  chiTietMoMoi,
  chiTietDuyTri,
  tenKhTheoMa,
  diemKpi,
  tongCaNhom,
}: Props) {
  const [maNvDangChon, setMaNvDangChon] = useState<string>(maNvMacDinh);
  const laCaNhom = maNvDangChon === MA_CA_NHOM;

  const nvDoanhSo = hangMuc.find((x) => x.ma_nv === maNvDangChon);
  const nvMoMoi = hangMucMoMoi.find((x) => x.ma_nv === maNvDangChon);
  const nvDuyTri = hangMucDuyTri.find((x) => x.ma_nv === maNvDangChon);
  const nvDiemKpi = diemKpi.find((x) => x.ma_nv === maNvDangChon);
  const donMoMoiCuaNv = laCaNhom
    ? chiTietMoMoi
    : chiTietMoMoi.filter((d) => d.maNv === maNvDangChon);
  const khachDuyTriCuaNv = laCaNhom
    ? chiTietDuyTri
    : chiTietDuyTri.filter((d) => d.maNv === maNvDangChon);
  const donMoMoiSapXep = [...donMoMoiCuaNv].sort((a, b) => (a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : 0));

  // Dữ liệu hiển thị cho Doanh số theo kênh — cá nhân hoặc cả nhóm
  const dsKdPm = laCaNhom ? tongCaNhom.tongDoanhThuKdPm : nvDoanhSo?.keDonPhongMach ?? 0;
  const dsKdPmKh = laCaNhom ? tongCaNhom.tongChiTieuKdPm : nvDoanhSo?.chiTieuKdPm ?? 0;
  const dsKdPmPct = laCaNhom
    ? tongCaNhom.tongChiTieuKdPm > 0
      ? (tongCaNhom.tongDoanhThuKdPm / tongCaNhom.tongChiTieuKdPm) * 100
      : null
    : nvDoanhSo?.phanTramKdPm ?? null;
  const dsThau = laCaNhom ? tongCaNhom.tongDoanhThuThau : nvDoanhSo?.thau ?? 0;
  const dsThauKh = laCaNhom ? tongCaNhom.tongChiTieuThau : nvDoanhSo?.chiTieuThau ?? 0;
  const dsThauPct = laCaNhom
    ? tongCaNhom.tongChiTieuThau > 0
      ? Math.min(tongCaNhom.tongDoanhThuThau / tongCaNhom.tongChiTieuThau, 1.2) * 100
      : null
    : nvDoanhSo?.phanTramThau ?? null;
  const dsTong = laCaNhom ? tongCaNhom.tongDoanhThuKdPm + tongCaNhom.tongDoanhThuThau : nvDoanhSo?.tongCong ?? 0;

  const moMoiTheoNhom = laCaNhom ? tongCaNhom.tongTheoNhomChung : nvMoMoi?.theoNhom ?? [];
  const moMoiSoDon = laCaNhom ? tongCaNhom.tongSoDonMoMoi : nvMoMoi?.soDonMoMoi ?? 0;
  const moMoiDoanhSo = laCaNhom ? tongCaNhom.tongDoanhSoMoMoi : nvMoMoi?.doanhSoMoMoi ?? 0;

  const duyTriDat = laCaNhom ? tongCaNhom.tongKhachDatChung : nvDuyTri?.soKhachDat ?? 0;
  const duyTriTong = laCaNhom ? tongCaNhom.tongKhachMucTieuChung : nvDuyTri?.tongKhachMucTieu ?? 0;
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
          <option value={MA_CA_NHOM}>Cả nhóm (tổng hợp)</option>
          {dsNhanVien.map((nv) => (
            <option key={nv.ma_nv} value={nv.ma_nv}>
              {nv.ten_nv} ({nv.ma_nv})
            </option>
          ))}
        </select>
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
            giaTri={dinhDangTien(dsKdPm)}
            phanTram={dsKdPmPct}
            keHoach={{ giaTri: dsKdPmKh, ap: dsKdPmKh > 0, dinhDang: dinhDangTien }}
          />
          <TheThongKe
            nhan="Thầu (trần 120%)"
            giaTri={dinhDangTien(dsThau)}
            phanTram={dsThauPct}
            keHoach={{ giaTri: dsThauKh, ap: dsThauKh > 0, dinhDang: dinhDangTien }}
          />
          <TheThongKe nhan="Tổng doanh thu" giaTri={dinhDangTien(dsTong)} />
        </div>
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
          <TheThongKe nhan="Tổng số đơn Mở mới" giaTri={String(moMoiSoDon)} />
          <TheThongKe nhan="Tổng doanh số Mở mới" giaTri={dinhDangTien(moMoiDoanhSo)} />
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
                const n = moMoiTheoNhom.find((x) => x.nhom === nhom);
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

        {donMoMoiSapXep.length > 0 ? (
          <div className="border-t border-slate-100 px-6 py-5">
            <p className="mb-3 text-sm font-medium text-slate-700">
              Chi tiết từng đơn Mở mới ({donMoMoiSapXep.length} đơn)
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
                  {donMoMoiSapXep.map((don, i) => (
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
          <CanhBao>
            Chưa có danh sách khách hàng mục tiêu + chỉ tiêu sản lượng Duy trì tháng này
            {laCaNhom ? " cho cả nhóm" : " cho nhân viên này"}.
          </CanhBao>
        ) : null}

        <div className="p-6">
          <TheThongKe
            nhan="Khách hàng đạt chỉ tiêu"
            giaTri={`${duyTriDat} / ${duyTriTong}`}
            phanTram={duyTriTong > 0 ? duyTriPct : null}
          />
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

      {/* ---- Điểm KPI tổng ---- */}
      {!laCaNhom ? (
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

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Tổng điểm chính thức của công ty là <b>1000 điểm</b>, cần đạt <b>≥850 điểm</b> và{" "}
              <b>không có chỉ tiêu nào dưới 50%</b> mới tính đạt KPI. Số ở trên chỉ tính các mục hệ thống này đang
              theo dõi (Doanh số Kê đơn/Phòng mạch, Doanh số Thầu, Mở mới, Duy trì) — chưa gồm Code mới, điểm Nhân sự
              (của SS), điểm SP thị trường (của NV thử việc) hay điểm thưởng/trừ thủ công.
            </p>

            {(nvDiemKpi?.diemKhTong ?? 0) < 950 ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                Dữ liệu chỉ tiêu tháng này trong hệ thống mới theo dõi được{" "}
                <b>{(nvDiemKpi?.diemKhTong ?? 0).toFixed(0)}/1000 điểm</b> — chưa đủ để kết luận đạt/không đạt KPI
                chính thức.
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
                  ? "✅ Đạt KPI (dựa trên dữ liệu hệ thống đang theo dõi)."
                  : "❌ Chưa đạt KPI (dựa trên dữ liệu hệ thống đang theo dõi)."}
              </div>
            )}

            {nvDiemKpi && nvDiemKpi.duoi50.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm font-medium text-slate-700">Chỉ tiêu đang dưới 50%:</p>
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
      ) : null}
    </div>
  );
}

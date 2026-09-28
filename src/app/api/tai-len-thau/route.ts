import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { TEN_COOKIE_MA_NV } from "@/lib/gate";

function chuoiHoacRong(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "");
  return String(v).trim();
}

function soHoacNull(v: ExcelJS.CellValue): number | null {
  const s = chuoiHoacRong(v);
  if (!s) return null;
  const n = Number(s.replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

function ngayHoacNull(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  const s = chuoiHoacRong(v);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function POST(request: NextRequest) {
  const nguoiDangXem = (await cookies()).get(TEN_COOKIE_MA_NV)?.value || null;
  const supabase = await createClient();

  const { data: nvSS } = await supabase.from("nhan_vien").select("ma_nv").eq("vai_tro", "ss").maybeSingle();
  if (!nvSS || nguoiDangXem !== nvSS.ma_nv) {
    return NextResponse.redirect(new URL("/tien-do-thau?loi=quyen", request.url), { status: 303 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.redirect(new URL("/tien-do-thau?loi=file", request.url), { status: 303 });
  }

  const { data: dsNhanVien } = await supabase.from("nhan_vien").select("ma_nv, ten_nv");
  const maNvTheoTen = new Map((dsNhanVien ?? []).map((nv) => [nv.ten_nv, nv.ma_nv]));

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const banGhi: Record<string, unknown>[] = [];
  const daThay = new Set<string>();

  workbook.eachSheet((sheet) => {
    if (!sheet.name.startsWith("Thầu ")) return;
    sheet.eachRow((row, soDong) => {
      if (soDong === 1) return;
      const values = row.values as ExcelJS.CellValue[];
      const soHd = chuoiHoacRong(values[1]);
      const maHang = chuoiHoacRong(values[7]);
      const maKhach = chuoiHoacRong(values[4]);
      if (!soHd || !maHang) return;
      const khoa = `${soHd}|${maKhach}|${maHang}`;
      if (daThay.has(khoa)) return;
      daThay.add(khoa);

      const tenNvTrienKhai = chuoiHoacRong(values[22]) || null;
      banGhi.push({
        khu_vuc: sheet.name,
        so_hd: soHd,
        ngay_bat_dau: ngayHoacNull(values[2]),
        ngay_het_han: ngayHoacNull(values[3]),
        ma_khach: maKhach || null,
        ten_khach: chuoiHoacRong(values[5]) || null,
        tinh: chuoiHoacRong(values[6]) || null,
        ma_hang: maHang,
        ten_mat_hang: chuoiHoacRong(values[8]) || null,
        gia_ban_ke_hoach: soHoacNull(values[9]),
        sl_ke_hoach: soHoacNull(values[10]),
        sl_thuc_hien: soHoacNull(values[11]),
        sl_con_lai: soHoacNull(values[12]),
        dieu_kien: chuoiHoacRong(values[13]) || null,
        sl_vuot_thau: soHoacNull(values[14]),
        sl_dieu_chuyen_tang: soHoacNull(values[15]),
        sl_dieu_chuyen_giam: soHoacNull(values[16]),
        sl_ke_hoach_thuc: soHoacNull(values[17]),
        ty_le_thuc_hien: soHoacNull(values[18]),
        giai_trinh: chuoiHoacRong(values[19]) || null,
        giai_phap_khac_phuc: chuoiHoacRong(values[20]) || null,
        nhom_trien_khai: chuoiHoacRong(values[21]) || null,
        ten_nv_trien_khai: tenNvTrienKhai,
        ma_nv: tenNvTrienKhai ? maNvTheoTen.get(tenNvTrienKhai) ?? null : null,
        quan_ly_phu_trach: chuoiHoacRong(values[23]) || null,
        khoa_phong_da_trien_khai: chuoiHoacRong(values[24]) || null,
        updated_at: new Date().toISOString(),
      });
    });
  });

  if (banGhi.length === 0) {
    return NextResponse.redirect(new URL("/tien-do-thau?loi=trong", request.url), { status: 303 });
  }

  await supabase.from("thau_hop_dong").delete().not("id", "is", null);
  const { error } = await supabase.from("thau_hop_dong").insert(banGhi);
  if (error) {
    return NextResponse.redirect(new URL("/tien-do-thau?loi=luu", request.url), { status: 303 });
  }

  return NextResponse.redirect(new URL("/tien-do-thau?ok=1", request.url), { status: 303 });
}

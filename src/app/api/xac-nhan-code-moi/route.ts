import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TEN_COOKIE_MA_NV } from "@/lib/gate";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const maToChuc = String(formData.get("ma_to_chuc") ?? "");
  const maNv = String(formData.get("ma_nv") ?? "");
  const maChungTuDauTien = String(formData.get("ma_chung_tu_dau_tien") ?? "") || null;
  const ngayPhatHien = String(formData.get("ngay_phat_hien") ?? "");
  const quyetDinh = String(formData.get("quyet_dinh") ?? "");

  if (!maToChuc || !maNv || !ngayPhatHien || !["da_duyet", "tu_choi"].includes(quyetDinh)) {
    return NextResponse.redirect(new URL("/xac-nhan-code-moi?loi=1", request.url), { status: 303 });
  }

  const nguoiDuyet = (await cookies()).get(TEN_COOKIE_MA_NV)?.value || null;
  const supabase = await createClient();

  const { data: nvSS } = await supabase
    .from("nhan_vien")
    .select("ma_nv")
    .eq("vai_tro", "ss")
    .maybeSingle();
  if (!nvSS || nguoiDuyet !== nvSS.ma_nv) {
    return NextResponse.redirect(new URL("/xac-nhan-code-moi?loi=1", request.url), { status: 303 });
  }

  const { data: dongDaCo } = await supabase
    .from("new_code_confirmations")
    .select("id")
    .eq("ma_to_chuc", maToChuc)
    .maybeSingle();

  const banGhi = {
    ma_to_chuc: maToChuc,
    ma_nv: maNv,
    ma_chung_tu_dau_tien: maChungTuDauTien,
    ngay_phat_hien: ngayPhatHien,
    trang_thai: quyetDinh,
    nguoi_duyet: nguoiDuyet,
    ngay_duyet: new Date().toISOString(),
  };

  if (dongDaCo) {
    await supabase.from("new_code_confirmations").update(banGhi).eq("id", dongDaCo.id);
  } else {
    await supabase.from("new_code_confirmations").insert(banGhi);
  }

  return NextResponse.redirect(new URL("/xac-nhan-code-moi", request.url), { status: 303 });
}

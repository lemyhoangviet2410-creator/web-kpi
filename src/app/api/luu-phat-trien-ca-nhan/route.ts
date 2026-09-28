import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TEN_COOKIE_MA_NV } from "@/lib/gate";

export async function POST(request: NextRequest) {
  const nguoiDangXem = (await cookies()).get(TEN_COOKIE_MA_NV)?.value || null;
  const supabase = await createClient();

  const { data: nvSS } = await supabase.from("nhan_vien").select("ma_nv").eq("vai_tro", "ss").maybeSingle();
  if (!nvSS || nguoiDangXem !== nvSS.ma_nv) {
    return NextResponse.redirect(new URL("/phat-trien-ca-nhan?loi=quyen", request.url), { status: 303 });
  }

  const formData = await request.formData();
  const thang = String(formData.get("thang") ?? "");
  const noiDung = String(formData.get("noi_dung") ?? "");

  if (!thang) {
    return NextResponse.redirect(new URL("/phat-trien-ca-nhan?loi=thieu", request.url), { status: 303 });
  }

  const { data: dongDaCo } = await supabase
    .from("ghi_chu_phat_trien")
    .select("id")
    .eq("thang", thang)
    .maybeSingle();

  const banGhi = { thang, noi_dung: noiDung, cap_nhat_luc: new Date().toISOString() };

  if (dongDaCo) {
    await supabase.from("ghi_chu_phat_trien").update(banGhi).eq("id", dongDaCo.id);
  } else {
    await supabase.from("ghi_chu_phat_trien").insert(banGhi);
  }

  return NextResponse.redirect(new URL("/phat-trien-ca-nhan?ok=1", request.url), { status: 303 });
}

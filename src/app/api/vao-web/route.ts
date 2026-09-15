import { NextRequest, NextResponse } from "next/server";
import {
  MAT_KHAU_TRUY_CAP,
  TEN_COOKIE_DA_VAO,
  GIA_TRI_COOKIE_DA_VAO,
  TEN_COOKIE_MA_NV,
} from "@/lib/gate";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const matKhau = String(formData.get("mat_khau") ?? "");
  const maNv = String(formData.get("ma_nv") ?? "").trim();

  if (matKhau !== MAT_KHAU_TRUY_CAP) {
    const urlLoi = new URL("/vao-web", request.url);
    urlLoi.searchParams.set("loi", "1");
    return NextResponse.redirect(urlLoi, { status: 303 });
  }

  // Chỉ bật cờ "secure" khi chạy https (Vercel) — cookie secure sẽ bị trình duyệt
  // (đặc biệt Safari) từ chối lưu khi test ở http://localhost, khiến vào đúng
  // mật khẩu vẫn bị đẩy lại màn nhập.
  const chayHttps = request.nextUrl.protocol === "https:";

  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.set(TEN_COOKIE_DA_VAO, GIA_TRI_COOKIE_DA_VAO, {
    httpOnly: true,
    secure: chayHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  if (maNv) {
    response.cookies.set(TEN_COOKIE_MA_NV, maNv, {
      httpOnly: true,
      secure: chayHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  } else {
    response.cookies.delete(TEN_COOKIE_MA_NV);
  }
  return response;
}

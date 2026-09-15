import { NextRequest, NextResponse } from "next/server";
import { MAT_KHAU_TRUY_CAP, TEN_COOKIE_DA_VAO, GIA_TRI_COOKIE_DA_VAO } from "@/lib/gate";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const matKhau = String(formData.get("mat_khau") ?? "");

  if (matKhau !== MAT_KHAU_TRUY_CAP) {
    const urlLoi = new URL("/vao-web", request.url);
    urlLoi.searchParams.set("loi", "1");
    return NextResponse.redirect(urlLoi, { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.set(TEN_COOKIE_DA_VAO, GIA_TRI_COOKIE_DA_VAO, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return response;
}

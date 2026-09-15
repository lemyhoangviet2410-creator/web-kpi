import { NextResponse, type NextRequest } from "next/server";
import { TEN_COOKIE_DA_VAO, GIA_TRI_COOKIE_DA_VAO } from "@/lib/gate";

const DUONG_DAN_CONG_KHAI = ["/vao-web", "/api/vao-web"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (DUONG_DAN_CONG_KHAI.some((duongDan) => pathname.startsWith(duongDan))) {
    return NextResponse.next();
  }

  const daVao = request.cookies.get(TEN_COOKIE_DA_VAO)?.value === GIA_TRI_COOKIE_DA_VAO;
  if (!daVao) {
    const urlVaoWeb = new URL("/vao-web", request.url);
    return NextResponse.redirect(urlVaoWeb);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

import { NextRequest, NextResponse } from "next/server";
import { TEN_COOKIE_DA_VAO } from "@/lib/gate";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/vao-web", request.url), { status: 303 });
  response.cookies.delete(TEN_COOKIE_DA_VAO);
  return response;
}

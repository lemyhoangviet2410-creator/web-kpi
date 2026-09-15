"use client";

import { useRouter } from "next/navigation";

export default function NutDangXuat() {
  const router = useRouter();

  async function xuLy() {
    await fetch("/api/thoat", { method: "POST" });
    router.push("/vao-web");
    router.refresh();
  }

  return (
    <button
      onClick={xuLy}
      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      Đăng xuất
    </button>
  );
}

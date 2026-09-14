"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NutDangXuat() {
  const router = useRouter();

  async function xuLy() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={xuLy}
      style={{ padding: "4px 10px", fontSize: "0.85rem", cursor: "pointer" }}
    >
      Đăng xuất
    </button>
  );
}

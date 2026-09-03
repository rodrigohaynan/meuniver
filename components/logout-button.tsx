"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <button type="button" onClick={() => void logout()} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#ded0c8] bg-white px-4 text-sm font-bold text-[#684f55]">
      <LogOut className="size-4" /> Sair
    </button>
  );
}

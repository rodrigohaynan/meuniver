"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

export function AdminDeleteInvitationButton({
  id,
  title,
  onDeleted,
}: {
  id: string;
  title: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (deleting) return;
    const target = title.trim() || "este convite";
    if (!window.confirm(
      `Excluir definitivamente "${target}"?\n\nTambém serão excluídos os presentes, as reservas e as confirmações de presença vinculados ao convite. Esta ação não pode ser desfeita.`,
    )) return;

    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/invitations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "EXCLUIR" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir o convite.");
      if (onDeleted) onDeleted();
      else router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o convite.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-red-200 bg-white px-4 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
      >
        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        {deleting ? "Excluindo..." : "Excluir"}
      </button>
      {error && <p role="alert" className="max-w-xs text-xs font-semibold text-red-700">{error}</p>}
    </div>
  );
}

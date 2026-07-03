"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 transition-colors mb-6"
    >
      <ArrowLeft size={16} /> Voltar
    </button>
  );
}

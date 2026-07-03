import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: "green" | "blue" | "purple" | "orange";
  sub?: string;
}

const colors = {
  green:  { bg: "bg-brand-50",  icon: "bg-brand-500",  text: "text-brand-600" },
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-500",   text: "text-blue-600" },
  purple: { bg: "bg-purple-50", icon: "bg-purple-500", text: "text-purple-600" },
  orange: { bg: "bg-orange-50", icon: "bg-orange-500", text: "text-orange-600" },
};

export function StatCard({ label, value, icon: Icon, color = "green", sub }: StatCardProps) {
  const c = colors[color];
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center", c.icon)}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

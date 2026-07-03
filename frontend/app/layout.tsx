import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";
import { AuthProvider } from "@/lib/authContext";

export const metadata: Metadata = {
  title: "FutAnalytics",
  description: "Dashboard de análise e descoberta de jogadores de futebol",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}

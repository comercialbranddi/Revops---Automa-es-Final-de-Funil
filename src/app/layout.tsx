import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observabilidade — Funil de Eventos",
  description: "Branddi · RevOps · Observabilidade do pipeline 7. Eventos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}

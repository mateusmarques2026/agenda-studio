import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Studio — Gestão da barbearia",
  description:
    "Serviços, clientes e agendamentos em um só lugar. Projeto de portfólio para pequenos negócios.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

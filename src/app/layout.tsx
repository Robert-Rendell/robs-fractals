import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/nav";

export const metadata: Metadata = {
  title: "Robs Fractals",
  description: "Robs Fractals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main style={{ padding: "2rem 1.5rem", flex: 1 }}>{children}</main>
      </body>
    </html>
  );
}

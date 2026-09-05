import type { Metadata } from "next";
import "./globals.css";
import Nav from "./components/nav";
import MainContent from "./components/main-content";

export const metadata: Metadata = {
  title: "Rob's Fractals",
  description: "Rob's Fractals",
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
        <MainContent>{children}</MainContent>
      </body>
    </html>
  );
}

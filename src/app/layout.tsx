import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global",
  description: "3D global explorer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-white antialiased ">
      <body className="h-full flex flex-col bg-white ">{children}</body>
    </html>
  );
}

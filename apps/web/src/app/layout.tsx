import type { Metadata } from "next";
import { Inter, Montserrat, Lato } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat"
});
const lato = Lato({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-lato"
});

export const metadata: Metadata = {
  title: "Notes App",
  description: "This is an app to take notes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} ${lato.variable}`}>
      <body className={inter.className}>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}

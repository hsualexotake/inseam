import type { Metadata } from "next";
import { Inter, Montserrat, Lato, Libre_Baskerville } from "next/font/google";
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
const baskerville = Libre_Baskerville({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-baskerville"
});

export const metadata: Metadata = {
  title: "Inseam",
  description: "Intelligent tracking and updates delivered straight to your inbox.",
  icons: {
    icon: "/images/combologo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} ${lato.variable} ${baskerville.variable}`}>
      <body className={inter.className}>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}

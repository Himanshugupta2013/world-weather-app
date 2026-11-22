import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyRoute — Weather & Travel Planner",
  description: "Explore worldwide weather forecasts and find a promising time to travel.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

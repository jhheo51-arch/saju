import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./palace-theme.css";
import "./cute-theme.css";

export const metadata: Metadata = {
  title: "나만의 사주 | 쉬운 해석",
  description: "사주 계산과 관심 주제 선택 흐름을 확인하는 화면 프로토타입",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

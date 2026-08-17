import type { ReactElement, ReactNode } from "react";

export const metadata = {
  title: "Polar AI Commerce — Admin",
  description: "Customer 360, Inbox, AI, Knowledge, Campaigns, and Analytics for Polar AI Commerce.",
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

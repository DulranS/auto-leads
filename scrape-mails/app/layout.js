// app/layout.js
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script async src="https://accounts.google.com/gsi/client" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
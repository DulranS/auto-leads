// app/layout.js
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script async src="https://accounts.google.com/gsi/client" />
      </head>
      <body>{children}</body>
    </html>
  );
}
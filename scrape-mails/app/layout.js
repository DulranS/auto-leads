// app/layout.js
import './globals.css';
import ExtensionCleaner from './components/ExtensionCleaner';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script async src="https://accounts.google.com/gsi/client" />
      </head>
      <body suppressHydrationWarning>
        <ExtensionCleaner />
        {children}
      </body>
    </html>
  );
}
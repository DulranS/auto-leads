// app/layout.js
import './globals.css';
import ExtensionCleaner from './components/ExtensionCleaner';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script async src="https://accounts.google.com/gsi/client" />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Block extension interference
            (function() {
              const originalDefineProperty = Object.defineProperty;
              Object.defineProperty = function(obj, prop, descriptor) {
                if (prop === 'ethereum' && window.ethereum) {
                  return;
                }
                return originalDefineProperty.call(this, obj, prop, descriptor);
              };
            })();
          `
        }} />
      </head>
      <body suppressHydrationWarning>
        <noscript>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <h1>JavaScript must be enabled to use this application</h1>
          </div>
        </noscript>
        <ExtensionCleaner />
        {children}
      </body>
    </html>
  );
}
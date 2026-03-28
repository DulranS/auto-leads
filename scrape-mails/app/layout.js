// app/layout.js
import './globals.css';
import ExtensionCleaner from './components/ExtensionCleaner';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script async src="https://accounts.google.com/gsi/client" />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Suppress extension errors before they happen
            (function() {
              const originalError = console.error;
              const originalWarn = console.warn;
              const originalLog = console.log;
              
              function shouldSuppress(...args) {
                const str = args.join(' ').toString();
                return str.includes('webextension') || 
                       str.includes('TronWeb') || 
                       str.includes('bybit') ||
                       str.includes('gethookd') ||
                       str.includes('evmAsk') ||
                       str.includes('frame_ant') ||
                       str.includes('lockdown-install');
              }
              
              console.error = function(...args) {
                if (shouldSuppress(...args)) return;
                return originalError.apply(console, args);
              };
              
              console.warn = function(...args) {
                if (shouldSuppress(...args)) return;
                return originalWarn.apply(console, args);
              };
              
              console.log = function(...args) {
                if (shouldSuppress(...args)) return;
                return originalLog.apply(console, args);
              };
              
              // Prevent extension DOM manipulation
              Object.defineProperty(document.documentElement, 'setAttribute', {
                value: function(name, value) {
                  if (name.startsWith('data-bybit') || 
                      name.startsWith('data-extension') ||
                      name.includes('channel-name') ||
                      name.includes('wallet')) {
                    return;
                  }
                  return HTMLElement.prototype.setAttribute.call(this, name, value);
                }
              });
            })();
          `
        }} />
      </head>
      <body suppressHydrationWarning>
        <ExtensionCleaner />
        {children}
      </body>
    </html>
  );
}
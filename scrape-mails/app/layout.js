// app/layout.js
import './globals.css';
import ExtensionCleaner from './components/ExtensionCleaner';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { NotificationProvider } from './components/ui/NotificationProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script async src="https://accounts.google.com/gsi/client" />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Suppress extension errors before they happen - with comprehensive error handling
            (function() {
              try {
                // Safely get original console methods
                const originalError = window.console && window.console.error;
                const originalWarn = window.console && window.console.warn;
                const originalLog = window.console && window.console.log;
                
                // Safe suppression function
                function shouldSuppress(...args) {
                  try {
                    if (!args || args.length === 0) return false;
                    const str = args.join(' ').toString().toLowerCase();
                    return str.includes('webextension') || 
                           str.includes('tronweb') || 
                           str.includes('bybit') ||
                           str.includes('gethookd') ||
                           str.includes('evmAsk') ||
                           str.includes('frame_ant') ||
                           str.includes('lockdown-install');
                  } catch (e) {
                    return false;
                  }
                }
                
                // Safe console override
                if (window.console && originalError) {
                  window.console.error = function(...args) {
                    try {
                      if (shouldSuppress(...args)) return;
                      return originalError.apply(window.console, args);
                    } catch (e) {
                      // Silent fail
                    }
                  };
                }
                
                if (window.console && originalWarn) {
                  window.console.warn = function(...args) {
                    try {
                      if (shouldSuppress(...args)) return;
                      return originalWarn.apply(window.console, args);
                    } catch (e) {
                      // Silent fail
                    }
                  };
                }
                
                if (window.console && originalLog) {
                  window.console.log = function(...args) {
                    try {
                      if (shouldSuppress(...args)) return;
                      return originalLog.apply(window.console, args);
                    } catch (e) {
                      // Silent fail
                    }
                  };
                }
                
                // Safe DOM manipulation prevention
                if (document && document.documentElement && HTMLElement && HTMLElement.prototype) {
                  try {
                    Object.defineProperty(document.documentElement, 'setAttribute', {
                      value: function(name, value) {
                        try {
                          if (name && typeof name === 'string' && (
                              name.startsWith('data-bybit') || 
                              name.startsWith('data-extension') ||
                              name.includes('channel-name') ||
                              name.includes('wallet'))) {
                            return;
                          }
                          return HTMLElement.prototype.setAttribute.call(this, name, value);
                        } catch (e) {
                          // Silent fail - use original method
                          try {
                            return HTMLElement.prototype.setAttribute.call(this, name, value);
                          } catch (e2) {
                            // Complete fail - do nothing
                          }
                        }
                      },
                      configurable: false,
                      writable: false
                    });
                  } catch (e) {
                    // Silent fail - DOM protection not available
                  }
                }
              } catch (e) {
                // Complete script failure - don't break the app
                console.warn('Extension blocker script failed:', e);
              }
            })();

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script async src="https://accounts.google.com/gsi/client" />
        <script dangerouslySetInnerHTML={{
          __html: \`(function() { try { const originalError = window.console && window.console.error; const originalWarn = window.console && window.console.warn; const originalLog = window.console && window.console.log; function shouldSuppress(...args) { try { if (!args || args.length === 0) return false; const str = args.join(' ').toString(); return str.includes('webextension') || str.includes('TronWeb') || str.includes('bybit') || str.includes('gethookd') || str.includes('evmAsk') || str.includes('frame_ant') || str.includes('lockdown-install'); } catch (e) { return false; } } if (window.console && originalError) { window.console.error = function(...args) { try { if (shouldSuppress(...args)) return; return originalError.apply(window.console, args); } catch (e) {} }; } if (window.console && originalWarn) { window.console.warn = function(...args) { try { if (shouldSuppress(...args)) return; return originalWarn.apply(window.console, args); } catch (e) {} }; } if (window.console && originalLog) { window.console.log = function(...args) { try { if (shouldSuppress(...args)) return; return originalLog.apply(window.console, args); } catch (e) {} }; } if (document && document.documentElement && HTMLElement && HTMLElement.prototype) { try { Object.defineProperty(document.documentElement, 'setAttribute', { value: function(name, value) { try { if (name && typeof name === 'string' && (name.startsWith('data-bybit') || name.startsWith('data-extension') || (name.includes && name.includes('channel-name')) || (name.includes && name.includes('wallet')))) { return; } return HTMLElement.prototype.setAttribute.call(this, name, value); } catch (e) { try { return HTMLElement.prototype.setAttribute.call(this, name, value); } catch (e2) {} } }, configurable: false, writable: false }); } catch (e) {} } } catch (e) { console.warn('Extension blocker script failed:', e); } })();\`
        }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <NotificationProvider>
            <ExtensionCleaner />
            {children}
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
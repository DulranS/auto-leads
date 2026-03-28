'use client';

import { useEffect } from 'react';

export default function ExtensionCleaner() {
  useEffect(() => {
    // Comprehensive extension cleanup
    const cleanExtensions = () => {
      try {
        // Remove extension-injected attributes
        const html = document.documentElement;
        const body = document.body;
        
        if (html) {
          // Remove all data-* attributes that could cause hydration issues
          const attributes = html.attributes;
          for (let i = attributes.length - 1; i >= 0; i--) {
            const attr = attributes[i];
            if (attr.name.startsWith('data-bybit') || 
                attr.name.startsWith('data-extension') ||
                attr.name.startsWith('data-webext') ||
                attr.name.includes('channel-name') ||
                attr.name.includes('wallet')) {
              html.removeAttribute(attr.name);
            }
          }
        }
        
        // Remove extension-injected elements
        const extensionElements = document.querySelectorAll('[id*="extension"], [class*="extension"], [data-webext]');
        extensionElements.forEach(el => el.remove());
        
        // Suppress extension errors
        const originalError = console.error;
        console.error = (...args) => {
          if (args[0] && typeof args[0] === 'string' && 
              (args[0].includes('webextension') || 
               args[0].includes('TronWeb') || 
               args[0].includes('bybit'))) {
            return; // Suppress extension errors
          }
          originalError.apply(console, args);
        };
        
      } catch (e) {
        // Silent fail - don't break the app
      }
    };

    // Run multiple times to catch late-injecting extensions
    const timer1 = setTimeout(cleanExtensions, 100);
    const timer2 = setTimeout(cleanExtensions, 500);
    const timer3 = setTimeout(cleanExtensions, 1000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return null;
}

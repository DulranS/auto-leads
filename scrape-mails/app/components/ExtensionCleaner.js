'use client';

import { useEffect } from 'react';

export default function ExtensionCleaner() {
  useEffect(() => {
    // Remove extension-injected attributes that cause hydration issues
    const removeExtensionAttributes = () => {
      const html = document.documentElement;
      if (html) {
        // Remove common extension attributes
        html.removeAttribute('data-bybit-channel-name');
        html.removeAttribute('data-bybit-is-default-wallet');
        html.removeAttribute('data-extension-version');
        // Add more as needed for other extensions
      }
    };

    // Run after hydration
    const timer = setTimeout(removeExtensionAttributes, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return null;
}

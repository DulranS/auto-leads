// lib/firebase-cache.js
/**
 * Firebase Query Caching Utility
 * 
 * Provides in-memory caching for Firebase queries to reduce:
 * - Firestore read costs
 * - API latency
 * - Unnecessary database hits
 * 
 * Cache TTL (Time To Live): 5 minutes by default
 */

class FirebaseCache {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate a cache key from query parameters
   */
  generateKey(collectionName, filters = {}, options = {}) {
    const keyParts = [
      collectionName,
      JSON.stringify(filters),
      JSON.stringify(options)
    ];
    return keyParts.join('|');
  }

  /**
   * Get cached data if available and not expired
   */
  get(collectionName, filters = {}, options = {}) {
    const key = this.generateKey(collectionName, filters, options);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache is expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set data in cache with expiration
   */
  set(collectionName, data, filters = {}, options = {}, ttl = this.defaultTTL) {
    const key = this.generateKey(collectionName, filters, options);
    
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
    
    // Clean up old entries periodically
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  /**
   * Remove expired entries from cache
   */
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific collection
   */
  clearCollection(collectionName) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(collectionName + '|')) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;
    
    for (const value of this.cache.values()) {
      if (now > value.expiresAt) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      activeEntries: activeCount,
      expiredEntries: expiredCount
    };
  }
}

// Singleton instance
const firebaseCache = new FirebaseCache();

/**
 * Cached query wrapper for Firestore
 * 
 * @param {Function} queryFn - The Firestore query function to execute
 * @param {string} collectionName - Name of the collection being queried
 * @param {object} filters - Query filters for cache key generation
 * @param {object} options - Query options for cache key generation
 * @param {number} ttl - Custom TTL in milliseconds (optional)
 */
export async function cachedQuery(queryFn, collectionName, filters = {}, options = {}, ttl) {
  // Try to get from cache first
  const cached = firebaseCache.get(collectionName, filters, options);
  if (cached) {
    console.log(`[Cache HIT] ${collectionName}`);
    return cached;
  }
  
  // Execute query if not in cache
  console.log(`[Cache MISS] ${collectionName}`);
  const data = await queryFn();
  
  // Store in cache
  firebaseCache.set(collectionName, data, filters, options, ttl);
  
  return data;
}

/**
 * Invalidate cache for a specific collection
 */
export function invalidateCache(collectionName) {
  firebaseCache.clearCollection(collectionName);
  console.log(`[Cache INVALIDATED] ${collectionName}`);
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  firebaseCache.clear();
  console.log('[Cache CLEARED] All entries');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return firebaseCache.getStats();
}

export default firebaseCache;

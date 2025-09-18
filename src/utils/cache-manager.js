// Cache management tool utility
const { t } = require('../lang');

class CacheManagerTool {
  constructor(options = {}) {
    this.iconCache = options.iconCache || new Map();
    this.searchCache = options.searchCache || new Map();
    this.cacheExpiry = options.cacheExpiry || 30 * 60 * 1000; // 30 minutes
  }
  /**获取等待处理的数量**/
  async get_waiting_count() {
    // 统计状态不存在或者状态不是 'failed' 和 'completed' 的数量
    let waitingCount = 0;
    
    for (const [key, value] of this.searchCache.entries()) {
      // 检查是否有状态字段
      if (!value.status || (value.status !== 'failed' && value.status !== 'completed')) {
        waitingCount++;
      }
    }
    
    return waitingCount;
  }
  /**
   * Get cache statistics
   * @param {Object} params - Parameters
   * @returns {Object} Cache statistics
   */
  async get_cache_stats(params) {
    const now = Date.now();
    const validIconEntries = Array.from(this.iconCache.entries()).filter(([key, value]) =>
      now - value.timestamp < this.cacheExpiry
    );
    const validSearchEntries = Array.from(this.searchCache.entries()).filter(([key, value]) =>
      now - value.timestamp < this.cacheExpiry
    );

    return {
      iconCache: {
        totalEntries: this.iconCache.size,
        validEntries: validIconEntries.length,
        expiredEntries: this.iconCache.size - validIconEntries.length
      },
      searchCache: {
        totalEntries: this.searchCache.size,
        validEntries: validSearchEntries.length,
        expiredEntries: this.searchCache.size - validSearchEntries.length
      },
      cacheExpiryMinutes: this.cacheExpiry / (60 * 1000),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Clear cache
   * @param {Object} params - Parameters
   * @returns {Object} Clear result
   */
  async clear_cache(params) {
    const { expiredOnly = false } = params || {};

    if (expiredOnly) {
      const now = Date.now();
      for (const [key, value] of this.iconCache.entries()) {
        if (now - value.timestamp >= this.cacheExpiry) {
          this.iconCache.delete(key);
        }
      }

      // Also clean up search result cache
      for (const [key, value] of this.searchCache.entries()) {
        if (now - value.timestamp >= this.cacheExpiry) {
          this.searchCache.delete(key);
        }
      }
    } else {
      this.iconCache.clear();
      this.searchCache.clear();
    }

    return {
      message: expiredOnly ? t('cache.expiredEntriesCleared') : t('cache.allEntriesCleared'),
      remainingEntries: this.iconCache.size,
      searchCacheEntries: this.searchCache.size
    };
  }
}

module.exports = CacheManagerTool;

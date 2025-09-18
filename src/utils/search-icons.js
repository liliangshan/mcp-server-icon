// Search icons tool utility
const { t } = require('../lang');

// Icon cache and API configuration
const ICONFONT_API_BASE = 'https://www.iconfont.cn/api/icon/search.json';

class SearchIconsTool {
  constructor(options = {}) {
    this.iconCache = options.iconCache || new Map();
    this.searchCache = options.searchCache || new Map();
    this.selectionCache = options.selectionCache || new Map();
    this.cacheExpiry = options.cacheExpiry || 30 * 60 * 1000; // 30 minutes
    this.httpServer = options.httpServer || null;
    this.webServerAutoOpen = options.webServerAutoOpen || false;
  }

  async fetchIconData(params) {
    const {
      q = '',
      sortType = 'updated_at',
      page = 1,
      pageSize = 100,
      sType = '',
      fromCollection = -1,
      fills = ''
    } = params;

    return new Promise(async(resolve, reject) => {
      const cacheKey = `search_${q}_${sortType}_${page}_${pageSize}_${sType}_${fromCollection}_${fills}`;
      if (this.iconCache.has(cacheKey)) {
        const cached = this.iconCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          resolve(cached.data);
          return;
        }
      }

      const requestParams = new URLSearchParams({
        q: q,
        sortType,
        page,
        pageSize,
        sType,
        fromCollection,
        fills,
        t: Date.now(),
        ctoken: 'null'
      });

      const response = await fetch(ICONFONT_API_BASE, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: requestParams.toString(),
        signal: AbortSignal.timeout(parseInt(process.env.ICON_SEARCH_TIMEOUT) || 30000) // 30 second timeout
      });

      if (!response.ok) {
        reject(new Error(`HTTP error! status: ${response.status}`));
        return;
      }

      const data = await response.json();

      if (data.code !== 200) {
        reject(new Error(`API returned error: ${data.message || 'Unknown error'}`));
        return;
      }

      this.iconCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      resolve(data);
    });
  }
  /**
   * Search icons from iconfont.cn
   * @param {Object} params - Search parameters
   * @returns {Object} Search results
   */
  async search_icons(params) {

    const {
      q = '',
      sortType = 'updated_at',
      page = 1,
      pageSize = 100,
      sType = '',
      fromCollection = -1,
      fills = ''
    } = params;

    // Validate parameters
    if (typeof page !== 'number' || page < 1) {
      throw new Error('page parameter must be a positive number');
    }
    if (typeof pageSize !== 'number' || pageSize < 1 || pageSize > 100) {
      throw new Error('pageSize parameter must be between 1-100');
    }

    // Create cache key
    const cacheKey = `search_${q}_${sortType}_${page}_${pageSize}_${sType}_${fromCollection}_${fills}`;

    // Check cache first
    if (this.iconCache.has(cacheKey)) {
      const cached = this.iconCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        const data = cached.data;
        
        // Generate search result cache ID
        const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.searchCache.set(searchId, {
          data: data,
          timestamp: Date.now(),
          searchParams: { q, sortType, page, pageSize, sType, fromCollection, fills }
        });

        // Create result object
        let result = {
          searchId: searchId,
          webUrl: this.httpServer ? `${this.httpServer.getUrl()}?searchId=${searchId}` : `http://localhost:3000?searchId=${searchId}`,
          waitingMessage: t('search.pleaseWaitForSelection'),
          count: data.data?.icons?.length || 0,
         // data: data.data || {},
          instructions: [
            `1. ${t('search.browseResults')}`,
            `2. ${t('search.clickSelectButton')}`,
            `3. ${t('search.clickSendButton')}`,
            `4. ${t('search.resultsAutoSent')}`
          ]
        };

        // If search results are not empty, handle browser opening
        if (data.data?.icons && data.data.icons.length > 0) {
          // Ensure HTTP server is started
          if (!this.httpServer || !this.httpServer.isRunning()) {
            try {
              await this.httpServer?.start({ autoOpen: this.webServerAutoOpen });
            } catch (error) {
              // Even if server fails to start, we should still return MCP format
            }
          }

          // Decide whether to auto-open browser based on configuration
          if (this.httpServer && this.httpServer.isRunning()) {
            const url = `${this.httpServer.getUrl()}?searchId=${searchId}`;

            if (this.webServerAutoOpen) {
              // Auto-open browser if configured
              this.httpServer.openBrowser(url);
            }

            result.webUrl = url;
          }
        }
        result.contentType = "application/vnd.x-mcp-embedded-prompt";
        result.content = [
          {
            type: "text",
            text: t('search.pleaseCheckSelectedIcons', { searchId: searchId })
          }
        ];
        return result;
      } else {
        this.iconCache.delete(cacheKey);
      }
    }

    try {
      // Make API request using built-in fetch
      const data = await this.fetchIconData({ q, sortType, page, pageSize, sType, fromCollection, fills });

      let result = null;

      const searchId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      result = {
        searchId: searchId,
        webUrl: this.httpServer ? `${this.httpServer.getUrl()}?searchId=${searchId}` : `http://localhost:3000?searchId=${searchId}`,
        waitingMessage: t('search.pleaseWaitForSelection'),
        count: data.data?.icons?.length || 0,
        // data: data.data || {},
        instructions: [
          `1. ${t('search.browseResults')}`,
          `2. ${t('search.clickSelectButton')}`,
          `3. ${t('search.clickSendButton')}`,
          `4. ${t('search.resultsAutoSent')}`
        ]
      };

      // Cache the result
      this.iconCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      // Generate search result cache ID
      // searchId is already defined above
      this.searchCache.set(searchId, {
        data: data,
        timestamp: Date.now(),
        searchParams: { q, sortType, page, pageSize, sType, fromCollection, fills }
      });
      this.selectionCache.set(searchId, {
        status: 'waiting',
        searchId: searchId,
        timestamp: Date.now(),
        connected: true
      });

      // If search results are not empty, handle browser opening
      if (data.data?.icons && data.data.icons.length > 0) {
        // process.stderr.write(`🔍 ${t('search.foundIcons', { count: result.data.icons.length })}\n`);

        // Ensure HTTP server is started
        if (!this.httpServer || !this.httpServer.isRunning()) {
          try {
            await this.httpServer?.start({ autoOpen: this.webServerAutoOpen });
          } catch (error) {
            //process.stderr.write(`⚠️  ${t('server.startupFailed')}: ${error.message}\n`);
            // Even if server fails to start, we should still return MCP format

            // Continue to MCP format return below
          }
        }

        // Decide whether to auto-open browser based on configuration
        if (this.httpServer && this.httpServer.isRunning()) {
          const url = `${this.httpServer.getUrl()}?searchId=${searchId}`;

          if (this.webServerAutoOpen) {
            // Auto-open browser if configured
            this.httpServer.openBrowser(url);
            //process.stderr.write(`🌐 ${t('search.autoOpenedBrowser')}: ${url}\n`);
            //process.stderr.write(`💡 ${t('search.pleaseSelectIconsInBrowser')}\n`);
          }

          result = {
            searchId: searchId,
            webUrl: `${this.httpServer.getUrl()}?searchId=${searchId}`,
            waitingMessage: t('search.pleaseWaitForSelection'),
            count: data.data?.icons?.length || 0,
            // data: data.data || {},
            instructions: [
              `1. ${t('search.browseResults')}`,
              `2. ${t('search.clickSelectButton')}`,
              `3. ${t('search.clickSendButton')}`,
              `4. ${t('search.resultsAutoSent')}`
            ]
          };

          // Silently wait for user selection
          //process.stderr.write(`🌐 ${t('search.webPageUrl')}: ${url}\n`);
          //process.stderr.write(`💡 ${t('search.pleaseSelectIconsInBrowser')}\n`);

          // Also update cached results
          this.searchCache.set(searchId, {
            data: data,
            timestamp: Date.now(),
            searchParams: { q, sortType, page, pageSize, sType, fromCollection, fills }
          });
       
        }
      }


      // Always return toolCall for search results with icons
      if (data.data?.icons && data.data.icons.length > 0) {
        // process.stderr.write(`[DEBUG] Found ${result.data.icons.length} icons, searchId: ${searchId}\n`);

        // Ensure we have searchId and basic info
        if (!result.searchId) {
          result.searchId = searchId;
        }
        if (!result.webUrl) {
          result.webUrl = this.httpServer ? `${this.httpServer.getUrl()}?searchId=${searchId}` : `http://localhost:3000?searchId=${searchId}`;
        }
        if (!result.waitingMessage) {
          result.waitingMessage = t('search.pleaseWaitForSelection');
        }
        if (!result.instructions || result.instructions.length === 0) {
          result.instructions = [
            `1. ${t('search.browseResults')}`,
            `2. ${t('search.clickSelectButton')}`,
            `3. ${t('search.clickSendButton')}`,
            `4. ${t('search.resultsAutoSent')}`
          ];
        }
        /*  return {
            message: t('search.searchError'),
            searchId: 'search_0',
            webUrl: 'http://localhost:3000?searchId=search_0',
            count:0,
            result
          };*/
        // Return standard result with toolCall information

      } else {
        // process.stderr.write(`[DEBUG] No icons found\n`);
      }
      this.selectionCache.set(searchId, {
        status: 'waiting',
        searchId: searchId,
        timestamp: Date.now(),
        connected: true
      });
      result.contentType = "application/vnd.x-mcp-embedded-prompt";
      result.content = [
        {
          type: "text",
          text: t('search.pleaseCheckSelectedIcons', { searchId: searchId })
        }
      ];
      return result;
    } catch (error) {
      return {
        message: t('search.searchErrorWithMessage', { message: error.message }),
        searchId: t('search.searchIdZero'),
        webUrl: t('search.webUrlZero'),
        count: t('search.countZero'),
        result: error.message
      };
    }
  }
}

module.exports = SearchIconsTool;

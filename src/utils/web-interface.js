// Web interface handler
const { t } = require('../lang');
const fs = require('fs');
const path = require('path');
const { executeSingleCommand }  = require('./window-utils-powershell');
class WebInterface {
    constructor(options = {}) {
        this.searchCache = options.searchCache || new Map();
        this.selectionCache = options.selectionCache || new Map();
        this.iconCache = options.iconCache || new Map();
        this.onSaveIcons = options.onSaveIcons || null;
        this.searchIconsTool = options.searchIconsTool || null;
        this.cacheExpiry = options.cacheExpiry || 30 * 60 * 1000; // 30 minutes
   
        this.language = options.language || 'en';
    }

    /**
     * Handle HTTP requests
     * @param {http.IncomingMessage} req - Request object
     * @param {http.ServerResponse} res - Response object
     */
    handleRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (pathname === '/') {
            this.serveIndexPage(res, url.searchParams);
        } else if (pathname === '/api/search') {
            this.handleSearchAPI(req, res);
        } else if (pathname === '/site.js') {
            fs.readFile(path.join(__dirname, 'site.'+this.language+'.js'), (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'application/javascript' });
                    res.end(data);
                }
            });
        } else if (pathname === '/api/save') {
            this.handleSaveAPI(req, res);
        } else if (pathname === '/api/cache') {
            this.handleCacheAPI(req, res, url.searchParams);
        } else if (pathname.startsWith('/api/icon/')) {
            this.handleIconAPI(req, res, pathname);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    }
  /**获取等待处理的数量**/
   get_waiting_count() {
    // 统计状态不存在或者状态不是 'failed' 和 'completed' 的数量
    let waitingCount = 0;
    
    for (const [key, value] of this.selectionCache.entries()) {
      // 检查是否有状态字段
      if (!value.status || (value.status !== 'failed' && value.status !== 'completed')) {
        waitingCount++;
      }
    }
    
    return waitingCount;
  }
    /**
     * Handle cache API
     * @param {http.IncomingMessage} req - Request object
     * @param {http.ServerResponse} res - Response object
     * @param {URLSearchParams} searchParams - URL search parameters
     */
    handleCacheAPI(req, res, searchParams) {
        const searchId = searchParams.get('searchId');
        const page = searchParams.get('page');
        const requestKeyword = searchParams.get('q');

        if (!searchId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing searchId parameter' }));
            return;
        }

        // 首先从searchCache获取原始搜索参数
        const searchResult = this.searchCache.get(searchId);
        if (!searchResult) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Search result not found or expired' }));
            return;
        }

        // 从searchParams中提取参数，如果有requestKeyword则替换q
        const { q, sortType, pageSize, sType, fromCollection, fills } = searchResult.searchParams;
        const searchQuery = requestKeyword || q;
        
        // 构建cacheKey，使用请求的page参数或默认的page
        const requestPage = page ? parseInt(page) : searchResult.searchParams.page;
        const cacheKey = `search_${searchQuery}_${sortType}_${requestPage}_${pageSize}_${sType}_${fromCollection}_${fills}`;

        // 从iconCache中获取数据
        let cachedResult = this.iconCache.get(cacheKey);
        
        if (!cachedResult || Date.now() - cachedResult.timestamp > this.cacheExpiry) {
            // 如果缓存不存在或已过期，从服务器获取
            if (this.searchIconsTool) {
                this.searchIconsTool.fetchIconData({
                    q: searchQuery, sortType, page: requestPage, pageSize, sType, fromCollection, fills
                }).then(result => {
                    // 更新searchCache
                    this.searchCache.set(searchId, {
                        data: result,
                        timestamp: Date.now(),
                        searchParams: { q: searchQuery, sortType, page: requestPage, pageSize, sType, fromCollection, fills }
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        data: result.data,
                        searchParams: { q: searchQuery, sortType, page: requestPage, pageSize, sType, fromCollection, fills },
                        timestamp: Date.now()
                    }));
                }).catch(error => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to fetch data from server: ' + error.message }));
                });
                return;
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Search tool not configured' }));
                return;
            }
        }

        // 使用缓存的数据
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: cachedResult.data,
            searchParams: { q: searchQuery, sortType, page: requestPage, pageSize, sType, fromCollection, fills },
            timestamp: cachedResult.timestamp
        }));
    }

    /**
     * Serve main page
     * @param {http.ServerResponse} res - Response object
     * @param {URLSearchParams} searchParams - URL search parameters
     */
    serveIndexPage(res, searchParams) {
       
        const html = this.generateIndexHTML();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    }

    /**
     * Generate index HTML
     * @returns {string} HTML content
     */
    generateIndexHTML() {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('web.title')}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 5px 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .header-left {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin: 0;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
            margin: 0;
        }
        
        .header-search {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            max-width: 400px;
        }
        
        .header-search form {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
        }
        
        .header-search-input {
            flex: 1;
            padding: 10px 15px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 25px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .header-search-input::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }
        
        .header-search-input:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.6);
            background: rgba(255, 255, 255, 0.2);
        }
        
        .header-search-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            width: 45px;
            height: 45px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .header-search-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.5);
            transform: scale(1.05);
        }
        
        .search-icon {
            width: 20px;
            height: 20px;
            fill: white;
        }
        
        .search-section {
            padding: 30px;
            border-bottom: 1px solid #eee;
        }
        
        .search-form {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .search-input {
            flex: 1;
            min-width: 300px;
            padding: 15px 20px;
            border: 2px solid #e1e5e9;
            border-radius: 10px;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        
        .search-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .search-btn {
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .search-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .search-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .filters {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }
        
        .filter-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .filter-group label {
            font-weight: 600;
            color: #555;
            font-size: 14px;
        }
        
        .filter-group select, .filter-group input {
            padding: 10px 15px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .filter-group select:focus, .filter-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .loading {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #666;
            z-index: 10;
        }
        
        .loading::after {
            content: '';
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .results-section {
            padding: 30px;
            position: relative;
        }
        
        .results-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .results-count {
            color: #666;
            font-size: 14px;
        }
        
        .icons-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .icon-card {
            border: 2px solid #e1e5e9;
            border-radius: 15px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
            background: white;
        }
        
        .icon-card:hover {
            border-color: #667eea;
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.15);
        }
        
        .icon-card.selected {
            border-color: #667eea;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        }
        
        .icon-preview {
            width: 64px;
            height: 64px;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            border-radius: 10px;
            font-size: 24px;
        }
        
        .icon-svg-container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .icon-svg-container svg {
            width: 48px;
            height: 48px;
            max-width: 100%;
            max-height: 100%;
            fill: #333;
            transition: all 0.3s ease;
        }
        
        .icon-card:hover .icon-svg-container svg {
            fill: #667eea;
            transform: scale(1.1);
        }
        
        .icon-name {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
            font-size: 14px;
        }
        
        .icon-id {
            color: #666;
            font-size: 12px;
            margin-bottom: 10px;
        }
        
        .icon-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
        
        .action-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .select-btn {
            background: #667eea;
            color: white;
        }
        
        .select-btn:hover {
            background: #5a6fd8;
        }
        
        .select-btn.selected {
            background: #4caf50;
        }
        
        .preview-btn {
            background: #f8f9fa;
            color: #666;
            border: 1px solid #e1e5e9;
        }
        
        .preview-btn:hover {
            background: #e9ecef;
        }
        
        .selected-icons {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .selected-icons h3 {
            margin-bottom: 15px;
            color: #333;
        }
        
        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            margin: 30px 0;
            padding: 20px;
        }
        
        .page-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        
        .page-btn:hover:not(:disabled) {
            background: #0056b3;
        }
        
        .page-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .page-info {
            font-size: 14px;
            color: #666;
            font-weight: 500;
        }
        
        .page-numbers {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        
        .page-number {
            background: #f8f9fa;
            color: #333;
            border: 1px solid #dee2e6;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            min-width: 40px;
            text-align: center;
            transition: all 0.3s;
        }
        
        .page-number:hover:not(.active):not(:disabled) {
            background: #e9ecef;
            border-color: #adb5bd;
        }
        
        .page-number.active {
            background: #007bff;
            color: white;
            border-color: #007bff;
        }
        
        .page-number:disabled {
            background: #f8f9fa;
            color: #6c757d;
            cursor: not-allowed;
            opacity: 0.6;
        }
        
        .page-ellipsis {
            color: #6c757d;
            padding: 8px 4px;
            font-size: 14px;
        }
        
        .selected-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .selected-item {
            background: white;
            border: 2px solid #667eea;
            border-radius: 10px;
            padding: 10px 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .remove-btn {
            background: #ff4757;
            color: white;
            border: none;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .save-section {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 20px;
            margin-top: 20px;
        }
        
        .save-btn {
            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 15px 30px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .save-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(76, 175, 80, 0.3);
        }
        
        .save-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .auto-send-notice {
            text-align: center;
            margin-top: 15px;
            padding: 10px;
            background: #e3f2fd;
            border-radius: 8px;
            border-left: 4px solid #2196f3;
        }
        
        .auto-send-notice p {
            margin: 0;
            color: #1976d2;
            font-size: 14px;
            font-weight: 500;
        }
        
        .error {
            background: #ffebee;
            color: #c62828;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #c62828;
        }
        
        .success {
            background: #e8f5e8;
            color: #2e7d32;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #2e7d32;
        }
        
        @media (max-width: 768px) {
            .search-form {
                flex-direction: column;
            }
            
            .search-input {
                min-width: auto;
            }
            
            .filters {
                flex-direction: column;
            }
            
            .icons-grid {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                <h1>🎨 ${t('web.title')}</h1>
            </div>
            <form id="headerSearchForm" class="header-search">
                <input type="text" id="headerSearchInput" class="header-search-input" placeholder="${t('web.searchPlaceholder')}" />
                <button type="submit" id="headerSearchBtn" class="header-search-btn">
                    <svg class="search-icon" viewBox="0 0 24 24">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                </button>
            </form>
        </div>
        
        <div class="results-section">
            <div id="loading" class="loading" style="display: none;">${t('web.searching')}</div>
            <div id="error" class="error" style="display: none;"></div>
            <div id="success" class="success" style="display: none;"></div>
            
            <div id="resultsHeader" class="results-header" style="display: none;">
                <h3>${t('web.searchResults')}</h3>
                <div id="resultsCount" class="results-count"></div>
            </div>
            
            <div id="iconsGrid" class="icons-grid"></div>
            
            <div id="pagination" class="pagination" style="display: none;">
                <button id="prevPage" class="page-btn" disabled>${this.language === 'zh-cn' ? '上一页' : 'Previous'}</button>
                <div id="pageNumbers" class="page-numbers"></div>
                <button id="nextPage" class="page-btn" disabled>${this.language === 'zh-cn' ? '下一页' : 'Next'}</button>
            </div>
            
            <div id="selectedIcons" class="selected-icons" style="display: none;">
                <h3>${t('web.selectedIcons')}</h3>
                <div id="selectedList" class="selected-list"></div>
                <div class="auto-send-notice">
                    <p>💡 ${t('web.autoSendNotice')}</p>
                </div>
            </div>
        </div>
    </div>

    <script src="site.js?lang=${this.language}"></script>
</body>
</html>`;
    }

    /**
     * Handle search API
     * @param {http.IncomingMessage} req - Request object
     * @param {http.ServerResponse} res - Response object
     */
    async handleSearchAPI(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const params = JSON.parse(body);

                if (this.searchIconsTool) {
                    const result = await this.searchIconsTool.search_icons(params);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Search tool not configured' }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    }

    /**
     * Handle save API
     * @param {http.IncomingMessage} req - Request object
     * @param {http.ServerResponse} res - Response object
     */
    async handleSaveAPI(req, res) {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                // 检查是否有等待处理的请求
                        const allWaiting = this.get_waiting_count();
                    if(allWaiting === 0){
                        executeSingleCommand();
                    }
                    
                

                const { icons, searchId } = JSON.parse(body);

                if (!icons || !Array.isArray(icons)) {
                    throw new Error('Invalid icons data');
                }
                
                // Call the save handler if provided
                if (this.onSaveIcons) {
                    const result = await this.onSaveIcons(icons, searchId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                       
                  
                        body
                    }));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Save handler not configured' }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    }

    /**
     * Handle icon API
     * @param {http.IncomingMessage} req - Request object
     * @param {http.ServerResponse} res - Response object
     * @param {string} pathname - Request pathname
     */
    async handleIconAPI(req, res, pathname) {
        const iconId = pathname.split('/').pop();
        // This could be used for individual icon details
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ iconId, message: 'Icon API endpoint' }));
    }

    /**
     * Set save handler
     * @param {Function} handler - Save handler function
     */
    setSaveHandler(handler) {
        this.onSaveIcons = handler;
    }

    /**
     * Set search cache
     * @param {Map} cache - Search cache Map
     */
    setSearchCache(cache) {
        this.searchCache = cache;
    }

    /**
     * Set selection cache
     * @param {Map} cache - Selection cache Map
     */
    setSelectionCache(cache) {
        this.selectionCache = cache;
    }

    /**
     * Set cache manager tool
     * @param {Object} tool - Cache manager tool instance
     */
    setCacheManagerTool(tool) {
        this.cacheManagerTool = tool;
    }

    /**
     * Set icon cache
     * @param {Map} cache - Icon cache Map
     */
    setIconCache(cache) {
        this.iconCache = cache;
    }
}

module.exports = WebInterface;

// Using built-in fetch (Node.js 18+)
const fs = require('fs');
const path = require('path');
const HttpServer = require('./utils/http-server');
const WebInterface = require('./utils/web-interface');
const SearchIconsTool = require('./utils/search-icons');
const CacheManagerTool = require('./utils/cache-manager');
const WebServerManagerTool = require('./utils/web-server-manager');
const IconSaverTool = require('./utils/icon-saver');
const SelectionCheckerTool = require('./utils/selection-checker');
const { t, initFromEnv,getCurrentLanguage } = require('./lang');

// Icon cache
const iconCache = new Map();
let CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// Icon search API configuration
const ICONFONT_API_BASE = 'https://www.iconfont.cn/api/icon/search.json';

// HTTP Server configuration
let httpServer = null;
let webInterface = null;
let searchCache = new Map(); // Store search result cache
let selectionCache = new Map(); // Store user selection results
let rl = null; // readline interface
let mcpClient = null; // MCP client connection

// Final MCP Server
class FinalMCPServer {
  constructor(options = {}) {
    this.name = 'icon-mcp-server';
    this.version = '1.0.0';
    this.initialized = false;
    this.autoStartWebServer = options.autoStartWebServer === true; // Default not to auto-start
    this.webServerPort = options.webServerPort || 3000;
    this.webServerAutoOpen = options.webServerAutoOpen === true; // Default not to auto-open browser
    
    // Initialize language from environment
    initFromEnv();
    
    // Initialize HTTP server and web interface
    this.initializeHttpComponents();
    
    // Initialize tool classes
    this.initializeToolClasses();
  }

  /**
   * Initialize HTTP server and web interface components
   */
  initializeHttpComponents() {
    // Create HTTP server instance
    httpServer = new HttpServer({
      port: this.webServerPort,
      autoOpen: this.webServerAutoOpen,
      selectionCache: selectionCache,
      language: getCurrentLanguage().toLowerCase()
    });

    // Create web interface instance (will be updated after tool classes are initialized)
    webInterface = new WebInterface({
      searchCache: searchCache,
      selectionCache: selectionCache,
      onSaveIcons: this.handleSaveIcons.bind(this),
      language: getCurrentLanguage().toLowerCase()
    });

    // Set request handler
    httpServer.setRequestHandler(webInterface.handleRequest.bind(webInterface));
  }

  /**
   * Initialize tool classes
   */
  initializeToolClasses() {
    // Create tool instances
    this.searchIconsTool = new SearchIconsTool({
      iconCache: iconCache,
      searchCache: searchCache,
      selectionCache: selectionCache,
      cacheExpiry: CACHE_EXPIRY,
      httpServer: httpServer,
      webServerAutoOpen: this.webServerAutoOpen
    });

    this.cacheManagerTool = new CacheManagerTool({
      iconCache: iconCache,
      searchCache: searchCache,
      cacheExpiry: CACHE_EXPIRY
    });

    this.webServerManagerTool = new WebServerManagerTool({
      httpServer: httpServer
    });

    this.iconSaverTool = new IconSaverTool({
      selectionCache: selectionCache,
      httpServer: httpServer
    });

    this.selectionCheckerTool = new SelectionCheckerTool({
      searchCache: searchCache,
      selectionCache: selectionCache,
      httpServer: httpServer
    });

    // Update web interface with search tool and cache manager tool
    if (webInterface) {
      webInterface.searchIconsTool = this.searchIconsTool;
      webInterface.selectionCache= selectionCache;
    }
  }

  /**
   * Handle save icons from web interface
   * @param {Array} icons - Selected icons
   * @param {string} searchId - Search ID
   * @returns {Object} Save result
   */
  async handleSaveIcons(icons, searchId) {
    try {
      const result = await this.iconSaverTool.sendToMCPClient(icons, searchId);
      return {
        success: true,
        mcpSent: true,
        selectedCount: icons.length,
        mcpResult: result
      };
    } catch (mcpError) {
      process.stderr.write(`�?${t('selection.failedToSend')}: ${mcpError.message}\n`);
      return {
        success: false,
        error: 'Failed to send to MCP client',
        message: mcpError.message
      };
    }
  }

  // Search icons from iconfont.cn
  async search_icons(params) {
    return await this.searchIconsTool.search_icons({
      ...params,
      pageSize: 100
    });
  }




  // Get cache statistics
  async get_cache_stats(params) {
    return await this.cacheManagerTool.get_cache_stats(params);
  }


  // Clear cache
  async clear_cache(params) {
    return await this.cacheManagerTool.clear_cache(params);
  }


  // Start HTTP server for web interface
  async start_web_server(params) {
    return await this.webServerManagerTool.start_web_server(params);
  }






  // Handle cache API (moved to WebInterface)
  handleCacheAPI(req, res, searchParams) {
    // This method is now handled by WebInterface
    webInterface.handleCacheAPI(req, res, searchParams);
  }

  // Serve main page (moved to WebInterface)
  serveIndexPage(res, searchParams) {
    // This method is now handled by WebInterface
    webInterface.serveIndexPage(res, searchParams);
  }


  // Handle search API (moved to WebInterface)
  async handleSearchAPI(req, res) {
    // This method is now handled by WebInterface
    await webInterface.handleSearchAPI(req, res);
  }

  // Handle save API (moved to WebInterface)
  async handleSaveAPI(req, res) {
    // This method is now handled by WebInterface
    await webInterface.handleSaveAPI(req, res);
  }

  // Handle icon API (moved to WebInterface)
  async handleIconAPI(req, res, pathname) {
    // This method is now handled by WebInterface
    await webInterface.handleIconAPI(req, res, pathname);
  }



  // Send selected icons to MCP client
  async sendToMCPClient(icons, searchId) {
    return await this.iconSaverTool.sendToMCPClient(icons, searchId);
  }






  // Check selection status
  async check_selection_status(params) {
    return await this.selectionCheckerTool.check_selection_status({
      ...params,
      maxWaitTime: 180000
    });
  }


  // 检查用户是否已选择图标
  checkForUserSelection(searchId) {
    return this.selectionCheckerTool.checkForUserSelection(searchId);
  }

  // Handle JSON-RPC requests
  async handleRequest(request) {
    try {
      const { jsonrpc, id, method, params } = request;

      if (jsonrpc !== '2.0') {
        throw new Error('Unsupported JSON-RPC version');
      }

      let result = null;
      let error = null;

      try {
        if (method === 'initialize') {
          // If already initialized, return success but don't re-initialize
          if (!this.initialized) {
            this.initialized = true;
          }

          // Build server capabilities to match client capabilities
          const serverCapabilities = {
            tools: {
              listChanged: false
            }
          };

          // If client supports prompts, we also support it
          if (params?.capabilities?.prompts) {
            serverCapabilities.prompts = {
              listChanged: false
            };
          }

          // If client supports resources, we also support it
          if (params?.capabilities?.resources) {
            serverCapabilities.resources = {
              listChanged: false
            };
          }

          // If client supports logging, we also support it
          if (params?.capabilities?.logging) {
            serverCapabilities.logging = {
              listChanged: false
            };
          }

          // If client supports roots, we also support it
          if (params?.capabilities?.roots) {
            serverCapabilities.roots = {
              listChanged: false
            };
          }

          result = {
            protocolVersion: params?.protocolVersion || '2024-11-05',
            capabilities: serverCapabilities,
            serverInfo: {
              name: this.name,
              version: this.version
            }
          };
        } else if (method === 'tools/list') {
          result = {
            tools: [
              {
                name: 'search_icons',
                description: 'Search icons from iconfont.cn',
                inputSchema: {
                  type: 'object',
                  properties: {
                    q: {
                      type: 'string',
                      description: 'Search query keyword'
                    },
                    sortType: {
                      type: 'string',
                      description: 'Sort type: updated_at, created_at, name, etc.',
                      default: 'updated_at'
                    },
                    page: {
                      type: 'number',
                      description: 'Page number (starting from 1)',
                      default: 1
                    },
                    sType: {
                      type: 'string',
                      description: 'Search type filter'
                    },
                    fromCollection: {
                      type: 'number',
                      description: 'Collection filter (-1 for all)',
                      default: -1
                    },
                    fills: {
                      type: 'string',
                      description: 'Fill type filter'
                    }
                  }
                }
              },
              {
                name: 'start_web_server',
                description: 'Start HTTP web server for icon search and selection interface',
                inputSchema: {
                  type: 'object',
                  properties: {
                    port: {
                      type: 'number',
                      description: 'Port number to start server on (default: 3000)',
                      default: 3000
                    },
                    autoOpen: {
                      type: 'boolean',
                      description: 'Automatically open browser (default: true)',
                      default: true
                    }
                  }
                }
              },
            
              {
                name: 'get_cache_stats',
                description: 'Get cache statistics',
                inputSchema: {
                  type: 'object',
                  properties: {}
                }
              },
              {
                name: 'clear_cache',
                description: 'Clear icon cache',
                inputSchema: {
                  type: 'object',
                  properties: {
                    expiredOnly: {
                      type: 'boolean',
                      description: 'Only clear expired entries',
                      default: false
                    }
                  }
                }
              },
             
              {
                name: 'check_selection_status',
                description: 'Check if user has completed icon selection in web interface. This tool will wait for user selection and return selected icons when completed.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    searchId: {
                      type: 'string',
                      description: 'Search ID to check selection status for'
                    }
                  },
                  required: ['searchId']
                }
              }
            ],
            environment: {
              ICONFONT_API: ICONFONT_API_BASE,
              CACHE_EXPIRY_MINUTES: CACHE_EXPIRY / (60 * 1000),
              serverInfo: {
                name: this.name,
                version: this.version
              }
            }
          };
        } else if (method === 'prompts/list') {
          result = {
            prompts: []
          };
        } else if (method === 'prompts/call') {
          result = {
            messages: [
              {
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: 'Unsupported prompts call'
                  }
                ]
              }
            ]
          };
        } else if (method === 'resources/list') {
          result = {
            resources: []
          };
        } else if (method === 'resources/read') {
          result = {
            contents: [
              {
                uri: 'error://unsupported',
                text: 'Unsupported resources read'
              }
            ]
          };
        } else if (method === 'logging/list') {
          result = {
            logs: []
          };
        } else if (method === 'logging/read') {
          result = {
            contents: [
              {
                uri: 'error://unsupported',
                text: 'Unsupported logging read'
              }
            ]
          };
        } else if (method === 'roots/list') {
          result = {
            roots: []
          };
        } else if (method === 'roots/read') {
          result = {
            contents: [
              {
                uri: 'error://unsupported',
                text: 'Unsupported roots read'
              }
            ]
          };
        } else if (method === 'tools/call') {
          const { name, arguments: args } = params || {};

          if (!name) {
            throw new Error('Missing tool name');
          }

          // Check if method exists
          if (!this[name]) {
            throw new Error(`Unknown tool: ${name}`);
          }

          result = await this[name](args || {});

          // Check if result is already in MCP format (has isDelta, contentType, etc.)
          if (result && typeof result === 'object' && (result.isDelta !== undefined || result.contentType !== undefined || result.toolCall !== undefined)) {
             
          } else {
            // Tool call results need to be wrapped in content
            result = {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }
        } else if (method === 'ping') {
          result = { pong: true };
        } else if (method === 'shutdown') {
          result = null;
          setTimeout(() => {
            process.exit(0);
          }, 100);
        } else if (method === 'notifications/initialized') {
          // Handle initialization notification
          result = null;
        } else if (method === 'notifications/exit') {
          result = null;
          process.exit(0);
        } else {
          throw new Error(`Unknown method: ${method}`);
        }
      } catch (err) {
        error = err.message;
        throw err;
      }

      // For notification methods, no response is needed
      if (method === 'notifications/initialized' || method === 'notifications/exit') {
        return null;
      }

      // shutdown method needs to return response
      if (method === 'shutdown') {
        return {
          jsonrpc: '2.0',
          id,
          result: null
        };
      }
      
      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      // Use standard MCP error codes
      let errorCode = -32603; // Internal error
      let errorMessage = error.message;

      if (error.message.includes('Server not initialized')) {
        errorCode = -32002; // Server not initialized
      } else if (error.message.includes('Unknown method')) {
        errorCode = -32601; // Method not found
      } else if (error.message.includes('Unsupported JSON-RPC version')) {
        errorCode = -32600; // Invalid Request
      }
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: errorCode,
          message: errorMessage
        }
      };
    }
  }

  // Start server
  async start() {
    // 如果配置了自动打开浏览器，则自动启动HTTP服务�?
    if (this.webServerAutoOpen) {
      try {
        // 使用stderr输出日志，避免干扰MCP JSON通信
        process.stderr.write('🚀 正在启动HTTP服务�?..\n');
        await this.start_web_server({
          autoOpen: false // 根据配置决定是否自动打开
        });
        process.stderr.write(`HTTP服务器启动成功${httpServer.getUrl()}\n`);
      } catch (error) {
        setTimeout(() => {
          this.start();
        }, 1000);
        process.stderr.write(`⚠️  HTTP服务器启动失�? ${error.message}\n`);
        process.stderr.write('💡 你可以稍后手动启动HTTP服务器\n');
      }
    }

    // Listen to stdin
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', async (data) => {
      try {
        const lines = data.toString().trim().split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const request = JSON.parse(line);
              const response = await this.handleRequest(request);
              if (response) {
                console.log(JSON.stringify(response));
              }
            } catch (requestError) {
              console.error('Error processing individual request:', requestError.message);
              // Send error response instead of crashing the entire server
              const errorResponse = {
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32603,
                  message: `Internal error: ${requestError.message}`
                }
              };
              console.log(JSON.stringify(errorResponse));
            }
          }
        }
      } catch (error) {
        console.error('Error processing data:', error.message);
      }
    });

    // Handle process signals
    process.on('SIGTERM', async () => {
      if (httpServer && httpServer.isRunning()) {
        await this.stop_web_server();
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      if (httpServer && httpServer.isRunning()) {
        await this.stop_web_server();
      }
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise rejection:', reason);
      process.exit(1);
    });
  }
}

// Start server
async function main() {
  // 从命令行参数或环境变量读取配�?
  const options = {
    autoStartWebServer: process.env.AUTO_START_WEB_SERVER === 'true',
    webServerPort: parseInt(process.env.WEB_SERVER_PORT) || 3000,
    webServerAutoOpen: process.env.WEB_SERVER_AUTO_OPEN === 'true'
  };

  // 更新缓存和超时配�?
  if (process.env.ICON_CACHE_EXPIRY) {
    CACHE_EXPIRY = parseInt(process.env.ICON_CACHE_EXPIRY) || CACHE_EXPIRY;
  }

  const server = new FinalMCPServer(options);
  await server.start();
}

// Only start if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

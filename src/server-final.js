// Using built-in fetch (Node.js 18+)

// Icon cache
const iconCache = new Map();
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// Icon search API configuration
const ICONFONT_API_BASE = 'https://www.iconfont.cn/api/icon/search.json';

// Final MCP Server
class FinalMCPServer {
  constructor() {
    this.name = 'icon-mcp-server';
    this.version = '1.0.0';
    this.initialized = false;
  }

  // Search icons from iconfont.cn
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
    if (iconCache.has(cacheKey)) {
      const cached = iconCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
        return cached.data;
      } else {
        iconCache.delete(cacheKey);
      }
    }

    try {
      // Prepare request parameters
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

      // Make API request using built-in fetch
      const response = await fetch(ICONFONT_API_BASE, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: requestParams.toString(),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 200) {
        throw new Error(`API returned error: ${data.message || 'Unknown error'}`);
      }

      const result = {
        code: data.code,
        data: data.data,
        pagination: {
          page,
          pageSize,
          total: data.data?.icons?.length || 0
        },
        searchParams: {
          q,
          sortType,
          sType,
          fromCollection,
          fills
        }
      };

      // Cache the result
      iconCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: Unable to reach iconfont API');
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach iconfont API');
      } else {
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }



  // Get cache statistics
  async get_cache_stats(params) {
    const now = Date.now();
    const validEntries = Array.from(iconCache.entries()).filter(([key, value]) => 
      now - value.timestamp < CACHE_EXPIRY
    );

    return {
      totalEntries: iconCache.size,
      validEntries: validEntries.length,
      expiredEntries: iconCache.size - validEntries.length,
      cacheExpiryMinutes: CACHE_EXPIRY / (60 * 1000),
      memoryUsage: process.memoryUsage()
    };
  }

  // Clear cache
  async clear_cache(params) {
    const { expiredOnly = false } = params || {};

    if (expiredOnly) {
      const now = Date.now();
      for (const [key, value] of iconCache.entries()) {
        if (now - value.timestamp >= CACHE_EXPIRY) {
          iconCache.delete(key);
        }
      }
    } else {
      iconCache.clear();
    }

    return {
      message: expiredOnly ? 'Expired cache entries cleared' : 'All cache entries cleared',
      remainingEntries: iconCache.size
    };
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
                description: 'Search icons from iconfont.cn (single keyword search only)',
                inputSchema: {
                  type: 'object',
                  properties: {
                    q: {
                      type: 'string',
                      description: 'Search query keyword (single word only, use the most relevant keyword)'
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
                    pageSize: {
                      type: 'number',
                      description: 'Number of icons per page (1-100)',
                      default: 100
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

          // Tool call results need to be wrapped in content
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
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

      // Ensure all methods return correct response format
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
      process.exit(0);
    });

    process.on('SIGINT', async () => {
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
  const server = new FinalMCPServer();
  await server.start();
}

// Only start if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

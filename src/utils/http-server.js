// HTTP Server utility class
const http = require('http');
const { exec } = require('child_process');
const WebSocket = require('ws');
// Use PowerShell version for window operations (no native dependencies required)
const windowUtils = require('./window-utils-powershell');
const { t } = require('../lang');

class HttpServer {
  constructor(options = {}) {
    this.server = null;
    this.wss = null;
    this.port = options.port || 3000;
    this.autoOpen = options.autoOpen || false;
    this.onRequest = options.onRequest || null;
    this.onWebSocketConnection = options.onWebSocketConnection || null;
    this.clients = new Set();
    this.selectionCache = options.selectionCache || new Map();
  }

  /**
   * Start HTTP server
   * @param {Object} options - Server options
   * @returns {Promise<Object>} Server info
   */
  async start(options = {}) {
    const { port = this.port, autoOpen = this.autoOpen } = options;

    if (this.server) {
      return {
        message: t('server.started'),
        port: this.port,
        url: `http://localhost:${this.port}`
      };
    }

    // Find available port
    const availablePort = await this.findAvailablePort(port);
    this.port = availablePort;

    // Create HTTP server
    this.server = http.createServer((req, res) => {
      if (this.onRequest) {
        this.onRequest(req, res);
      }
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, 'localhost', () => {
        const url = `http://localhost:${this.port}`;
        //process.stderr.write(`HTTP server started on ${url}\n`);

        // Start WebSocket server
        this.startWebSocketServer();

        if (autoOpen) {
          this.openBrowser(url);
        }

        resolve({
          message: t('server.started'),
          port: this.port,
          url: url,
          websocket: true
        });
      });

      this.server.on('error', (err) => {
        reject({
          error: t('server.startupFailed'),
          message: err.message
        });
      });
    });
  }

  /**
   * Start WebSocket server
   */
  startWebSocketServer() {
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      
      // Extract searchId from query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      const searchId = url.searchParams.get('searchId');
      
      // Store searchId with WebSocket connection
      ws.searchId = searchId;
      
      //process.stderr.write(`WebSocket client connected. Total clients: ${this.clients.size}${searchId ? `, searchId: ${searchId}` : ''}\n`);

      // Initialize selection status in cache if searchId exists
      if (searchId) {
        this.initializeSelectionStatus(searchId);
        //process.stderr.write(`🔗 WebSocket connected with searchId: ${searchId}\n`);
      } else {
        //process.stderr.write(`⚠️  WebSocket connected without searchId\n`);
      }

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to Icon MCP Server',
        searchId: searchId,
        timestamp: new Date().toISOString()
      }));

      // Handle incoming messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid JSON message',
            error: error.message
          }));
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        this.clients.delete(ws);
        //process.stderr.write(`WebSocket client disconnected. Total clients: ${this.clients.size}\n`);
        
        // Mark selection as failed if searchId exists
        if (ws.searchId) {
          //process.stderr.write(`🔌 Client disconnected with searchId: ${ws.searchId}\n`);
          this.markSelectionFailed(ws.searchId);
        } else {
          //process.stderr.write(`⚠️  Client disconnected without searchId\n`);
        }
        
        // If no clients connected and this was the last client, check for pending selections
        if (this.clients.size === 0) {
          this.handleAllClientsDisconnected();
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        //process.stderr.write(`WebSocket error: ${error.message}\n`);
        this.clients.delete(ws);
        
        // Mark selection as failed if searchId exists
        if (ws.searchId) {
          this.markSelectionFailed(ws.searchId);
        }
        
        // If no clients connected after error, check for pending selections
        if (this.clients.size === 0) {
          this.handleAllClientsDisconnected();
        }
      });

      // Call custom connection handler if provided
      if (this.onWebSocketConnection) {
        this.onWebSocketConnection(ws, req);
      }
    });

    //process.stderr.write(`WebSocket server started on port ${this.port}\n`);
  }

  /**
   * Handle WebSocket messages - only ping/pong
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} data - Message data
   */
  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
      
      default:
        // 忽略其他消息类型，只处理ping/pong
        break;
    }
  }


  /**
   * Initialize selection status in cache
   * @param {string} searchId - Search ID
   */
  initializeSelectionStatus(searchId) {
    if (!this.selectionCache.has(searchId)) {
      this.selectionCache.set(searchId, {
        status: 'waiting',
        searchId: searchId,
        timestamp: Date.now(),
        connected: true
      });
      //process.stderr.write(`📝 Initialized selection status for searchId: ${searchId}\n`);
    }
  }

  /**
   * Mark selection as failed
   * @param {string} searchId - Search ID
   */
  markSelectionFailed(searchId) {
    setTimeout(()=>{
      if (this.selectionCache.has(searchId)) {
        const selection = this.selectionCache.get(searchId);
        if(selection.status == 'completed'){
          return;
        }
        selection.status = 'failed';
        selection.connected = false;
        selection.failedAt = Date.now();
        selection.failureReason = 'WebSocket disconnected without selection';
        
        this.selectionCache.set(searchId, selection);
        //process.stderr.write(`❌ Marked selection as failed for searchId: ${searchId}\n`);
      } else {
        // 如果缓存中没有该searchId，创建一个失败状态
        this.selectionCache.set(searchId, {
          status: 'failed',
          searchId: searchId,
          timestamp: Date.now(),
          connected: false,
          failedAt: Date.now(),
          failureReason: 'WebSocket disconnected without selection'
        });
        //process.stderr.write(`❌ Created failed selection status for searchId: ${searchId}\n`);
      }
    },2000)
  }



  /**
   * Check if selection exists for given searchId
   * @param {string} searchId - Search ID
   * @returns {Object|null} Selection result or null
   */
  checkSelectionExists(searchId) {
    const selection = this.selectionCache.get(searchId);
    if (selection && selection.status === 'completed') {
      return selection;
    }
    return null;
  }

  /**
   * Get selection status
   * @param {string} searchId - Search ID
   * @returns {Object} Selection status
   */
  getSelectionStatus(searchId) {
    const selection = this.selectionCache.get(searchId);
    if (!selection) {
      return {
        status: 'not_found',
        message: 'Selection not found'
      };
    }
    
    return {
      status: selection.status,
      searchId: searchId,
      connected: selection.connected,
      timestamp: selection.timestamp,
      message: this.getStatusMessage(selection)
    };
  }

  /**
   * Get status message based on selection status
   * @param {Object} selection - Selection object
   * @returns {string} Status message
   */
  getStatusMessage(selection) {
    switch (selection.status) {
      case 'waiting':
        return 'Waiting for user selection...';
      case 'completed':
        return 'Selection completed successfully';
      case 'failed':
        return `Selection failed: ${selection.failureReason || 'Unknown error'}`;
      default:
        return 'Unknown status';
    }
  }

  /**
   * Handle when all clients disconnect
   */
  handleAllClientsDisconnected() {
    //process.stderr.write(`⚠️  All WebSocket clients disconnected. Checking for pending selections...\n`);
    
    // Mark all waiting selections as failed
    let failedCount = 0;
    for (const [searchId, selection] of this.selectionCache.entries()) {
      if (selection.status === 'waiting') {
        this.markSelectionFailed(searchId);
        failedCount++;
      }
    }
    
  }


  /**
   * Stop HTTP server
   * @returns {Promise<Object>} Stop result
   */
  async stop() {
    if (!this.server) {
      return {
        message: t('server.shutdown')
      };
    }

    return new Promise((resolve) => {
      // Close WebSocket server first
      if (this.wss) {
        this.wss.close();
        this.wss = null;
        this.clients.clear();
      }

      this.server.close(() => {
        this.server = null;
        resolve({
          message: t('server.shutdown')
        });
      });
    });
  }

  /**
   * Find available port using random port in range 20000-30000
   * @param {number} startPort - Starting port number (ignored, using random range)
   * @returns {Promise<number>} Available port
   */
  async findAvailablePort(startPort) {
    // Generate random port in range 20000-30000
    const minPort = 20000;
    const maxPort = 30000;
    const randomPort = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
    
    // Try to create a temporary server with random port
    try {
      return await this.findAvailablePortByServer(randomPort);
    } catch (error) {
      // If random port fails, try sequential search from random port
      return await this.findAvailablePortByServer(randomPort);
    }
  }

  /**
   * Find available port by creating temporary server
   * @param {number} startPort - Starting port number
   * @returns {Promise<number>} Available port
   */
  async findAvailablePortByServer(startPort) {
    return new Promise((resolve, reject) => {
      const server = http.createServer();

      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Try next port in range 20000-30000
          const nextPort = startPort + 1;
          if (nextPort <= 30000) {
            this.findAvailablePortByServer(nextPort).then(resolve).catch(reject);
          } else {
            // If we've reached the end of range, start from 20000
            this.findAvailablePortByServer(20000).then(resolve).catch(reject);
          }
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Open browser
   * @param {string} url - URL to open
   */
  openBrowser(url) {
    const start = process.platform === 'darwin' ? 'open' :
      process.platform === 'win32' ? 'start' : 'xdg-open';

    // First try to use exec to open browser (more reliable)
    exec(`${start} ${url}`, (error) => {
      
    });
  }

 

  /**
   * Minimize browser window
   */
  minimizeBrowser() {
    
  }

  /**
   * Set request handler
   * @param {Function} handler - Request handler function
   */
  setRequestHandler(handler) {
    this.onRequest = handler;
  }

  /**
   * Get server instance
   * @returns {http.Server|null} HTTP server instance
   */
  getServer() {
    return this.server;
  }

  /**
   * Check if server is running
   * @returns {boolean} Server running status
   */
  isRunning() {
    return this.server !== null;
  }

  /**
   * Get server port
   * @returns {number} Server port
   */
  getPort() {
    return this.port;
  }

  /**
   * Get server URL
   * @returns {string} Server URL
   */
  getUrl() {
    return `http://localhost:${this.port}`;
  }

  /**
   * Get WebSocket URL
   * @returns {string} WebSocket URL
   */
  getWebSocketUrl() {
    return `ws://localhost:${this.port}`;
  }

  /**
   * Get connected clients count
   * @returns {number} Number of connected clients
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Send ping to all clients
   */
  pingAllClients() {
    const pingMessage = JSON.stringify({
      type: 'ping',
      timestamp: new Date().toISOString()
    });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(pingMessage);
      }
    });
  }

  /**
   * Check if WebSocket server is running
   * @returns {boolean} WebSocket server running status
   */
  isWebSocketRunning() {
    return this.wss !== null;
  }
}

module.exports = HttpServer;

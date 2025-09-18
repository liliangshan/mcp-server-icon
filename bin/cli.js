#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');



//console.log(`Starting MCP Icon server from: ${serverPath}`);

let server = null;

// Function to start server
function startServer() {
  // Create environment object with simplified configurations
  const env = {
    ...process.env,
    // Only essential environment variables
    WEB_SERVER_AUTO_OPEN: process.env.WEB_SERVER_AUTO_OPEN || 'false',
    // Use default values for other settings
    AUTO_START_WEB_SERVER: process.env.WEB_SERVER_AUTO_OPEN === 'true' ? 'true' : 'false', // If auto-open browser is configured, auto-start server
    WEB_SERVER_PORT: '3000',
    ICON_CACHE_EXPIRY: '1800000', // 30 minutes in ms
    ICON_SEARCH_TIMEOUT: '30000', // 30 seconds
    LANGUAGE: process.env.LANGUAGE || 'en', // Language setting, default to English
  };
  const file_name = env.WEB_SERVER_AUTO_OPEN==='true' ? 'server-final-http.js':'server-final.js';
// Get server script path
const serverPath = path.resolve(__dirname, '../src/'+file_name);

// Check if server file exists
if (!fs.existsSync(serverPath)) {
  console.error(`Server file not found: ${serverPath}`);
  process.exit(1);
}
  //console.log('Starting MCP Icon server with configuration:');
  console.error(JSON.stringify({
    WEB_SERVER_AUTO_OPEN: env.WEB_SERVER_AUTO_OPEN,
    'HTTP Server Port': env.WEB_SERVER_PORT,
    'Auto Open Browser': env.WEB_SERVER_AUTO_OPEN === 'true' ? 'Yes' : 'No',
    'Auto Start Server': env.AUTO_START_WEB_SERVER === 'true' ? 'Yes' : 'No',
    'Language': env.LANGUAGE,
    'Cache Expiry': '30 minutes',
    'Search Timeout': '30 seconds',
    
    'file_name': file_name
  }));
  server = spawn('node', [serverPath], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: env
  });

  console.error(`MCP Icon server process started with PID: ${server.pid}`);
  console.error('Press Ctrl+C to gracefully shutdown the server');
}

// Start the server
startServer();

// Handle server close
server.on('close', (code) => {
  console.log(`MCP Icon server exited with code: ${code}`);
  // Clear any pending shutdown timeout
  if (global.shutdownTimeout) {
    clearTimeout(global.shutdownTimeout);
  }
  
  // Check if this is a restart request
  if (code === 0) {
    console.log('Server requested restart, restarting...');
    setTimeout(() => {
      startServer();
    }, 2000); // Wait 2 seconds before restart
  } else {
    // Exit CLI process when server exits with error
    setTimeout(() => {
      console.log('CLI process exiting after server shutdown');
      process.exit(code);
    }, 1000);
  }
});

// Handle server error
server.on('error', (err) => {
  console.error('Server process error:', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

// Handle signals
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down server...');
  gracefulShutdown('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down server...');
  gracefulShutdown('SIGTERM');
});

// Handle Windows specific signals
process.on('SIGBREAK', () => {
  console.log('Received SIGBREAK, shutting down server...');
  gracefulShutdown('SIGTERM');
});

// Handle restart signal from server
process.on('SIGUSR1', () => {
  console.log('Received restart signal from server...');
  restartServer();
});

// Handle process exit
process.on('exit', (code) => {
  console.log(`CLI process exiting with code: ${code}`);
});

// Graceful shutdown function
function gracefulShutdown(signal) {
  // Set a timeout to force exit if server doesn't respond
  global.shutdownTimeout = setTimeout(() => {
    console.log('Server shutdown timeout, forcing exit...');
    try {
      if (server) {
        server.kill('SIGKILL');
      }
    } catch (err) {
      console.error('Failed to force kill server:', err.message);
    }
    process.exit(1);
  }, 10000); // 10 seconds timeout
  
  // Try graceful shutdown
  try {
    if (server) {
      server.kill(signal);
      console.log(`Sent ${signal} signal to server process ${server.pid}`);
    } else {
      console.log('No server process to shutdown');
      process.exit(0);
    }
  } catch (err) {
    console.error(`Failed to send ${signal} signal to server:`, err.message);
    if (global.shutdownTimeout) {
      clearTimeout(global.shutdownTimeout);
    }
    process.exit(1);
  }
}

// Restart server function
function restartServer() {
  console.log('Restarting MCP Icon server...');
  if (server) {
    try {
      server.kill('SIGTERM');
      setTimeout(() => {
        if (server && !server.killed) {
          console.log('Server not responding to SIGTERM, forcing kill...');
          server.kill('SIGKILL');
        }
        startServer();
      }, 3000); // Wait 3 seconds for graceful shutdown
    } catch (err) {
      console.error('Failed to stop server for restart:', err.message);
      startServer();
    }
  } else {
    startServer();
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in CLI:', {
    error: err.message,
    stack: err.stack
  });
  if (server) {
    server.kill('SIGTERM');
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise rejection in CLI:', {
    reason: reason.toString(),
    promise: promise.toString()
  });
  if (server) {
    server.kill('SIGTERM');
  }
  process.exit(1);
});

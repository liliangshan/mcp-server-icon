#!/usr/bin/env node

const path = require('path');

// Get the server file path
const serverPath = path.resolve(__dirname, '../src/server-final.js');

// Start the server
async function startServer() {
  try {
    // Import and start the server
    const { spawn } = require('child_process');
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['inherit', 'inherit', 'inherit']
    });

    serverProcess.on('close', (code) => {
      process.exit(code);
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server process:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('Error starting MCP Icon server:', error.message);
    process.exit(1);
  }
}

startServer();

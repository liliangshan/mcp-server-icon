#!/usr/bin/env node

// Simple MCP Icon Server Launcher
const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.resolve(__dirname, 'src/server-final.js');

console.error('Starting MCP Icon Server...');

const server = spawn('node', [serverPath], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: process.env
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('close', (code) => {
  console.error(`Server exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
});

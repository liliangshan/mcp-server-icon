const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const addon = require('./minimize_window.node');

async function executeSingleCommand() {
    if (process.platform !== 'win32') {
        return {
            success: false,
            action: 'error',
            error: 'Not supported on non-Windows platforms'
        };
    }

    try {
        const output = addon.minimizeForegroundWindow();
   
       

        if (output.startsWith('MINIMIZED')) {
            return { success: true, action: 'minimized', message: output };
        } else if (output.startsWith('ERROR')) {
            return { success: false, action: 'error', error: output.replace('ERROR: ', '') };
        } else {
            return { success: false, action: 'unknown', error: 'Unknown output: ' + JSON.stringify(output) };
        }
    } catch (error) {
        return { success: false, action: 'error', error: error.message };
    }
}

module.exports = { executeSingleCommand };

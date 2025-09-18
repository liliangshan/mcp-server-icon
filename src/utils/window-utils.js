// Try to load ffi-napi, fallback to mock functions if not available
let ffi, ref, user32;
let ffiAvailable = false;

try {
    ffi = require('ffi-napi');
    ref = require('ref-napi');
    
    // Define Windows API constants
    const SW_MINIMIZE = 6;
    const SW_RESTORE = 9;
    const SW_SHOW = 5;
    const SW_HIDE = 0;

    // Load user32.dll
    user32 = new ffi.Library('user32', {
        'GetForegroundWindow': ['int', []],
        'GetWindowTextW': ['int', ['int', 'pointer', 'int']],
        'ShowWindow': ['bool', ['int', 'int']],
        'GetWindowThreadProcessId': ['int', ['int', 'pointer']],
        'FindWindowW': ['int', ['string', 'string']],
        'SetForegroundWindow': ['bool', ['int']],
        'IsWindowVisible': ['bool', ['int']],
        'GetWindowRect': ['bool', ['int', 'pointer']]
    });
    ffiAvailable = true;
} catch (error) {
    console.warn('ffi-napi not available, using mock functions for window operations');
    ffiAvailable = false;
    
    // Mock user32 object
    user32 = {
        GetForegroundWindow: () => 0,
        GetWindowTextW: () => 0,
        ShowWindow: () => false,
        GetWindowThreadProcessId: () => 0,
        FindWindowW: () => 0,
        SetForegroundWindow: () => false,
        IsWindowVisible: () => false,
        GetWindowRect: () => false
    };
}

/**
 * Get the handle of the current foreground window
 * @returns {number} Window handle
 */
function getForegroundWindow() {
    return user32.GetForegroundWindow();
}

/**
 * Get window title
 * @param {number} hwnd Window handle
 * @returns {string} Window title
 */
function getWindowTitle(hwnd) {
    const bufferSize = 255;
    const buffer = Buffer.alloc(bufferSize * 2); // Wide characters need 2x space
    const length = user32.GetWindowTextW(hwnd, buffer, bufferSize);
    return length > 0 ? buffer.toString('ucs2').replace(/\0+$/, '') : '';
}

/**
 * Get the process ID of the window
 * @param {number} hwnd Window handle
 * @returns {number} Process ID
 */
function getWindowProcessId(hwnd) {
    if (!ffiAvailable) {
        
        return 0;
    }
    const pidPtr = ref.alloc('int');
    user32.GetWindowThreadProcessId(hwnd, pidPtr);
    return pidPtr.deref();
}

/**
 * Minimize window
 * @param {number} hwnd Window handle
 * @returns {boolean} Success status
 */
function minimizeWindow(hwnd) {
    return user32.ShowWindow(hwnd, SW_MINIMIZE);
}

/**
 * Restore window
 * @param {number} hwnd Window handle
 * @returns {boolean} Success status
 */
function restoreWindow(hwnd) {
    return user32.ShowWindow(hwnd, SW_RESTORE);
}

/**
 * Show window
 * @param {number} hwnd Window handle
 * @returns {boolean} Success status
 */
function showWindow(hwnd) {
    return user32.ShowWindow(hwnd, SW_SHOW);
}

/**
 * Hide window
 * @param {number} hwnd Window handle
 * @returns {boolean} Success status
 */
function hideWindow(hwnd) {
    return user32.ShowWindow(hwnd, SW_HIDE);
}

/**
 * Set window as foreground window
 * @param {number} hwnd Window handle
 * @returns {boolean} Success status
 */
function setForegroundWindow(hwnd) {
    return user32.SetForegroundWindow(hwnd);
}

/**
 * Check if window is visible
 * @param {number} hwnd Window handle
 * @returns {boolean} Visibility status
 */
function isWindowVisible(hwnd) {
    return user32.IsWindowVisible(hwnd);
}

/**
 * Find window by class name and window name
 * @param {string} className Window class name
 * @param {string} windowName Window name
 * @returns {number} Window handle
 */
function findWindow(className, windowName) {
    return user32.FindWindowW(className, windowName);
}

/**
 * Get complete information of the active window
 * @returns {Object} Object containing window handle, title, and process ID
 */
function getActiveWindowInfo() {
    const hwnd = getForegroundWindow();
    if (hwnd === 0) {
        return {
            success: false,
            error: 'Unable to get foreground window handle'
        };
    }

    const title = getWindowTitle(hwnd);
    const pid = getWindowProcessId(hwnd);
    const visible = isWindowVisible(hwnd);

    return {
        success: true,
        hwnd: hwnd,
        title: title,
        processId: pid,
        visible: visible
    };
}

/**
 * Get information of all visible windows
 * @returns {Array} Array of window information
 */
function getAllVisibleWindows() {
    // This is a simplified implementation, actual applications may need more complex enumeration logic
    const windows = [];
    const hwnd = getForegroundWindow();
    if (hwnd !== 0) {
        windows.push({
            hwnd: hwnd,
            title: getWindowTitle(hwnd),
            processId: getWindowProcessId(hwnd),
            visible: isWindowVisible(hwnd)
        });
    }
    return windows;
}

module.exports = {
    // Basic functions
    getForegroundWindow,
    getWindowTitle,
    getWindowProcessId,
    minimizeWindow,
    restoreWindow,
    showWindow,
    hideWindow,
    setForegroundWindow,
    isWindowVisible,
    findWindow,
    
    // Composite functions
    getActiveWindowInfo,
    getAllVisibleWindows,
    
    // Constants
    SW_MINIMIZE,
    SW_RESTORE,
    SW_SHOW,
    SW_HIDE
};

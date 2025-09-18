let selectedIcons = new Set();
let currentIcons = [];
let websocket = null;
let searchId = null;
let currentPage = 1;
let totalPages = 1;
let totalIcons = 0;
let pageSize = 15;

// Display icons with pagination
function displayIcons(icons, totalCount = null) {
    const grid = document.getElementById('iconsGrid');
    if (!grid) {
        console.error('iconsGrid element not found!');
        return;
    }
    grid.innerHTML = '';

    
    // Backend already returned data for the current page, display directly without slicing
    const pageIcons = icons;
    
    console.log('Display icons directly:', {
        pageIconsLength: pageIcons.length,
        pageIcons: pageIcons
    });

    console.log('Starting to render icons, count:', pageIcons.length);
    
    if (pageIcons.length === 0) {
        console.log('No icons to display');
        return;
    }
    
    pageIcons.forEach((icon, index) => {
        console.log(`Rendering icon ${index + 1}/${pageIcons.length}:`, icon);
        const iconCard = document.createElement('div');
        iconCard.className = 'icon-card';

        // Prioritize show_svg, fallback to icon field if not available
        let iconDisplay = '';
        if (icon.show_svg) {
            // Use SVG format for display
            iconDisplay = `
                        <div class="icon-svg-container">
                            ${icon.show_svg}
                        </div>
                    `;
                } else if (icon.icon) {
                    // Use image format for display
                    iconDisplay = `
                        <img src="${icon.icon}" alt="${icon.name}" style="max-width: 100%; max-height: 100%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div style="display: none; color: #999;">📄</div>
                    `;
                } else {
                    // Show placeholder when no icon is available
                    iconDisplay = `
                        <div style="color: #999; font-size: 24px;">📄</div>
                    `;
                }
                
                iconCard.innerHTML = `
                    <div class="icon-preview">
                        ${iconDisplay}
                    </div>
                    <div class="icon-name">${icon.name}</div>
                    <div class="icon-id">ID: ${icon.id}</div>
                    <div class="icon-actions">
                        <button class="action-btn select-btn" onclick="toggleSelection(${index})">
                            Select
                        </button>
                        <button class="action-btn preview-btn" onclick="previewIcon(${index})">preview</button>
                    </div>
                `;
                grid.appendChild(iconCard);
            });
        }

// Update pagination controls
function updatePagination() {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageNumbers = document.getElementById('pageNumbers');
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    
    // Generate page number buttons
    generatePageNumbers(pageNumbers);
}

// Generate page number buttons
function generatePageNumbers(container) {
        container.innerHTML = '';
        
        const maxVisiblePages = 7; // Show up to 7 page numbers
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // Add first page and ellipsis if needed
        if (startPage > 1) {
            addPageButton(container, 1);
            if (startPage > 2) {
                addEllipsis(container);
            }
        }
        
        // Add visible page numbers
        for (let i = startPage; i <= endPage; i++) {
            addPageButton(container, i);
        }
        
        // Add ellipsis and last page if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                addEllipsis(container);
            }
            addPageButton(container, totalPages);
        }
    }

// Add a page number button
function addPageButton(container, pageNum) {
        const button = document.createElement('button');
        button.className = 'page-number';
        button.textContent = pageNum;
        button.disabled = pageNum === currentPage;
        
        if (pageNum === currentPage) {
            button.classList.add('active');
        }
        
        button.addEventListener('click', () => goToPage(pageNum));
        container.appendChild(button);
    }

// Add ellipsis
function addEllipsis(container) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-ellipsis';
        ellipsis.textContent = '...';
        container.appendChild(ellipsis);
    }

// Go to specific page
async function goToPage(pageNum) {
        if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
            // Update URL with page parameter
            const urlParams = new URLSearchParams(window.location.search);
            const searchId = urlParams.get('searchId');
            
            if (searchId) {
                const newUrl = `${window.location.pathname}?searchId=${searchId}&page=${pageNum}`;
                window.history.pushState({}, '', newUrl);
                
                // Reload cached results with new page parameter
                await loadCachedResults();
            } else {
                // Fallback to local pagination if no searchId
                currentPage = pageNum;
                displayIcons(currentIcons, totalIcons);
            }
        }
    }

// Go to previous page
function prevPage() {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    }

// Go to next page
function nextPage() {
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    }

    // Toggle icon selection
    function toggleSelection(index) {
        const icon = currentIcons[index];
        
        if (!icon) {
            console.error('Icon not found, index:', index, 'current page icons count:', currentIcons.length);
            return;
        }
        
        if (selectedIcons.has(icon.id)) {
            selectedIcons.delete(icon.id);
        } else {
            selectedIcons.add(icon.id);
        }
        
        updateSelectedDisplay();
        updateSaveButton();
        displayIcons(currentIcons, totalIcons); // Refresh to update button states
        
        // If icons are selected, automatically send to server
        if (selectedIcons.size > 0) {
            autoSendSelectedIcons();
        }
    }

    // Update selected icons display
    function updateSelectedDisplay() {
        const selectedSection = document.getElementById('selectedIcons');
        const selectedList = document.getElementById('selectedList');
        
        if (selectedIcons.size === 0) {
            selectedSection.style.display = 'none';
            return;
        }
        
        selectedSection.style.display = 'block';
        selectedList.innerHTML = '';
        
        selectedIcons.forEach(iconId => {
            const icon = currentIcons.find(i => i.id === iconId);
            if (icon) {
                const item = document.createElement('div');
                item.className = 'selected-item';
                item.innerHTML = `
                    <span>${icon.name}</span>
                    <button class="remove-btn" onclick="removeSelection('${iconId}')">×</button>
                `;
                selectedList.appendChild(item);
            }
        });
        
        // Show auto-send notification
        const autoSendNotice = selectedSection.querySelector('.auto-send-notice');
        if (autoSendNotice) {
            autoSendNotice.style.display = 'block';
        }
    }

    // Remove selection
    function removeSelection(iconId) {
        selectedIcons.delete(iconId);
        updateSelectedDisplay();
        updateSaveButton();
        displayIcons(currentIcons, totalIcons); // Refresh to update button states
    }

    // Update save button state (deprecated, kept for compatibility)
    function updateSaveButton() {
        // No longer need save button due to auto-send
    }

    // Preview icon
    function previewIcon(index) {
        const icon = currentIcons[index];
        
        if (!icon) {
            console.error('Icon not found, index:', index, 'current page icons count:', currentIcons.length);
            return;
        }
        
        const previewWindow = window.open('', '_blank', 'width=600,height=400');
        
        // Prioritize show_svg, fallback to icon field if not available
        let iconDisplay = '';
        if (icon.show_svg) {
            iconDisplay = `
                <div style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                    <div style="font-size: 120px; color: #333;">
                        ${icon.show_svg}
                    </div>
                </div>
            `;
        } else if (icon.icon) {
            iconDisplay = `
                <div style="margin: 20px 0;">
                    <img src="${icon.icon}" alt="${icon.name}" style="max-width: 200px; max-height: 200px;">
                </div>
            `;
        } else {
            iconDisplay = `
                <div style="margin: 20px 0; font-size: 48px; color: #999;">📄</div>
            `;
        }
        
        previewWindow.document.write(`
            <html>
            <head>
                <title>Icon Preview - ${icon.name}</title>
                <style>
                    body { margin: 0; padding: 20px; text-align: center; font-family: Arial, sans-serif; }
                    .preview-container { max-width: 500px; margin: 0 auto; }
                    .icon-preview { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 10px; }
                    .icon-preview svg { width: 120px; height: 120px; fill: #333; }
                    .icon-info { text-align: left; margin: 20px 0; }
                    .close-btn { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="preview-container">
                    <h2>${icon.name}</h2>
                    <div class="icon-preview">
                        ${iconDisplay}
                    </div>
                    <div class="icon-info">
                        <p><strong>ID:</strong> ${icon.id}</p>
                        <p><strong>name:</strong> ${icon.name}</p>
                        <p><strong>fontClass:</strong> ${icon.font_class}</p>
                        <p><strong>Unicode:</strong> ${icon.unicode}</p>
                        <p><strong>size:</strong> ${icon.width} × ${icon.height}</p>
                    </div>
                    <button class="close-btn" onclick="window.close()">close</button>
                </div>
            </body>
            </html>
        `);
    }

    // Auto send selected icons
    async function autoSendSelectedIcons() {
        if (selectedIcons.size === 0) return;

        const selectedIconsData = currentIcons.filter(icon => selectedIcons.has(icon.id));
        
        // Get current search ID
        const urlParams = new URLSearchParams(window.location.search);
        const searchId = urlParams.get('searchId');
        
        try {
            showLoading(true);
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    icons: selectedIconsData,
                    searchId: searchId
                })
            });

            let data;
            try {
                data = await response.json();

                if (data && data.error) {
                    showError(data.error);
                } else {
                    window.close();
                }

            } catch (parseError) {
                console.error('Failed to parse response:', parseError);
                // Even if parsing fails, if response is ok, consider it success
                if (response.ok) {
                    showSuccess('Icon selection sent to MCP client');
                    
                    // Clear selection and refresh interface
                    selectedIcons.clear();
                    updateSelectedDisplay();
                    updateSaveButton();
                    displayIcons(currentIcons, totalIcons);
                    
                    // Close window after successful submission
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                } else {
                    showError('Failed to parse server response');
                }
            }
            
            
        } catch (error) {
            showError('sendFailed: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    // Save selected icons (keep original functionality but hide button)
    async function saveSelectedIcons() {
        await autoSendSelectedIcons();
    }

    // Save button click (deprecated due to auto-send)
    // document.getElementById('saveBtn').addEventListener('click', saveSelectedIcons);

    // Utility functions
    function showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    function showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    function showSuccess(message) {
        const successDiv = document.getElementById('success');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    }

    function hideMessages() {
        document.getElementById('error').style.display = 'none';
        document.getElementById('success').style.display = 'none';
    }



    // Load cached search results from URL parameters
    async function loadCachedResults() {
        const urlParams = new URLSearchParams(window.location.search);
        searchId = urlParams.get('searchId');
        const urlPage = urlParams.get('page');
        const urlQuery = urlParams.get('q');
        
        if (searchId) {
            console.log('Loading cached search results:', searchId);
            showLoading(true);
            hideMessages();
            
            // Initialize WebSocket connection
            initWebSocket();
            
            try {
                // Build API URL with pagination parameter and query parameter
                let apiUrl = `/api/cache?searchId=${searchId}`;
                if (urlPage && parseInt(urlPage) > 0) {
                    apiUrl += `&page=${urlPage}`;
                }
                if (urlQuery) {
                    apiUrl += `&q=${encodeURIComponent(urlQuery)}`;
                }
                
                console.log('API request URL:', apiUrl);
                const response = await fetch(apiUrl);
                const data = await response.json();
                
                console.log('Cache API response:', data);
                
                if (data.success) {
                    // Populate search form
                    const params = data.searchParams;
                  
                    // Use searchParams to set current page and page size
                    if (params) {
                        // Check if URL has page parameter, use it if valid
                        if (urlPage && parseInt(urlPage) > 0) {
                            currentPage = parseInt(urlPage);
                            console.log(`Using URL page parameter: ${currentPage}`);
                        } else {
                            currentPage = params.page || 1;
                            console.log(`Using searchParams page: ${currentPage}`);
                        }
                        pageSize = params.pageSize || 15;
                    } else {
                        // Reset pagination to default
                        currentPage = urlPage ? parseInt(urlPage) : 1;
                        pageSize = 15;
                        console.log('No searchParams found, using URL page or default');
                    }
                    
                    // Set current page number
                    if (urlPage && parseInt(urlPage) > 0) {
                        currentPage = parseInt(urlPage);
                    } else {
                        currentPage = params.page || 1;
                    }
                    
                    // Display search results - handle nested data structure
                    currentIcons = data.data?.data?.icons || data.data?.icons || [];
                    const totalCount = data.data?.count || currentIcons.length;
                    
                    // Calculate pagination
                    totalIcons = totalCount;
                    totalPages = Math.ceil(totalIcons / pageSize);
                    
                    console.log('Display icons debug:', {
                        iconsLength: currentIcons.length,
                        totalCount: totalCount,
                        currentPage: currentPage,
                        pageSize: pageSize,
                        totalPages: totalPages
                    });
                    
                    displayIcons(currentIcons, totalCount);
                    
                    // Update pagination controls
                    updatePagination();
                    

                } else {
                    showError('failedToLoadCache: ' + data.error);
                    // If cache loading fails, clear search box, do not execute search
                
                }
            } catch (error) {
                showError('failedToLoadCache: ' + error.message);
                // If cache loading fails, clear search box, do not execute search
              
            } finally {
                showLoading(false);
            }
        } else {
            // No cache ID, clear search box, do not execute search
         
        }
    }

    // WebSocket connection management - only handle ping/pong
    function initWebSocket() {
        // Check if WebSocket is already connected and working
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected, reusing existing connection');
            return;
        }
        
        // Close existing connection if it exists but is not open
        if (websocket) {
            console.log('Closing existing WebSocket connection');
            websocket.close();
        }
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?searchId=${searchId}`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function(event) {
            console.log('WebSocket connection established');
            
            // Send ping message to test connection
            sendPing();
        };
        
        websocket.onmessage = function(event) {
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (error) {
                console.error('WebSocket message parsing failed:', error);
            }
        };
        
        websocket.onclose = function(event) {
            console.log('WebSocket connection closed');
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
        };
    }
    
    // Send ping message
    function sendPing() {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'ping',
                timestamp: new Date().toISOString()
            }));
        }
    }
    
    // Handle WebSocket messages - only handle ping/pong
    function handleWebSocketMessage(message) {
        switch (message.type) {
            case 'welcome':
                console.log('Server welcome message:', message.message);
                break;
                
            case 'pong':
                console.log('Received pong response');
                setTimeout(sendPing, 3000);
                // Can add heartbeat detection logic here
                break;
                
            default:
                console.log('Received message:', message.type);
        }
    }

    // Clean up WebSocket connection when page unloads
    window.addEventListener('beforeunload', () => {
        if (websocket) {
            websocket.close();
        }
    });
    
    // Notify server when page is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && websocket) {
            // Page is hidden, user may have closed browser
           
        }
    });

    // Clean up WebSocket connection when page unloads
    window.addEventListener('beforeunload', () => {
        if (websocket) {
            websocket.close();
        }
    });

    // Add pagination event listeners
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);

    // Auto-load on page load
    window.addEventListener('load', () => {
        loadCachedResults();
    });

    // Listen for browser back/forward buttons
    window.addEventListener('popstate', function(event) {
        loadCachedResults();
    });

    // Header search functionality
    function performHeaderSearch() {
        const searchInput = document.getElementById('headerSearchInput');
        const query = searchInput.value.trim();
        
        if (query) {
            // Update URL with q parameter and page=1
            const urlParams = new URLSearchParams(window.location.search);
            const searchId = urlParams.get('searchId');
            
            if (searchId) {
                const newUrl = `${window.location.pathname}?searchId=${searchId}&q=${encodeURIComponent(query)}&page=1`;
                window.history.pushState({}, '', newUrl);
                
                // Reload cached results with new keyword
                loadCachedResults();
            } else {
                // If no searchId, show error message
                showError('Please search first');
            }
        }
    }
    
    // Handle form submission
    document.addEventListener('DOMContentLoaded', function() {
        const searchForm = document.getElementById('headerSearchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault(); // Prevent default form submission
                e.stopPropagation(); // Prevent event bubbling
                performHeaderSearch();
            });
        }
    });
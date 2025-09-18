let selectedIcons = new Set();
let currentIcons = [];
let websocket = null;
let searchId = null;
// Display icons
function displayIcons(icons) {
    const grid = document.getElementById('iconsGrid');
    grid.innerHTML = '';

    icons.forEach((icon, index) => {
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

        // Toggle icon selection
        function toggleSelection(index) {
            const icon = currentIcons[index];
            if (selectedIcons.has(icon.id)) {
                selectedIcons.delete(icon.id);
            } else {
                selectedIcons.add(icon.id);
            }
            
            updateSelectedDisplay();
            updateSaveButton();
            displayIcons(currentIcons); // Refresh to update button states
            
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
            displayIcons(currentIcons); // Refresh to update button states
        }

        // Update save button state (deprecated, kept for compatibility)
        function updateSaveButton() {
            // No longer need save button due to auto-send
        }

        // Preview icon
        function previewIcon(index) {
            const icon = currentIcons[index];
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
            
            // 获取当前搜索ID
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
                    } else if (data) {
                        showSuccess('Icon selection sent to MCP client');
                        
                        // Clear selection and refresh interface
                        selectedIcons.clear();
                        updateSelectedDisplay();
                        updateSaveButton();
                        displayIcons(currentIcons);
                        
                        window.close();
                    }

                } catch (parseError) {
                    console.error('Failed to parse response:', parseError);
                    showError('Failed to parse server response');
                    return;
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
            document.getElementById('loading').style.display = show ? 'block' : 'none';
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
            
            if (searchId) {
                console.log('Loading cached search results:', searchId);
                showLoading(true);
                hideMessages();
                
                // Initialize WebSocket connection
                initWebSocket();
                
                try {
                    const response = await fetch(`/api/cache?searchId=${searchId}`);
                    const data = await response.json();
                    
                    console.log('Cache API response:', data);
                    
                    if (data.success) {
                        // Populate search form
                        const params = data.searchParams;
                      
                        
                        // Display search results - handle nested data structure
                        currentIcons = data.data?.data?.icons || data.data?.icons || [];
                        displayIcons(currentIcons);
                        

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
                    setTimeout(sendPing, 3000);
                    console.log('Received pong response');
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
                
            }
        });

        // Clean up WebSocket connection when page unloads
        window.addEventListener('beforeunload', () => {
            if (websocket) {
                websocket.close();
            }
        });

        // Auto-load on page load
        window.addEventListener('load', () => {
            loadCachedResults();
        });
let selectedIcons = new Set();
let currentIcons = [];
let websocket = null;
let searchId = null;
        // 显示图标
function displayIcons(icons) {
    const grid = document.getElementById('iconsGrid');
    grid.innerHTML = '';

    icons.forEach((icon, index) => {
        const iconCard = document.createElement('div');
        iconCard.className = 'icon-card';

        // 优先使用show_svg，如果没有则使用icon字段
        let iconDisplay = '';
        if (icon.show_svg) {
            // 使用SVG格式显示
            iconDisplay = `
                        <div class="icon-svg-container">
                            ${icon.show_svg}
                        </div>
                    `;
                } else if (icon.icon) {
                    // 使用图片格式显示
                    iconDisplay = `
                        <img src="${icon.icon}" alt="${icon.name}" style="max-width: 100%; max-height: 100%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div style="display: none; color: #999;">📄</div>
                    `;
                } else {
                    // 没有可用图标时显示占位符
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
                           选择
                        </button>
                        <button class="action-btn preview-btn" onclick="previewIcon(${index})">预览</button>
                    </div>
                `;
                grid.appendChild(iconCard);
            });
        }

        // 切换图标选择
        function toggleSelection(index) {
            const icon = currentIcons[index];
            if (selectedIcons.has(icon.id)) {
                selectedIcons.delete(icon.id);
            } else {
                selectedIcons.add(icon.id);
            }
            
            updateSelectedDisplay();
            updateSaveButton();
            displayIcons(currentIcons); // 刷新以更新按钮状态
            
            // 如果选择了图标，自动发送到服务端
            if (selectedIcons.size > 0) {
                autoSendSelectedIcons();
            }
        }

        // 更新选中图标显示
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
            
            // 显示自动发送提示
            const autoSendNotice = selectedSection.querySelector('.auto-send-notice');
            if (autoSendNotice) {
                autoSendNotice.style.display = 'block';
            }
        }

        // 移除选择
        function removeSelection(iconId) {
            selectedIcons.delete(iconId);
            updateSelectedDisplay();
            updateSaveButton();
            displayIcons(currentIcons); // 刷新以更新按钮状态
        }

        // 更新保存按钮状态（已废弃，保留兼容性）
        function updateSaveButton() {
            // 不再需要保存按钮，因为自动发送
        }

        // 预览图标
        function previewIcon(index) {
            const icon = currentIcons[index];
            const previewWindow = window.open('', '_blank', 'width=600,height=400');
            
            // 优先使用show_svg，如果没有则使用icon字段
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
                    <title>图标预览 - ${icon.name}</title>
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
                        <button class="close-btn" onclick="window.close()">关闭</button>
                    </div>
                </body>
                </html>
            `);
        }

        // 自动发送选中的图标
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
                        showSuccess('图标选择已发送到MCP客户端');
                        
                        // 清空选择并刷新界面
                        selectedIcons.clear();
                        updateSelectedDisplay();
                        updateSaveButton();
                        displayIcons(currentIcons);
                        
                        window.close();
                    }

                } catch (parseError) {
                    console.error('解析响应失败:', parseError);
                    showError('解析服务器响应失败');
                    return;
                }
                
                
            } catch (error) {
                showError('发送失败: ' + error.message);
            } finally {
                showLoading(false);
            }
        }

        // 保存选中的图标（保留原有功能，但隐藏按钮）
        async function saveSelectedIcons() {
            await autoSendSelectedIcons();
        }

        // 保存按钮点击（已废弃，因为自动发送）
        // document.getElementById('saveBtn').addEventListener('click', saveSelectedIcons);

        // 工具函数
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



        // 从URL参数加载缓存的搜索结果
        async function loadCachedResults() {
            const urlParams = new URLSearchParams(window.location.search);
            searchId = urlParams.get('searchId');
            
            if (searchId) {
                console.log('从缓存加载搜索结果:', searchId);
                showLoading(true);
                hideMessages();
                
                // 初始化WebSocket连接
                initWebSocket();
                
                try {
                    const response = await fetch(`/api/cache?searchId=${searchId}`);
                    const data = await response.json();
                    
                    console.log('缓存API响应:', data);
                    
                    if (data.success) {
                        // 填充搜索表单
                        const params = data.searchParams;
                      
                        
                        // 显示搜索结果 - 处理嵌套的数据结构
                        currentIcons = data.data?.data?.icons || data.data?.icons || [];
                        displayIcons(currentIcons);
                        

                    } else {
                        showError('加载缓存失败: ' + data.error);
                        // 如果缓存加载失败，清空搜索框，不执行搜索
                    
                    }
                } catch (error) {
                    showError('加载缓存失败: ' + error.message);
                    // 如果缓存加载失败，清空搜索框，不执行搜索
                  
                } finally {
                    showLoading(false);
                }
            } else {
                // 没有缓存ID，清空搜索框，不执行搜索
             
            }
        }

        // WebSocket 连接管理 - 只处理ping/pong
        function initWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}?searchId=${searchId}`;
            
            console.log('连接WebSocket:', wsUrl);
            
            websocket = new WebSocket(wsUrl);
            
            websocket.onopen = function(event) {
                console.log('WebSocket连接已建立');
                
                // 发送ping消息测试连接
                sendPing();
            };
            
            websocket.onmessage = function(event) {
                try {
                    const message = JSON.parse(event.data);
                    handleWebSocketMessage(message);
                } catch (error) {
                    console.error('WebSocket消息解析失败:', error);
                }
            };
            
            websocket.onclose = function(event) {
                console.log('WebSocket连接已关闭');
            };
            
            websocket.onerror = function(error) {
                console.error('WebSocket错误:', error);
            };
        }
        
        // 发送ping消息
        function sendPing() {
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({
                    type: 'ping',
                    timestamp: new Date().toISOString()
                }));
            }
        }
        
        // 处理WebSocket消息 - 只处理ping/pong
        function handleWebSocketMessage(message) {
            switch (message.type) {
                case 'welcome':
                    console.log('服务器欢迎消息:', message.message);
                    break;
                    
                case 'pong':
                    console.log('收到pong响应');
                    setTimeout(sendPing, 3000);
                    // 可以在这里添加心跳检测逻辑
                    break;
                    
                default:
                    console.log('收到消息:', message.type);
            }
        }

        // 页面卸载时清理WebSocket连接
        window.addEventListener('beforeunload', () => {
            if (websocket) {
                websocket.close();
            }
        });
        
        // 页面隐藏时通知服务器
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && websocket) {
                // 页面被隐藏，可能用户关闭了浏览器
               
            }
        });

        // 页面卸载时清理WebSocket连接
        window.addEventListener('beforeunload', () => {
            if (websocket) {
                websocket.close();
            }
        });

        // 页面加载时自动加载
        window.addEventListener('load', () => {
            loadCachedResults();
        });
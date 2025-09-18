let selectedIcons = new Set();
let currentIcons = [];
let websocket = null;
let searchId = null;
let currentPage = 1;
let totalPages = 1;
let totalIcons = 0;
let pageSize = 15;
        // 显示图标（带分页）
        function displayIcons(icons, totalCount = null) {
            const grid = document.getElementById('iconsGrid');
            if (!grid) {
                console.error('iconsGrid 元素未找到！');
                return;
            }
            grid.innerHTML = '';

            
            // 后台已经返回了对应页面的数据，直接显示，不需要再切片
            const pageIcons = icons;
            
            console.log('直接显示图标:', {
                pageIconsLength: pageIcons.length,
                pageIcons: pageIcons
            });

    console.log('开始渲染图标，数量:', pageIcons.length);
    
    if (pageIcons.length === 0) {
        console.log('没有图标需要显示');
        return;
    }
    
    pageIcons.forEach((icon, index) => {
  
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

// 更新分页控件
function updatePagination() {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageNumbers = document.getElementById('pageNumbers');
    console.log('更新分页控件', {
        totalPages: totalPages,
        currentPage: currentPage,
        pageNumbers: pageNumbers
    });
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    
    // 生成页码按钮
    generatePageNumbers(pageNumbers);
}

// 生成页码按钮
function generatePageNumbers(container) {
    container.innerHTML = '';
    
    const maxVisiblePages = 7; // 最多显示7个页码
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // 如果接近末尾，调整起始页
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // 添加第一页和省略号（如果需要）
    if (startPage > 1) {
        addPageButton(container, 1);
        if (startPage > 2) {
            addEllipsis(container);
        }
    }
    
    // 添加可见的页码
    for (let i = startPage; i <= endPage; i++) {
        addPageButton(container, i);
    }
    
    // 添加省略号和最后一页（如果需要）
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            addEllipsis(container);
        }
        addPageButton(container, totalPages);
    }
}

// 添加页码按钮
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

// 添加省略号
function addEllipsis(container) {
    const ellipsis = document.createElement('span');
    ellipsis.className = 'page-ellipsis';
    ellipsis.textContent = '...';
    container.appendChild(ellipsis);
}

// 跳转到指定页
async function goToPage(pageNum) {
    if (pageNum >= 1 && pageNum <= totalPages && pageNum !== currentPage) {
        // 更新URL，添加page参数
        const urlParams = new URLSearchParams(window.location.search);
        const searchId = urlParams.get('searchId');
        
        if (searchId) {
            const newUrl = `${window.location.pathname}?searchId=${searchId}&page=${pageNum}`;
            window.history.pushState({}, '', newUrl);
            
            // 使用新的page参数重新加载缓存结果
            await loadCachedResults();
        } else {
            // 如果没有searchId，回退到本地分页
            currentPage = pageNum;
            displayIcons(currentIcons, totalIcons);
        }
    }
}

// 上一页
function prevPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

// 下一页
function nextPage() {
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
}

    // 切换图标选择
    function toggleSelection(index) {
        const icon = currentIcons[index];
        
        if (!icon) {
            console.error('图标未找到，索引:', index, '当前页图标数量:', currentIcons.length);
            return;
        }
        
        if (selectedIcons.has(icon.id)) {
            selectedIcons.delete(icon.id);
        } else {
            selectedIcons.add(icon.id);
        }
        
        updateSelectedDisplay();
        updateSaveButton();
        displayIcons(currentIcons, totalIcons); // 刷新以更新按钮状态
        
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
        displayIcons(currentIcons, totalIcons); // 刷新以更新按钮状态
    }

    // 更新保存按钮状态（已废弃，保留兼容性）
    function updateSaveButton() {
        // 不再需要保存按钮，因为自动发送
    }

    // 预览图标
    function previewIcon(index) {
        const icon = currentIcons[index];
        
        if (!icon) {
            console.error('图标未找到，索引:', index, '当前页图标数量:', currentIcons.length);
            return;
        }
        
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
                } else {
                    // 成功 - 显示消息并关闭窗口
                    showSuccess('图标选择已发送到MCP客户端');
                    
                    // 清空选择并刷新界面
                    selectedIcons.clear();
                    updateSelectedDisplay();
                    updateSaveButton();
                    displayIcons(currentIcons, totalIcons);
                    
                    // 成功提交后总是关闭窗口
                    setTimeout(() => {
                        window.close();
                    }, 1000); // 给用户时间看到成功消息
                }

            } catch (parseError) {
                console.error('解析响应失败:', parseError);
                // 即使解析失败，如果响应是ok的，也认为是成功
                if (response.ok) {
                    window.close();
                } else {
                    showError('解析服务器响应失败');
                }
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



    // 从URL参数加载缓存的搜索结果
    async function loadCachedResults() {
        const urlParams = new URLSearchParams(window.location.search);
        searchId = urlParams.get('searchId');
        const urlPage = urlParams.get('page');
        const urlQuery = urlParams.get('q');
        
        if (searchId) {
            console.log('从缓存加载搜索结果:', searchId);
            showLoading(true);
            hideMessages();
            
            // 初始化WebSocket连接
            initWebSocket();
            
            try {
                // 构建API URL，包含分页参数和查询参数
                let apiUrl = `/api/cache?searchId=${searchId}`;
                if (urlPage && parseInt(urlPage) > 0) {
                    apiUrl += `&page=${urlPage}`;
                }
                if (urlQuery) {
                    apiUrl += `&q=${encodeURIComponent(urlQuery)}`;
                }
                
                console.log('API请求URL:', apiUrl);
                const response = await fetch(apiUrl);
                const data = await response.json();
                
                console.log('缓存API响应:', data);
                
                if (data.success) {
                    // 填充搜索表单
                    const params = data.searchParams;
                  
                    // 使用searchParams设置当前页码和每页大小
                    if (params) {
                        // 检查URL是否有page参数，如果有且有效则使用
                        if (urlPage && parseInt(urlPage) > 0) {
                            currentPage = parseInt(urlPage);
                            console.log(`使用URL页码参数: ${currentPage}`);
                        } else {
                            currentPage = params.page || 1;
                            console.log(`使用searchParams页码: ${currentPage}`);
                        }
                        pageSize = params.pageSize || 15;
                    } else {
                        // 重置分页为默认值
                        currentPage = urlPage ? parseInt(urlPage) : 1;
                        pageSize = 15;
                        console.log('未找到searchParams，使用URL页码或默认值');
                    }
                    
                    // 设置当前页码
                    if (urlPage && parseInt(urlPage) > 0) {
                        currentPage = parseInt(urlPage);
                    } else {
                        currentPage = params.page || 1;
                    }
                    
                    // 显示搜索结果 - 处理嵌套的数据结构
                    currentIcons = data.data?.data?.icons || data.data?.icons || [];
                    const totalCount = data.data?.count || currentIcons.length;
                    
                    // 计算分页
                    totalIcons = totalCount;
                    totalPages = Math.ceil(totalIcons / pageSize);
                    
                    console.log('显示图标调试:', {
                        iconsLength: currentIcons.length,
                        totalCount: totalCount,
                        currentPage: currentPage,
                        pageSize: pageSize,
                        totalPages: totalPages,
                        data
                    });
                    
                    displayIcons(currentIcons, totalCount);
                    
                    // 更新分页控件
                    updatePagination();
                    

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
        // 检查WebSocket是否已经连接并正常工作
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            console.log('WebSocket已连接，复用现有连接');
            return;
        }
        
        // 如果存在连接但不是打开状态，则关闭现有连接
        if (websocket) {
            console.log('关闭现有WebSocket连接');
            websocket.close();
        }
        
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

    // 添加分页事件监听器
    document.getElementById('prevPage').addEventListener('click', prevPage);
    document.getElementById('nextPage').addEventListener('click', nextPage);

    // 页面加载时自动加载
    window.addEventListener('load', () => {
        loadCachedResults();
    });

    // 监听浏览器前进/后退按钮
    window.addEventListener('popstate', function(event) {
        loadCachedResults();
    });

    // Header搜索功能
    function performHeaderSearch() {
        const searchInput = document.getElementById('headerSearchInput');
        const query = searchInput.value.trim();
        
        if (query) {
            // 更新URL，添加q参数和page=1
            const urlParams = new URLSearchParams(window.location.search);
            const searchId = urlParams.get('searchId');
            
            if (searchId) {
                const newUrl = `${window.location.pathname}?searchId=${searchId}&q=${encodeURIComponent(query)}&page=1`;
                window.history.pushState({}, '', newUrl);
                
                // 重新加载缓存结果，使用新的关键词
                loadCachedResults();
            } else {
                // 如果没有searchId，显示错误信息
                showError('请先进行搜索');
            }
        }
    }
    
    // 处理表单提交
    document.addEventListener('DOMContentLoaded', function() {
        const searchForm = document.getElementById('headerSearchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault(); // 阻止默认表单提交
                e.stopPropagation(); // 阻止事件冒泡
                performHeaderSearch();
            });
        }
    });
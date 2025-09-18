// Selection status checking tool utility
const { t } = require('../lang');
const { executeSingleCommand } = require('./window-utils-powershell');
class SelectionCheckerTool {
  constructor(options = {}) {
    this.searchCache = options.searchCache || new Map();
    this.selectionCache = options.selectionCache || new Map();
    this.httpServer = options.httpServer || null;
    this.cacheManagerTool = options.cacheManagerTool || null;
  }

  /**获取等待处理的数量**/
   get_waiting_count() {
    // 统计状态不存在或者状态不是 'failed' 和 'completed' 的数量
    let waitingCount = 0;
    
    for (const [key, value] of this.selectionCache.entries()) {
      // 检查是否有状态字段
      if (!value.status || (value.status !== 'failed' && value.status !== 'completed')) {
        waitingCount++;
      }
    }
    
    return waitingCount;
  }

  /**
   * Check selection status
   * @param {Object} params - Parameters
   * @returns {Object} Selection status
   */
  async check_selection_status(params) {
    const { searchId, maxWaitTime = 180000 } = params || {}; // Default wait 3 minutes

    if (!searchId) {
      throw new Error('Missing searchId parameter');
    }

    // Check if search results exist in cache
    const cachedResult = this.searchCache.get(searchId);
    if (!cachedResult) {
      return {
        isDelta: true,
        contentType: "text",
        content: [
          {
            type: "text",
            text: `❌ ${t('search.searchResultNotFound')}\n\n🔍 ${t('search.searchId')}: ${searchId}\n💡 ${t('search.pleaseSearchAgain')}`
          }
        ],
        status: 'not_found',
        message: t('search.searchResultNotFound'),
        searchId: searchId
      };
    }

    // Start waiting for user selection (silent wait)
    const webUrl = this.httpServer ? this.httpServer.getUrl() : 'http://localhost:3000';
    process.stderr.write(`🌐 ${t('search.webPageUrl')}: ${webUrl}?searchId=${searchId}\n`);

    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms
    let lastDebugTime = startTime; // 用于调试输出

    return new Promise((resolve) => {
      const checkSelection = () => {
        const elapsedTime = Date.now() - startTime;

        // Check if timeout
        if (elapsedTime >= maxWaitTime) {
          // Wait timeout, stop detecting user selection
          resolve({
            isDelta: true,
            contentType: "text",
            content: [
              {
                type: "text",
                text: `⏰ ${t('selection.waitTimeout')}\n\n🌐 ${t('search.webPageUrl')}: ${webUrl}?searchId=${searchId}\n⏰ ${t('selection.waitTime')}: ${Math.round(elapsedTime / 1000)} seconds\n\n💡 ${t('selection.pleaseRefreshPage')}`
              }
            ],
            status: 'timeout',
            message: t('selection.waitTimeout'),
            searchId: searchId,
            elapsedTime: elapsedTime,
            webUrl: `${webUrl}?searchId=${searchId}`
          });
          return;
        }

        // 每10秒输出一次调试信息
        if (elapsedTime - (lastDebugTime - startTime) >= 10000) {
          const selection = this.selectionCache.get(searchId);
          const status = selection ? selection.status : 'not_found';
          const connected = selection ? selection.connected : false;
          process.stderr.write(`🔍 [DEBUG] searchId: ${searchId}, status: ${status}, connected: ${connected}, elapsed: ${Math.round(elapsedTime / 1000)}s\n`);
          lastDebugTime = Date.now();
        }

        // Check if there are selection results
        // Here we check if there are new selection notifications
        // In actual implementation, can check selection status through database, files or other storage
        const hasSelection = this.checkForUserSelection(searchId);

        if (hasSelection) {

          // 添加检查运行状态字段
          hasSelection.checkRun = true;
          // 检查是否有等待处理的请求
          const allWaiting = this.get_waiting_count();
          if (allWaiting === 0) {
            executeSingleCommand();
          }
          // 检查选择状态
          if (hasSelection.status === 'failed') {
            // 选择失败，立即终止检查
            process.stderr.write(`❌ ${t('selection.selectionFailed')}\n`);
            // 更新searchCache中对应条目的状态为failed
            const cachedResult = this.searchCache.get(searchId);
            if (cachedResult) {
              cachedResult.status = 'failed';
            }
            resolve({
              isDelta: true,
              contentType: "text",
              content: [
                {
                  type: "text",
                  text: `❌ ${t('selection.selectionFailed')}\n\n🔍 ${t('search.searchId')}: ${searchId}\n💡 ${t('selection.pleaseTryAgain')}`
                }
              ],
              status: 'failed',
              message: t('selection.selectionFailed'),
              searchId: searchId,
              failureReason: hasSelection.failureReason || 'Selection failed',
              allWaiting: allWaiting
            });



            return;
          }

          if (hasSelection.status === 'completed') {
            // 选择成功
            process.stderr.write(`✅ ${t('selection.detectedUserSelection')}\n`);
            // 更新searchCache中对应条目的状态为completed
            const cachedResult = this.searchCache.get(searchId);
            if (cachedResult) {
              cachedResult.status = 'completed';
            }
            // 检查是否有等待处理的请求
            const allWaiting = this.get_waiting_count();
            if (allWaiting === 0) {
              executeSingleCommand();
            }
            // 直接返回SVG内容
            const svgContents = hasSelection.selectedIcons.map(icon => {
              const svgContent = icon.show_svg || icon.icon;
              return {
                name: icon.name || icon.id,
                id: icon.id,
                svg: svgContent,
                fileName: `${icon.name || icon.id}.svg`
              };
            });

            resolve({
              ...svgContents,
              success: true,
              allWaiting: allWaiting
            });
            return;
          }

        }

        // Continue waiting (silent wait, no progress output)
        // Removed waiting progress messages
        setTimeout(checkSelection, checkInterval);
      };

      // 开始检测
      checkSelection();
    });
  }

  /**
   * Check if user has selected icons
   * @param {string} searchId - Search ID
   * @returns {Object|null} Selection result
   */
  checkForUserSelection(searchId) {
    // 检查selectionCache中是否有该searchId的选择结果
    const selection = this.selectionCache.get(searchId);
    if (selection) {
      // 只有成功完成的选择才清除缓存，失败状态保留以便检测
      if (selection.status === 'completed') {
        this.selectionCache.delete(searchId);
      }
      return selection;
    }
    return null;
  }
}

module.exports = SelectionCheckerTool;

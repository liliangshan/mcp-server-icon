// Icon saving tool utility
const fs = require('fs');
const path = require('path');
const { t } = require('../lang');

class IconSaverTool {
  constructor(options = {}) {
    this.selectionCache = options.selectionCache || new Map();
    this.httpServer = options.httpServer || null;
  }

  /**
   * Save icons to local files
   * @param {Object} params - Save parameters
   * @returns {Object} Save result
   */
  async save_icons(params) {
    const { icons, savePath = './saved-icons' } = params || {};

    if (!icons || !Array.isArray(icons)) {
      throw new Error('Invalid icons data');
    }

    try {
      // Create save directory
      const fullSavePath = path.resolve(savePath);
      if (!fs.existsSync(fullSavePath)) {
        fs.mkdirSync(fullSavePath, { recursive: true });
      }

      const timestamp = Date.now();
      const iconDir = path.join(fullSavePath, `icons-${timestamp}`);
      fs.mkdirSync(iconDir, { recursive: true });

      let savedCount = 0;
      const totalCount = icons.length;

      process.stderr.write(`📁 ${t('download.savePath')}: ${iconDir}\n`);

      for (let i = 0; i < icons.length; i++) {
        const icon = icons[i];
        try {
          process.stderr.write(`⏳ ${t('download.saving', { current: i + 1, total: totalCount, name: icon.name || icon.id })}\n`);

          // Prefer show_svg, if not available use icon field
          let iconData = icon.show_svg || icon.icon;

          if (!iconData) {
            process.stderr.write(`⚠️  ${t('download.noSvgData', { name: icon.name || icon.id })}\n`);
            continue;
          }

          // If iconData is URL, need to download
          if (iconData.startsWith('http')) {
            const iconResponse = await fetch(iconData);
            if (iconResponse.ok) {
              iconData = await iconResponse.text();
            } else {
              process.stderr.write(`❌ ${t('download.downloadFailed', { name: icon.name || icon.id })}\n`);
              continue;
            }
          }

          const fileName = `${icon.name || icon.id}.svg`;
          const filePath = path.join(iconDir, fileName);

          fs.writeFileSync(filePath, iconData);
          savedCount++;
          process.stderr.write(`✅ ${t('download.saved', { name: fileName })}\n`);
        } catch (iconError) {
          process.stderr.write(`❌ ${t('download.saveFailed', { name: icon.name || icon.id, error: iconError.message })}\n`);
        }
      }

      process.stderr.write(`\n🎉 ${t('download.saveCompleted')}\n`);
      process.stderr.write(`📊 ${t('download.successfullySaved', { saved: savedCount, total: totalCount })}\n`);
      process.stderr.write(`📁 ${t('download.saveLocation')}: ${iconDir.replace(/\\/g, '/')}\n`);

      return {
        success: true,
        savedCount: savedCount,
        totalCount: totalCount,
        savePath: iconDir,
        message: t('download.iconSaved', { saved: savedCount, total: totalCount, path: iconDir })
      };

    } catch (error) {
      process.stderr.write(`❌ ${t('download.errorDuringSave')}: ${error.message}\n`);
      throw error;
    }
  }

  /**
   * Send selected icons to MCP client
   * @param {Array} icons - Selected icons
   * @param {string} searchId - Search ID
   * @returns {Object} Send result
   */
  async sendToMCPClient(icons, searchId) {
    try {
      const result = {
        type: 'icon_selection',
        searchId: searchId,
        selectedIcons: icons,
        timestamp: Date.now(),
        summary: {
          count: icons.length,
          names: icons.map(icon => icon.name || icon.id)
        }
      };

      // Send to MCP client
      process.stderr.write(`📤 ${t('selection.sendingIcons', { count: icons.length })}\n`);
      process.stderr.write(`📋 ${t('selection.selectedIconsList')}: ${result.summary.names.join(', ')}\n`);

      // Send JSON-RPC notification to MCP client via stdout
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/icon_selection',
        params: {
          type: 'icon_selection',
          searchId: searchId,
          selectedIcons: icons,
          timestamp: Date.now(),
          summary: {
            count: icons.length,
            names: icons.map(icon => icon.name || icon.id)
          }
        }
      };

      // Send notification to MCP client
      console.log(JSON.stringify(notification));

      // Store selection results in cache for check_selection_status detection
      this.selectionCache.set(searchId, {
        selectedIcons: icons,
        summary: result.summary,
        timestamp: Date.now(),
        searchId: searchId,
        status: 'completed', // 标记为已完成
        completedAt: Date.now()
      });

      // Minimize browser window after successful send
      if (this.httpServer) {
        this.httpServer.minimizeBrowser();
      }

      return result;
    } catch (error) {
      process.stderr.write(`❌ ${t('selection.failedToSend')}: ${error.message}\n`);
      throw error;
    }
  }
}

module.exports = IconSaverTool;

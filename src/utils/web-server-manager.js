// Web server management tool utility
const { t } = require('../lang');

class WebServerManagerTool {
  constructor(options = {}) {
    this.httpServer = options.httpServer || null;
  }

  /**
   * Start HTTP server for web interface
   * @param {Object} params - Server parameters
   * @returns {Object} Server start result
   */
  async start_web_server(params) {
    const { port, autoOpen = true } = params || {};

    if (!this.httpServer) {
      throw new Error('HTTP server not initialized');
    }

    if (this.httpServer.isRunning()) {
      return {
        message: t('server.started'),
        port: this.httpServer.getPort(),
        url: this.httpServer.getUrl()
      };
    }

    try {
      const result = await this.httpServer.start({  autoOpen });
      return result;
    } catch (error) {
      throw new Error(`${t('server.startupFailed')}: ${error.message}`);
    }
  }

  /**
   * Stop HTTP server
   * @param {Object} params - Parameters
   * @returns {Object} Server stop result
   */
  async stop_web_server(params) {
    if (!this.httpServer) {
      return {
        message: t('server.shutdown')
      };
    }

    if (!this.httpServer.isRunning()) {
      return {
        message: t('server.shutdown')
      };
    }

    try {
      const result = await this.httpServer.stop();
      return result;
    } catch (error) {
      throw new Error(`${t('server.shutdown')}: ${error.message}`);
    }
  }
}

module.exports = WebServerManagerTool;

const storeConfigService = require('../services/storeConfig.service');

const storeConfigController = {
  async getPublicConfig(_req, res, next) {
    try {
      const config = await storeConfigService.getConfig();
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  },

  async getAdminConfig(_req, res, next) {
    try {
      const config = await storeConfigService.getAdminConfig();
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  },

  async updateConfig(req, res, next) {
    try {
      const updated = await storeConfigService.updateConfig(req.user, req.body);
      res.json({
        success: true,
        message: 'Store settings updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  async checkAddressCoverage(req, res, next) {
    try {
      const { lat, lng } = req.query;
      const result = await storeConfigService.validateDeliveryEligibility({ lat, lng }, { checkHours: false });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = storeConfigController;

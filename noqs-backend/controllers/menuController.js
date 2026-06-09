const menuModel = require('../models/menuModel');

exports.getMenu = async (req, res, next) => {
  try {
    const { category } = req.query;
    const items = await menuModel.getAll({ category });
    res.status(200).json(items);
  } catch (err) {
    next(err);
  }
};

exports.getMenuItem = async (req, res, next) => {
  try {
    const item = await menuModel.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Menu item '${req.params.id}' does not exist`
      });
    }
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
};

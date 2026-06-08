const menuModel = require('../models/menuModel');

exports.getMenu = (req, res, next) => {
  try {
    const { category } = req.query;
    let items = menuModel.getAll();

    if (category && category !== 'All') {
      items = items.filter(
        (i) => i.category.toLowerCase() === String(category).toLowerCase()
      );
    }

    res.status(200).json(items);
  } catch (err) {
    next(err);
  }
};

exports.getMenuItem = (req, res, next) => {
  try {
    const item = menuModel.findById(req.params.id);
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

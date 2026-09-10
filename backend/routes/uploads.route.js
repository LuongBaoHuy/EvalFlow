const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload.middleware');
const uploadsController = require('../controllers/uploads.controller');

// Middleware wrapper for handling single file upload with custom error messages
const handleSingleUpload = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Dung lượng tệp vượt quá giới hạn tối đa 5MB. Vui lòng chọn tệp nhỏ hơn.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Lỗi khi tải tệp lên',
      });
    }
    next();
  });
};

// POST /api/uploads/file & POST /api/uploads/image
router.post('/file', handleSingleUpload('file'), uploadsController.uploadFile);
router.post('/image', handleSingleUpload('image'), uploadsController.uploadFile);

module.exports = router;

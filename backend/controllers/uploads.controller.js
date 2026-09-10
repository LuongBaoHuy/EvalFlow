exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn 1 tệp hợp lệ (tối đa 5MB) để tải lên',
      });
    }

    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: 'Tải lên tệp thành công',
      data: {
        url: fileUrl,
        filename: req.file.originalname || req.file.filename,
        savedName: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Lỗi khi tải lên tệp',
    });
  }
};

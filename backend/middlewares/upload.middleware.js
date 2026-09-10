const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'file-' + uniqueSuffix + ext);
  },
});

// File filter (Allowed document & image extensions: .txt, .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .csv, .zip, .rar, .jpg, .png, etc.)
const fileFilter = (req, file, cb) => {
  const allowedExts = /\.(txt|doc|docx|pdf|xls|xlsx|ppt|pptx|csv|zip|rar|jpg|jpeg|png|gif|webp)$/i;
  const isExtensionValid = allowedExts.test(path.extname(file.originalname).toLowerCase());

  // Prevent executable & dangerous scripts
  const dangerousExts = /\.(exe|sh|bat|cmd|js|vbs|php|py|pl|cgi|jar)$/i;
  const isDangerous = dangerousExts.test(path.extname(file.originalname).toLowerCase());

  if (isExtensionValid && !isDangerous) {
    return cb(null, true);
  } else {
    cb(new Error('Tệp không hợp lệ! Hệ thống chấp nhận các định dạng tệp: .txt, .docx, .doc, .pdf, .xlsx, .xls, .ppt, .pptx, .csv, .zip, .rar, .jpg, .png...'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Strictly 5MB limit
  fileFilter: fileFilter,
});

module.exports = upload;

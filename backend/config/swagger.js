const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EvalFlow API Documentation',
      version: '1.0.0',
      description: `
Tài liệu OpenAPI 3.0 chính thức cho Hệ thống Quản lý Khảo sát EvalFlow.

### Các điểm nổi bật:
- **Xác thực JWT Bearer**: Nhấp vào nút **Authorize** ở trên cùng bên phải và dán Token vào dạng \`Bearer <token>\`.
- **Quản lý Đồng thời (Optimistic Locking)**: API \`PUT /api/surveys/:id\` và \`PUT /api/campaigns/:id\` bắt buộc nhận tham số \`version\` để phòng tránh xung đột dữ liệu giữa nhiều Quản trị viên (HTTP Status **409 Conflict**).
- **Tính toàn vẹn dữ liệu (Transactions)**: Tất cả API cập nhật liên hoàn đều được bảo vệ bởi PostgreSQL Database Transactions (\`BEGIN ... COMMIT ... ROLLBACK\`).
      `,
      contact: {
        name: 'EvalFlow Development Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Máy chủ Phát triển (Local Dev Server)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nhập JWT token lấy từ API đăng nhập \`/api/auth/login\`',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './server.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;

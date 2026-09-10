const express = require('express');
const router = express.Router();
const surveysController = require('../controllers/surveys.controller');
const questionsController = require('../controllers/questions.controller');

/**
 * @openapi
 * tags:
 *   name: Surveys
 *   description: Quản lý Mẫu Form Khảo sát (Transaction & Optimistic Locking)
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Survey:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: Form Khảo sát Đánh giá Môn học Học kỳ 1
 *         description:
 *           type: string
 *           example: Nhằm nâng cao chất lượng giảng dạy và dịch vụ đào tạo...
 *         theme_config:
 *           type: object
 *           properties:
 *             primaryColor:
 *               type: string
 *               example: "#2563eb"
 *             fontFamily:
 *               type: string
 *               example: "Inter"
 *             logoUrl:
 *               type: string
 *               example: ""
 *             coverImageUrl:
 *               type: string
 *               example: ""
 *         version:
 *           type: integer
 *           example: 3
 *           description: Số phiên bản phục vụ Optimistic Locking (Quản lý đồng thời)
 *         created_by:
 *           type: integer
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/surveys:
 *   get:
 *     summary: Lấy danh sách Mẫu khảo sát
 *     tags: [Surveys]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về danh sách Mẫu khảo sát và phân trang
 */
router.get('/', surveysController.listSurveys.bind(surveysController));

/**
 * @openapi
 * /api/surveys/trash:
 *   get:
 *     summary: Lấy danh sách Mẫu khảo sát đã xóa (Thùng rác)
 *     tags: [Surveys]
 *     responses:
 *       200:
 *         description: Trả về danh sách mẫu đã xóa mềm
 */
router.get('/trash', surveysController.listTrashSurveys.bind(surveysController));

/**
 * @openapi
 * /api/surveys/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết 1 Mẫu khảo sát
 *     tags: [Surveys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chi tiết Mẫu khảo sát (Bao gồm trường version hiện tại)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Survey'
 *       404:
 *         description: Không tìm thấy Mẫu khảo sát
 */
router.get('/:id', surveysController.getSurvey.bind(surveysController));

/**
 * @openapi
 * /api/surveys:
 *   post:
 *     summary: Tạo mới một Mẫu khảo sát
 *     tags: [Surveys]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - created_by
 *             properties:
 *               title:
 *                 type: string
 *                 example: Khảo sát Ý kiến Sinh viên 2026
 *               description:
 *                 type: string
 *                 example: Mô tả thông tin cho Form khảo sát
 *               theme_config:
 *                 type: object
 *               created_by:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Tạo Mẫu khảo sát thành công
 */
router.post('/', surveysController.createSurvey.bind(surveysController));

/**
 * @openapi
 * /api/surveys/{id}:
 *   put:
 *     summary: Cập nhật Mẫu khảo sát (Bảo vệ bởi Transaction & Optimistic Locking)
 *     tags: [Surveys]
 *     description: API thực thi câu lệnh SQL UPDATE trong PostgreSQL Transaction. Yêu cầu truyền trường `version` từ bản nạp ban đầu. Nếu version ở DB đã bị Admin khác tăng lên, API sẽ lập tức ROLLBACK và ném lỗi 409 Conflict.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - version
 *             properties:
 *               title:
 *                 type: string
 *                 example: Form Khảo sát Đánh giá Môn học (Đã sửa)
 *               description:
 *                 type: string
 *                 example: Nội dung mô tả cập nhật
 *               theme_config:
 *                 type: object
 *               version:
 *                 type: integer
 *                 example: 3
 *                 description: BẮT BUỘC gửi version hiện tại để tránh xung đột ghi đè giữa nhiều Quản trị viên
 *     responses:
 *       200:
 *         description: Cập nhật thành công, version tăng lên +1
 *       400:
 *         description: Dữ liệu gửi lên không hợp lệ
 *       409:
 *         description: Xung đột Dữ liệu (Optimistic Locking Conflict). Record đã bị Quản trị viên khác sửa trong lúc soạn thảo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Dữ liệu đã bị thay đổi bởi một Quản trị viên khác trong lúc bạn đang soạn thảo.
 */
router.put('/:id', surveysController.updateSurvey.bind(surveysController));

/**
 * @openapi
 * /api/surveys/{id}:
 *   delete:
 *     summary: Xóa mềm Mẫu khảo sát (Move to Trash)
 *     tags: [Surveys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Đã chuyển Mẫu khảo sát vào Thùng rác
 */
router.delete('/:id', surveysController.deleteSurvey.bind(surveysController));

/**
 * @openapi
 * /api/surveys/trash/{id}/restore:
 *   put:
 *     summary: Phục hồi Mẫu khảo sát từ Thùng rác
 *     tags: [Surveys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Đã khôi phục Mẫu khảo sát thành công
 */
router.put('/:id/restore', surveysController.restoreSurvey.bind(surveysController));

/**
 * @openapi
 * /api/surveys/trash/{id}/force:
 *   delete:
 *     summary: Xóa vĩnh viễn Mẫu khảo sát khỏi CSDL
 *     tags: [Surveys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Đã xóa vĩnh viễn Mẫu khảo sát
 */
router.delete('/:id/force', surveysController.forceDeleteSurvey.bind(surveysController));

// Survey questions sub-routes
router.get('/:surveyId/questions', questionsController.getSurveyQuestions.bind(questionsController));
router.post('/:surveyId/questions', questionsController.createQuestion.bind(questionsController));
router.post('/:surveyId/questions/batch', questionsController.replaceQuestionsBatch.bind(questionsController));
router.put('/:surveyId/questions/batch', questionsController.replaceQuestionsBatch.bind(questionsController));

module.exports = router;

const express = require('express');
const router = express.Router();
const assignmentsController = require('../controllers/assignments.controller');
const usersController = require('../controllers/users.controller');
const adminMiddleware = require('../middlewares/admin.middleware');

// Student / User existing endpoint
router.get('/my-assignments', assignmentsController.getMyAssignments.bind(assignmentsController));

// Admin User Management Endpoints (Protected by adminMiddleware)
router.get('/roles', adminMiddleware, usersController.getRoles.bind(usersController));
router.get('/', adminMiddleware, usersController.getUsers.bind(usersController));
router.post('/bulk-import', adminMiddleware, usersController.bulkImport.bind(usersController));
router.post('/', adminMiddleware, usersController.createUser.bind(usersController));
router.put('/:id', adminMiddleware, usersController.updateUser.bind(usersController));
router.patch('/:id/toggle-lock', adminMiddleware, usersController.toggleLockUser.bind(usersController));
router.delete('/:id', adminMiddleware, usersController.deleteUser.bind(usersController));

module.exports = router;

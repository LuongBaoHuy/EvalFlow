const usersService = require('../services/users.service');

class UsersController {
  async getRoles(req, res) {
    try {
      const data = await usersService.getRolesList();
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách vai trò thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách vai trò thất bại');
    }
  }

  async getUsers(req, res) {
    try {
      const { page, limit, search, role } = req.query;
      const data = await usersService.getUsersList({ page, limit, search, role });
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách người dùng thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Lấy danh sách người dùng thất bại');
    }
  }

  async createUser(req, res) {
    try {
      const data = await usersService.createUser(req.body);
      return res.status(201).json({
        success: true,
        message: 'Tạo tài khoản người dùng thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Tạo tài khoản thất bại');
    }
  }

  async updateUser(req, res) {
    try {
      const data = await usersService.updateUser(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        message: 'Cập nhật thông tin người dùng thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Cập nhật người dùng thất bại');
    }
  }

  async deleteUser(req, res) {
    try {
      const data = await usersService.deleteUser(req.params.id, req.user?.id);
      return res.status(200).json({
        success: true,
        message: 'Xóa người dùng thành công',
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Xóa người dùng thất bại');
    }
  }

  async toggleLockUser(req, res) {
    try {
      const data = await usersService.toggleLockUser(req.params.id, req.user?.id);
      const actionMsg = data.is_locked ? 'Khóa tài khoản thành công' : 'Mở khóa tài khoản thành công';
      return res.status(200).json({
        success: true,
        message: actionMsg,
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Thay đổi trạng thái khóa thất bại');
    }
  }

  async bulkImport(req, res) {
    try {
      const usersList = Array.isArray(req.body) ? req.body : req.body?.users || [];
      const data = await usersService.bulkImportUsers(usersList);
      return res.status(200).json({
        success: true,
        message: data.message,
        data,
      });
    } catch (err) {
      return this._sendError(res, err, 'Nhập danh sách tài khoản từ Excel thất bại');
    }
  }

  _sendError(res, err, fallbackMsg) {
    const statusCode = err.statusCode || 500;
    const message = err.statusCode ? err.message : fallbackMsg;
    return res.status(statusCode).json({
      success: false,
      message,
      data: null,
    });
  }
}

module.exports = new UsersController();

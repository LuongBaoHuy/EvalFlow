import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  getUsersApi,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  toggleLockUserApi,
  bulkImportUsersApi,
} from '../../api/users.api';
import { getUser } from '../../utils/auth.utils';
import {
  Download,
  Upload,
  Plus,
  Search,
  Check,
  Lock,
  Unlock,
  Trash2,
  X,
  Edit,
  UserPlus,
  FileSpreadsheet,
  Users
} from 'lucide-react';

export default function UsersList() {
  const currentUser = getUser();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null for Create, user object for Edit
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role_name: 'Sinh viên',
    custom_role: '',
    department: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete Confirmation Modal State
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users list
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getUsersApi({
        page,
        limit: 10,
        search: debouncedSearch,
        role: roleFilter,
      });
      if (res.success && res.data) {
        setUsers(res.data.users || []);
        setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      } else {
        setError(res.message || 'Không thể tải danh sách người dùng');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, debouncedSearch, roleFilter]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      const res = await getUsersApi({
        page: 1,
        limit: 10000,
        search: debouncedSearch,
        role: roleFilter,
      });

      const exportList = res.data?.users || [];
      if (exportList.length === 0) {
        alert('Không có dữ liệu người dùng nào để xuất!');
        return;
      }

      const formattedData = exportList.map((u, index) => ({
        'STT': index + 1,
        'Mã ID': u.id,
        'Họ và Tên': u.full_name,
        'Email': u.email,
        'Vai trò (Role)': u.role_name || 'N/A',
        'Khoa / Phòng ban': u.department || 'Chưa cập nhật',
      }));

      const ws = XLSX.utils.json_to_sheet(formattedData);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 8 },
        { wch: 25 },
        { wch: 30 },
        { wch: 18 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Nguoi_Dung');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Danh_Sach_Nguoi_Dung_${today}.xlsx`);

      showToast(`Đã xuất thành công ${formattedData.length} người dùng ra file Excel!`);
    } catch (err) {
      alert('Lỗi khi xuất file Excel: ' + (err.response?.data?.message || err.message));
    }
  };

  // Excel Sample Template Download
  const handleDownloadTemplate = () => {
    const wsData = [
      ['Họ và Tên', 'Email', 'Role', 'Khoa / Phòng ban'],
      ['Nguyễn Văn A', 'nguyenvana@gmail.com', 'Sinh viên', 'Khoa Công nghệ thông tin'],
      ['Trần Thị B', 'tranthib@gmail.com', 'Giảng viên', 'Khoa Kinh tế'],
      ['Lê Văn C', 'levanc@gmail.com', 'Sinh viên', 'Khoa Ngoại ngữ'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Danh_Sach_User');
    XLSX.writeFile(wb, 'Mau_Danh_Sach_Nguoi_Dung.xlsx');
  };

  // Excel Upload Import Handler
  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const importedUsers = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (Array.isArray(row) && row.length >= 2) {
            const fullName = String(row[0] || '').trim();
            const email = String(row[1] || '').trim();
            const roleName = String(row[2] || 'Sinh viên').trim();
            const department = String(row[3] || '').trim();

            if (fullName && email && email.includes('@')) {
              importedUsers.push({
                full_name: fullName,
                email,
                role_name: roleName,
                department,
              });
            }
          }
        }

        if (importedUsers.length === 0) {
          alert('File Excel không đúng định dạng hoặc không có dữ liệu hợp lệ (Cột A: Họ tên, Cột B: Email).');
          return;
        }

        const res = await bulkImportUsersApi(importedUsers);
        if (res.success) {
          showToast(res.message || `Đã nhập thành công ${importedUsers.length} tài khoản!`);
          fetchUsers();
        } else {
          alert(res.message || 'Không thể nhập file Excel');
        }
      } catch (err) {
        alert('Đã xảy ra lỗi khi đọc file Excel: ' + (err.response?.data?.message || err.message));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset file input
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      full_name: '',
      email: '',
      role_name: 'Sinh viên',
      custom_role: '',
      department: '',
      password: '123123',
    });
    setModalError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (userObj) => {
    setEditingUser(userObj);
    const isStandardRole = ['Admin', 'Sinh viên', 'Giảng viên'].includes(userObj.role_name);
    setFormData({
      full_name: userObj.full_name || '',
      email: userObj.email || '',
      role_name: isStandardRole ? userObj.role_name : 'Custom',
      custom_role: isStandardRole ? '' : userObj.role_name || '',
      department: userObj.department || '',
      password: '',
    });
    setModalError('');
    setIsModalOpen(true);
  };

  // Save Modal Form (Create / Edit)
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.email.trim()) {
      setModalError('Họ tên và Email là bắt buộc');
      return;
    }

    const finalRole =
      formData.role_name === 'Custom' ? formData.custom_role.trim() : formData.role_name;
    if (!finalRole) {
      setModalError('Vui lòng chọn hoặc nhập vai trò (Role)');
      return;
    }

    try {
      setSaving(true);
      setModalError('');

      if (editingUser) {
        const res = await updateUserApi(editingUser.id, {
          full_name: formData.full_name,
          email: formData.email,
          role_name: finalRole,
          department: formData.department,
        });
        if (res.success) {
          showToast('Đã cập nhật thông tin tài khoản thành công!');
          setIsModalOpen(false);
          fetchUsers();
        } else {
          setModalError(res.message || 'Cập nhật thất bại');
        }
      } else {
        const res = await createUserApi({
          full_name: formData.full_name,
          email: formData.email,
          role_name: finalRole,
          department: formData.department,
          password: formData.password || '123123',
        });
        if (res.success) {
          showToast('Đã tạo tài khoản người dùng thành công!');
          setIsModalOpen(false);
          fetchUsers();
        } else {
          setModalError(res.message || 'Tạo tài khoản thất bại');
        }
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Lỗi khi lưu thông tin người dùng');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Lock Account Handler
  const handleToggleLockUser = async (userObj) => {
    if (!userObj) return;
    if (currentUser && String(currentUser.id) === String(userObj.id)) {
      alert('Bạn không thể tự khóa tài khoản của chính mình!');
      return;
    }

    const actionText = userObj.is_locked ? 'MỞ KHÓA' : 'KHÓA';
    const detailText = userObj.is_locked
      ? 'Người dùng sẽ có thể đăng nhập trở lại bình thường.'
      : 'Người dùng sẽ bị đăng xuất và không thể đăng nhập vào hệ thống.';

    if (!window.confirm(`Xác nhận ${actionText} tài khoản "${userObj.full_name}"?\n(${detailText})`)) {
      return;
    }

    try {
      const res = await toggleLockUserApi(userObj.id);
      if (res.success) {
        showToast(res.message || `Đã ${actionText.toLowerCase()} tài khoản thành công!`);
        fetchUsers();
      } else {
        alert(res.message || 'Thao tác thất bại');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi thay đổi trạng thái khóa tài khoản');
    }
  };

  // Confirm Delete Handler
  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    if (currentUser && String(currentUser.id) === String(deletingUser.id)) {
      alert('Bạn không thể tự xóa tài khoản của chính mình!');
      setDeletingUser(null);
      return;
    }
    try {
      setDeleting(true);
      const res = await deleteUserApi(deletingUser.id);
      if (res.success) {
        showToast(`Đã xóa tài khoản "${deletingUser.full_name}" thành công!`);
        setDeletingUser(null);
        fetchUsers();
      } else {
        alert(res.message || 'Xóa tài khoản thất bại');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi xóa tài khoản');
    } finally {
      setDeleting(false);
    }
  };

  const getRoleBadgeStyle = (rName) => {
    if (rName === 'Admin') return 'bg-red-100 text-red-800 border-red-200';
    if (rName === 'Giảng viên') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (rName === 'Sinh viên') return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-amber-100 text-amber-800 border-amber-200';
  };

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[100] bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-bounce">
          <Check size={16} className="currentColor" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Header (Styled like /admin/campaigns) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quản lý Người dùng</h1>
          <p className="text-sm text-gray-500 mb-6">
            Xem danh sách tài khoản, tìm kiếm, lọc phân quyền và quản lý tài khoản thành viên trong hệ thống.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0 self-start md:self-auto">
          {/* Nút Tải File Mẫu Excel */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium text-sm px-4 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
            title="Tải về file Excel mẫu 4 cột chuẩn (Họ tên | Email | Role | Khoa)"
          >
            <Download size={16} className="currentColor" /> <span>Tải mẫu Excel</span>
          </button>

          {/* Nút Xuất Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium text-sm px-4 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
            title="Xuất danh sách người dùng ra Excel"
          >
            <FileSpreadsheet size={16} className="currentColor" /> <span>Xuất Excel</span>
          </button>

          {/* Nút Import Excel */}
          <label className="bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium text-sm px-4 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer">
            <Upload size={16} className="currentColor" /> <span>Nhập từ Excel</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelUpload}
              className="hidden"
            />
          </label>

          {/* Nút Tạo Tài khoản Thủ công */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-6 py-2 rounded-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} className="currentColor" /> <span>Thêm Người dùng</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar (Borderless) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4">
        <div className="relative w-full sm:w-[400px]">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 text-sm">
            <Search size={16} className="currentColor" />
          </span>
          <input
            type="text"
            placeholder="Tìm theo Tên hoặc Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-base border-b border-gray-300 py-2 pl-9 focus:outline-none focus:border-gray-900 text-gray-900 placeholder:text-gray-400 bg-transparent transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-400 hover:text-gray-900 cursor-pointer"
            >
              <X size={16} className="currentColor" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-sm font-medium text-gray-500">Vai trò:</span>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="text-sm border-b border-gray-300 py-2 outline-none focus:border-gray-900 text-gray-700 bg-transparent cursor-pointer"
          >
            <option value="">Tất cả vai trò</option>
            <option value="Admin">Admin (Quản trị viên)</option>
            <option value="Sinh viên">Sinh viên</option>
            <option value="Giảng viên">Giảng viên</option>
          </select>
        </div>
      </div>

      {/* 3. Table Container (Borderless) */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-xs font-medium flex items-center gap-2">
          <X size={16} className="currentColor" /> {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500 font-medium">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent mb-2"></div>
          <p className="text-base">Đang tải danh sách người dùng...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Users size={32} className="mx-auto text-gray-400" />
          <p className="text-base text-gray-500 font-medium">Không tìm thấy người dùng nào phù hợp</p>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 w-16 border-b border-gray-200">ID</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Họ và Tên</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Email</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Vai trò</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Trạng thái</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 border-b border-gray-200">Phòng ban</th>
                  <th className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3 px-3 text-right w-56 border-b border-gray-200">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {users.map((u) => {
                  const isSelf = currentUser && String(currentUser.id) === String(u.id);
                  return (
                    <tr key={u.id} className={`transition ${u.is_locked ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="py-4 px-3 font-mono text-gray-400">#{u.id}</td>
                      <td className="py-4 px-3 font-medium text-gray-900 flex items-center gap-1.5">
                        <span>{u.full_name}</span>
                        {isSelf && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                            (Bạn)
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-gray-500">{u.email}</td>
                      <td className="py-4 px-3">
                        <span className={`inline-block font-medium text-xs px-2.5 py-0.5 rounded-full border ${getRoleBadgeStyle(u.role_name)}`}>
                          {u.role_name || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        {u.is_locked ? (
                          <span className="inline-flex items-center gap-1 font-medium text-xs text-rose-600">
                            <Lock size={12} className="currentColor" /> Đã khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-xs text-emerald-600">
                            <Check size={12} className="currentColor" /> Hoạt động
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-gray-500">
                        {u.department || <span className="text-gray-300 italic">Chưa cập nhật</span>}
                      </td>
                      <td className="py-4 px-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition cursor-pointer"
                            title="Sửa thông tin"
                          >
                            Sửa
                          </button>

                          {isSelf ? (
                            <button
                              type="button"
                              disabled
                              title="Không thể tự khóa tài khoản của chính bạn"
                              className="text-sm font-medium text-gray-300 cursor-not-allowed"
                            >
                              Khóa
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleLockUser(u)}
                              className={`text-sm font-medium transition cursor-pointer ${u.is_locked ? 'text-amber-600 hover:text-amber-800' : 'text-gray-600 hover:text-gray-900'}`}
                              title={u.is_locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            >
                              {u.is_locked ? 'Mở khóa' : 'Khóa'}
                            </button>
                          )}

                          {isSelf ? (
                            <button
                              type="button"
                              disabled
                              title="Không thể tự xóa tài khoản của chính bạn"
                              className="text-sm font-medium text-gray-300 cursor-not-allowed"
                            >
                              Xóa
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingUser(u)}
                              className="text-sm font-medium text-red-600 hover:text-red-800 transition cursor-pointer"
                              title="Xóa tài khoản"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
            <div className="text-sm text-gray-500">
              Hiển thị <span className="font-medium text-gray-900">{users.length}</span> / <span className="font-medium text-gray-900">{pagination.total}</span> tài khoản
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-sm font-medium bg-transparent hover:bg-gray-50 text-gray-700 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                ◄ Trước
              </button>
              <span className="text-sm font-medium px-2 text-gray-900">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm font-medium bg-transparent hover:bg-gray-50 text-gray-700 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Sau ►
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit User */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-200 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                {editingUser ? <><Edit size={18} className="text-blue-600" /> Cập nhật Tài khoản</> : <><UserPlus size={18} className="text-emerald-600" /> Tạo Tài khoản Mới</>}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition text-xs"
              >
                <X size={14} className="currentColor" />
              </button>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <X size={16} className="currentColor" /> {modalError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Họ và Tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full text-xs border border-gray-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full text-xs border border-gray-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Vai trò (Role) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role_name}
                  onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-semibold text-gray-800"
                >
                  <option value="Sinh viên">Sinh viên</option>
                  <option value="Giảng viên">Giảng viên</option>
                  <option value="Admin">Admin (Quản trị viên)</option>
                  <option value="Custom">Tùy chọn vai trò khác...</option>
                </select>
              </div>

              {formData.role_name === 'Custom' && (
                <div>
                  <label className="block text-xs font-bold text-purple-900 mb-1">
                    Nhập tên Vai trò tùy chỉnh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.custom_role}
                    onChange={(e) => setFormData({ ...formData, custom_role: e.target.value })}
                    placeholder="Ví dụ: Trưởng khoa, Khách mời..."
                    className="w-full text-xs border border-purple-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-purple-50/30"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Khoa / Phòng ban (Tùy chọn)</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Ví dụ: Khoa Công nghệ thông tin"
                  className="w-full text-xs border border-gray-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Mật khẩu mặc định
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="123123"
                    className="w-full text-xs font-mono border border-gray-300 rounded-xl px-3.5 py-2.5 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    Mật khẩu mặc định tạo mới: <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-700">123123</code>
                  </span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Đang lưu...' : editingUser ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeletingUser(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-gray-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center text-xl mx-auto">
              <Trash2 size={24} className="currentColor" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base">Xác nhận xóa tài khoản</h3>
              <p className="text-xs text-gray-500 mt-1">
                Bạn có chắc chắn muốn xóa tài khoản <b>"{deletingUser.full_name}"</b> ({deletingUser.email}) khỏi hệ thống?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { getUser, getUserRole, clearAuth, isAuthenticated } from '../utils/auth.utils';
import NotificationBell from './NotificationBell';
import { countMyPendingReviewsApi } from '../api/workflow.api';
import { Menu, FileText, Send, CheckSquare, Home, LogOut, User, ClipboardList, CheckCircle, Settings, HelpCircle, FileSignature } from 'lucide-react';

const IconMenu = () => <Menu className="w-5 h-5" />;
const IconSurvey = () => <FileText className="w-5 h-5" />;
const IconCampaign = () => <Send className="w-5 h-5" />;
const IconMySurvey = () => <FileSignature className="w-5 h-5" />;
const IconHome = () => <Home className="w-5 h-5" />;
const IconLogout = () => <LogOut className="w-5 h-5" />;
const IconUser = () => <User className="w-6 h-6" />;

const Layout = () => {
  const navigate = useNavigate();
  const user = getUser();
  const role = getUserRole();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (user?.id && role !== 'Sinh viên' && role !== 'Admin') {
      countMyPendingReviewsApi(user.id)
        .then(res => {
          if (res?.success && res?.data?.count !== undefined) {
            setPendingCount(parseInt(res.data.count, 10));
          }
        })
        .catch(err => console.error('Failed to load pending reviews count:', err));
    }
  }, [user?.id, location.pathname, role]); // Cập nhật khi chuyển trang

  const menuItems = [];

  if (role === 'Sinh viên') {
    menuItems.push(
      { path: '/my-surveys', label: 'Bài khảo sát của tôi', icon: <IconMySurvey /> }
    );
  } else if (role === 'Giảng viên') {
    menuItems.push(
      { path: '/my-surveys', label: 'Bài khảo sát của tôi', icon: <IconMySurvey /> },
      { path: '/my-pending-reviews', label: 'Phiếu chờ duyệt', icon: <ClipboardList className="w-5 h-5" />, badge: pendingCount },
      { path: '/my-reviewed', label: 'Phiếu đã duyệt', icon: <CheckCircle className="w-5 h-5" /> },
      { path: '/lecturer/dashboard', label: 'Kết quả Giảng dạy', icon: <IconCampaign /> }
    );
  } else if (role === 'Admin') {
    menuItems.push(
      { path: '/admin', label: 'Tổng quan', icon: <IconHome /> },
      { path: '/admin/surveys', label: 'Mẫu Form Khảo sát', icon: <IconSurvey /> },
      { path: '/admin/campaigns', label: 'Form khảo sát', icon: <IconCampaign /> },
      { path: '/admin/users', label: 'Quản lý Người dùng', icon: <IconUser /> },
      { path: '/admin/lecturer-evaluations', label: 'Đánh giá Giảng viên', icon: <IconCampaign /> },
      { path: '/admin/audit-logs', label: 'Nhật ký Hoạt động', icon: <ClipboardList className="w-5 h-5" /> }
    );
  } else {
    menuItems.push(
      { path: '/my-surveys', label: 'Bài khảo sát của tôi', icon: <IconMySurvey /> },
      { path: '/my-pending-reviews', label: 'Phiếu chờ duyệt', icon: <ClipboardList className="w-5 h-5" />, badge: pendingCount },
      { path: '/my-reviewed', label: 'Phiếu đã duyệt', icon: <CheckCircle className="w-5 h-5" /> }
    );
  }

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  if (!isAuthenticated() || role === 'PublicGuest') {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center py-6 px-2 sm:px-4 lg:px-8">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex text-slate-900">
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'
          } transition-all duration-300 bg-slate-50 border-r border-slate-50 flex flex-col h-screen sticky top-0 shrink-0`}
      >
        {/* Top Section (Logo + Main Navigation) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-50 rounded-br-2xl shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 text-slate-900 font-bold text-xl">
                EF
              </div>
              {sidebarOpen && (
                <div className="whitespace-nowrap">
                  <p className="font-bold text-slate-900 text-sm leading-tight tracking-tight">EvalFlow</p>
                  <p className="text-xs text-slate-500">Khảo sát & Đánh giá</p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/' || item.path === '/admin'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 mb-1 cursor-pointer text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:text-blue-600 active:scale-[0.97] active:bg-blue-100 ${isActive
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-medium'
                    : 'text-gray-600 border-l-4 border-transparent font-medium'
                  } ${!sidebarOpen ? 'justify-center' : ''}`
                }
                title={!sidebarOpen ? item.label : undefined}
              >
                <span className="flex-shrink-0 text-lg">{item.icon}</span>
                {sidebarOpen && <span className="whitespace-nowrap flex-1">{item.label}</span>}
                {item.badge > 0 && sidebarOpen && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto">
                    {item.badge}
                  </span>
                )}
                {item.badge > 0 && !sidebarOpen && (
                  <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Anchoring Section (Menu Đáy) */}
        <div className="mt-auto p-3 space-y-1 border-t border-slate-50 pb-4 shrink-0">
          {sidebarOpen && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4">
              HỆ THỐNG
            </p>
          )}

          {/* Menu Item 1: Cài đặt hệ thống */}
          <div
            className={`flex items-center gap-3 px-4 py-3 mb-1 cursor-pointer text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:text-blue-600 active:scale-[0.97] active:bg-blue-100 text-gray-600 border-l-4 border-transparent font-medium ${!sidebarOpen ? 'justify-center' : ''
              }`}
            title={!sidebarOpen ? 'Cài đặt hệ thống' : undefined}
          >
            <span className="flex-shrink-0"><Settings className="w-5 h-5" /></span>
            {sidebarOpen && <span className="whitespace-nowrap">Cài đặt hệ thống</span>}
          </div>

          {/* Menu Item 2: Trợ giúp & Hỗ trợ */}
          <div
            className={`flex items-center gap-3 px-4 py-3 mb-1 cursor-pointer text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:text-blue-600 active:scale-[0.97] active:bg-blue-100 text-gray-600 border-l-4 border-transparent font-medium ${!sidebarOpen ? 'justify-center' : ''
              }`}
            title={!sidebarOpen ? 'Trợ giúp & Hỗ trợ' : undefined}
          >
            <span className="flex-shrink-0"><HelpCircle className="w-5 h-5" /></span>
            {sidebarOpen && <span className="whitespace-nowrap">Trợ giúp & Hỗ trợ</span>}
          </div>

          {/* Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="w-full mt-2 p-2 rounded-md border border-slate-200/60 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer"
            title="Thu gọn / Mở rộng menu"
          >
            <IconMenu />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="h-16 bg-slate-50 border-b border-slate-50 px-6 flex items-center justify-between gap-4 sticky top-0 z-40">
          <div />

          <div className="flex items-center justify-end ml-auto gap-4">
            {/* Red Notification Bell Component */}
            <NotificationBell />

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              >
                <div className="w-8 h-8 bg-slate-100 text-slate-700 border border-slate-200 rounded-full flex items-center justify-center font-semibold text-xs overflow-hidden">
                  <IconUser />
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium text-slate-700 leading-none">
                    {user?.full_name || 'Người dùng'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {user?.role_name || role || 'Sinh viên'}
                  </p>
                </div>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-0"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-md py-1.5 z-10 animate-in fade-in slide-in-from-top-1 duration-100">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900 leading-none">
                        {user?.full_name || 'Người dùng'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5 break-all">
                        {user?.email || ''}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 font-medium">
                        Vai trò: {user?.role_name || role}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <IconLogout />
                      Đăng xuất
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 bg-white overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

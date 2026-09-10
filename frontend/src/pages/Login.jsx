import { useState } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { loginApi, googleLoginApi } from '../api/auth.api';
import { saveAuth, isAuthenticated, getUserRole } from '../utils/auth.utils';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const getRoleRedirectPath = (roleName) => {
    if (roleName === 'Admin') return '/admin';
    if (roleName === 'Giảng viên' || roleName === 'Lecturer') return '/lecturer/dashboard';
    return '/my-surveys';
  };

  if (isAuthenticated()) {
    const role = getUserRole();
    if (redirectParam) {
      return <Navigate to={decodeURIComponent(redirectParam)} replace />;
    }
    if (role === 'PublicGuest') {
      const savedSurveyUrl = sessionStorage.getItem('last_survey_url');
      if (savedSurveyUrl) {
        return <Navigate to={savedSurveyUrl} replace />;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md space-y-4">
            <div className="text-3xl">🌐</div>
            <h3 className="font-bold text-gray-800 text-lg">Khảo sát Công khai (Google Forms)</h3>
            <p className="text-xs text-gray-500">
              Bạn đã đăng nhập thành công. Vui lòng sử dụng đường link Khảo sát Công khai được cung cấp để thực hiện bài khảo sát.
            </p>
          </div>
        </div>
      );
    }
    try {
      sessionStorage.removeItem('last_survey_url');
    } catch (e) { }
    return <Navigate to={getRoleRedirectPath(role)} replace />;
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    setApiError('');
    if (!credentialResponse?.credential) {
      setApiError('Không nhận được Token xác thực từ Google');
      return;
    }

    setLoading(true);
    try {
      const result = await googleLoginApi({
        credential: credentialResponse.credential,
      });
      if (result.success && result.data) {
        saveAuth(result.data.token, result.data.user);
        const role = result.data.user.role_name;
        if (redirectParam) {
          navigate(decodeURIComponent(redirectParam), { replace: true });
        } else if (role === 'PublicGuest') {
          const savedSurveyUrl = sessionStorage.getItem('last_survey_url');
          if (savedSurveyUrl) {
            navigate(savedSurveyUrl, { replace: true });
          } else {
            setApiError('Đăng nhập thành công! Vui lòng mở lại đường link khảo sát công khai.');
          }
        } else {
          try {
            sessionStorage.removeItem('last_survey_url');
          } catch (e) { }
          navigate(getRoleRedirectPath(role), { replace: true });
        }
      } else {
        setApiError(result.message || 'Đăng nhập Google thất bại');
      }
    } catch (err) {
      setApiError(err.response?.data?.message || err.message || 'Lỗi khi xác thực tài khoản Google');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = 'Vui lòng nhập email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Email không hợp lệ';
    if (!password) newErrors.password = 'Vui lòng nhập mật khẩu';
    else if (password.length < 6) newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await loginApi(email, password);
      if (result.success && result.data) {
        saveAuth(result.data.token, result.data.user);
        const role = result.data.user.role_name;
        if (redirectParam) {
          navigate(decodeURIComponent(redirectParam), { replace: true });
        } else if (role === 'PublicGuest') {
          const savedSurveyUrl = sessionStorage.getItem('last_survey_url');
          if (savedSurveyUrl) {
            navigate(savedSurveyUrl, { replace: true });
          } else {
            setApiError('Đăng nhập thành công! Vui lòng mở lại đường link khảo sát công khai.');
          }
        } else {
          try {
            sessionStorage.removeItem('last_survey_url');
          } catch (e) { }
          navigate(getRoleRedirectPath(role), { replace: true });
        }
      } else {
        setApiError(result.message || 'Đăng nhập không thành công');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Không thể kết nối đến máy chủ';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3 shadow-xs">
            <span className="text-white font-bold text-base">EF</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">EvalFlow</h1>
          <p className="text-sm text-slate-500 mt-1">Hệ thống Quản lý Khảo sát & Đánh giá</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="nhap@email.com"
              className={`w-full px-3.5 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                } disabled:bg-slate-100 text-slate-900 placeholder:text-slate-400`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="••••••••"
                className={`w-full px-3.5 py-2 pr-12 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors ${errors.password ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
                  } disabled:bg-slate-100 text-slate-900 placeholder:text-slate-400`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          {apiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-600 font-medium">
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm rounded-md transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 space-y-3 flex flex-col items-center">
          <div className="text-center text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
            Hoặc đăng nhập bằng Google (Khảo sát Công khai)
          </div>
          <div className="flex justify-center w-full">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setApiError('Đăng nhập bằng Google không thành công. Hãy kiểm tra Client ID trong file .env.')}
              shape="pill"
              size="large"
              width="100%"
              locale="vi"
            />
          </div>
          {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center w-full mt-2 font-medium">
              💡 Chưa cấu hình Client ID. Vui lòng dán Google Client ID vào file <code>frontend/.env</code> để kích hoạt Popup xác thực Google.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

# Cấu trúc dự án
- Đây là dự án Full-stack với Backend (Node.js) và Frontend (ReactJS + Vite + Tailwind CSS).

# Quy định cho Frontend (chỉ áp dụng khi làm việc trong thư mục `/frontend`)

## 1. Đồng nhất Icon (Lucide React)
- CHỈ sử dụng thư viện `lucide-react` cho các tính năng và giao diện mới.
- Tuyệt đối KHÔNG sử dụng thêm FontAwesome, Material Icons hay import file SVG thủ công trừ khi có yêu cầu đặc biệt.
- **Kích thước chuẩn:** 
  - Nhỏ: `size={16}`
  - Vừa (Mặc định): `size={20}`
  - Lớn: `size={24}`
- Ưu tiên sử dụng component bọc (Wrapper Component) nếu có sẵn thay vì gọi trực tiếp từ `lucide-react`.

## 2. Styling (Tailwind CSS)
- Dự án sử dụng Tailwind CSS. Hãy ưu tiên sử dụng các utility classes của Tailwind để căn chỉnh kích thước, khoảng cách và màu sắc.
- Hạn chế tối đa việc viết inline-style (`style={{...}}`) hoặc tạo thêm file CSS mới.

## 3. Chiến lược an toàn & Bảo toàn Code cũ (QUAN TRỌNG)
- **KHÔNG** tự động format, refactor hay thay đổi cấu trúc, icon của các file hiện có nếu người dùng không yêu cầu rõ ràng.
- Các trang và component cũ vẫn có thể đang dùng thư viện icon khác hoặc style khác, hãy để nguyên chúng.
- Chỉ áp dụng các quy định UI/Icon mới này cho các **file được tạo mới** hoặc khi người dùng yêu cầu **"cập nhật lại icon cho component này"**.
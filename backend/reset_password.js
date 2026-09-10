const bcrypt = require('bcrypt');

const TARGET_PASSWORD = process.argv[2] || '123123';
const COST = 10;

const USERS_NEED_RESET = [
  { email: 'admin@truong.edu.vn',    name: 'Quản trị viên Hệ thống' },
  { email: 'nguyenvana@truong.edu.vn', name: 'Nguyễn Văn A' },
  { email: 'tranthib@truong.edu.vn',   name: 'Trần Thị B' },
  { email: 'lehoangc@sv.truong.edu.vn', name: 'Lê Hoàng C' },
  { email: 'phamd@sv.truong.edu.vn',   name: 'Phạm D' },
];

(async () => {
  console.log('===========================================================');
  console.log('TOOL RESET BCRYPT PASSWORD — HASH & SQL GENERATOR');
  console.log(`Mật khẩu sẽ set cho tất cả user: ${TARGET_PASSWORD}`);
  console.log('===========================================================\n');

  const hash = await bcrypt.hash(TARGET_PASSWORD, COST);
  const verifyOk = await bcrypt.compare(TARGET_PASSWORD, hash);

  console.log('✅ BCRYPT_HASH (copy giá trị này vào cột password_hash):');
  console.log(hash);
  console.log(`\n✅ Verify: bcrypt.compare("${TARGET_PASSWORD}", hash) === ${verifyOk ? 'PASSED' : 'FAILED'}\n`);

  console.log('===========================================================');
  console.log('📋 CÂU LỆNH SQL — DÁN VÀO DBeaver SQL Editor rồi F5 chạy:');
  console.log('===========================================================\n');

  console.log(`-- Cách 1: Reset tất cả user trong danh sách thành "${TARGET_PASSWORD}"`);
  USERS_NEED_RESET.forEach((u) => {
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = '${u.email}'; -- ${u.name}`);
  });

  console.log('\n-- Cách 2 (gọn): Dùng IN() để cập nhật 1 lượt');
  const listEmails = USERS_NEED_RESET.map((u) => `'${u.email}'`).join(', ');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email IN (${listEmails});`);

  console.log('\n-- Cách 3: Chỉ đổi riêng admin (email admin@truong.edu.vn):');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@truong.edu.vn';`);

  console.log('\n===========================================================');
  console.log('✅ SAU KHI CHẠY SQL XONG — TEST ĐĂNG NHẬP:');
  console.log('   Email (Admin): admin@truong.edu.vn');
  console.log(`   Mật khẩu     : ${TARGET_PASSWORD}`);
  console.log('===========================================================');
})();

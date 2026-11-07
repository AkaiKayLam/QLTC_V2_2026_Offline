# Tài chính cá nhân offline – bản nâng cấp thử nghiệm

## Tính năng
- PIN số mới từ 4 chữ số trở lên; nút hiện/ẩn và xóa nhanh.
- Dữ liệu mã hóa AES-GCM, khóa dẫn xuất PBKDF2, lưu cục bộ IndexedDB.
- Nhập số tiền có dấu phân cách hàng nghìn.
- Thêm/sửa/xóa giao dịch.
- Thêm/sửa/xóa tài khoản; tìm kiếm tài khoản.
- Danh mục thu/chi mặc định; thêm và xóa danh mục.
- Hạn mức theo tháng và danh mục, cảnh báo khi đạt 80% hoặc vượt 100%.
- Sao lưu/khôi phục file .pfbackup đã mã hóa; service worker cache để chạy offline.

## Cài thử
Cần chạy trên HTTPS (GitHub Pages phù hợp) hoặc localhost. Không mở trực tiếp index.html bằng trình quản lý file.
1. Tải toàn bộ nội dung thư mục này lên repository GitHub.
2. Settings → Pages → Deploy from branch → main → /(root).
3. Mở URL HTTPS bằng Chrome Android, chọn Install app / Add to Home screen.
4. Mở app khi có mạng lần đầu; sau đó bật chế độ máy bay để thử.

## Lưu ý rất quan trọng
- Đây là bản MVP thử nghiệm, chưa được kiểm thử bảo mật độc lập hay trên mọi dòng OPPO/realme.
- PIN 4 số là mức tối thiểu theo yêu cầu, nhưng nên dùng 6–8 số hoặc dài hơn.
- Nếu đã có kho dữ liệu cũ, bản nâng cấp giữ nguyên cơ chế mở khóa cũ; PIN/mật khẩu cũ vẫn dùng để mở kho hiện tại. Quy định PIN số áp dụng khi tạo kho mới.
- Xóa tài khoản đang có giao dịch hoặc danh mục đã được dùng trong giao dịch sẽ bị chặn để tránh mất liên kết dữ liệu.
- Hạn mức hiện tính theo tháng dương lịch hiện tại.
- Không nhập dữ liệu tài chính thật trước khi kiểm thử kỹ và tạo bản sao lưu.
- Trước khi cập nhật mã nguồn, sao lưu file .pfbackup. Không xóa dữ liệu trang web/Chrome khi chưa có bản sao lưu.
- Không có máy chủ, tài khoản trực tuyến hay đồng bộ đám mây.

# Tài chính cá nhân offline – bản nâng cấp

## Tính năng mới / bổ sung
- **Phân trang lịch sử giao dịch**: Chỉ hiện 50 giao dịch gần nhất. Nút **Hiển thị thêm** để load thêm 50 mỗi lần, cho đến hết.
- **Xuất dữ liệu thường (không mã hóa)**:
  - Xuất file CSV (mở được bằng Excel / Google Sheets).
  - Nút **Sao chép bảng giao dịch** để dán trực tiếp vào Excel (Ctrl+V).
- **Chuyển khoản giữa các ví/tài khoản**: Nút ⇄ Chuyển trên tab Giao dịch. Tạo giao dịch loại TRANSFER, số dư hai bên cập nhật đúng.
- **Quản lý vay nợ / cho vay**:
  - Tab mới **Vay nợ**.
  - Thêm khoản Cho vay (người khác nợ mình) hoặc Vay nợ (mình nợ người khác).
  - Tự động tạo giao dịch tiền mặt tương ứng.
  - Ghi nhận Thu nợ / Trả nợ, theo dõi số còn lại, trạng thái tất toán.
  - Tổng đang cho vay / đang nợ hiển thị rõ.

## Tính năng gốc (giữ nguyên)
- PIN số từ 4 chữ số trở lên; nút hiện/ẩn và xóa nhanh.
- Dữ liệu mã hóa AES-GCM, khóa dẫn xuất PBKDF2, lưu cục bộ IndexedDB.
- Nhập số tiền có dấu phân cách hàng nghìn.
- Thêm/sửa/xóa giao dịch, tài khoản, danh mục.
- Hạn mức theo tháng và danh mục, cảnh báo 80%/100%.
- Sao lưu/khôi phục file .pfbackup đã mã hóa; service worker cache để chạy offline.

## Cài thử
Cần chạy trên HTTPS (GitHub Pages phù hợp) hoặc localhost. Không mở trực tiếp index.html bằng trình quản lý file.
1. Tải toàn bộ nội dung thư mục này lên repository GitHub.
2. Settings → Pages → Deploy from branch → main → /(root).
3. Mở URL HTTPS bằng Chrome Android, chọn Install app / Add to Home screen.
4. Mở app khi có mạng lần đầu; sau đó bật chế độ máy bay để thử.

## Lưu ý rất quan trọng
- Đây là bản MVP thử nghiệm, chưa được kiểm thử bảo mật độc lập.
- PIN 4 số là mức tối thiểu, nên dùng 6–8 số hoặc dài hơn.
- Nếu đã có kho dữ liệu cũ, bản nâng cấp vẫn mở được bằng PIN cũ (schema tự nâng lên version 3, thêm mảng debts rỗng).
- Xóa tài khoản đang có giao dịch hoặc danh mục đã dùng sẽ bị chặn.
- Hạn mức tính theo tháng dương lịch hiện tại.
- **Xuất CSV / sao chép bảng là dữ liệu thô không mã hóa** – chỉ dùng khi bạn chủ động muốn.
- Không nhập dữ liệu tài chính thật trước khi kiểm thử kỹ và tạo bản sao lưu.
- Trước khi cập nhật mã nguồn, sao lưu file .pfbackup. Không xóa dữ liệu trang web/Chrome khi chưa có bản sao lưu.
- Không có máy chủ, tài khoản trực tuyến hay đồng bộ đám mây.

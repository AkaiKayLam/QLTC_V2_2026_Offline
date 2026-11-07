# Tài chính cá nhân Offline – bản khởi đầu

Đây là bộ khung thử nghiệm đầu tiên. Ứng dụng có:
- Tạo kho dữ liệu cục bộ bằng mật khẩu chính.
- Mã hóa dữ liệu trong IndexedDB bằng AES-GCM và khóa dẫn xuất PBKDF2.
- Ghi nhận giao dịch thu/chi cơ bản.
- Tạo tài khoản tiền mặt/ngân hàng/ví.
- Sao lưu file `.pfbackup` đã mã hóa.
- Khôi phục file sau khi kiểm tra giải mã và xác nhận thay thế.
- Service Worker cache các tệp ứng dụng để chạy offline sau lần tải đầu.

## Cách chạy thử đơn giản

PWA và Service Worker cần HTTPS hoặc localhost. Không mở trực tiếp `index.html` bằng cách nhấp đúp nếu muốn kiểm tra chế độ offline.

### Cách thử trên máy tính có Python
1. Giải nén thư mục.
2. Mở Terminal/Command Prompt tại thư mục đó.
3. Chạy: `python -m http.server 8000`
4. Mở `http://localhost:8000` bằng Chrome hoặc Edge.
5. Tạo mật khẩu chính, thử thêm giao dịch, sau đó tải file backup.
6. Tải lại trang để kiểm tra khóa/mở khóa.
7. Khi trang đã tải đủ, ngắt Internet (nếu đang dùng localhost thì vẫn truy cập localhost được) và thử lại.

### Cài PWA trên thiết bị
Đưa các tệp lên một static host HTTPS (ví dụ GitHub Pages hoặc Cloudflare Pages) một lần, mở URL trên thiết bị và chọn cài/thêm vào màn hình chính. Sau khi Service Worker cache thành công, có thể mở ứng dụng offline. Lần cài đầu cần Internet.

## Cảnh báo bản thử nghiệm
- Đây là MVP kỹ thuật, chưa phải sản phẩm hoàn thiện để lưu toàn bộ tài sản thật.
- Chưa có chuyển khoản, tài sản, khoản vay, đầu tư, báo cáo nâng cao, chỉnh sửa/xóa giao dịch, nhập Excel hay kiểm thử đa thiết bị.
- Bản này chưa triển khai khóa bằng vân tay/Face ID. Trình duyệt không cung cấp một API sinh trắc học phổ quát; cần thiết kế riêng theo nền tảng hoặc dùng WebAuthn/passkey nếu phù hợp.
- Không có chức năng đặt lại mật khẩu chính. Nếu quên mật khẩu, dữ liệu mã hóa không thể giải mã.
- File backup có cùng mật khẩu chính hiện tại; giữ mật khẩu ở nơi an toàn.
- Trình duyệt/OS có thể xóa dữ liệu cục bộ. Sao lưu định kỳ ra USB/ổ cứng.
- Cần kiểm thử restore và tương thích trên Android, iOS, Windows, macOS trước khi dùng dữ liệu quan trọng.
- Không đưa file backup lên dịch vụ công cộng hoặc gửi cho người khác.

## Cấu trúc
- `index.html`: giao diện
- `styles.css`: giao diện responsive
- `app.js`: IndexedDB, mã hóa, giao dịch, backup/restore
- `sw.js`: cache offline
- `manifest.webmanifest`: cấu hình PWA

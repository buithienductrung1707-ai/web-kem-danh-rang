# Website bán kem đánh răng

Website bán hàng bằng tiếng Việt, gồm cửa hàng cho khách và trang quản trị. Frontend dùng HTML, CSS và JavaScript. Backend dùng Node.js, Express và SQLite, đồng thời phục vụ các trang web từ cùng một địa chỉ.

## Bản demo trực tuyến

- [Mở cửa hàng](https://web-kem-danh-rang.buithienductrung1707.workers.dev)
- [Mở trang quản trị](https://web-kem-danh-rang.buithienductrung1707.workers.dev/admin.html)

Bản demo chạy trên Cloudflare Workers và SQLite-backed Durable Object thuộc gói miễn phí, sử dụng tên miền phụ `workers.dev`. Website tiếp tục hoạt động khi tắt máy tính cá nhân. Đăng nhập admin bằng tài khoản có trong database tại lần triển khai đầu tiên.

Đơn hàng, tài khoản, tồn kho, quảng cáo, phiên đăng nhập và ảnh tải lên được lưu trên Cloudflare. Dữ liệu trực tuyến và [database trên máy](backend/shop.sqlite) được quản lý riêng. Lần triển khai đầu tiên nhập dữ liệu từ database của repo. Những lần cập nhật mã nguồn tiếp theo tiếp tục sử dụng dữ liệu trực tuyến đang có.

Email đặt lại mật khẩu và thông báo đơn hàng cần cấu hình SMTP. Bản demo hiện để trống cấu hình email. Chuyển khoản ngân hàng hiện theo thông tin cấu hình của cửa hàng.

## Chuẩn bị

- Cài [Git](https://git-scm.com/downloads) và [Node.js](https://nodejs.org/en/download). Môi trường đã kiểm tra là **Node.js 26.13.1**.
- Đăng nhập GitHub bằng tài khoản có quyền truy cập repo riêng tư này.
- Mở PowerShell hoặc Terminal trong VS Code. Các lệnh dưới đây dành cho Windows PowerShell và dùng `npm.cmd` đi kèm Node.js.

## Tải và chạy website

Mở Terminal tại nơi bạn muốn lưu dự án, rồi chạy lần lượt từng dòng.

```powershell
git clone https://github.com/buithienductrung1707-ai/web-kem-danh-rang.git
cd web-kem-danh-rang
cd backend
node --version
npm.cmd ci
npm.cmd start
```

`npm.cmd ci` cài các thư viện theo phiên bản trong [package-lock.json](backend/package-lock.json). Khi máy chủ sẵn sàng, Terminal hiển thị `Cửa hàng đang chạy tại http://127.0.0.1:3000`.

Mở các địa chỉ sau trong trình duyệt.

| Trang | Địa chỉ |
| --- | --- |
| Trang chủ | <http://127.0.0.1:3000/> |
| Kem đánh răng | <http://127.0.0.1:3000/kem-danh-rang.html> |
| Giỏ hàng và đặt hàng | <http://127.0.0.1:3000/gio-hang.html> |
| Đăng ký | <http://127.0.0.1:3000/dang-ky.html> |
| Đăng nhập, thông tin tài khoản | <http://127.0.0.1:3000/dang-nhap.html> |
| Đơn hàng của tôi | <http://127.0.0.1:3000/don-hang.html> |
| Tra cứu đơn hàng | <http://127.0.0.1:3000/tra-cuu.html> |
| Quản trị cửa hàng | <http://127.0.0.1:3000/admin.html> |

Giữ Terminal chạy trong lúc sử dụng website. Bấm **Ctrl + C** trong Terminal để dừng máy chủ. Ở lần mở tiếp theo, vào thư mục [backend/](backend/) rồi chạy `npm.cmd start`.

Các lệnh tạo admin, cấu hình và sao lưu bên dưới cũng chạy trong thư mục [backend/](backend/). Dùng `Get-Location` để kiểm tra vị trí hiện tại.

## Tài khoản quản trị

Repo đi kèm [shop.sqlite](backend/shop.sqlite), chứa dữ liệu của bản cài đặt hiện tại, gồm sản phẩm, banner, tài khoản và đơn hàng. Đăng nhập tài khoản quản trị có sẵn bằng mật khẩu đã đặt cho bản dữ liệu đó.

Để tạo tài khoản quản trị khi database chưa có tài khoản `admin`, dừng máy chủ bằng **Ctrl + C** rồi chạy nhóm lệnh sau. PowerShell sẽ hỏi mật khẩu và che nội dung bạn nhập.

```powershell
$shopAdminSecret = Read-Host 'Nhập mật khẩu admin' -AsSecureString
$env:SHOP_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $shopAdminSecret).Password
npm.cmd run tao-admin
Remove-Item Env:SHOP_ADMIN_PASSWORD
```

Tên đăng nhập được tạo là **admin**. Script chấp nhận mật khẩu dài từ 1 đến 128 ký tự. Khi tạo thành công, chương trình báo `Đã tạo tài khoản quản trị admin.`.

Nếu nhận thông báo `Tài khoản admin đã được tạo trước đó.`, chương trình đã tìm thấy tài khoản hiện hữu và kết thúc. Hãy đăng nhập bằng mật khẩu tương ứng với tài khoản trong database đó.

Chạy lại máy chủ rồi mở trang quản trị.

```powershell
npm.cmd start
```

## Mua hàng và xem đơn

1. Mở danh mục **Kem đánh răng**, tìm sản phẩm hoặc dùng bộ lọc và sắp xếp.
2. Bấm **Xem nhanh** để xem ảnh, mô tả, giá và số lượng có thể thêm. Chọn **Thêm vào giỏ** hoặc **Mua nhanh**.
3. Mở **Giỏ hàng**, điều chỉnh số lượng và kiểm tra tổng tiền.
4. Điền thông tin nhận hàng, chọn cách thanh toán và bấm **Xem lại đơn hàng**.
5. Kiểm tra nội dung rồi bấm **Xác nhận đặt hàng**. Lưu mã đơn sau khi đặt thành công.

Khách có thể đăng ký bằng email, mật khẩu, họ tên, số điện thoại và địa chỉ. Mật khẩu khách hàng dài từ 8 đến 128 ký tự. Khi đã đăng nhập, giỏ hàng sử dụng thông tin nhận hàng đã lưu trong tài khoản.

Khách mua bằng thông tin nhận hàng nhập tại giỏ có thể điền thêm email để nhận thông báo. Tồn kho trên máy chủ được trừ khi đơn hàng được tạo thành công.

### Theo dõi đơn hàng

- Mở **Tra cứu đơn hàng**, nhập mã đơn và số điện thoại nhận hàng để xem trạng thái.
- Mở **Đơn hàng của tôi** sau khi đăng nhập để xem lịch sử, lọc trạng thái và chuyển trang.
- Dùng **Thêm đơn hàng đã có mã** cùng mã đơn và số điện thoại để liên kết đơn phù hợp với tài khoản.

Các trạng thái đơn hàng được hiển thị theo luồng xử lý.

| Mã trạng thái | Ý nghĩa |
| --- | --- |
| `NEW` | Đã nhận đơn hàng |
| `CONFIRMED` | Đã xác nhận |
| `SHIPPING` | Đang giao hàng |
| `COMPLETED` | Đã hoàn thành |
| `CANCELLED` | Đã hủy |

## Sử dụng trang quản trị

Đăng nhập tại <http://127.0.0.1:3000/admin.html> bằng tài khoản quản trị.

### Sản phẩm

- Chọn **Thêm sản phẩm** hoặc chọn một sản phẩm hiện có để chỉnh tên, giá, mô tả, ảnh, tồn kho và trạng thái hiển thị.
- Khi dùng ảnh từ máy tính, chọn ảnh rồi bấm **Tải ảnh lên**. Tiếp tục bấm **Lưu sản phẩm** để áp dụng.
- Định dạng ảnh hỗ trợ gồm JPEG, PNG và WebP, dung lượng tối đa **5 MiB**.

### Quảng cáo đầu trang

Chọn một trong ba quảng cáo có sẵn, sửa tiêu đề, mô tả, ảnh, nút liên kết, thứ tự và trạng thái hiển thị, rồi bấm **Lưu quảng cáo**. Ảnh tải từ máy tính cũng cần được lưu vào quảng cáo sau khi tải lên.

Hai banner ở mép trái, phải màn hình lấy nội dung từ [header.js](backend/public/header.js) và ảnh trong [assets/](backend/public/assets/). Chúng hiển thị từ chiều rộng màn hình **1280px**.

### Đơn hàng

- Xem thống kê, tìm kiếm, lọc danh sách và xuất CSV.
- Cập nhật theo trình tự `NEW → CONFIRMED → SHIPPING → COMPLETED`.
- Có thể hủy đơn từ trạng thái `NEW` hoặc `CONFIRMED`.
- Dùng thao tác xóa đơn hàng và xác nhận trên hộp thoại khi cần xóa.

Để xem 20 đơn gần nhất trong Terminal, dùng lệnh sau.

```powershell
npm.cmd run xem-don
```

## Cấu hình chuyển khoản và email

Dừng máy chủ bằng **Ctrl + C** trước khi chạy lại với cấu hình mới.

Ở lần cấu hình đầu tiên, tạo tệp `smtp.env` từ [mẫu cấu hình](backend/config/smtp.env.example), rồi mở để điền thông tin.

```powershell
Copy-Item -LiteralPath config/smtp.env.example -Destination smtp.env
notepad smtp.env
```

Tệp `smtp.env` được đặt trong thư mục [backend/](backend/). Điền thông tin SMTP do nhà cung cấp email của bạn cấp.

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ten-dang-nhap-smtp
SMTP_PASS=mat-khau-smtp
SMTP_FROM=Cua hang kem danh rang <no-reply@example.com>
SHOP_PUBLIC_URL=http://127.0.0.1:3000
```

`SHOP_PUBLIC_URL` là địa chỉ gốc dùng để tạo liên kết trong email, ví dụ `http://127.0.0.1:3000` khi chạy trên máy hoặc địa chỉ HTTPS của website khi triển khai. Nhà cung cấp dùng cổng 465 thường yêu cầu `SMTP_SECURE=true`, còn cổng 587 thường dùng `SMTP_SECURE=false`.

Để cấu hình chuyển khoản, thêm ba dòng sau vào cùng tệp và thay bằng thông tin ngân hàng thực tế của cửa hàng.

```dotenv
SHOP_BANK_NAME=Ten ngan hang
SHOP_BANK_ACCOUNT_NUMBER=So tai khoan
SHOP_BANK_ACCOUNT_HOLDER=Ten chu tai khoan
```

Chạy website với tệp cấu hình đã tạo.

```powershell
node --env-file=smtp.env server.cjs
```

Khách chọn **Chuyển khoản ngân hàng** tại giỏ hàng và làm theo thông tin hiển thị cùng đơn. Việc kiểm tra tiền chuyển khoản và đối soát do cửa hàng thực hiện thủ công.

SMTP phục vụ email đặt lại mật khẩu và thông báo đơn hàng. Liên kết đặt lại mật khẩu có thời hạn **30 phút**. Thông báo đơn được lưu trong hàng đợi của database để máy chủ xử lý gửi. Hãy kiểm tra thư nhận bằng địa chỉ email của bạn sau khi cấu hình nhà cung cấp SMTP.

## Dữ liệu và sao lưu

| Thành phần | Vị trí |
| --- | --- |
| Database SQLite | [backend/shop.sqlite](backend/shop.sqlite) |
| Ảnh sản phẩm và ảnh quảng cáo tải lên | [backend/public/uploads/products/](backend/public/uploads/products/) |
| Ảnh giao diện có sẵn | [backend/public/assets/](backend/public/assets/) |
| Cấu hình cục bộ do bạn tạo | `backend/smtp.env` |

Database được mở và khởi tạo schema khi máy chủ chạy. Khi sử dụng một database mới, chương trình tạo sản phẩm mẫu và ba quảng cáo đầu trang. Bản database đang nằm trong repo lưu dữ liệu của cửa hàng tại thời điểm commit.

Để sao lưu, dừng máy chủ bằng **Ctrl + C**, rồi chạy từ thư mục [backend/](backend/). Các lệnh tạo một thư mục có thời gian ở cùng cấp với thư mục dự án.

```powershell
$shopBackupFolder = Join-Path ..\.. ('backup-kem-danh-rang-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $shopBackupFolder
Copy-Item -LiteralPath shop.sqlite -Destination $shopBackupFolder
Copy-Item -LiteralPath public/uploads -Destination $shopBackupFolder -Recurse
if (Test-Path -LiteralPath smtp.env) {
    Copy-Item -LiteralPath smtp.env -Destination $shopBackupFolder
}
```

Khi khôi phục, dừng máy chủ và chép database, thư mục ảnh cùng cấu hình về đúng vị trí trong bảng trên, rồi khởi động lại. Quản lý bản sao lưu và quyền truy cập repo phù hợp với dữ liệu tài khoản, thông tin nhận hàng đang lưu trong database.

## Cấu trúc mã nguồn

| Đường dẫn | Nội dung |
| --- | --- |
| [backend/public/](backend/public/) | Các trang HTML, CSS, JavaScript và ảnh giao diện |
| [backend/src/server.cjs](backend/src/server.cjs) | Chạy máy chủ Node.js trên máy cá nhân |
| [backend/src/app.cjs](backend/src/app.cjs) | Ứng dụng Express, API công khai và phục vụ frontend |
| [backend/src/routes/admin.cjs](backend/src/routes/admin.cjs) | Đăng nhập và API quản trị |
| [backend/src/routes/account.cjs](backend/src/routes/account.cjs) | Tài khoản, hồ sơ, đơn của khách và khôi phục mật khẩu |
| [backend/src/db/database.cjs](backend/src/db/database.cjs) | Schema, nâng cấp cấu trúc và dữ liệu mẫu |
| [backend/src/services/](backend/src/services/) | Xử lý đơn, ảnh, quảng cáo và email |
| [backend/src/utils/](backend/src/utils/) | Lọc đơn và xuất CSV |
| [backend/scripts/](backend/scripts/) | Tạo admin và xem đơn bằng Terminal |
| [backend/config/](backend/config/) | Đường dẫn dữ liệu và mẫu cấu hình |
| [backend/cloudflare/](backend/cloudflare/) | Entry point Workers, SQLite, phiên đăng nhập và ảnh trực tuyến |
| [backend/wrangler.jsonc](backend/wrangler.jsonc) | Cấu hình triển khai Cloudflare |
| [backend/server.cjs](backend/server.cjs) | Điểm chạy cho `npm.cmd start` |

### Chỉnh sửa giao diện

| Mục cần sửa | Tệp |
| --- | --- |
| Màu sắc, header, menu và banner hai bên | [style.css](backend/public/style.css) |
| Thẻ tiện ích, xem nhanh và giỏ hàng nổi | [storefront-widgets.css](backend/public/storefront-widgets.css) |
| Tìm kiếm, menu và nội dung banner hai bên | [header.js](backend/public/header.js) |
| Ảnh logo dùng chung | [shop-logo.png](backend/public/assets/shop-logo.png) |
| Danh mục sản phẩm, giỏ hàng và đặt hàng | [app.js](backend/public/app.js) |
| Trình chiếu quảng cáo trang chủ | [carousel.js](backend/public/carousel.js) |
| Giao diện quản trị | [admin.html](backend/public/admin.html), [admin.js](backend/public/admin.js) |

Sau khi sửa giao diện, bấm **Ctrl + F5** trong trình duyệt để tải lại. Sau khi sửa mã backend hoặc biến môi trường, dừng và chạy lại máy chủ.

## Kiểm tra nhanh và xử lý lỗi

Mở hai API sau để kiểm tra máy chủ trả dữ liệu.

- [Danh sách sản phẩm](http://127.0.0.1:3000/api/products)
- [Quảng cáo đầu trang](http://127.0.0.1:3000/api/banners)

| Hiện tượng | Cách xử lý |
| --- | --- |
| `npm.ps1 cannot be loaded` | Dùng các lệnh `npm.cmd ci` và `npm.cmd start` như hướng dẫn. |
| Lỗi liên quan `node:sqlite` hoặc `Database is not a constructor` | Kiểm tra `node --version` và dùng phiên bản Node.js 26.13.1 đã được kiểm tra với dự án. |
| `Cannot find module` | Vào thư mục [backend/](backend/) và chạy `npm.cmd ci`. |
| `EADDRINUSE` ở cổng 3000 | Tìm Terminal đang chạy website, bấm Ctrl + C để dừng lần chạy đó, rồi khởi động lại. |
| Giao diện vẫn hiển thị bản cũ | Bấm Ctrl + F5 trong trình duyệt. |
| Thông báo email chưa sẵn sàng | Điền cấu hình SMTP và chạy bằng `node --env-file=smtp.env server.cjs`. |
| Trang local yêu cầu đăng nhập lại sau khi khởi động máy chủ | Đăng nhập lại. Phiên local được lưu trong bộ nhớ tiến trình và có thời hạn tối đa 8 giờ. Phiên trên Cloudflare được lưu cùng dữ liệu trực tuyến. |

Trong [package.json](backend/package.json), lệnh `npm.cmd test` hiện được cấu hình trả thông báo `Error: no test specified`. Có thể dùng kiểm tra API và thao tác thử trên giao diện theo các mục trên để kiểm tra bản cài đặt.

## Cập nhật bản demo Cloudflare

Chạy các lệnh sau từ thư mục [backend/](backend/). Lệnh đăng nhập mở trình duyệt để bạn cấp quyền cho Wrangler sử dụng tài khoản Cloudflare của mình.

```powershell
npm.cmd ci
npx.cmd wrangler login
npm.cmd run deploy
```

Đích triển khai được khai báo trong [wrangler.jsonc](backend/wrangler.jsonc). Build tự tạo snapshot từ [shop.sqlite](backend/shop.sqlite) trong thư mục tạm `.cloudflare`, sau đó tải mã backend và ảnh giao diện lên Cloudflare. Snapshot dùng để khởi tạo database trực tuyến ở lần đầu.

Để thử môi trường Workers trên máy trước khi triển khai, dùng lệnh sau rồi mở địa chỉ Wrangler hiển thị.

```powershell
npm.cmd run dev:cloudflare
```

Phần sao lưu SQLite và ảnh ở trên áp dụng cho bản chạy local. Với dữ liệu trực tuyến, dùng mục Durable Objects trong Cloudflare để quản lý database và khả năng khôi phục được cung cấp cho gói hiện tại.

Giữ nguyên tên Worker, binding `SHOP_BACKEND`, tên class `ShopBackend` và tên instance `storefront` khi cập nhật để tiếp tục truy cập đúng database. Gói miễn phí có hạn mức sử dụng, phù hợp cho bản demo ít người truy cập. Xem [hạn mức Workers](https://developers.cloudflare.com/workers/platform/limits/) và [hạn mức Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Khi dùng `npm.cmd start`, website vẫn chạy trên máy cá nhân tại **127.0.0.1, cổng 3000** qua [src/server.cjs](backend/src/server.cjs).

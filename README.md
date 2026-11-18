# Website bán kem đánh răng

Website bán hàng bằng tiếng Việt, gồm cửa hàng cho khách và trang quản trị. Frontend dùng HTML, CSS và JavaScript. Backend dùng Node.js, Express và SQLite, đồng thời phục vụ các trang web từ cùng một địa chỉ.

## Bản demo trực tuyến

| Trang | Đường dẫn |
| --- | --- |
| Trang chủ | [Mở trang chủ](https://web-kem-danh-rang.buithienductrung1707.workers.dev/) |
| Kem đánh răng | [Xem sản phẩm](https://web-kem-danh-rang.buithienductrung1707.workers.dev/kem-danh-rang.html) |
| Bàn chải đánh răng | [Xem danh mục bàn chải](https://web-kem-danh-rang.buithienductrung1707.workers.dev/san-pham.html?danh-muc=ban-chai-danh-rang) |
| Tất cả sản phẩm | [Khám phá sản phẩm](https://web-kem-danh-rang.buithienductrung1707.workers.dev/san-pham.html) |
| Giỏ hàng | [Mở giỏ hàng](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-nhap.html?view=cart) |
| Xác nhận mua hàng | [Kiểm tra đơn hàng](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-nhap.html?view=checkout) |
| Đăng ký | [Tạo tài khoản](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-ky.html) |
| Đăng nhập, thông tin tài khoản | [Mở tài khoản](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-nhap.html) |
| Đơn hàng của tôi | [Xem đơn đã đặt](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-nhap.html?view=orders) |
| Tra cứu đơn hàng | [Tra cứu trạng thái đơn](https://web-kem-danh-rang.buithienductrung1707.workers.dev/tra-cuu.html) |
| Quản trị cửa hàng | [Đăng nhập quản trị](https://web-kem-danh-rang.buithienductrung1707.workers.dev/admin.html) |

Bản demo chạy trên Cloudflare Workers và SQLite-backed Durable Object thuộc gói miễn phí, sử dụng tên miền phụ `workers.dev`. Website tiếp tục hoạt động khi tắt máy tính cá nhân. Đăng nhập admin bằng tài khoản có trong database tại lần triển khai đầu tiên.

Đơn hàng, tài khoản, danh mục, tồn kho, quảng cáo, tin nhắn chăm sóc khách hàng, phiên đăng nhập và ảnh tải lên được lưu trên Cloudflare. Dữ liệu trực tuyến và [database trên máy](backend/shop.sqlite) được quản lý riêng. Lần triển khai đầu tiên nhập dữ liệu từ database của repo. Những lần cập nhật mã nguồn tiếp theo tiếp tục sử dụng dữ liệu trực tuyến đang có.

Bản demo hiện dùng thanh toán khi nhận hàng (COD). Để bật chuyển khoản, cần khai báo ba biến thông tin ngân hàng trong cấu hình Worker. Hướng dẫn SMTP bên dưới áp dụng cho bản Node.js local. Bật email trên Workers cần cấu hình SMTP và bộ xử lý gửi email, gồm hàng đợi thông báo đơn hàng.

## Chuẩn bị

- Cài [Git](https://git-scm.com/downloads) và [Node.js](https://nodejs.org/en/download). Môi trường đã kiểm tra là **Node.js 26.13.1**.
- Đăng nhập GitHub bằng tài khoản có quyền truy cập repo riêng tư này.
- Mở PowerShell hoặc Terminal trong VS Code. Các lệnh dưới đây dành cho Windows PowerShell và dùng `npm.cmd` đi kèm Node.js.

## Tải và chạy website trên máy cá nhân

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

Mở [website trên máy cá nhân](http://127.0.0.1:3000/) trong trình duyệt sau khi chạy máy chủ.

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

1. Chọn danh mục trên trang chủ hoặc trong menu **Khám phá sản phẩm**, tìm sản phẩm hoặc dùng bộ lọc và sắp xếp. Ô tìm kiếm trên header tìm trong toàn bộ sản phẩm của các danh mục đang hiển thị.
2. Bấm **Xem nhanh** để xem ảnh, mô tả, giá và số lượng có thể thêm. Chọn **Thêm vào giỏ** hoặc **Mua nhanh**.
3. Mở **Giỏ hàng** trong khu vực tài khoản. Chọn từng sản phẩm hoặc **Chọn tất cả**, điều chỉnh số lượng và kiểm tra tiền của các sản phẩm đã chọn. Dùng biểu tượng thùng rác để xóa riêng hoặc **Xóa đã chọn** để xóa nhiều sản phẩm.
4. Bấm **Tiếp tục đặt hàng** để mở bước xác nhận. Kiểm tra sản phẩm, địa chỉ nhận hàng, phương thức thanh toán và tổng tiền. Khách chưa đăng nhập điền thông tin nhận hàng ở bước này.
5. Bấm **Tạo đơn hàng** để gửi đơn. Lưu mã đơn sau khi đặt thành công. Các sản phẩm chưa chọn tiếp tục nằm trong giỏ hàng.

**Tài khoản**, **Giỏ hàng** và **Đơn hàng** dùng chung bố cục có thanh điều hướng bên trái. Có thể mở trực tiếp [hồ sơ](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-nhap.html), [giỏ hàng](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-nhap.html?view=cart), [xác nhận mua hàng](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-nhap.html?view=checkout) và [đơn hàng](https://web-kem-danh-rang.buithienductrung1707.workers.dev/dang-nhap.html?view=orders). Giỏ rỗng hiển thị nút khám phá sản phẩm và xem đơn hàng. Các đường dẫn giỏ hàng, đơn hàng cũ tự chuyển về khu vực tương ứng.

Giỏ hàng và bước xác nhận hỗ trợ mua khi chưa đăng nhập. Lựa chọn sản phẩm được giữ khi chuyển giữa giỏ và xác nhận trong cùng tab. Khi chưa nhận được kết quả gửi đơn, giữ trang hoặc mở lại bước xác nhận rồi bấm **Thử gửi lại** để tiếp tục cùng lần đặt hàng.

Lần gửi đang chờ giữ nguyên mã yêu cầu khi đổi phiên đăng nhập. Đăng nhập đúng tài khoản đã bắt đầu lần gửi để xem thông tin nhận hàng và kiểm tra lại kết quả.

Khi thêm sản phẩm thành công, ảnh sản phẩm bay tới biểu tượng giỏ hàng trên header và số lượng trên giỏ nhấn sáng nhẹ. Nếu thiết bị bật chế độ giảm chuyển động, phản hồi được rút gọn để hạn chế hiệu ứng.

Khách có thể đăng ký bằng email, mật khẩu, họ tên, số điện thoại và địa chỉ. Mật khẩu khách hàng dài từ 8 đến 128 ký tự. Khi đã đăng nhập, đơn hàng sử dụng địa chỉ nhận hàng mặc định trong tài khoản.

Sau khi đăng nhập, góc tài khoản hiện **Xin chào** và hai từ đầu, cuối trong họ tên. Ví dụ **Nguyễn Văn An** hiện **Nguyễn An**. Avatar mặc định có chữ **NA**, màu nền và chữ được chọn ngẫu nhiên từ các cặp màu có tương phản rõ, giữ ổn định trên cùng trình duyệt. Tên một từ dùng hai chữ cái đầu, ví dụ **Trung** có avatar **TR**. Ảnh đại diện đã tải lên được hiển thị trên header và trang tài khoản.

### Quản lý tài khoản cá nhân

Bấm khu vực tài khoản trên header để mở trang **Thông tin tài khoản**. Thanh bên hiển thị họ tên, số điện thoại và mã khách hàng được ghép từ `KH` cùng ID tài khoản.

- Trong tab **Thông tin tài khoản**, chỉnh **Họ**, **Tên**, **Số điện thoại** rồi bấm **Cập nhật**. Bấm **Hoàn tác** để đưa các ô nhập về thông tin đã lưu. Email dùng để đăng nhập được hiển thị ở chế độ chỉ xem.
- Bấm **Thay đổi** ở ảnh đại diện để chọn JPG, PNG hoặc WebP. Ảnh đầu vào tối đa **20 MiB**, được cắt vuông ở giữa, thu về **512 × 512px** và nén trước khi tải lên. Bấm **Xoá ảnh** để dùng lại avatar chữ cái.
- Tab **Thay đổi mật khẩu** yêu cầu mật khẩu hiện tại, mật khẩu mới và nhập lại mật khẩu mới. Đổi thành công sẽ tiếp tục phiên hiện tại và yêu cầu các phiên khác đăng nhập lại. Nếu máy chủ thông báo mật khẩu đã đổi nhưng phiên chưa lưu được, đăng nhập bằng mật khẩu mới.
- **Sổ địa chỉ giao nhận** hỗ trợ tối đa **5 địa chỉ**, gồm người nhận, số điện thoại và địa chỉ. Dùng **Thêm địa chỉ**, **Chỉnh sửa**, **Xoá** hoặc **Đặt mặc định**. Thông tin người nhận được quản lý riêng với họ tên và số điện thoại cá nhân.

Thông tin nhận hàng cũ được chuyển thành địa chỉ đầu tiên khi mở sổ địa chỉ. Xoá địa chỉ mặc định sẽ chọn địa chỉ còn lại đầu tiên làm mặc định. Khi sổ trống, thêm địa chỉ nhận hàng để tiếp tục đặt hàng. Khi có lỗi phiên bản, đóng cửa sổ chỉnh sửa, bấm **Tải lại địa chỉ** rồi kiểm tra thông tin hiện tại.

**Danh mục nổi bật** và menu **Khám phá sản phẩm** dùng chung danh sách do quản trị quản lý. Có sẵn **Kem đánh răng** và **Bàn chải đánh răng**. Trang bàn chải hiển thị sản phẩm đã được gán đúng danh mục. Khi danh mục chưa có sản phẩm, trang hiển thị thông báo đang cập nhật.

Khách mua bằng thông tin nhận hàng nhập tại giỏ có thể điền thêm email để nhận thông báo. Tồn kho trên máy chủ được trừ khi đơn hàng được tạo thành công.

### Theo dõi đơn hàng

- Mở **Tra cứu đơn hàng**, nhập mã đơn và số điện thoại nhận hàng để xem trạng thái.
- Mở **Đơn hàng** trên thanh bên tài khoản sau khi đăng nhập để xem lịch sử. Có thể lọc theo khoảng ngày, mã đơn hoặc tên sản phẩm, trạng thái và sắp xếp mới nhất hoặc cũ nhất.
- Thẻ đơn hiển thị ảnh sản phẩm, tổng tiền và tiến trình xử lý. Mốc thời gian dùng lịch sử trạng thái thực tế của đơn. Bấm **Xem chi tiết** để xem thông tin nhận hàng và các sản phẩm, hoặc **Mua lại** để thêm sản phẩm vào giỏ.
- Dùng **Thêm đơn hàng đã có mã** cùng mã đơn và số điện thoại để liên kết đơn phù hợp với tài khoản.

Các trạng thái đơn hàng được hiển thị theo luồng xử lý.

| Mã trạng thái | Ý nghĩa |
| --- | --- |
| `NEW` | Đã nhận đơn hàng |
| `CONFIRMED` | Đã xác nhận |
| `SHIPPING` | Đang giao hàng |
| `COMPLETED` | Đã hoàn thành |
| `CANCELLED` | Đã hủy |

## Trò chuyện với cửa hàng

Bấm bong bóng chat ở góc phải dưới các trang cửa hàng để mở cửa sổ **Chăm sóc khách hàng**. Nhập nội dung rồi bấm **Gửi tin nhắn**. Có thể thêm tên trước tin nhắn đầu tiên. Khách có thể gửi tin khi chưa đăng nhập và dùng các liên kết trong cửa sổ để tra cứu đơn hoặc xem sản phẩm.

Tin nhắn và phản hồi của cửa hàng được lưu trong database. Cuộc trò chuyện tự cập nhật mỗi **10 giây** khi cửa sổ chat đang mở và trang đang hiển thị. Bấm nút đóng hoặc phím **Escape** để thu gọn về bong bóng.

Trình duyệt lưu mã truy cập riêng để mở lại cuộc trò chuyện trên cùng website. Dùng lại trình duyệt đó để xem phản hồi. Xóa dữ liệu website hoặc đổi trình duyệt sẽ tạo cuộc trò chuyện mới. Nếu trình duyệt chặn lưu dữ liệu, cửa sổ sẽ thông báo cần giữ trang để tiếp tục xem tin nhắn.

Khi mất kết nối, nội dung chưa xác nhận được giữ lại. Bấm **Thử gửi lại** để hệ thống kiểm tra kết quả và tiếp tục gửi, tránh tạo tin nhắn trùng.

## Sử dụng trang quản trị

Mở [trang quản trị trực tuyến](https://web-kem-danh-rang.buithienductrung1707.workers.dev/admin.html) và đăng nhập bằng tài khoản quản trị của bản demo.

### Chăm sóc khách hàng

Chọn **Chăm sóc khách hàng** trong menu quản trị. Danh sách sắp xếp theo tin nhắn mới nhất, cuộc trò chuyện có tin cuối từ khách hiển thị **Chờ phản hồi**. Chọn một cuộc trò chuyện, nhập câu trả lời rồi bấm **Gửi trả lời**. Khách xem được câu trả lời trong cửa sổ chat của họ.

Tin nhắn tự cập nhật mỗi **10 giây** khi đang xem mục này. Bấm **Tải lại tin nhắn** để kiểm tra ngay. Khi kết quả gửi chưa xác nhận, giữ nội dung và bấm **Kiểm tra và gửi lại**. Đăng xuất sẽ đóng quyền xem tin nhắn trong phiên quản trị.

### Danh mục

Mở **Danh mục** trong quản trị để thêm hoặc chỉnh sửa tên, đường dẫn không dấu, mô tả, ảnh, thứ tự và trạng thái hiển thị. Số thứ tự nhỏ xuất hiện trước. Các danh mục đang hiển thị xuất hiện đồng thời ở trang chủ và menu **Khám phá sản phẩm** sau khi tải lại trang cửa hàng.

Dùng **Chọn ảnh từ máy tính** rồi **Tải ảnh lên**, hoặc nhập đường dẫn ảnh có sẵn. Bấm **Thêm danh mục** hoặc **Lưu danh mục** để áp dụng. Danh mục có sản phẩm cần chuyển các sản phẩm sang danh mục khác trước khi xóa. Danh mục mặc định dành cho sản phẩm cũ có thể ẩn. Khi có thông báo phiên bản đã thay đổi, bấm **Tải lại danh mục** trước khi lưu tiếp.

### Sản phẩm

- Chọn **Thêm sản phẩm** hoặc chọn một sản phẩm hiện có để chỉnh tên, giá, danh mục, mô tả, ảnh, tồn kho và trạng thái hiển thị.
- Để thêm bàn chải, chọn **Bàn chải đánh răng** trong ô **Danh mục sản phẩm**, điền thông tin và lưu. Giỏ hàng hỗ trợ sản phẩm từ nhiều danh mục trong cùng đơn.
- Khi dùng ảnh từ máy tính, chọn ảnh rồi bấm **Tải ảnh lên**. Tiếp tục bấm **Lưu sản phẩm** để áp dụng.
- Định dạng ảnh hỗ trợ gồm JPEG, PNG và WebP, dung lượng tối đa **5 MiB**.

### Quảng cáo

Mở mục **Quảng cáo** trong trang quản trị và chọn nhóm cần quản lý.

- **Quảng cáo đầu trang** quản lý các ảnh quảng cáo ngang ở đầu trang chủ. Khi có nhiều quảng cáo đang hiển thị, chúng tự chuyển mỗi **4 giây**. Dùng nút **‹** và **›** ở hai bên để chuyển quảng cáo trước hoặc tiếp theo, hoặc chọn các nút chấm bên dưới.
- **Quảng cáo hai bên** quản lý banner dọc ở mép trái và phải website, xuất hiện trên màn hình từ **1280px**. Chọn vị trí **Bên trái website** hoặc **Bên phải website** cho từng banner. Khi một bên có nhiều banner đang hiển thị, chúng luân phiên mỗi **5 giây**.

Trong mỗi nhóm, bấm **Thêm quảng cáo** để tạo mới, hoặc chọn một quảng cáo có sẵn để sửa tiêu đề, mô tả, ảnh, nhãn và liên kết nút, thứ tự cùng trạng thái hiển thị. Số thứ tự nhỏ được hiển thị trước. Để ẩn quảng cáo, bỏ chọn **Hiển thị trên website** rồi lưu.

Ảnh từ máy tính cần được **Tải ảnh lên** trước khi bấm **Thêm quảng cáo** hoặc **Lưu quảng cáo**. Bấm **Xóa quảng cáo** và xác nhận trong hộp thoại để xóa quảng cáo đang chọn. Khi nhóm trống, dùng **Thêm quảng cáo** để bắt đầu lại.

Nội dung cả hai nhóm được lưu trong database và quản lý qua trang admin. Tải lại trang cửa hàng để xem thay đổi. Khi có thông báo phiên bản đã thay đổi hoặc kết quả lưu chưa xác nhận, bấm **Tải lại quảng cáo** để kiểm tra danh sách hiện tại.

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

`SHOP_PUBLIC_URL` là địa chỉ gốc dùng để tạo liên kết trong email. Bản chạy trên máy dùng `http://127.0.0.1:3000`. Địa chỉ của bản demo là `https://web-kem-danh-rang.buithienductrung1707.workers.dev`. Nhà cung cấp dùng cổng 465 thường yêu cầu `SMTP_SECURE=true`, còn cổng 587 thường dùng `SMTP_SECURE=false`.

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
| Ảnh sản phẩm, quảng cáo và ảnh đại diện tải lên | [backend/public/uploads/products/](backend/public/uploads/products/) |
| Ảnh giao diện có sẵn | [backend/public/assets/](backend/public/assets/) |
| Cấu hình cục bộ do bạn tạo | `backend/smtp.env` |

Database được mở và khởi tạo schema khi máy chủ chạy. Khi sử dụng một database mới, chương trình tạo sản phẩm mẫu, ba quảng cáo đầu trang và hai banner hai bên. Bản database đang nằm trong repo lưu dữ liệu của cửa hàng tại thời điểm commit.

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
| [backend/src/services/customer-addresses.cjs](backend/src/services/customer-addresses.cjs) | Sổ địa chỉ cá nhân, địa chỉ mặc định và dữ liệu hồ sơ |
| [backend/src/routes/support.cjs](backend/src/routes/support.cjs), [backend/src/services/support.cjs](backend/src/services/support.cjs) | API và lưu trữ tin nhắn chăm sóc khách hàng |
| [backend/src/services/categories.cjs](backend/src/services/categories.cjs) | Danh mục dùng chung cho trang chủ, menu và sản phẩm |
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
| Thẻ tiện ích và xem nhanh sản phẩm | [storefront-widgets.css](backend/public/storefront-widgets.css) |
| Hiệu ứng thêm sản phẩm vào giỏ hàng | [cart-feedback.js](backend/public/cart-feedback.js), [cart-feedback.css](backend/public/cart-feedback.css) |
| Tìm kiếm, menu và hiển thị banner hai bên từ API | [header.js](backend/public/header.js) |
| Lời chào và avatar tài khoản trên header | [account.js](backend/public/account.js), [account-header.css](backend/public/account-header.css) |
| Giao diện và thao tác cài đặt tài khoản cá nhân | [account-dashboard.js](backend/public/account-dashboard.js), [account-dashboard.css](backend/public/account-dashboard.css), [dang-nhap.html](backend/public/dang-nhap.html) |
| Điều hướng chung tài khoản, giỏ hàng và đơn hàng | [account-workspace.js](backend/public/account-workspace.js), [account-workspace.css](backend/public/account-workspace.css) |
| Giỏ hàng và bước xác nhận mua hàng | [account-cart.html](backend/public/account-cart.html), [account-cart.css](backend/public/account-cart.css), [app.js](backend/public/app.js) |
| Lịch sử đơn hàng và tiến trình xử lý | [account-orders.html](backend/public/account-orders.html), [order-history.js](backend/public/order-history.js), [account-orders.css](backend/public/account-orders.css) |
| Danh mục nổi bật, menu danh mục và trang sản phẩm chung | [catalog-categories.js](backend/public/catalog-categories.js), [catalog-categories.css](backend/public/catalog-categories.css), [san-pham.html](backend/public/san-pham.html) |
| Quản lý danh mục trong trang admin | [admin-categories.js](backend/public/admin-categories.js), [admin-categories.css](backend/public/admin-categories.css) |
| Ảnh logo dùng chung | [shop-logo.png](backend/public/assets/shop-logo.png) |
| Danh mục sản phẩm, giỏ hàng và đặt hàng | [app.js](backend/public/app.js) |
| Trình chiếu quảng cáo trang chủ | [carousel.js](backend/public/carousel.js) |
| Bong bóng và cửa sổ chăm sóc khách hàng | [support-chat.js](backend/public/support-chat.js), [support-chat.css](backend/public/support-chat.css) |
| Đọc và trả lời tin nhắn trong quản trị | [admin-support.js](backend/public/admin-support.js), [admin-support.css](backend/public/admin-support.css) |
| Giao diện quản trị | [admin.html](backend/public/admin.html), [admin.js](backend/public/admin.js) |

Sau khi sửa giao diện, bấm **Ctrl + F5** trong trình duyệt để tải lại. Sau khi sửa mã backend hoặc biến môi trường, dừng và chạy lại máy chủ.

Ảnh [danh mục bàn chải](backend/public/assets/category-toothbrush.png) được tạo bằng công cụ imagegen tích hợp. [Prompt tạo ảnh](backend/public/assets/category-toothbrush.prompt.txt) được lưu cùng ảnh để có thể tạo lại theo cùng phong cách.

Trên điện thoại, header sắp xếp logo và các biểu tượng thao tác ở hàng đầu, ô tìm kiếm ở hàng riêng, tiếp theo là menu một hàng gồm **Trang chủ**, **Sản phẩm** và **Đơn của tôi**. Biểu tượng xe giao hàng mở tra cứu đơn, hình người mở tài khoản, giỏ hàng mở trang giỏ và mặt trăng/mặt trời đổi giao diện sáng/tối.

## Kiểm tra nhanh và xử lý lỗi

Mở hai API sau để kiểm tra bản demo trực tuyến trả dữ liệu.

- [Danh sách sản phẩm](https://web-kem-danh-rang.buithienductrung1707.workers.dev/api/products)
- [Quảng cáo đầu trang](https://web-kem-danh-rang.buithienductrung1707.workers.dev/api/banners)

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

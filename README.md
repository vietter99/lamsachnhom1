# MPLIS · Làm sạch nhóm 1

Userscript tra cứu hàng loạt số phát hành giấy chứng nhận trên MPLIS/VBDLIS, phân loại lý do hồ sơ chưa đáp ứng nhóm 1, rồi xuất kết quả ra CSV để dán ngược vào sheet.

Repo này tách riêng, không dùng chung mã với `autovbdlis`.

## Làm được gì

Bạn dán một danh sách số phát hành. Script gọi API tra cứu cho từng số, đọc mã lỗi hệ thống trả về, rồi dựng bảng kết quả kèm nút tải CSV.

Tick **Kiểm chữ ký số từng file quét** để script tải từng file quét về và xác định file nào đã ký số, file nào chưa.

Bấm **Tải file quét** để gói file quét của các hồ sơ đã tra vào một file ZIP, tên file đặt lại theo mẫu bạn chọn.

Hai bộ lọc, cả hai bật sẵn:

**Chỉ tải file giấy chứng nhận** — lấy file mang dấu `GCN` trong tên **và khớp số phát hành đang tra**, bỏ đơn đăng ký cùng giấy tờ kèm theo.

Phải khớp cả số phát hành vì một hồ sơ quét chứa nhiều giấy chứng nhận. Hồ sơ 13610680 trong dữ liệu thật có cả `24349_GCN_DL 242877.pdf` lẫn `24349_GCN_DL 242878.pdf`; lọc theo mỗi chữ `GCN` sẽ lấy nhầm giấy của thửa khác.

**Chỉ tải file chưa ký số** — file đã có chữ ký số thì bỏ qua, vì không cần ký lại. Đây là mục đích chính của công cụ: gom đúng những file còn thiếu chữ ký.

Bỏ tick từng ô để nới bộ lọc tương ứng.

Khi không file nào khớp, script bỏ qua hồ sơ đó và ghi vào phần trạng thái. Nó không đoán bừa lấy file đầu tiên: tải nhầm giấy của thửa khác rồi đặt tên theo số phát hành đang tra thì sai nặng hơn nhiều so với không tải gì và báo cho bạn biết.

Script chỉ đọc. Nó không sửa hồ sơ, không bấm "Gửi yêu cầu phân loại lại", không ghi gì lên hệ thống.

## Đổi tên file khi tải

Mẫu mặc định `{soPhatHanh}.pdf` cho ra `DL 242877.pdf`. Ô nhập mẫu nằm trong mục **Đổi mẫu tên file**, gấp lại sẵn vì phần lớn thời gian không cần đụng tới.

MPLIS không tự đổi tên file khi gắn nó vào giấy chứng nhận. Thao tác tự động của hệ thống là điền `giayChungNhanId`, `versionGiayChungNhan` và bật cờ `laGiayChungNhan`; phần tên vẫn do người dùng gõ tay. Mẫu này lặp lại cách đặt tên đó để khỏi phải gõ lại từng hồ sơ.

Đuôi `.pdf` thêm vào để mở được ngay trên máy; MPLIS không dùng đuôi.

| Biến | Giá trị mẫu |
|---|---|
| `{soPhatHanh}` | `DL 242877` (số bạn dán vào) |
| `{soPhatHanhHeThong}` | `DL 242877` (số máy chủ trả về, để đối chiếu) |
| `{tenGoc}` | `24349_GCN_DL 242877.pdf` |
| `{trangThaiKy}` | `da-ky` hoặc `chua-ky` |
| `{giayChungNhanId}` | `1001333`, rỗng khi file chưa gắn |
| `{versionGcn}` | `2`, rỗng khi file chưa gắn |
| `{toBanDo}` | `297` |
| `{soThua}` | `158` |
| `{xaId}` | `24346` |
| `{tinhHinhDangKyId}` | `13610680` |

Ví dụ mẫu `{soPhatHanh}_{trangThaiKy}.pdf` cho ra `DL 242877_chua-ky.pdf`.

Ký tự Windows cấm (`\ / : * ? " < > |`) bị thay bằng `_`. Dấu tiếng Việt giữ nguyên. Tên trùng nhau tự thêm hậu tố `_2`, `_3`.

Script gói ZIP thay vì tải rời từng file vì trình duyệt chặn việc tải nhiều file liên tiếp: sau file thứ hai nó hỏi quyền, và bạn phải bấm xác nhận giữa chừng cho từng hồ sơ. `src/zip.js` tự ghi ZIP theo phương thức store, không nén, không phụ thuộc thư viện ngoài. PDF đã nén sẵn bên trong nên nén lại gần như không giảm dung lượng.

## Chạy tất cả tự động

Nút **Chạy tất cả tự động** làm trọn bốn bước một lượt:

```
tra cứu  →  gắn giấy chứng nhận  →  tải file chưa ký số  →  gửi phân loại lại
```

Nó hỏi xác nhận **một lần** ở đầu, rồi chạy hết, không dừng lại hỏi từng hồ sơ.

Đổi lại, nó không đoán bừa. Hồ sơ nào rơi vào hai tình huống dưới thì bỏ qua và gom vào danh sách báo cuối lượt:

- Nhiều file cùng là giấy chứng nhận trong một hồ sơ quét
- Không nhận ra file nào là giấy chứng nhận

Danh sách đó hiện ngay trên panel sau khi chạy xong. Xử lý tay từng cái, hoặc tra riêng số đó rồi bấm **Gắn giấy** để tự chọn file.

`kiemTraAnToan` vẫn chạy trước mỗi lần ghi. Chế độ tự động bỏ bước hỏi, không bỏ bước chặn.

## Cài

```bash
npm install
npm run build
```

Mở Tampermonkey, tạo script mới, dán toàn bộ nội dung `dist/mplis-lamsach.user.js`. Sau đó mở MPLIS và đăng nhập như thường lệ. Panel hiện ở góc phải, kéo được.

Muốn xem giao diện trước khi cài:

```bash
npm run preview
```

Lệnh này dựng `preview/index.html` với dữ liệu giả. CSS và icon đọc thẳng từ `src/`, nên bản xem trước không lệch với bản chạy thật.

## Giao diện

Bảng màu đạt WCAG AA trên cả 22 cặp màu chữ/nền đang dùng. Ba màu gốc từ ui-ux-pro-max trượt ngưỡng nên đã thay: xanh lá `#16A34A` lên `#15803D`, viền `#CBD5E1` lên `#7C8794`, chữ mờ `#94A3B8` lên `#64748B`.

Panel chỉ có chế độ sáng vì MPLIS chỉ có chế độ sáng. Icon là SVG inline lấy hình từ Lucide, không dùng emoji. Không nạp font hay thư viện từ mạng ngoài, phòng máy cơ quan chặn.

Bàn phím: `Ctrl+Enter` trong ô nhập chạy tra cứu luôn. Mọi nút đều có viền focus nhìn thấy được.

## Dùng

1. Vào màn **Làm sạch dữ liệu nhóm 2** (`/dc/DonDangKy/LamSachDuLieuNhom2`).
2. Dán danh sách số phát hành vào ô textarea, mỗi dòng một số. Script tự chuẩn hoá `dl242877` thành `DL 242877` và bỏ số trùng.
3. Bấm **Tra cứu**. Mỗi số cách nhau 350ms để không dội request lên máy chủ.
4. Bấm **Tải CSV** khi chạy xong.

## Phạm vi tỉnh / huyện / xã

Panel không hỏi mã tỉnh, huyện, xã. API vẫn cần ba tham số này, nên script đọc chúng từ chính form tìm kiếm của MPLIS qua `[name="tinhId"]`, `[name="huyenId"]`, `[name="xaId"]`. Form đó đã mang sẵn phạm vi đúng với đơn vị của tài khoản đang đăng nhập.

Không tìm thấy ô nào thì script gửi chuỗi rỗng và để máy chủ áp phạm vi mặc định của tài khoản. Giá trị `-1` hoặc `0` trên dropdown cũng được coi là không lọc.

Nếu kết quả trả về sai phạm vi, mở console kiểm tra:

```js
document.querySelector('[name="xaId"]')?.value
```

Trả `undefined` nghĩa là tên trường khác dự đoán. Báo lại tên thật để sửa `docPhamViTuTrang` trong `src/panel.js`.

## Cột trong file CSV

| Cột | Nội dung |
|---|---|
| Số phát hành | Số bạn đã dán |
| Trạng thái | Đạt nhóm 1 / Chưa đạt nhóm 1 / Không tìm thấy / Lỗi tra cứu |
| Tình hình đăng ký | `tinhHinhDangKyId` |
| GCN trên hệ thống | Số phát hành hệ thống trả về, để đối chiếu với số bạn dán |
| GCN bị lỗi | Ví dụ `2304915_1` |
| Nhóm dữ liệu | Ví dụ `HOSOQUET` |
| Mã lỗi | Ví dụ `NOSIGN` |
| Mô tả lỗi | Nhãn tiếng Việt của mã lỗi |
| Tờ bản đồ, Số thửa, Mã xã, Chủ sử dụng | Thông tin thửa đất |
| Thông báo hệ thống | Nguyên văn `errorMessages` |

## Mã lỗi

Hệ thống trả mã ở trường `thongTinDangKyChuaDapUngNhom1`, dạng:

```
TINHHINHDANGKY.13610685|GIAYCHUNGNHAN.2304915_1|HOSOQUET|NOSIGN
```

Phần cuối là mã lỗi, phần áp cuối là nhóm dữ liệu, các phần đầu là thực thể liên quan. Script bóc theo dấu `|` thay vì đọc câu tiếng Việt trong `errorMessages`, vì câu chữ đổi theo bản cập nhật còn mã thì không.

Bảng nhãn tiếng Việt trong `src/parse.js` mới có `NOSIGN`. Mã lạ hiển thị nguyên văn thay vì bị bỏ qua. Gặp mã mới thì thêm vào `NHAN_MA_LOI`.

## Nhận diện chữ ký số

`src/pdf-sign.js` đọc bytes của file PDF và tìm khoá `/ByteRange` cùng `/SubFilter`. Có cả hai nghĩa là file đã ký số. Cách này không cần mở trình xem PDF và không cần nhìn bằng mắt.

Hàm này chỉ trả lời có chữ ký hay không. Nó không kiểm tra chữ ký còn hợp lệ, chứng thư còn hạn, hay nội dung có bị sửa sau khi ký. Đừng dùng kết quả thay cho việc thẩm định chữ ký.

Panel v1 chưa gọi tới nó. Muốn thử tay, mở console trên trang MPLIS:

```js
// Bấm "Xem hồ sơ quét" và chọn đơn đăng ký trước, rồi:
const files = MLS.docDanhSachFileQuetTuDom();
console.table(files);
await MLS.kiemTraChuKyTheoDocId(files[0].docId);
```

## API đang dùng

| Việc | Endpoint |
|---|---|
| Tra cứu theo số phát hành | `POST /dc/LamSachDuLieuAjax/GetThongKePhanLoaiThuaDatChiTiet` |
| Chi tiết đăng ký và danh sách GCN | `POST /dc/LamSachDuLieuAjax/GetThongTinDangKyNhom1` |
| Danh sách file hồ sơ quét | `POST /dc/HoSoQuetAjax/GetHoSoQuetKeKhaiByTinhHinhDangKyId` |
| Tải file hồ sơ quét | `GET /dc/Handlers/FileHandler.ashx?DocId=…&MimeType=application/pdf` |

Mỗi file quét trong phản hồi của `GetHoSoQuetKeKhaiByTinhHinhDangKyId` là một object phẳng:

```json
{
  "nodeId": "a0959bdc-5627-4023-a27c-8191fb5e9f3a",
  "moTa": "24349_GCN_DL 242877.pdf",
  "daKySo": false,
  "laGiayChungNhan": false,
  "hoSoQuetId": 2188437
}
```

`nodeId` chính là `DocId` mà `FileHandler.ashx` nhận. `moTa` là tên hiển thị. `daKySo` cho biết file đã ký số hay chưa, nên script đọc cờ này thay vì tải file về để soi nội dung.

Các object nằm rải rác nhiều tầng nên `bocFileQuetTuJson` duyệt toàn cây. Một `nodeId` xuất hiện nhiều lần dưới các `hoSoQuetId` khác nhau với cách viết `moTa` khác nhau (`24349_GCN_DL 242877` và `24349_GCN_DL 242877.pdf`); hàm gộp theo `nodeId` và giữ tên có đuôi `.pdf`.

`laGiayChungNhan` đánh dấu file **đã được gắn** vào một giấy chứng nhận trong hệ thống:

| Trường | Chưa gắn | Đã gắn |
|---|---|---|
| `laGiayChungNhan` | `false` | `true` |
| `loaiHoSoQuet` | `0` | `1` |
| `giayChungNhanId` | `null` | `1001333` |
| `versionGiayChungNhan` | `null` | `2` |
| `daKySo` | `false` | `true` |

Người dùng chọn giấy để gắn theo Số phát hành. Cây chọn hiển thị mỗi giấy dưới dạng `Giấy chứng nhận <giayChungNhanId>_<versionGiayChungNhan>` kèm dòng mô tả:

```
Giấy chứng nhận 1001333_2 - Số phát hành: DĐ 659138 - Số vào sổ: CH 04421 - ...
```

`moTa` không đổi theo thao tác gắn. Vì vậy không lọc file cần xử lý theo cờ này: file cần xử lý chính là file có cờ `false`. Nhận diện giấy chứng nhận chưa gắn phải dựa vào tên.

Cột **Đã chuyển thành GCN** trong file CSV cho biết hồ sơ đã qua bước này hay chưa.

Anti-forgery token đọc từ `input[name="__RequestVerificationToken"]` ngay trong trang. Không hardcode, vì token đổi mỗi phiên đăng nhập.

## Bảo mật

`.gitignore` chặn `file chi tiết`, `*.har`, `*.log` và các file `ket-qua-*.csv`. Những file này chứa token phiên đăng nhập và dữ liệu công dân. Đừng gỡ các dòng đó.

Ai cầm được token phiên còn hạn thì thao tác được trên hệ thống dưới danh nghĩa tài khoản bạn.

## Chưa làm

- Tải file hồ sơ quét hàng loạt rồi đổi tên. Cần chốt quy tắc đặt tên trước.
- Gửi yêu cầu phân loại lại. Đây là thao tác ghi, nằm ngoài phạm vi v1.

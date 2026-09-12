/**
 * Cầu nối giữa userscript MPLIS và Google Sheets.
 *
 * Userscript không gọi thẳng Google Sheets API được, nên nó POST JSON tới Web App
 * này và Web App ghi hộ vào sheet.
 *
 * TRIỂN KHAI
 *
 *   1. Mở sheet, chọn Tiện ích mở rộng > Apps Script.
 *   2. Xoá hết nội dung file Code.gs, dán toàn bộ file này vào.
 *   3. Xem lại CAU_HINH bên dưới cho khớp sheet của bạn.
 *   4. Bấm Triển khai > Lần triển khai mới > loại Ứng dụng web.
 *      - Thực thi với tư cách: Tôi
 *      - Ai có quyền truy cập: Bất kỳ ai
 *   5. Chép URL kết thúc bằng /exec, dán vào ô "URL Apps Script" trong panel.
 *
 * Sửa file này rồi thì phải Triển khai lại, không thì Web App vẫn chạy bản cũ.
 *
 * "Bất kỳ ai" nghĩa là ai biết URL đều ghi được vào sheet. URL dài và ngẫu nhiên
 * nên khó đoán, nhưng đừng đăng nó công khai. Muốn chặt hơn thì đặt MAT_KHAU bên
 * dưới và panel sẽ phải gửi kèm.
 */

var CAU_HINH = {
  /**
   * Tab được phép ghi.
   *
   *   []                        tìm khắp mọi tab (mặc định)
   *   ['Dlieya Viet']           chỉ một tab
   *   ['Dlieya Viet', 'Phu Xuan']  vài tab
   *
   * Sổ chia theo xã nên mỗi xã một tab. Cố định một tên thì mọi xã khác báo
   * "không thấy số phát hành" dù dữ liệu vẫn nằm trong file.
   */
  TAB: [],

  /**
   * CỘT DÙNG ĐỂ TÌM DÒNG.
   *
   * Cấu hình sẵn theo bảng tổng đang dùng:
   *   C  Số tờ bản đồ
   *   D  Số thứ tự thửa đất
   *   G  Thông tin giấy chứng nhận  (ô này chứa được NHIỀU số, ngăn bằng ';')
   *
   * Mở sheet, nhìn chữ cái cột ngay dưới thanh công cụ mà điền. Điền sai cột
   * là ghi đè lên dữ liệu người khác — kiểm lại trước khi chạy thật.
   */
  COT_SO_PHAT_HANH: 'G',
  COT_TO_BAN_DO: 'C',
  COT_SO_THUA: 'D',

  /**
   * CỘT ĐƯỢC GHI. Để rỗng ('') là không đụng tới cột đó.
   *
   *   H  Thông tin thiếu     thiếu cái gì, đã bỏ id nội bộ và gộp câu trùng
   *   O  Kết quả thực hiện   Đã gắn GCN / Chưa gắn GCN / Không có GCN
   *   N  Ngày thực hiện      ngày chạy tool
   *
   * Cột K (SỐ THỬA MỚI), L (TB MỚI), M (Người thực hiện) cố tình để trống:
   * đó là phần người khác tự điền, tool không chạm vào.
   */
  COT_THONG_TIN_THIEU: 'H',
  COT_GAN_GCN: 'O',
  COT_NGAY: 'N',

  /**
   * Cột phân loại nhóm (ví dụ 'E' — "Phân loại dữ liệu theo Kế hoạch 2959").
   * Để rỗng thì tool KHÔNG ghi kết luận nhóm 1 đi đâu cả. Bật lên là ghi đè
   * giá trị phân loại sẵn có, nên chỉ bật khi chắc chắn.
   */
  COT_KET_LUAN: '',

  // Dòng đầu tiên chứa dữ liệu (bỏ qua dòng tiêu đề).
  DONG_DAU: 2,

  // Để rỗng nếu không cần mật khẩu.
  MAT_KHAU: '',
};

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (CAU_HINH.MAT_KHAU && data.matKhau !== CAU_HINH.MAT_KHAU) {
      return traLoi({ ok: false, error: 'Sai mật khẩu' });
    }

    var soPhatHanh = chuanHoa(data.soPhatHanh);
    if (!soPhatHanh && !data.thu) return traLoi({ ok: false, error: 'Thiếu số phát hành' });

    var dsTab = layDanhSachTab();
    if (!dsTab.length) {
      return traLoi({ ok: false, error: 'Không tab nào khớp cấu hình TAB' });
    }

    // Nạp cột số phát hành của từng tab một lần, dùng lại cho mọi phép tìm.
    var kho = [];
    var tongDong = 0;
    for (var t = 0; t < dsTab.length; t++) {
      var sh = dsTab[t];
      var n = sh.getLastRow() - CAU_HINH.DONG_DAU + 1;
      if (n < 1) continue;
      kho.push({
        sheet: sh,
        ten: sh.getName(),
        giaTri: sh.getRange(CAU_HINH.DONG_DAU, soCot(CAU_HINH.COT_SO_PHAT_HANH), n, 1).getValues(),
        to: CAU_HINH.COT_TO_BAN_DO
          ? sh.getRange(CAU_HINH.DONG_DAU, soCot(CAU_HINH.COT_TO_BAN_DO), n, 1).getValues()
          : null,
        thua: CAU_HINH.COT_SO_THUA
          ? sh.getRange(CAU_HINH.DONG_DAU, soCot(CAU_HINH.COT_SO_THUA), n, 1).getValues()
          : null,
      });
      tongDong += n;
    }
    if (!kho.length) return traLoi({ ok: false, error: 'Mọi tab đều không có dòng dữ liệu' });

    // Chế độ thử: chỉ báo tình hình, không ghi gì. Kiểm cả danh sách người dùng
    // đang định chạy, để thấy ngay số nào vắng mặt trước khi chạy thật.
    if (data.thu) {
      var canTim = (Array.isArray(data.danhSach) && data.danhSach.length)
        ? data.danhSach
        : (data.soPhatHanh ? [data.soPhatHanh] : []);

      var thay = [];
      var khongThay = [];
      for (var k = 0; k < canTim.length; k++) {
        var tim = timDong(kho, chuanHoa(canTim[k]));
        if (tim.length) thay.push(canTim[k] + ' (' + tim.length + ')');
        else khongThay.push(canTim[k]);
      }

      return traLoi({
        ok: true,
        thu: true,
        tab: kho.map(function (x) { return x.ten; }).join(', '),
        soTab: kho.length,
        soDong: tongDong,
        cotTim: CAU_HINH.COT_SO_PHAT_HANH,
        soDaTim: canTim.length,
        thay: thay,
        khongThay: khongThay,
      });
    }

    var dongKhop = timDong(kho, soPhatHanh);
    if (!dongKhop.length) {
      return traLoi({
        ok: false,
        error: 'Không thấy ' + data.soPhatHanh + ' trong cột ' + CAU_HINH.COT_SO_PHAT_HANH +
          ' của ' + kho.length + ' tab (' + tongDong + ' dòng đã quét)',
      });
    }

    // Có cấu hình cột Tờ/Thửa thì siết lại còn đúng dòng của thửa đang ghi.
    // KHÔNG tự lùi về ghi cả nhóm khi siết ra rỗng: ghi nhầm sang thửa khác
    // chính là lỗi mà bước này sinh ra để chặn.
    var locTheoThua = CAU_HINH.COT_TO_BAN_DO && CAU_HINH.COT_SO_THUA &&
      (data.to !== undefined && data.to !== null && data.to !== '') &&
      (data.thua !== undefined && data.thua !== null && data.thua !== '');

    if (locTheoThua) {
      var hep = [];
      for (var q = 0; q < dongKhop.length; q++) {
        if (chuanHoa(dongKhop[q].to) === chuanHoa(data.to) &&
            chuanHoa(dongKhop[q].thua) === chuanHoa(data.thua)) {
          hep.push(dongKhop[q]);
        }
      }
      if (!hep.length) {
        return traLoi({
          ok: false,
          error: 'Thấy ' + data.soPhatHanh + ' (' + dongKhop.length + ' dòng) nhưng không dòng nào' +
            ' khớp tờ ' + data.to + ' thửa ' + data.thua +
            '. Có trong sheet: ' + moTaThuaTrongSheet(dongKhop),
        });
      }
      dongKhop = hep;
    }

    var daGhi = [];
    var homNay = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');

    for (var j = 0; j < dongKhop.length; j++) {
      var d = dongKhop[j];
      ghiO(d, CAU_HINH.COT_THONG_TIN_THIEU, data.thongTinThieu);
      ghiO(d, CAU_HINH.COT_GAN_GCN, data.ganGcn);
      ghiO(d, CAU_HINH.COT_KET_LUAN, data.ketLuan);
      if (CAU_HINH.COT_NGAY) {
        d.sheet.getRange(d.dong, soCot(CAU_HINH.COT_NGAY)).setValue(homNay);
      }
      daGhi.push(d.ten + '!' + d.dong);
    }

    return traLoi({ ok: true, soDongDaGhi: daGhi.length, dong: daGhi });
  } catch (err) {
    return traLoi({ ok: false, error: String(err) });
  }
}

/** Gọi thẳng URL bằng trình duyệt để kiểm tra Web App đã chạy chưa. */
function doGet() {
  var ds = layDanhSachTab().map(function (s) { return s.getName(); });
  return traLoi({
    ok: true,
    thongDiep: 'Apps Script đang chạy. Dùng POST để ghi dữ liệu.',
    tabSeGhi: ds,
  });
}

/** Các tab được phép ghi, theo CAU_HINH.TAB. Rỗng nghĩa là mọi tab. */
function layDanhSachTab() {
  var tatCa = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  if (!CAU_HINH.TAB || !CAU_HINH.TAB.length) return tatCa;

  var chon = [];
  for (var i = 0; i < tatCa.length; i++) {
    if (CAU_HINH.TAB.indexOf(tatCa[i].getName()) >= 0) chon.push(tatCa[i]);
  }
  return chon;
}

/**
 * Ghi một ô, bỏ qua nếu cột chưa cấu hình.
 *
 * Giá trị rỗng vẫn ghi (xoá nội dung cũ) — trừ khi cột để rỗng trong CAU_HINH,
 * lúc đó không chạm vào cột đó chút nào.
 */
function ghiO(dong, cot, giaTri) {
  if (!cot) return;
  dong.sheet.getRange(dong.dong, soCot(cot)).setValue(giaTri || '');
}

/** Tìm mọi dòng khớp số phát hành, trên mọi tab. Kèm tờ/thửa của từng dòng. */
function timDong(kho, khoa) {
  var ra = [];
  if (!khoa) return ra;
  for (var t = 0; t < kho.length; t++) {
    var g = kho[t].giaTri;
    for (var i = 0; i < g.length; i++) {
      if (oChuaSo(g[i][0], khoa)) {
        ra.push({
          sheet: kho[t].sheet,
          ten: kho[t].ten,
          dong: CAU_HINH.DONG_DAU + i,
          to: kho[t].to ? kho[t].to[i][0] : '',
          thua: kho[t].thua ? kho[t].thua[i][0] : '',
        });
      }
    }
  }
  return ra;
}

/** "tờ 241 thửa 170; tờ 241 thửa 66" — để báo lỗi nói rõ sheet đang có gì. */
function moTaThuaTrongSheet(dongKhop) {
  var ra = [];
  for (var i = 0; i < dongKhop.length && i < 8; i++) {
    ra.push('tờ ' + dongKhop[i].to + ' thửa ' + dongKhop[i].thua);
  }
  return ra.join('; ');
}

/**
 * Ô sheet có khớp số phát hành đang tìm không.
 *
 * Một ô có thể chứa NHIỀU số của cùng một thửa, ngăn bằng dấu chấm phẩy:
 * "K 550097;K 550096;K 550094". So bằng nhau tuyệt đối thì cả ô đó không khớp
 * số nào — chính là lý do một lượt ghi 54 thửa trả về 0 dòng ghi được. Tách ô
 * ra rồi so từng phần.
 */
function oChuaSo(oSheet, khoa) {
  if (!khoa) return false;
  var van = String(oSheet == null ? '' : oSheet);
  var phan = van.split(';').join('|').split(',').join('|').split('\n').join('|').split('|');
  for (var i = 0; i < phan.length; i++) {
    if (chuanHoa(phan[i]) === khoa) return true;
  }
  return false;
}

/** Bỏ khoảng trắng và viết hoa, để `dl242877` khớp `DL 242877`. */
function chuanHoa(v) {
  return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase();
}

/** Đổi chữ cái cột thành số thứ tự: A thành 1, I thành 9. */
function soCot(chu) {
  var n = 0;
  var s = String(chu).toUpperCase();
  for (var i = 0; i < s.length; i++) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n;
}

function traLoi(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

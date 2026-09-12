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
   * CỘT LÀM VIỆC — KHAI BẰNG TÊN TIÊU ĐỀ, KHÔNG PHẢI CHỮ CÁI CỘT.
   *
   * Script tự dò tiêu đề trong mấy dòng đầu rồi suy ra chữ cái cột. Khai bằng
   * chữ cái ('G', 'H'...) từng làm ghi lệch cột hai lần: đếm nhầm một cột là
   * ghi đè lên dữ liệu người khác, mà nhìn bằng mắt thì không phát hiện ra.
   *
   * Tên phải khớp tiêu đề trong sheet (không phân biệt hoa thường, dấu cách
   * thừa, và dấu tiếng Việt). Để rỗng ('') là không dùng cột đó.
   */
  TIEU_DE_SO_PHAT_HANH: 'Thông tin giấy chứng nhận',
  TIEU_DE_TO: 'Số tờ bản đồ',
  TIEU_DE_THUA: 'Số thứ tự thửa đất',

  TIEU_DE_THONG_TIN_THIEU: 'Thông tin thiếu',
  TIEU_DE_KET_QUA: 'Kết quả thực hiện',
  TIEU_DE_NGAY: 'Ngày thực hiện',

  // Tình trạng gắn GCN. Sheet hiện chưa có cột riêng cho việc này; thêm cột
  // rồi điền đúng tên tiêu đề vào đây là tool ghi.
  TIEU_DE_GAN_GCN: '',

  // Số dòng đầu sheet dùng làm tiêu đề (tiêu đề gộp nhiều dòng thì tăng lên).
  SO_DONG_TIEU_DE: 3,

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

    // Nạp sẵn cột cần dò của từng tab, dùng lại cho mọi phép tìm.
    var kho = [];
    var tongDong = 0;
    var thieuCot = [];
    for (var t = 0; t < dsTab.length; t++) {
      var sh = dsTab[t];
      var dc = doCot(sh);
      if (!dc.cot.soPhatHanh) {
        thieuCot.push(sh.getName());
        continue;
      }
      var n = sh.getLastRow() - dc.dongDau + 1;
      if (n < 1) continue;
      kho.push({
        sheet: sh,
        ten: sh.getName(),
        cot: dc.cot,
        dongDau: dc.dongDau,
        giaTri: sh.getRange(dc.dongDau, dc.cot.soPhatHanh, n, 1).getValues(),
        to: dc.cot.to ? sh.getRange(dc.dongDau, dc.cot.to, n, 1).getValues() : null,
        thua: dc.cot.thua ? sh.getRange(dc.dongDau, dc.cot.thua, n, 1).getValues() : null
      });
      tongDong += n;
    }

    if (!kho.length) {
      return traLoi({
        ok: false,
        error: 'Không tab nào có cột tiêu đề "' + CAU_HINH.TIEU_DE_SO_PHAT_HANH +
          '"' + (thieuCot.length ? ' (đã xem: ' + thieuCot.join(', ') + ')' : '') +
          '. Kiểm lại tên tiêu đề trong CAU_HINH cho khớp sheet.'
      });
    }

    // Chế độ thử: chỉ báo tình hình, không ghi gì.
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
        cotDaDo: moTaCot(kho[0]),
        dongDau: kho[0].dongDau,
        soDaTim: canTim.length,
        thay: thay,
        khongThay: khongThay
      });
    }

    var dongKhop = timDong(kho, soPhatHanh);
    if (!dongKhop.length) {
      return traLoi({
        ok: false,
        error: 'Không thấy ' + data.soPhatHanh + ' trong cột "' +
          CAU_HINH.TIEU_DE_SO_PHAT_HANH + '" của ' + kho.length + ' tab (' +
          tongDong + ' dòng đã quét)'
      });
    }

    // Siết còn đúng dòng của thửa đang ghi. KHÔNG tự lùi về ghi cả nhóm khi
    // siết ra rỗng: ghi nhầm sang thửa khác chính là lỗi bước này sinh ra để
    // chặn.
    var locTheoThua = kho[0].cot.to && kho[0].cot.thua &&
      data.to !== undefined && data.to !== null && data.to !== '' &&
      data.thua !== undefined && data.thua !== null && data.thua !== '';

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
            '. Có trong sheet: ' + moTaThuaTrongSheet(dongKhop)
        });
      }
      dongKhop = hep;
    }

    var daGhi = [];
    var homNay = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');

    for (var j = 0; j < dongKhop.length; j++) {
      var d = dongKhop[j];
      ghiO(d, d.cot.thongTinThieu, data.thongTinThieu);
      ghiO(d, d.cot.ketQua, data.ketQua);
      ghiO(d, d.cot.ganGcn, data.ganGcn);
      if (d.cot.ngay) d.sheet.getRange(d.dong, d.cot.ngay).setValue(homNay);
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
/** Bỏ dấu tiếng Việt, gộp khoảng trắng, viết thường — để so tên tiêu đề. */
function chuanTieuDe(v) {
  return String(v == null ? '' : v)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/d/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Dò vị trí các cột theo TÊN TIÊU ĐỀ trong mấy dòng đầu sheet.
 *
 * Trả về { cot: {khoa: soCot}, dongDau }. `dongDau` là dòng ngay sau dòng
 * tiêu đề cuối cùng tìm thấy — tiêu đề gộp hai dòng thì dữ liệu bắt đầu từ
 * dòng thứ ba, khai cứng số đó dễ lệch nên để script tự suy.
 */
function doCot(sheet) {
  var canTim = {
    soPhatHanh: CAU_HINH.TIEU_DE_SO_PHAT_HANH,
    to: CAU_HINH.TIEU_DE_TO,
    thua: CAU_HINH.TIEU_DE_THUA,
    thongTinThieu: CAU_HINH.TIEU_DE_THONG_TIN_THIEU,
    ketQua: CAU_HINH.TIEU_DE_KET_QUA,
    ngay: CAU_HINH.TIEU_DE_NGAY,
    ganGcn: CAU_HINH.TIEU_DE_GAN_GCN
  };

  var soDong = Math.min(CAU_HINH.SO_DONG_TIEU_DE, sheet.getLastRow());
  if (soDong < 1) return { cot: {}, dongDau: 2 };

  var o = sheet.getRange(1, 1, soDong, sheet.getLastColumn()).getValues();
  var cot = {};
  var dongCuoi = 0;

  for (var r = 0; r < o.length; r++) {
    for (var c = 0; c < o[r].length; c++) {
      var oChuan = chuanTieuDe(o[r][c]);
      if (!oChuan) continue;
      for (var khoa in canTim) {
        if (!canTim[khoa] || cot[khoa]) continue;
        if (oChuan === chuanTieuDe(canTim[khoa])) {
          cot[khoa] = c + 1;
          if (r + 1 > dongCuoi) dongCuoi = r + 1;
        }
      }
    }
  }

  return { cot: cot, dongDau: dongCuoi + 1 };
}

function ghiO(dong, cot, giaTri) {
  if (!cot) return;
  // Không ghi đè bằng chuỗi rỗng. Ô có thể đang chứa chữ của người khác; xoá
  // đi thì mất dữ liệu mà tool cũng chẳng có gì thay vào. Muốn báo "không còn
  // thiếu gì" thì gửi hẳn chữ "Không thiếu", đừng gửi rỗng.
  if (giaTri === undefined || giaTri === null || giaTri === '') return;
  dong.sheet.getRange(dong.dong, cot).setValue(giaTri);
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
          cot: kho[t].cot,
          dong: kho[t].dongDau + i,
          to: kho[t].to ? kho[t].to[i][0] : '',
          thua: kho[t].thua ? kho[t].thua[i][0] : ''
        });
      }
    }
  }
  return ra;
}

/** Liệt kê cột đã dò được, để chế độ thử nói rõ nó sẽ ghi vào đâu. */
function moTaCot(mot) {
  var ra = [];
  for (var khoa in mot.cot) ra.push(khoa + '=' + chuCot(mot.cot[khoa]));
  return ra.join(', ');
}

/** 1 -> 'A', 8 -> 'H', 27 -> 'AA'. */
function chuCot(n) {
  var ra = '';
  while (n > 0) {
    var du = (n - 1) % 26;
    ra = String.fromCharCode(65 + du) + ra;
    n = Math.floor((n - 1) / 26);
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

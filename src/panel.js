import { PANEL_CSS } from './panel-style.js';
import { ICONS } from './icons.js';
import { timTheoSoPhatHanh, timHoSoTiepNhan } from './api.js';
import { bocKetQuaTraCuu, bocNguoiNopDon } from './parse.js';
import { kiemTraChuKyTheoDangKy } from './pdf-sign.js';
import { taoZip, lamSachTenFile, tenKhongTrung } from './zip.js';
import { dungPayloadGanGiay, guiGanGiay, kiemTraAnToan } from './gan-giay.js';
import { guiYeuCauPhanLoaiLai } from './api.js';
import { ghiVaoSheet, docUrlSheet, luuUrlSheet } from './sheet.js';
import { log, canhBao, loi as ghiLoi, moNhom, dongNhom, bang } from './log.js';
import {
    parseInputList,
    normalizeSoPhatHanh,
    escapeHtml,
    toCsv,
    downloadText,
    timestampSlug,
    sleep,
} from './utils.js';

const CSV_HEADERS = [
    { key: 'soPhatHanh', label: 'Số phát hành' },
    { key: 'trangThai', label: 'Trạng thái' },
    { key: 'tinhHinhDangKyId', label: 'Tình hình đăng ký' },
    { key: 'thongTinGiayChungNhan', label: 'GCN trên hệ thống' },
    { key: 'giayChungNhanLoi', label: 'GCN bị lỗi' },
    { key: 'nhomGop', label: 'Nhóm dữ liệu' },
    { key: 'maLoiGop', label: 'Mã lỗi' },
    { key: 'moTaLoi', label: 'Mô tả lỗi' },
    { key: 'soHieuToBanDo', label: 'Tờ bản đồ' },
    { key: 'soThuTuThua', label: 'Số thửa' },
    { key: 'xaId', label: 'Mã xã' },
    { key: 'thongTinChu', label: 'Chủ sử dụng' },
    { key: 'soFileQuet', label: 'Số file quét' },
    { key: 'soFileGcn', label: 'Số file GCN khớp' },
    { key: 'daChuyenGcn', label: 'Đã chuyển thành GCN' },
    { key: 'tenMoiFileQuet', label: 'Tên mọi file quét' },
    { key: 'fileChuaKy', label: 'File chưa ký số' },
    { key: 'fileDaKy', label: 'File đã ký số' },
    { key: 'thongBaoHeThong', label: 'Thông báo hệ thống' },
];

const TRANG_THAI = {
    DAT: 'Đạt nhóm 1',
    CHUA_DAT: 'Chưa đạt nhóm 1',
    KHONG_THAY: 'Không tìm thấy',
    LOI: 'Lỗi tra cứu',
};

const MUC_DO = {
    [TRANG_THAI.DAT]: 'ok',
    [TRANG_THAI.CHUA_DAT]: 'warn',
    [TRANG_THAI.KHONG_THAY]: 'err',
    [TRANG_THAI.LOI]: 'err',
};

/**
 * Mẫu tên mặc định.
 *
 * MPLIS không tự đổi `moTa` khi gắn file vào giấy chứng nhận. Thao tác tự động
 * của nó là điền `giayChungNhanId`, `versionGiayChungNhan` và bật cờ
 * `laGiayChungNhan`; phần tên file vẫn do người dùng gõ tay. `Giấy chứng nhận
 * DĐ 659138` trong dữ liệu mẫu là tên do người dùng tự đặt, không phải mặc
 * định của hệ thống.
 *
 * Mẫu này lặp lại đúng cách đặt tên đó để khỏi phải gõ lại từng hồ sơ.
 * Đuôi `.pdf` thêm vào để mở được ngay trên máy; MPLIS không dùng đuôi.
 */
const MAU_TEN_MAC_DINH = '{soPhatHanh}.pdf';

/**
 * Bỏ dấu tiếng Việt và viết hoa, để so tên file bất kể cách gõ dấu.
 *
 * NFD tách nguyên âm khỏi dấu thanh nên xoá được bằng dải combining mark. Riêng
 * đ và Đ là ký tự độc lập, NFD không tách, phải thay tay.
 */
function boDau(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toUpperCase();
}

/**
 * Nhận diện file giấy chứng nhận trong bộ hồ sơ quét.
 *
 * Cán bộ đặt tên theo ít nhất hai lối, cả hai đều có trong dữ liệu thật:
 *
 *   24349_GCN_DL 242877.pdf
 *   GIẤY CHỨNG NHẬN QSD ĐẤT, QSH NHÀ Ở VÀ TÀI SẢN GẮN LIỀN VỚI ĐẤT
 *
 * Lối thứ hai không mang chữ GCN và cũng không mang số phát hành, nên bắt buộc
 * khớp cả hai thứ sẽ bỏ sót phần lớn hồ sơ cũ. Mẫu dưới chạy trên tên đã bỏ dấu.
 */
const NHAN_DIEN_GCN = /(^|[_\-\s])GCN([_\-\s]|$)|GIAY\s*CHUNG\s*NHAN/;

/**
 * Đơn/giấy tờ đi kèm giấy chứng nhận, không phải chính giấy chứng nhận.
 *
 * File chi tiết cho thấy hồ sơ quét gồm 2 file cùng chưa ký: `GT` và
 * `Giấy chứng nhận BĐ 263922`. `GT` mang đúng số phát hành trong tên ở nhiều hồ
 * sơ khác (`23449_GT_CY 163553`), nên chỉ so số không đủ — phải loại theo nhãn
 * GT/PT trước khi so số, bất kể hoa thường hay đứng ở đâu trong tên.
 */
const NHAN_DIEN_DON_KEM = /(^|[_\-\s])(GT|PT)([_\-\s]|$)/;

/**
 * Tên file có phải giấy chứng nhận không.
 *
 * Lối đặt tên thứ ba gặp trong thực tế: tên chỉ là chính số phát hành, ví dụ
 * file `AC 491066` trong hồ sơ của giấy `AC 491066`. Không có chữ GCN, không có
 * cụm "giấy chứng nhận", nên phải so với số phát hành đang tra.
 */
function laGiayChungNhan(ten, soPhatHanh) {
    // Nhãn GT/PT loại trước tiên, kể cả khi tên mang đúng số phát hành: đó là
    // đơn/giấy tờ đi kèm, không phải giấy chứng nhận.
    if (NHAN_DIEN_DON_KEM.test(boDau(ten))) return false;

    // Số phát hành xuất hiện bất kỳ đâu trong tên là đủ, không cần chữ gì đứng
    // trước, giữa hay sau nó. Người quét đặt tên file mỗi nơi một kiểu; bắt theo
    // chữ "GCN" bỏ sót file tên khác kiểu, và có thể chọn nhầm file chỉ vì nó
    // chứa chữ "giấy chứng nhận" mà không khớp đúng số đang tra.
    if (soPhatHanh) return chuanHoaDeSo(ten).includes(chuanHoaDeSo(soPhatHanh));

    // Không có số phát hành để so (hiếm) thì mới xét tới chữ trong tên.
    return NHAN_DIEN_GCN.test(boDau(ten));
}

let ketQua = [];
let dangChay = false;
let yeuCauDung = false;

/**
 * Trạng thái đang lọc bảng kết quả theo (Đạt / Chưa đạt / Không thấy / Lỗi).
 * Rỗng nghĩa là hiện hết, không lọc gì. Bấm vào ô thống kê để bật/tắt từng
 * trạng thái — bật được nhiều trạng thái cùng lúc (lọc kiểu HOẶC).
 */
let locTrangThai = new Set();

/**
 * Người dùng đã bấm nút Đóng hay chưa — lưu vào localStorage, không chỉ biến JS.
 *
 * "Xem hồ sơ quét" trên MPLIS đôi khi tải lại cả trang (không chỉ đổi DOM trong
 * SPA), userscript chạy lại từ đầu, biến JS mất sạch. Không lưu ra ngoài thì
 * panel bật lại y như lần đầu mở trang — đóng hay thu gọn thế nào cũng vô nghĩa,
 * đúng như hiện tượng "bấm tắt vẫn nhảy lên". Vòng canh gác trong `main.js` cũng
 * đọc cờ này để không dựng lại panel khi MPLIS xoá nó khỏi DOM lúc chuyển màn.
 */
const KHOA_DA_DONG = 'mls-da-dong';
const KHOA_THU_GON = 'mls-thu-gon';
const KHOA_PHONG_TO = 'mls-phong-to';

function docCoLuu(khoa) {
    try {
        return localStorage.getItem(khoa) === '1';
    } catch {
        return false;
    }
}

function luuCo(khoa, bat) {
    try {
        if (bat) localStorage.setItem(khoa, '1');
        else localStorage.removeItem(khoa);
    } catch {
        // localStorage bị chặn thì bỏ qua; trạng thái chỉ còn sống trong phiên này.
    }
}

/** Cho `main.js` biết có nên dựng lại panel không. */
export function nguoiDungDaDong() {
    return docCoLuu(KHOA_DA_DONG);
}

/**
 * Hồ sơ mà chế độ tự động không dám tự quyết: nhiều giấy chứng nhận trong cùng
 * một hồ sơ quét, hoặc không nhận ra file nào là giấy chứng nhận. Gom lại rồi
 * báo một lần ở cuối, thay vì dừng giữa chừng hỏi từng cái.
 */
let canXemTay = [];

/**
 * Đang trong lượt `chayTatCa` hay không.
 *
 * `chayTraCuu` tự gọi bước tải và bước gửi phân loại khi người dùng bật ô tick.
 * Trong lượt chạy tất cả thì `chayTatCa` đã gọi các bước đó theo thứ tự của nó,
 * nên cờ này chặn chúng chạy lần thứ hai.
 */
let dangChayTatCa = false;

/**
 * Lấy phạm vi tỉnh/huyện/xã từ chính form tìm kiếm của MPLIS thay vì bắt người
 * dùng gõ tay. Form đó đã có sẵn giá trị đúng với đơn vị của tài khoản đang
 * đăng nhập, nên gõ lại chỉ thừa và dễ sai.
 *
 * Không tìm thấy ô nào thì gửi chuỗi rỗng, để máy chủ tự áp phạm vi mặc định
 * của tài khoản.
 */
function docPhamViTuTrang() {
    const doc = (ten) => {
        const el = document.querySelector(`[name="${ten}"]`);
        const value = el && el.value != null ? String(el.value).trim() : '';
        // Select chưa chọn gì thường trả "-1" hoặc "0"; coi như không lọc.
        return value === '-1' || value === '0' ? '' : value;
    };
    return { tinhId: doc('tinhId'), huyenId: doc('huyenId'), xaId: doc('xaId') };
}

function dongKetQuaRong(soPhatHanh, trangThai, thongBao = '') {
    return {
        soPhatHanh,
        trangThai,
        maLois: [],
        tinhHinhDangKyId: '',
        thongTinGiayChungNhan: '',
        giayChungNhanLoi: '',
        nhomGop: '',
        maLoiGop: '',
        moTaLoi: '',
        soHieuToBanDo: '',
        soThuTuThua: '',
        xaId: '',
        thongTinChu: '',
        soFileQuet: '',
        soFileGcn: '',
        daChuyenGcn: '',
        tenMoiFileQuet: '',
        fileChuaKy: '',
        fileDaKy: '',
        thongBaoHeThong: thongBao,
        trangThaiSheet: '',
    };
}

export function taoPanel() {
    if (document.getElementById('mls-panel')) return;

    // "Xem hồ sơ quét" đôi khi tải lại cả trang. Tôn trọng lựa chọn đóng trước
    // đó ngay từ lần dựng đầu tiên của trang mới, thay vì mở to rồi mới đóng.
    if (docCoLuu(KHOA_DA_DONG)) {
        taoNutMoLai();
        return;
    }

    if (typeof GM_addStyle === 'function') {
        GM_addStyle(PANEL_CSS);
    } else {
        const style = document.createElement('style');
        style.textContent = PANEL_CSS;
        document.head.appendChild(style);
    }

    const panel = document.createElement('section');
    panel.id = 'mls-panel';
    panel.setAttribute('aria-label', 'Công cụ tra cứu làm sạch nhóm 1');
    panel.innerHTML = `
        <header class="mls-head">
            <h2>MPLIS · Làm sạch nhóm 1</h2>
            <span class="mls-head-badge" id="mls-head-badge" hidden></span>
            <button type="button" data-act="caidat" aria-label="Mở cài đặt">${ICONS.caiDat}</button>
            <button type="button" data-act="phongto" aria-label="Phóng to bảng để xem chi tiết" aria-pressed="false">${ICONS.phongTo}</button>
            <button type="button" data-act="thu" aria-label="Thu gọn bảng" aria-expanded="true">${ICONS.thuGon}</button>
            <button type="button" data-act="dong" aria-label="Đóng bảng">${ICONS.close}</button>
        </header>

        <div class="mls-body" id="mls-view-chinh">
            <div class="mls-field">
                <textarea id="mls-input" spellcheck="false" aria-label="Số phát hành, mỗi dòng một số"
                    placeholder="Dán số phát hành, mỗi dòng một số&#10;DL 242877&#10;DL 242992"></textarea>
                <p class="mls-hint">Giữ nguyên chữ bạn dán. Bỏ số trùng. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> để tra cứu.</p>
            </div>

            <div class="mls-actions">
                <button type="button" class="mls-primary mls-rong" data-act="chay">${ICONS.search}<span>Tra cứu</span></button>
                <button type="button" data-act="dung" disabled>${ICONS.stop}<span>Dừng</span></button>
            </div>

            <!-- Một thanh công cụ thay cho 5 khối xếp dọc. Nút đỏ = ghi lên
                 MPLIS; màu là thứ phân biệt, không cần thêm chữ giải thích. -->
            <div class="mls-thanh-cong-cu" role="group" aria-label="Thao tác trên kết quả">
                <button type="button" data-act="tudong" class="mls-stop" title="Chạy lần lượt các bước đã bật trong Cài đặt. Ghi lên MPLIS.">${ICONS.tudong}<span>Chạy tất cả</span></button>
                <button type="button" data-act="gan" class="mls-stop" disabled title="Gắn file quét vào giấy chứng nhận. Ghi lên MPLIS.">${ICONS.link}<span>Gắn giấy</span></button>
                <button type="button" data-act="phanloai" class="mls-stop" disabled title="Gửi yêu cầu phân loại lại. Ghi lên MPLIS.">${ICONS.send}<span>Phân loại</span></button>
                <span class="mls-thanh-ngan" aria-hidden="true"></span>
                <button type="button" data-act="zip" disabled title="Tải file quét chưa ký số về máy">${ICONS.archive}<span>Tải file</span></button>
                <button type="button" data-act="timmadinhdanh" disabled title="Tìm số CMND/CCCD và địa chỉ cho hồ sơ thiếu mã định danh. Chỉ đọc.">${ICONS.search}<span>Mã định danh</span></button>
                <button type="button" data-act="ghisheet" disabled title="Ghi kết quả vào Google Sheet">${ICONS.download}<span>Ghi sheet</span></button>
                <button type="button" data-act="csv" disabled title="Tải kết quả dạng CSV">${ICONS.download}<span>CSV</span></button>
            </div>

            <div class="mls-progress" role="progressbar" id="mls-progress"
                 aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
                 aria-label="Tiến độ"><span></span></div>

            <p class="mls-status" id="mls-status" role="status" aria-live="polite">
                Dán danh sách số phát hành rồi bấm Tra cứu.
            </p>

            <div id="mls-xacnhan"></div>

            <div class="mls-stats" id="mls-stats" hidden></div>
            <div id="mls-ketqua"></div>

            <details class="mls-thugon mls-nhatky-wrap">
                <summary>Nhật ký hoạt động</summary>
                <div class="mls-actions mls-actions-nho">
                    <button type="button" data-act="xoanhatky">Xoá nhật ký</button>
                </div>
                <div class="mls-nhatky" id="mls-nhatky" aria-live="polite"></div>
            </details>

            <p class="mls-foot">
                Nút đỏ ghi dữ liệu lên MPLIS và luôn hỏi xác nhận. Nút còn lại chỉ đọc.
            </p>
        </div>

        <div class="mls-body mls-view-caidat" id="mls-view-caidat" hidden>
            <p class="mls-status" id="mls-status-caidat" role="status" aria-live="polite">
                Chỉnh xong thì bấm Quay lại.
            </p>

            <div class="mls-caidat-head">
                <button type="button" data-act="dongcaidat">${ICONS.quayLai}<span>Quay lại</span></button>
                <h3>Cài đặt</h3>
            </div>

            <fieldset class="mls-nhom">
                <legend>Lọc file tải về</legend>
                <div class="mls-tick">
                    <label title="Gọi thêm một request mỗi hồ sơ để đọc danh sách file quét và cờ đã ký số">
                        <input type="checkbox" id="mls-kiemky" checked> Kiểm chữ ký số
                    </label>
                    <label title="Chỉ lấy file có GCN trong tên hoặc khớp số phát hành đang tra">
                        <input type="checkbox" id="mls-chigcn" checked> Chỉ giấy chứng nhận
                    </label>
                    <label title="Bỏ qua file đã có chữ ký số, vì không cần ký lại">
                        <input type="checkbox" id="mls-chichuaky" checked> Chỉ file chưa ký
                    </label>
                    <label title="Hồ sơ có nhiều file cùng là giấy chứng nhận thì dừng lại hỏi">
                        <input type="checkbox" id="mls-hoichon" checked> Hỏi khi nhiều giấy
                    </label>
                    <label title="Tải từng file riêng thay vì gói chung ZIP. Trình duyệt sẽ hỏi quyền tải nhiều file.">
                        <input type="checkbox" id="mls-tairoi"> Tải rời, không ZIP
                    </label>
                </div>

                <div class="mls-field mls-field-sub">
                    <label for="mls-mauten">Mẫu tên file</label>
                    <input type="text" id="mls-mauten" value="${escapeHtml(MAU_TEN_MAC_DINH)}">
                    <p class="mls-hint">
                        Biến: <code>{soPhatHanh}</code> <code>{soPhatHanhHeThong}</code>
                        <code>{tenGoc}</code> <code>{trangThaiKy}</code> <code>{giayChungNhanId}</code>
                        <code>{versionGcn}</code> <code>{toBanDo}</code> <code>{soThua}</code>
                        <code>{xaId}</code> <code>{tinhHinhDangKyId}</code>.
                        Tên trùng tự thêm hậu tố <code>_2</code>.
                    </p>
                </div>
            </fieldset>

            <fieldset class="mls-nhom mls-nhom-ghi">
                <legend>Bước "Chạy tất cả tự động" gồm những gì</legend>
                <p class="mls-nhom-note">Nhãn <b class="mls-ghi">ghi</b> = sửa dữ liệu MPLIS.</p>
                <div class="mls-tick mls-tick-doc">
                    <label title="Tra cứu xong thì tự gắn giấy chứng nhận cho hồ sơ quét. Ghi lên MPLIS.">
                        <input type="checkbox" id="mls-tugan"> Gắn giấy chứng nhận <b class="mls-ghi">ghi</b>
                    </label>
                    <label title="Tra cứu xong thì tải file quét luôn, khỏi bấm nút.">
                        <input type="checkbox" id="mls-tutai"> Tải file quét
                    </label>
                    <label title="Tra cứu xong thì tự gửi yêu cầu phân loại lại. Ghi lên MPLIS.">
                        <input type="checkbox" id="mls-tuphanloai"> Gửi phân loại lại <b class="mls-ghi">ghi</b>
                    </label>
                    <label title="Sau mỗi bước xong thì ghi kết quả vào Google Sheet">
                        <input type="checkbox" id="mls-tughi" checked> Ghi Google Sheet
                    </label>
                </div>
                <p class="mls-hint">Nút <b>Gắn giấy</b>/<b>Gửi phân loại</b> ở màn chính chạy ngay bước đó, không theo tick ở đây.</p>
            </fieldset>

            <fieldset class="mls-nhom">
                <legend>Google Sheet <span class="mls-thugon-dem ${docUrlSheet() ? 'mls-thugon-dem-ok' : ''}">${docUrlSheet() ? 'đã kết nối' : 'chưa kết nối'}</span></legend>
                <div class="mls-field">
                    <label for="mls-sheeturl">URL Apps Script ghi vào Google Sheet</label>
                    <input type="text" id="mls-sheeturl" placeholder="để trống nếu không dùng"
                        value="${escapeHtml(docUrlSheet())}">
                </div>
                <div class="mls-actions mls-actions-nho">
                    <button type="button" data-act="thusheet">Thử kết nối</button>
                </div>
                <details class="mls-hint">
                    <summary>Cách lấy URL</summary>
                    Mở sheet, Tiện ích mở rộng, Apps Script. Dán nội dung
                    <code>apps-script/Code.gs</code> trong repo. Triển khai dạng Ứng dụng web,
                    quyền truy cập "Bất kỳ ai". Chép URL kết thúc bằng <code>/exec</code>.
                </details>
            </fieldset>
        </div>
    `;
    document.body.appendChild(panel);

    // Cài đặt là một màn riêng, không phải khối cuộn thêm bên dưới — bấm bánh
    // răng để chuyển qua, "Quay lại" để chuyển về. Input/checkbox trong màn ẩn
    // vẫn nằm trong DOM (chỉ đổi `hidden`), nên mọi chỗ đọc bằng getElementById
    // không cần sửa gì.
    const viewChinh = document.getElementById('mls-view-chinh');
    const viewCaiDat = document.getElementById('mls-view-caidat');
    const moCaiDat = (mo) => {
        viewChinh.hidden = mo;
        viewCaiDat.hidden = !mo;
    };
    panel.querySelector('[data-act="caidat"]').addEventListener('click', () => moCaiDat(true));
    panel.querySelector('[data-act="dongcaidat"]').addEventListener('click', () => moCaiDat(false));

    const nutThu = panel.querySelector('[data-act="thu"]');
    const datThuGon = (thuGon) => {
        panel.classList.toggle('mls-collapsed', thuGon);
        nutThu.setAttribute('aria-expanded', String(!thuGon));
        nutThu.setAttribute('aria-label', thuGon ? 'Mở rộng bảng' : 'Thu gọn bảng');
        nutThu.innerHTML = thuGon ? ICONS.moRa : ICONS.thuGon;
        capNhatBadgeHeader();
    };
    nutThu.addEventListener('click', () => {
        const thuGon = !panel.classList.contains('mls-collapsed');
        luuCo(KHOA_THU_GON, thuGon);
        datThuGon(thuGon);
    });
    // Trang tải lại (do "Xem hồ sơ quét" chẳng hạn) thì panel dựng mới hoàn
    // toàn; khôi phục đúng trạng thái thu gọn trước đó thay vì luôn mở to.
    if (docCoLuu(KHOA_THU_GON)) datThuGon(true);

    // Phóng to: bảng rộng và cao hơn hẳn, đủ chỗ đọc mã lỗi, GCN lỗi, thông báo
    // hệ thống dài mà không phải cuộn ngang từng chữ. Thu nhỏ lại về đúng kích
    // thước gọn ban đầu khi bấm lần nữa.
    const nutPhongTo = panel.querySelector('[data-act="phongto"]');
    const datPhongTo = (to) => {
        panel.classList.toggle('mls-phong-to', to);
        nutPhongTo.setAttribute('aria-pressed', String(to));
        nutPhongTo.setAttribute('aria-label', to ? 'Thu nhỏ bảng' : 'Phóng to bảng để xem chi tiết');
        nutPhongTo.innerHTML = to ? ICONS.thuNho : ICONS.phongTo;
    };
    nutPhongTo.addEventListener('click', () => {
        const to = !panel.classList.contains('mls-phong-to');
        luuCo(KHOA_PHONG_TO, to);
        datPhongTo(to);
    });
    if (docCoLuu(KHOA_PHONG_TO)) datPhongTo(true);

    panel.querySelector('[data-act="dong"]').addEventListener('click', () => {
        // Đóng giữa chừng thì dừng vòng lặp, không để nó chạy tiếp trong nền.
        if (dangChay) yeuCauDung = true;
        luuCo(KHOA_DA_DONG, true);
        panel.remove();
        taoNutMoLai();
    });
    panel.querySelector('[data-act="chay"]').addEventListener('click', () => chayTraCuu());
    panel.querySelector('[data-act="csv"]').addEventListener('click', taiCsv);
    panel.querySelector('[data-act="zip"]').addEventListener('click', () => taiFileQuet());
    panel.querySelector('[data-act="gan"]').addEventListener('click', () => ganGiayHangLoat());
    panel.querySelector('[data-act="phanloai"]').addEventListener('click', () => guiPhanLoaiHangLoat());
    panel.querySelector('[data-act="tudong"]').addEventListener('click', chayTatCa);
    panel.querySelector('[data-act="thusheet"]').addEventListener('click', thuKetNoiSheet);
    panel.querySelector('[data-act="ghisheet"]').addEventListener('click', () => ghiKetQuaVaoSheet());
    panel.querySelector('[data-act="timmadinhdanh"]').addEventListener('click', timMaDinhDanhHangLoat);
    panel.querySelector('#mls-sheeturl').addEventListener('input', (e) => luuUrlSheet(e.target.value));
    panel.querySelector('[data-act="xoanhatky"]').addEventListener('click', () => {
        const host = document.getElementById('mls-nhatky');
        if (host) host.innerHTML = '';
    });
    panel.querySelector('[data-act="dung"]').addEventListener('click', () => {
        yeuCauDung = true;
        datTrangThai('Đang dừng sau bản ghi hiện tại…', true);
    });

    // Ctrl+Enter trong ô nhập chạy luôn, khỏi rời tay khỏi bàn phím.
    panel.querySelector('#mls-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            chayTraCuu();
        }
    });

    veKetQua();
    choPhepKeo(panel, panel.querySelector('.mls-head'));
}

/**
 * Nút tròn nhỏ ở góc phải sau khi đóng panel.
 *
 * Đóng hẳn mà không để lại lối vào thì người dùng phải tải lại trang mới mở lại
 * được công cụ, và mất luôn kết quả tra cứu đang có.
 */
function taoNutMoLai() {
    if (document.getElementById('mls-molai')) return;

    const nut = document.createElement('button');
    nut.id = 'mls-molai';
    nut.type = 'button';
    nut.title = 'Mở lại công cụ làm sạch nhóm 1';
    nut.setAttribute('aria-label', 'Mở lại công cụ làm sạch nhóm 1');
    nut.innerHTML = ICONS.search;
    nut.addEventListener('click', () => {
        luuCo(KHOA_DA_DONG, false);
        nut.remove();
        taoPanel();
        veKetQua();
    });

    // Đặt trực tiếp inline, không chỉ chờ CSS ngoài (GM_addStyle) áp lên. Style
    // ngoài có thể tiêm muộn hoặc bị chặn tuỳ trang; không có nó thì nút render
    // theo dòng chảy mặc định — rơi xuống cuối `<body>`, phải cuộn hết trang mới
    // thấy, giống hệt như "biến mất". Ép cứng ở đây để luôn nổi cố định góc màn
    // hình bất kể CSS ngoài có tới hay không, và đè mọi lớp phủ modal của MPLIS
    // bằng z-index tối đa.
    nut.style.cssText =
        'position:fixed;right:16px;bottom:16px;z-index:2147483647;' +
        'display:flex;align-items:center;justify-content:center;' +
        'width:44px;height:44px;padding:0;margin:0;' +
        'background:#1E40AF;color:#FFFFFF;border:0;border-radius:50%;' +
        'box-shadow:0 6px 20px rgba(15,23,42,.28);cursor:pointer;';

    document.body.appendChild(nut);
}

function choPhepKeo(panel, handle) {
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let keo = false;

    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        const rect = panel.getBoundingClientRect();
        keo = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;
        panel.style.right = 'auto';
        handle.classList.add('mls-dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!keo) return;
        // Giữ panel trong khung nhìn: kéo lạc ra ngoài là mất luôn công cụ.
        const rect = panel.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - 40);
        panel.style.left = `${Math.min(Math.max(0, startLeft + e.clientX - startX), maxLeft)}px`;
        panel.style.top = `${Math.min(Math.max(0, startTop + e.clientY - startY), maxTop)}px`;
    });

    document.addEventListener('mouseup', () => {
        keo = false;
        handle.classList.remove('mls-dragging');
    });
}

/**
 * Badge tóm tắt trên thanh tiêu đề, chỉ hiện khi panel đang thu gọn.
 *
 * Thu gọn xong mà không thấy gì thì không biết tool còn chạy hay đã xong. Badge
 * giữ lại đúng một con số cần biết: tiến độ khi đang chạy, số dòng khi đã xong.
 */
function capNhatBadgeHeader() {
    const panel = document.getElementById('mls-panel');
    const badge = document.getElementById('mls-head-badge');
    if (!panel || !badge) return;

    if (!panel.classList.contains('mls-collapsed')) {
        badge.hidden = true;
        return;
    }

    if (dangChay) {
        const bar = document.getElementById('mls-progress');
        const percent = bar ? bar.getAttribute('aria-valuenow') : '0';
        badge.textContent = `đang chạy ${percent}%`;
        badge.className = 'mls-head-badge dangchay';
    } else if (ketQua.length) {
        const dem = demTheoTrangThai();
        badge.textContent = `${ketQua.length} dòng · chưa đạt ${dem[TRANG_THAI.CHUA_DAT]}`;
        badge.className = 'mls-head-badge';
    } else {
        badge.textContent = 'chưa tra';
        badge.className = 'mls-head-badge';
    }
    badge.hidden = false;
}

/**
 * Ghi dòng trạng thái. Viết vào CẢ HAI màn.
 *
 * Nút "Thử kết nối" nằm ở màn Cài đặt, còn dòng trạng thái gốc nằm ở màn
 * chính — mà mở Cài đặt thì màn chính bị ẩn. Kết quả: bấm Thử kết nối xong
 * không thấy gì hiện ra, kể cả khi Apps Script báo lỗi rõ ràng.
 */
function datTrangThai(text, dangTai = false) {
    for (const id of ['mls-status', 'mls-status-caidat']) {
        const el = document.getElementById(id);
        if (!el) continue;
        el.innerHTML = dangTai ? '<span class="mls-spinner"></span>' : '';
        el.append(text);
    }
}

function datTienDo(xong, tong) {
    const bar = document.getElementById('mls-progress');
    if (!bar) return;
    const percent = tong > 0 ? Math.round((xong / tong) * 100) : 0;
    bar.querySelector('span').style.width = `${percent}%`;
    bar.setAttribute('aria-valuenow', String(percent));
    capNhatBadgeHeader();
}

/**
 * Nhật ký hoạt động hiện ngay trong panel, để biết tool đang làm tới đâu mà
 * không phải mở console. `mls-status` chỉ giữ 1 dòng và bị ghi đè liên tục nên
 * việc đã xong (nhất là ghi sheet) trôi qua rất nhanh, dễ tưởng như chưa chạy.
 */
function ghiNhatKy(text, muc = 'info') {
    const host = document.getElementById('mls-nhatky');
    if (!host) return;
    const gio = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const dong = document.createElement('div');
    dong.className = `mls-nhatky-dong mls-nhatky-${muc}`;
    dong.textContent = `${gio}  ${text}`;
    host.prepend(dong);
    while (host.children.length > 300) host.removeChild(host.lastChild);
}

function datNut(chay) {
    const panel = document.getElementById('mls-panel');
    if (!panel) return;
    capNhatBadgeHeader();
    panel.querySelector('[data-act="chay"]').disabled = chay;
    panel.querySelector('[data-act="dung"]').disabled = !chay;
    panel.querySelector('[data-act="csv"]').disabled = chay || ketQua.length === 0;
    panel.querySelector('[data-act="zip"]').disabled =
        chay || !ketQua.some((r) => r.tinhHinhDangKyId);
    panel.querySelector('[data-act="gan"]').disabled =
        chay || !ketQua.some((r) => r.tinhHinhDangKyId);
    panel.querySelector('[data-act="phanloai"]').disabled =
        chay || !ketQua.some((r) => r.thuaDatId);
    panel.querySelector('[data-act="tudong"]').disabled = chay;
    panel.querySelector('[data-act="ghisheet"]').disabled = chay || ketQua.length === 0;
    panel.querySelector('[data-act="timmadinhdanh"]').disabled =
        chay || !ketQua.some((r) => (r.maLois || []).some((m) => m.maLoi === 'maSoDinhDanh'));
}

async function chayTraCuu(tuDong = false) {
    if (dangChay && !tuDong) return;

    const danhSach = parseInputList(document.getElementById('mls-input').value);
    if (!danhSach.length) {
        datTrangThai('Chưa có số phát hành nào để tra.');
        return;
    }

    const scope = docPhamViTuTrang();
    const kiemKy = document.getElementById('mls-kiemky').checked;

    dangChay = true;
    yeuCauDung = false;
    ketQua = [];
    locTrangThai.clear();
    datNut(true);
    datTienDo(0, danhSach.length);
    veKetQua();
    ghiNhatKy(`Tra cứu: bắt đầu ${danhSach.length} số phát hành`);

    let daXong = 0;
    for (const soPhatHanh of danhSach) {
        if (yeuCauDung) break;
        datTrangThai(`Đang tra ${daXong + 1}/${danhSach.length}: ${soPhatHanh}`, true);

        try {
            // Gọi API bằng dạng chuẩn ("DL 242877"), nhưng mọi chỗ hiển thị và
            // ghi ra sheet vẫn giữ đúng chữ người dùng dán.
            const res = await timTheoSoPhatHanh(normalizeSoPhatHanh(soPhatHanh), scope);
            const records = res?.data || [];

            if (!records.length) {
                ketQua.push(dongKetQuaRong(soPhatHanh, TRANG_THAI.KHONG_THAY));
            } else {
                for (const record of records) {
                    const row = bocKetQuaTraCuu(soPhatHanh, record);
                    row.trangThai = row.dapUngNhom1 ? TRANG_THAI.DAT : TRANG_THAI.CHUA_DAT;
                    if (kiemKy && row.tinhHinhDangKyId) {
                        datTrangThai(`Đang kiểm chữ ký ${soPhatHanh}…`, true);
                        await gomKetQuaChuKy(row);
                    }
                    ketQua.push(row);
                }
            }
        } catch (err) {
            const thongBao = err && err.message ? err.message : String(err);
            ketQua.push(dongKetQuaRong(soPhatHanh, TRANG_THAI.LOI, thongBao));
        }

        daXong += 1;
        datTienDo(daXong, danhSach.length);
        veKetQua();
        await sleep(350); // giãn nhịp để không dội request lên máy chủ
    }

    dangChay = false;
    datNut(false);

    const dem = demTheoTrangThai();
    ghiNhatKy(
        `Tra cứu: xong ${daXong}/${danhSach.length}. Chưa đạt nhóm 1: ${dem[TRANG_THAI.CHUA_DAT]}. ` +
        `Không thấy: ${dem[TRANG_THAI.KHONG_THAY]}. Lỗi: ${dem[TRANG_THAI.LOI]}.`,
        dem[TRANG_THAI.LOI] ? 'warn' : 'info'
    );
    moNhom(`Tra cứu ${daXong}/${danhSach.length}`);
    bang('Kết quả', ketQua.map((r) => ({
        'Số phát hành': r.soPhatHanh,
        'Trạng thái': r.trangThai,
        'Mã lỗi': r.maLoiGop,
        'Tình hình đăng ký': r.tinhHinhDangKyId,
        'Thửa': r.soThuTuThua,
        'File quét': r.soFileQuet,
        'File GCN': r.soFileGcn,
        'Đã gắn': r.daChuyenGcn,
    })));
    bang('Hồ sơ không tra được', ketQua
        .filter((r) => r.trangThai === TRANG_THAI.KHONG_THAY || r.trangThai === TRANG_THAI.LOI)
        .map((r) => ({ 'Số phát hành': r.soPhatHanh, 'Trạng thái': r.trangThai, 'Lý do': r.thongBaoHeThong })));
    dongNhom();

    const phanDau = yeuCauDung ? `Đã dừng ở ${daXong}/${danhSach.length}` : `Xong ${daXong}/${danhSach.length}`;
    datTrangThai(
        `${phanDau}. Chưa đạt nhóm 1: ${dem[TRANG_THAI.CHUA_DAT]}. ` +
        `Không tìm thấy: ${dem[TRANG_THAI.KHONG_THAY]}. Lỗi: ${dem[TRANG_THAI.LOI]}.`
    );

    // Mỗi bước tự chạy đã tự ghi sheet ở cuối của chính nó (xem ganGiayHangLoat,
    // taiFileQuet, guiPhanLoaiHangLoat). Ghi thêm ở đây nữa thì trùng lặp: cùng
    // một dòng bị gửi lên Apps Script 2 lần liền cho cùng một trạng thái. Chỉ tự
    // ghi ở đây khi KHÔNG bước nào chạy, để lượt tra cứu đơn thuần vẫn có kết quả
    // trên sheet.
    const daGan = await tuGanGiayNeuBat();
    const daTai = await tuTaiNeuBat();
    const daPhanLoai = await tuPhanLoaiNeuBat();
    if (!daGan && !daTai && !daPhanLoai) await tuGhiSheetNeuBat();
}

/**
 * Tải và kiểm chữ ký toàn bộ file quét của một dòng kết quả, rồi ghi tóm tắt
 * vào chính dòng đó. Lỗi ở bước này không làm hỏng kết quả tra cứu: dòng vẫn
 * giữ nguyên trạng thái nhóm 1, chỉ thêm ghi chú vào thongBaoHeThong.
 */
async function gomKetQuaChuKy(row) {
    try {
        const tatCa = await kiemTraChuKyTheoDangKy(row.tinhHinhDangKyId);
        const gcn = locFileGiayChungNhan(tatCa, row.soPhatHanh);

        row.soFileQuet = tatCa.length;
        row.soFileGcn = gcn.length;
        // Liệt kê tên mọi file để mở rộng bộ nhận diện: file chưa gắn giấy không
        // mang dấu hiệu nào ngoài tên, nên tên là dữ liệu duy nhất để học thêm.
        row.tenMoiFileQuet = tatCa
            .map((f) => `${laGiayChungNhan(f.ten, row.soPhatHanh) ? '[GCN] ' : ''}${f.ten || f.docId}`)
            .join(' / ');
        row.daChuyenGcn = gcn.length
            ? (gcn.every((f) => f.laGiayChungNhan) ? 'Rồi' : 'Chưa')
            : '';
        row.fileDaKy = gcn.filter((f) => f.daKySo).map((f) => f.ten || f.docId).join(' | ');
        row.fileChuaKy = gcn.filter((f) => !f.daKySo).map((f) => f.ten || f.docId).join(' | ');

        if (!tatCa.length) {
            row.thongBaoHeThong = [row.thongBaoHeThong, 'Không bóc được file quét nào từ phản hồi']
                .filter(Boolean).join(' | ');
        } else if (!gcn.length) {
            row.thongBaoHeThong = [
                row.thongBaoHeThong,
                `Không nhận ra giấy chứng nhận trong ${tatCa.length} file quét: ` +
                    tatCa.map((f) => f.ten || f.docId).join(' / '),
            ].filter(Boolean).join(' | ');
        }
    } catch (err) {
        const thongBao = err && err.message ? err.message : String(err);
        row.thongBaoHeThong = [row.thongBaoHeThong, `Kiểm chữ ký lỗi: ${thongBao}`].filter(Boolean).join(' | ');
    }
}

function demTheoTrangThai() {
    const dem = {
        [TRANG_THAI.DAT]: 0,
        [TRANG_THAI.CHUA_DAT]: 0,
        [TRANG_THAI.KHONG_THAY]: 0,
        [TRANG_THAI.LOI]: 0,
    };
    for (const row of ketQua) {
        if (row.trangThai in dem) dem[row.trangThai] += 1;
    }
    return dem;
}

function veKetQua() {
    veThongKe();
    veBang();
}

function veThongKe() {
    const host = document.getElementById('mls-stats');
    if (!host) return;

    if (!ketQua.length) {
        host.hidden = true;
        host.innerHTML = '';
        return;
    }

    const dem = demTheoTrangThai();
    const o = [
        { ma: TRANG_THAI.DAT, nhan: 'Đạt', so: dem[TRANG_THAI.DAT], cls: 'ok' },
        { ma: TRANG_THAI.CHUA_DAT, nhan: 'Chưa đạt', so: dem[TRANG_THAI.CHUA_DAT], cls: 'warn' },
        { ma: TRANG_THAI.KHONG_THAY, nhan: 'Không thấy', so: dem[TRANG_THAI.KHONG_THAY], cls: 'err' },
        { ma: TRANG_THAI.LOI, nhan: 'Lỗi', so: dem[TRANG_THAI.LOI], cls: 'err' },
    ];

    host.hidden = false;
    host.innerHTML = o
        .map((t) => {
            const dangBat = locTrangThai.has(t.ma);
            return `<button type="button" class="mls-stat ${t.cls}${dangBat ? ' mls-stat-bat' : ''}"
                data-trangthai="${escapeHtml(t.ma)}" aria-pressed="${dangBat}"
                title="Bấm để chỉ hiện dòng ${escapeHtml(t.nhan)} trong bảng, bấm lại để bỏ lọc. Bấm 2 lần để copy danh sách số phát hành.">
                <b>${t.so}</b><span>${escapeHtml(t.nhan)}</span>
            </button>`;
        })
        .join('');

    if (!host.dataset.daGanSuKien) {
        host.dataset.daGanSuKien = '1';
        host.addEventListener('click', (e) => {
            const nut = e.target.closest('[data-trangthai]');
            if (!nut) return;
            const ma = nut.dataset.trangthai;
            if (locTrangThai.has(ma)) locTrangThai.delete(ma);
            else locTrangThai.add(ma);
            veKetQua();
        });

        // Bấm 2 lần: copy danh sách số phát hành của đúng trạng thái đó, mỗi
        // số một dòng — dán thẳng vào chỗ khác được luôn, khỏi lọc rồi gõ tay.
        host.addEventListener('dblclick', (e) => {
            const nut = e.target.closest('[data-trangthai]');
            if (!nut) return;
            const ma = nut.dataset.trangthai;
            const ds = ketQua.filter((r) => r.trangThai === ma).map((r) => r.soPhatHanh);
            if (!ds.length) return;

            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(ds.join('\n'));
                datTrangThai(`Đã copy ${ds.length} số phát hành (${ma}).`);
            } else {
                datTrangThai('Userscript thiếu quyền GM_setClipboard. Dán lại bản build mới nhất.');
            }
        });
    }
}

function veBang() {
    const host = document.getElementById('mls-ketqua');
    if (!host) return;

    if (!ketQua.length) {
        host.innerHTML = '<p class="mls-empty">Chưa có kết quả. Kết quả sẽ hiện ở đây sau khi tra cứu.</p>';
        return;
    }

    const dsHien = locTrangThai.size
        ? ketQua.filter((r) => locTrangThai.has(r.trangThai))
        : ketQua;

    const ghiChuLoc = locTrangThai.size
        ? `<p class="mls-hint mls-loc-hint">Đang lọc ${dsHien.length}/${ketQua.length} dòng theo:
            ${[...locTrangThai].map((t) => `<span class="mls-badge ${MUC_DO[t] || 'warn'}">${escapeHtml(t)}</span>`).join(' ')}.
            <button type="button" class="mls-loc-xoa" data-act="xoaloc">Bỏ lọc</button></p>`
        : '';

    if (!dsHien.length) {
        host.innerHTML = ghiChuLoc + '<p class="mls-empty">Không có dòng nào khớp bộ lọc đang chọn.</p>';
        host.querySelector('[data-act="xoaloc"]')?.addEventListener('click', () => {
            locTrangThai.clear();
            veKetQua();
        });
        return;
    }

    const rows = dsHien
        .map((r) => {
            const cls = MUC_DO[r.trangThai] || 'warn';
            // Một cột duy nhất, đọc câu văn thẳng từ server (`errorMessages`) thay
            // vì tách riêng mã lỗi (NOLINK...) và khoá GCN (2297443_2) ra 2 cột —
            // đọc trực tiếp câu người, khỏi phải tự ghép lại ý nghĩa.
            // Câu văn dài thì bó lại 2 dòng ở cỡ bảng gọn, xem hết khi rê chuột
            // (title) hoặc bấm Phóng to — không cắt hẳn, chỉ giấu bớt.
            const baoLoi = r.thongBaoHeThong
                ? `<span class="mls-baoloi" title="${escapeHtml(r.thongBaoHeThong)}">${escapeHtml(r.thongBaoHeThong)}</span>`
                : '<span aria-hidden="true">—</span><span class="mls-sr">không có</span>';

            // Cột riêng cho tên chủ + số CMND/CCCD, tách khỏi câu Báo lỗi — câu
            // lỗi server trả về chỉ ghi id nội bộ ("cá nhân 15517072_0"), không
            // ghi tên, nên gộp chung vào Báo lỗi từng làm cột đó vừa dài vừa
            // lẫn hai loại thông tin khác nhau.
            let oMaDinhDanh = '<span aria-hidden="true">—</span><span class="mls-sr">không có</span>';
            if ((r.maLois || []).some((m) => m.maLoi === 'maSoDinhDanh')) {
                const ten = bocTenChu(r.thongTinChu);
                const oTen = ten ? `<div class="mls-madinhdanh-ten">${escapeHtml(ten)}</div>` : '';

                // Địa chỉ tách riêng khỏi mã định danh — hồ sơ có thể có sẵn cái
                // này mà thiếu cái kia. Cùng nút Copy để dán vào ô "Địa chỉ" của
                // modal MPLIS, độc lập với việc mã định danh đã tìm được chưa.
                const oDiaChi = r.diaChiTimDuoc
                    ? `<div class="mls-madinhdanh-diachi">
                        <code>${escapeHtml(r.diaChiTimDuoc)}</code>
                        <button type="button" class="mls-madinhdanh-copy" data-soph="${escapeHtml(r.soPhatHanh)}" data-truong="diaChi"
                            title="Copy địa chỉ để dán vào ô Địa chỉ trên MPLIS">Copy</button>
                    </div>`
                    : '';

                if (r.maDinhDanhTimDuoc) {
                    // Ra nhiều số cùng tên thì cho chọn ngay tại đây bằng ô thả
                    // xuống, thay vì chỉ ghi chú "còn số khác" rồi bắt tự đối
                    // chiếu bằng mắt. Đổi lựa chọn cập nhật thẳng vào dòng kết
                    // quả (soPhatHanh làm khoá tra ngược), không cần tìm lại.
                    const dsSo = [r.maDinhDanhTimDuoc, ...(r.maDinhDanhSoKhac ? r.maDinhDanhSoKhac.split(' / ') : [])];
                    const oChon = dsSo.length > 1
                        ? `<label class="mls-sr" for="mls-md-${escapeHtml(r.soPhatHanh)}">Chọn mã định danh cho ${escapeHtml(r.soPhatHanh)}</label>
                            <select id="mls-md-${escapeHtml(r.soPhatHanh)}" class="mls-madinhdanh-chon" data-soph="${escapeHtml(r.soPhatHanh)}">
                                ${dsSo.map((so) => `<option value="${escapeHtml(so)}" ${so === r.maDinhDanhTimDuoc ? 'selected' : ''}>${escapeHtml(so)}</option>`).join('')}
                            </select>
                            <span class="mls-hint">${dsSo.length} số cùng tên, tự chọn đúng</span>`
                        : `<code>${escapeHtml(r.maDinhDanhTimDuoc)}</code>`;
                    // Copy để dán tay vào 1 trong 2 ô "Mã số định danh" / "Số giấy
                    // tờ" của modal "Cập nhật dữ liệu thiếu" trên MPLIS — tool
                    // không tự điền vào modal đó vì modal chỉ tồn tại khi người
                    // dùng tự mở, và mỗi hồ sơ một modal riêng.
                    const nguon = r.maDinhDanhNguon === 'ho-so' ? 'có sẵn trong hồ sơ' : 'tra một cửa';
                    const oCopy = `<button type="button" class="mls-madinhdanh-copy" data-soph="${escapeHtml(r.soPhatHanh)}" data-truong="soGiayTo"
                        title="Copy số đang chọn (${escapeHtml(nguon)}) để dán vào Mã số định danh / Số giấy tờ trên MPLIS">Copy</button>`;
                    oMaDinhDanh = `<div class="mls-madinhdanh">${oTen}${oChon}${oCopy}</div>${oDiaChi}`;
                } else {
                    // Chưa bấm "Tìm mã định danh" thì báo rõ ngay tại đây, thay
                    // vì chỉ hiện tên chủ rồi im. Badge giữ ngắn như mọi badge
                    // khác trong bảng (Chưa ký, chưa ghi...) — câu dài đẩy vào
                    // title, tránh vỡ dòng xấu trong cột hẹp.
                    oMaDinhDanh = `<div class="mls-madinhdanh">${oTen}` +
                        `<span class="mls-badge warn" title="Bấm nút Tìm mã định danh ở mục 4 để tra">Thiếu</span></div>${oDiaChi}`;
                }
            }

            // Một giấy chứng nhận phủ nhiều thửa, mỗi thửa một dòng riêng với
            // trạng thái nhóm 1 riêng — không có cột này thì không biết đúng
            // dòng "Chưa đạt" hay "Đạt" đang nói về thửa/tờ nào.
            const oThuaTo = r.soThuTuThua || r.soHieuToBanDo
                ? `<div class="mls-thua-to">
                    ${r.soThuTuThua ? `<span>Thửa <b>${escapeHtml(String(r.soThuTuThua))}</b></span>` : ''}
                    ${r.soHieuToBanDo ? `<span>Tờ <b>${escapeHtml(String(r.soHieuToBanDo))}</b></span>` : ''}
                </div>`
                : '<span aria-hidden="true">—</span><span class="mls-sr">không có</span>';

            return `<tr>
                <td>${escapeHtml(r.soPhatHanh)}</td>
                <td>${oThuaTo}</td>
                <td class="mls-badge-cell"><span class="mls-badge ${cls}">${escapeHtml(r.trangThai)}</span></td>
                <td>${baoLoi}</td>
                <td>${oMaDinhDanh}</td>
                <td class="mls-badge-cell">${oChuKy(r)}</td>
                <td class="mls-badge-cell">${oSheet(r)}</td>
            </tr>`;
        })
        .join('');

    host.innerHTML = ghiChuLoc + `<div class="mls-table-wrap">
        <table>
            <caption class="mls-sr">Kết quả tra cứu số phát hành giấy chứng nhận</caption>
            <thead>
                <tr>
                    <th scope="col">Số phát hành</th>
                    <th scope="col">Thửa/Tờ</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Báo lỗi</th>
                    <th scope="col">Mã định danh</th>
                    <th scope="col">Chữ ký</th>
                    <th scope="col">Sheet</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;

    host.querySelector('[data-act="xoaloc"]')?.addEventListener('click', () => {
        locTrangThai.clear();
        veKetQua();
    });

    // Đổi lựa chọn mã định danh: cập nhật thẳng dòng kết quả theo soPhatHanh.
    // Gắn một lần trên host (bảng dựng lại toàn bộ mỗi lần render, gắn lại mỗi
    // lần thì rò rỉ listener) thay vì gắn riêng từng ô select.
    if (!host.dataset.daGanSuKienMaDinhDanh) {
        host.dataset.daGanSuKienMaDinhDanh = '1';
        host.addEventListener('change', (e) => {
            const chon = e.target.closest('.mls-madinhdanh-chon');
            if (!chon) return;
            const row = ketQua.find((r) => r.soPhatHanh === chon.dataset.soph);
            if (!row) return;

            const soCu = row.maDinhDanhTimDuoc;
            const soMoi = chon.value;
            const dsSo = [soCu, ...(row.maDinhDanhSoKhac ? row.maDinhDanhSoKhac.split(' / ') : [])];
            row.maDinhDanhTimDuoc = soMoi;
            row.maDinhDanhSoKhac = dsSo.filter((so) => so !== soMoi).join(' / ');
            log(`Đổi mã định danh ${row.soPhatHanh}: ${soCu} → ${soMoi}`);
        });

        // Copy số hoặc địa chỉ đang chọn — người dùng tự dán vào đúng ô trên
        // modal MPLIS. `data-truong` phân biệt copy số (dán vào Mã số định
        // danh / Số giấy tờ) hay copy địa chỉ (dán vào ô Địa chỉ).
        host.addEventListener('click', (e) => {
            const nut = e.target.closest('.mls-madinhdanh-copy');
            if (!nut) return;
            const row = ketQua.find((r) => r.soPhatHanh === nut.dataset.soph);
            const laDiaChi = nut.dataset.truong === 'diaChi';
            const gt = laDiaChi ? row?.diaChiTimDuoc : row?.maDinhDanhTimDuoc;
            if (!gt) return;

            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(gt);
                datTrangThai(laDiaChi
                    ? `Đã copy địa chỉ — dán vào ô Địa chỉ trên MPLIS.`
                    : `Đã copy ${gt} — dán vào Mã số định danh hoặc Số giấy tờ trên MPLIS.`);
            } else {
                datTrangThai('Userscript thiếu quyền GM_setClipboard. Dán lại bản build mới nhất.');
            }
        });
    }
}

/**
 * Hiện hộp xác nhận và chờ người dùng quyết định.
 * Trả 'gui' | 'boqua' | 'huy'.
 */
function hoiXacNhan(row, payload) {
    return new Promise((resolve) => {
        const host = document.getElementById('mls-xacnhan');
        const canhBao = kiemTraAnToan(payload);
        const chan = canhBao.length > 0;
        const f = payload.fileSua;

        host.innerHTML = `
            <div class="mls-xacnhan" role="alertdialog" aria-labelledby="mls-xn-title">
                <h3 id="mls-xn-title">Sắp ghi dữ liệu lên MPLIS</h3>
                <dl>
                    <dt>Số phát hành</dt><dd>${escapeHtml(row.soPhatHanh)}</dd>
                    <dt>Hồ sơ quét</dt><dd>${escapeHtml(payload.hoSoQuet.hoSoQuetId)}</dd>
                    <dt>Tên file hiện tại</dt><dd>${escapeHtml(f.tenCu || '(trống)')}</dd>
                    <dt>Đổi thành</dt><dd>${escapeHtml(f.tenMoi)}</dd>
                    <dt>Gắn vào giấy</dt><dd>${escapeHtml(payload.giay.giayChungNhanId)}_${escapeHtml(payload.giay.version)} · số phát hành ${escapeHtml(payload.giay.soPhatHanh)}</dd>
                    <dt>Số file gửi lại</dt><dd>${payload.soPart}/${payload.tongFileTrongHoSo}</dd>
                    <dt>File đã ký số</dt><dd>${f.daKySo ? 'Rồi' : 'Chưa'}</dd>
                    <dt>Đã gắn trước đó</dt><dd>${f.daGanTruocDo ? 'Rồi' : 'Chưa'}</dd>
                </dl>
                <p class="mls-canhbao">${
                    chan
                        ? escapeHtml(canhBao.join('. '))
                        : `Toàn bộ ${payload.tongFileTrongHoSo} file của hồ sơ được gửi lại nguyên văn; chỉ file trên bị sửa. Thao tác này không có nút hoàn tác trong công cụ.`
                }</p>
                <div class="mls-actions">
                    <button type="button" class="mls-stop" data-xn="gui" ${chan ? 'disabled' : ''}>Gửi</button>
                    <button type="button" data-xn="boqua">Bỏ qua hồ sơ này</button>
                    <button type="button" data-xn="huy">Dừng tất cả</button>
                </div>
            </div>
        `;

        const xong = (kq) => {
            host.innerHTML = '';
            resolve(kq);
        };
        host.querySelector('[data-xn="gui"]').addEventListener('click', () => xong('gui'));
        host.querySelector('[data-xn="boqua"]').addEventListener('click', () => xong('boqua'));
        host.querySelector('[data-xn="huy"]').addEventListener('click', () => xong('huy'));
        host.querySelector(chan ? '[data-xn="boqua"]' : '[data-xn="gui"]').focus();
    });
}

/** Bỏ tiền tố hộ gia đình/xưng hô khỏi tên chủ, còn đúng tên để tìm trên hồ sơ tiếp nhận. */
function bocTenChu(thongTinChu) {
    return String(thongTinChu ?? '')
        .replace(/^(Hộ\s+(Ông|Bà|Gia\s*đình)\s+|Ông\s+|Bà\s+|Hộ\s+)/i, '')
        .trim();
}

/**
 * Tìm số CMND/CCCD cho hồ sơ thiếu mã định danh cá nhân (mã lỗi `maSoDinhDanh`),
 * qua tra cứu hồ sơ tiếp nhận (một cửa) theo tên chủ.
 *
 * CHỈ ĐỌC — không ghi gì lên MPLIS, chỉ điền vào bảng kết quả trong tool để
 * người dùng tự copy sang MPLIS sau khi đối chiếu.
 *
 * Khớp tên là lấy số đầu tiên tìm được, theo yêu cầu người dùng — không tự
 * chặn lại khi ra nhiều số khác nhau. Dữ liệu thật cho thấy cùng tên có thể ra
 * nhiều số (trùng tên khác người, hoặc lỗi gõ ở một hồ sơ cũ — ví dụ
 * 042064006947 và 042064006974, đảo 2 số cuối); các số còn lại vẫn ghi vào
 * `maDinhDanhSoKhac` để không giấu hẳn khả năng chọn nhầm.
 */
async function timMaDinhDanhHangLoat() {
    if (dangChay) return;

    const canTim = ketQua.filter((r) => (r.maLois || []).some((m) => m.maLoi === 'maSoDinhDanh'));
    if (!canTim.length) {
        datTrangThai('Không có hồ sơ nào thiếu mã định danh cá nhân trong kết quả hiện tại.');
        return;
    }

    const scope = docPhamViTuTrang();
    dangChay = true;
    yeuCauDung = false;
    datNut(true);
    datTienDo(0, canTim.length);
    ghiNhatKy(`Tìm mã định danh: bắt đầu ${canTim.length} hồ sơ`);

    let daTim = 0;
    let nhieuSoDem = 0;
    let khongThay = 0;
    const loi = [];
    let daXong = 0;

    let coSanDem = 0;

    for (const row of canTim) {
        if (yeuCauDung) break;
        const ten = bocTenChu(row.thongTinChu);
        datTrangThai(`Tìm mã định danh ${daXong + 1}/${canTim.length}: ${ten || row.soPhatHanh}`, true);

        // Địa chỉ tách riêng khỏi mã định danh: hồ sơ có thể đã có sẵn địa chỉ
        // dù đang thiếu mã định danh, hoặc ngược lại. Ghi nhận độc lập, đúng
        // theo caNhanId đang thiếu — không lẫn sang người đồng sở hữu kia.
        if (row.diaChiCoSanTuHoSo && row.diaChiCoSanTuHoSo.length) {
            row.diaChiTimDuoc = row.diaChiCoSanTuHoSo[0];
        }

        // Chính hồ sơ đã có sẵn số ở ô "Mã số định danh" hoặc "Số giấy tờ" (một
        // ô có, ô kia thiếu) thì dùng luôn — khỏi tốn lượt gọi một cửa, và độ
        // tin cậy cao hơn hẳn tìm theo tên (không sợ trùng tên khác người).
        if (row.dinhDanhCoSanTuHoSo && row.dinhDanhCoSanTuHoSo.length) {
            row.maDinhDanhTimDuoc = row.dinhDanhCoSanTuHoSo[0];
            row.maDinhDanhNguon = 'ho-so';
            if (row.dinhDanhCoSanTuHoSo.length > 1) {
                row.maDinhDanhSoKhac = row.dinhDanhCoSanTuHoSo.slice(1).join(' / ');
                nhieuSoDem += 1;
            }
            daTim += 1;
            coSanDem += 1;
            daXong += 1;
            datTienDo(daXong, canTim.length);
            veKetQua();
            continue;
        }

        if (!ten) {
            loi.push(`${row.soPhatHanh}: không đọc được tên chủ từ "${row.thongTinChu}"`);
        } else {
            try {
                const res = await timHoSoTiepNhan(ten, scope);
                const ds = bocNguoiNopDon(res);
                if (ds.length) {
                    // Khớp tên là lấy số đầu tiên tìm được, theo yêu cầu — không
                    // còn chặn lại chờ chọn tay khi ra nhiều số khác nhau. Vẫn
                    // ghi các số còn lại vào ghi chú, để không giấu hẳn khả năng
                    // chọn nhầm nếu sau này cần soát lại.
                    row.maDinhDanhTimDuoc = ds[0].giayChungMinh;
                    row.maDinhDanhNguon = 'mot-cua';
                    if (ds.length > 1) {
                        row.maDinhDanhSoKhac = ds.slice(1).map((d) => d.giayChungMinh).join(' / ');
                        nhieuSoDem += 1;
                    }
                    daTim += 1;
                } else {
                    khongThay += 1;
                }
            } catch (err) {
                loi.push(`${row.soPhatHanh}: ${err && err.message ? err.message : err}`);
            }
        }

        daXong += 1;
        datTienDo(daXong, canTim.length);
        veKetQua();
        await sleep(350);
    }

    dangChay = false;
    datNut(false);

    moNhom(
        `Tìm mã định danh: ${daTim} tìm được (${coSanDem} có sẵn trong hồ sơ, ` +
        `${daTim - coSanDem} tra một cửa), ${nhieuSoDem} nhiều số, ${khongThay} không thấy`
    );
    bang('Tìm được', canTim
        .filter((r) => r.maDinhDanhTimDuoc)
        .map((r) => ({
            'Số phát hành': r.soPhatHanh,
            'Tên chủ': bocTenChu(r.thongTinChu),
            'Mã định danh': r.maDinhDanhTimDuoc,
            'Nguồn': r.maDinhDanhNguon === 'ho-so' ? 'có sẵn trong hồ sơ' : 'một cửa',
            'Số khác (chưa chọn)': r.maDinhDanhSoKhac || '',
        })));
    if (loi.length) ghiLoi(`${loi.length} hồ sơ tìm mã định danh lỗi:`, loi);
    dongNhom();

    datTrangThai(
        `Tìm mã định danh: ${daTim}/${canTim.length} tìm được (${coSanDem} có sẵn trong hồ sơ).` +
        (nhieuSoDem ? ` ${nhieuSoDem} có nhiều số, đã lấy số đầu tiên.` : '') +
        (khongThay ? ` ${khongThay} không tìm thấy.` : '')
    );
}

/**
 * Gắn giấy chứng nhận cho từng hồ sơ, hỏi xác nhận trước mỗi lần ghi.
 *
 * Chỉ xử lý hồ sơ có đúng một file giấy chứng nhận khớp số phát hành và file đó
 * chưa được gắn. Hồ sơ mập mờ thì bỏ qua và ghi lý do, không đoán.
 */
async function ganGiayHangLoat(tuDong = false) {
    if (dangChay && !tuDong) return;

    const tatCaHoSo = gomTheoHoSo(ketQua);
    if (!tatCaHoSo.length) {
        datTrangThai('Chưa có hồ sơ nào để gắn. Tra cứu trước đã.');
        return;
    }

    // Đã đạt nhóm 1 hoặc đã gắn xong ngay trong phiên này thì khỏi gọi API kiểm
    // tra lại — gắn giấy không đổi được kết quả cho hồ sơ đã xong, chỉ tốn lượt
    // gọi và làm log rối thêm những dòng "đã gắn giấy từ trước" vô ích.
    const daXongTruoc = tatCaHoSo.filter(
        (row) => row.trangThai === TRANG_THAI.DAT || row.daChuyenGcn === 'Rồi'
    );
    const dong = tatCaHoSo.filter((row) => !daXongTruoc.includes(row));

    if (!dong.length) {
        datTrangThai(`Cả ${tatCaHoSo.length} hồ sơ đã đạt nhóm 1 hoặc đã gắn giấy từ trước. Không có gì để gắn.`);
        return;
    }

    const mauMoTa = (document.getElementById('mls-mauten').value.trim() || MAU_TEN_MAC_DINH)
        .replace(/\.pdf$/i, '');

    dangChay = true;
    yeuCauDung = false;
    datNut(true);
    datTienDo(0, dong.length);
    ghiNhatKy(
        `Gắn giấy: bắt đầu ${dong.length} hồ sơ` +
        (daXongTruoc.length ? ` (bỏ qua ${daXongTruoc.length} hồ sơ đã đạt nhóm 1 hoặc đã gắn từ trước)` : '')
    );

    let daGui = 0;
    let boQua = 0;
    let daXong = 0;
    const loi = [];

    for (const row of dong) {
        if (yeuCauDung) break;
        datTrangThai(`Chuẩn bị gắn giấy ${daXong + 1}/${dong.length}: ${row.soPhatHanh}`, true);

        try {
            const tatCa = await kiemTraChuKyTheoDangKy(row.tinhHinhDangKyId);
            const gcn = locFileGiayChungNhan(tatCa, row.soPhatHanh);

            let chuaGan = gcn.filter((f) => !f.laGiayChungNhan);

            // Chỉ suy luận khi tên không khớp GCN nào cả (gcn.length === 0). Tên có
            // khớp mà chuaGan rỗng nghĩa là giấy đã gắn từ trước — dừng ở đó, không
            // suy đoán tiếp, không thì tool vơ nhầm file khác gắn chồng lên hồ sơ đã
            // xong. Hồ sơ quét chỉ còn đúng một file chưa gắn thì file đó chính là
            // giấy cần gắn; suy ra được từ chính dữ liệu, không phải đoán bừa.
            if (!gcn.length && tuDong) {
                const theoHs = new Map();
                for (const f of tatCa) {
                    const k = String(f.hoSoQuetId);
                    if (!theoHs.has(k)) theoHs.set(k, []);
                    theoHs.get(k).push(f);
                }
                const suyRa = [];
                for (const [, nhomHs] of theoHs) {
                    // Hồ sơ quét này đã có file được gắn giấy rồi thì bỏ qua hẳn,
                    // không vơ thêm file khác trong cùng nhóm.
                    if (nhomHs.some((f) => f.laGiayChungNhan)) continue;
                    const con = nhomHs.filter((f) => !f.laGiayChungNhan);
                    if (con.length === 1) suyRa.push(con[0]);
                }
                if (suyRa.length) {
                    chuaGan = suyRa;
                    row.thongBaoHeThong = [
                        row.thongBaoHeThong,
                        `Suy ra giấy chứng nhận từ file duy nhất chưa gắn: ${suyRa.map((f) => f.ten || f.docId).join(' / ')}`,
                    ].filter(Boolean).join(' | ');
                }
            }

            if (!gcn.length && !chuaGan.length) {
                boQua += 1;
                loi.push(
                    `${row.soPhatHanh}: không nhận ra giấy chứng nhận trong ${tatCa.length} file: ` +
                    tatCa.map((f) => f.ten || f.docId).join(' / ')
                );
            } else if (!chuaGan.length) {
                boQua += 1;
                loi.push(`${row.soPhatHanh}: đã gắn giấy từ trước`);
            } else {
                // Một tình hình đăng ký chứa nhiều hồ sơ quét, mỗi hồ sơ có file
                // giấy chứng nhận riêng. Hồ sơ 13610646 có `GCN SỐ CH 655063`
                // trong hồ sơ quét 4371534 và `GCN CH 655063` trong 4371533; cả
                // hai đều phải gắn, mỗi cái một lần gọi API.
                const theoHoSoQuet = new Map();
                for (const f of chuaGan) {
                    const khoa = String(f.hoSoQuetId);
                    if (!theoHoSoQuet.has(khoa)) theoHoSoQuet.set(khoa, []);
                    theoHoSoQuet.get(khoa).push(f);
                }

                for (const [hoSoQuetId, nhom] of theoHoSoQuet) {
                    if (yeuCauDung) break;

                    // Nhiều file cùng là giấy chứng nhận trong một hồ sơ quét thì
                    // gắn hết vào cùng giấy đó. Dữ liệu thật cho thấy MPLIS chấp
                    // nhận: hồ sơ 13610685 có hai file cùng trỏ giayChungNhanId
                    // 2304915. Chúng là các mặt hoặc trang của cùng một giấy.
                    let canGan = tuDong ? nhom.map((f) => f.docId) : nhom[0];
                    if (nhom.length > 1 && !tuDong) {
                        // Cùng một hồ sơ quét mà có nhiều giấy chứng nhận thì
                        // không luật nào tách được, phải hỏi.
                        const chon = await hoiChonFile(row, nhom);
                        if (chon === null) {
                            yeuCauDung = true;
                            break;
                        }
                        if (!chon.length) {
                            boQua += 1;
                            loi.push(`${row.soPhatHanh} (hồ sơ quét ${hoSoQuetId}): bạn không chọn file nào`);
                            continue;
                        }
                        canGan = chon;
                    }

                    const payload = await dungPayloadGanGiay({
                        tinhHinhDangKyId: row.tinhHinhDangKyId,
                        soPhatHanh: row.soPhatHanh,
                        docIdCanGan: Array.isArray(canGan) ? canGan : [canGan.docId],
                        mauMoTa,
                    });

                    // Chế độ tự động không hỏi từng hồ sơ, nhưng `guiGanGiay` vẫn
                    // chạy `kiemTraAnToan` và ném lỗi nếu payload có thể làm mất file.
                    const quyetDinh = tuDong ? 'gui' : await hoiXacNhan(row, payload);
                    if (quyetDinh === 'huy') {
                        yeuCauDung = true;
                    } else if (quyetDinh === 'gui') {
                        await guiGanGiay(payload);
                        daGui += 1;
                        ghiNhatKy(`Gắn giấy ✓ ${row.soPhatHanh}: ${payload.fileSua.tenCu} → ${payload.fileSua.tenMoi}`, 'ok');
                        // Ghi kết quả cho mọi thửa thuộc hồ sơ, không riêng thửa đại diện.
                        for (const t of row.thuaGop || [row]) t.daChuyenGcn = 'Rồi';
                    } else {
                        boQua += 1;
                    }
                }
            }
        } catch (err) {
            const vi = err && err.message ? err.message : String(err);
            loi.push(`${row.soPhatHanh}: ${vi}`);
            ghiNhatKy(`Gắn giấy ✗ ${row.soPhatHanh}: ${vi}`, 'err');
        }

        daXong += 1;
        datTienDo(daXong, dong.length);
        veKetQua();
    }

    dangChay = false;
    datNut(false);
    ghiNhatKy(`Gắn giấy: xong ${daGui}, bỏ qua ${boQua}, vướng ${loi.length}`, loi.length ? 'warn' : 'info');
    moNhom(`Gắn giấy: xong ${daGui}, bỏ qua ${boQua}, vướng ${loi.length}`);
    bang('Vướng mắc', loi.map((t) => ({ 'Chi tiết': t })));
    bang('Cần xem tay', canXemTay.map((t) => ({ 'Chi tiết': t })));
    dongNhom();
    if (loi.length) canhBao(`${loi.length} hồ sơ gắn giấy không thành công, xem nhóm "Gắn giấy" phía trên.`);

    datTrangThai(
        `Đã gắn ${daGui} hồ sơ. Bỏ qua ${boQua}.` +
        (loi.length ? ` ${loi.length} vướng mắc: ${loi.slice(0, 2).join('; ')}` : '')
    );

    await tuGhiSheetNeuBat();
}

/**
 * Hỏi người dùng chọn file nào khi một hồ sơ có nhiều giấy chứng nhận.
 *
 * Hồ sơ `CH 655063` có hai file cùng mang chữ GCN và cùng khớp số phát hành:
 * `GCN SỐ CH 655063` và `GCN CH 655063`. Không luật đặt tên nào phân biệt được,
 * nên tool dừng lại hỏi thay vì tải cả hai hoặc đoán bừa một cái.
 *
 * Trả mảng docId đã chọn, hoặc null khi người dùng muốn dừng toàn bộ.
 */
function hoiChonFile(row, danhSach) {
    return new Promise((resolve) => {
        const host = document.getElementById('mls-xacnhan');
        const dong = danhSach.map((f, i) => `
            <label class="mls-chon-item">
                <input type="checkbox" value="${escapeHtml(f.docId)}" ${i === 0 ? 'checked' : ''}>
                <span>${escapeHtml(f.ten || f.docId)}
                    <em>${f.daKySo ? 'đã ký số' : 'chưa ký số'}</em>
                </span>
            </label>`).join('');

        host.innerHTML = `
            <div class="mls-xacnhan mls-chon" role="group" aria-labelledby="mls-chon-title">
                <h3 id="mls-chon-title">${escapeHtml(row.soPhatHanh)}: ${danhSach.length} file cùng là giấy chứng nhận</h3>
                <div class="mls-chon-list">${dong}</div>
                <p class="mls-canhbao">Chọn file cần tải. Bỏ chọn hết là bỏ qua hồ sơ này.</p>
                <div class="mls-actions">
                    <button type="button" data-chon="ok">Dùng file đã chọn</button>
                    <button type="button" data-chon="tatca">Lấy cả ${danhSach.length}</button>
                    <button type="button" class="mls-stop" data-chon="huy">Dừng tất cả</button>
                </div>
            </div>
        `;

        const xong = (kq) => {
            host.innerHTML = '';
            resolve(kq);
        };
        host.querySelector('[data-chon="ok"]').addEventListener('click', () => {
            xong(Array.from(host.querySelectorAll('input:checked')).map((i) => i.value));
        });
        host.querySelector('[data-chon="tatca"]').addEventListener('click', () => {
            xong(danhSach.map((f) => f.docId));
        });
        host.querySelector('[data-chon="huy"]').addEventListener('click', () => xong(null));
        host.querySelector('[data-chon="ok"]').focus();
    });
}

/**
 * Gửi yêu cầu phân loại lại cho mọi thửa đã tra, rồi ghi kết quả vào Google Sheet.
 *
 * Đây là bước cuối: sau khi gắn giấy và bổ sung dữ liệu thiếu, hệ thống cần được
 * bảo chấm lại hồ sơ. Gửi theo từng thửa vì MPLIS làm vậy.
 *
 * Bước này chạm dữ liệu nhưng không sửa gì: nó chỉ xếp hồ sơ vào hàng chờ chấm
 * lại. Vì vậy tool xác nhận một lần cho cả lượt, không hỏi từng hồ sơ như bước
 * gắn giấy.
 */
async function guiPhanLoaiHangLoat(tuDong = false) {
    if (dangChay && !tuDong) return;

    const tatCaThua = ketQua.filter((r) => r.thuaDatId);
    if (!tatCaThua.length) {
        datTrangThai('Chưa có thửa nào để gửi. Tra cứu trước đã.');
        return;
    }

    // Đã đạt nhóm 1 thì gửi phân loại lại không đổi được gì — hệ thống chấm
    // lại vẫn ra kết quả cũ, chỉ tốn lượt gọi. Bỏ qua ngay từ đầu.
    const daDatTruoc = tatCaThua.filter((r) => r.trangThai === TRANG_THAI.DAT);
    const thua = tatCaThua.filter((r) => r.trangThai !== TRANG_THAI.DAT);

    if (!thua.length) {
        datTrangThai(`Cả ${tatCaThua.length} thửa đã đạt nhóm 1. Không có gì để gửi phân loại.`);
        return;
    }

    const dongY = tuDong || window.confirm(
        `Gửi yêu cầu phân loại lại cho ${thua.length} thửa đất?\n\n` +
        'Thao tác này xếp hồ sơ vào hàng chờ hệ thống chấm lại. ' +
        'Nó không sửa dữ liệu hồ sơ.'
    );
    if (!dongY) return;

    dangChay = true;
    yeuCauDung = false;
    datNut(true);
    datTienDo(0, thua.length);
    ghiNhatKy(
        `Gửi phân loại: bắt đầu ${thua.length} thửa` +
        (daDatTruoc.length ? ` (bỏ qua ${daDatTruoc.length} thửa đã đạt nhóm 1)` : '')
    );

    let daGui = 0;
    const loi = [];

    for (let i = 0; i < thua.length; i += 1) {
        if (yeuCauDung) break;
        const row = thua[i];
        datTrangThai(`Gửi phân loại ${i + 1}/${thua.length}: ${row.soPhatHanh} thửa ${row.soThuTuThua}`, true);

        try {
            const res = await guiYeuCauPhanLoaiLai([row.thuaDatId]);
            if (res && res.success === false) throw new Error('Máy chủ từ chối');
            daGui += 1;
            row.thongBaoHeThong = [row.thongBaoHeThong, 'Đã gửi yêu cầu phân loại lại']
                .filter(Boolean).join(' | ');
            ghiNhatKy(`Phân loại ✓ ${row.soPhatHanh} thửa ${row.soThuTuThua}`, 'ok');
        } catch (err) {
            const vi = err && err.message ? err.message : String(err);
            loi.push(`${row.soPhatHanh} thửa ${row.soThuTuThua}: ${vi}`);
            ghiNhatKy(`Phân loại ✗ ${row.soPhatHanh} thửa ${row.soThuTuThua}: ${vi}`, 'err');
        }

        datTienDo(i + 1, thua.length);
        veKetQua();
        await sleep(350);
    }

    dangChay = false;
    datNut(false);

    // Bấm nút làm mới của MPLIS để danh sách bên trái nạp lại trạng thái mới.
    const btnRefresh = document.querySelector('#btnRefresh');
    if (btnRefresh && daGui) btnRefresh.click();

    ghiNhatKy(`Gửi phân loại: xong ${daGui}/${thua.length}, vướng ${loi.length}`, loi.length ? 'warn' : 'info');
    moNhom(`Gửi phân loại: ${daGui}/${thua.length} thửa`);
    bang('Lỗi', loi.map((t) => ({ 'Chi tiết': t })));
    dongNhom();

    await tuGhiSheetNeuBat();

    datTrangThai(
        `Đã gửi phân loại lại ${daGui}/${thua.length} thửa.` +
        (loi.length ? ` ${loi.length} lỗi: ${loi.slice(0, 2).join('; ')}` : '')
    );
}

/** Ô tick đó có đang bật không. */
function batBuoc(id) {
    const o = document.getElementById(id);
    return Boolean(o && o.checked);
}

/**
 * Chạy trọn quy trình một lượt: tra cứu, gắn giấy, tải file, gửi phân loại lại.
 *
 * Chế độ này ghi dữ liệu lên MPLIS mà không hỏi từng hồ sơ. Đổi lại, nó không
 * đoán bừa: hồ sơ nào mập mờ thì bỏ qua và gom vào danh sách báo cuối lượt.
 * `kiemTraAnToan` vẫn chạy trước mỗi lần ghi, nên payload có thể làm mất file
 * vẫn bị chặn như thường.
 */
async function chayTatCa() {
    if (dangChay) return;

    const danhSach = parseInputList(document.getElementById('mls-input').value);
    if (!danhSach.length) {
        datTrangThai('Chưa có số phát hành nào.');
        return;
    }

    // Liệt kê đúng bước sẽ chạy, theo ô tick người dùng đang đặt. Nói chung chung
    // "tool sẽ làm hết" là sai khi vài bước đang tắt.
    const buoc = ['tra cứu'];
    if (batBuoc('mls-tugan')) buoc.push('gắn giấy chứng nhận (ghi lên MPLIS)');
    if (batBuoc('mls-tutai')) buoc.push('tải file quét');
    if (batBuoc('mls-tuphanloai')) buoc.push('gửi phân loại lại (ghi lên MPLIS)');
    if (batBuoc('mls-tughi')) buoc.push('ghi Google Sheet sau mỗi bước');

    const coGhi = batBuoc('mls-tugan') || batBuoc('mls-tuphanloai');
    const dongY = window.confirm(
        `Chạy tự động cho ${danhSach.length} số phát hành?\n\n` +
        buoc.map((b, i) => `${i + 1}. ${b}`).join('\n') +
        (coGhi
            ? '\n\nBước ghi dữ liệu sẽ không hỏi lại từng hồ sơ. ' +
              'Hồ sơ nào tool không chắc thì bỏ qua và báo ở cuối.'
            : '\n\nLượt này không ghi gì lên MPLIS.') +
        '\n\nMuốn thêm hoặc bớt bước thì tắt hộp này, chỉnh ô tick rồi bấm lại.'
    );
    if (!dongY) return;

    canXemTay = [];
    dangChayTatCa = true;
    const batDau = Date.now();

    const dungSom = async (ly) => {
        dangChayTatCa = false;
        await tuGhiSheetNeuBat();
        baoCaoTuDong(batDau, ly);
    };

    await chayTraCuu();
    if (yeuCauDung) return dungSom('đã dừng sau bước tra cứu');

    if (!ketQua.some((r) => r.tinhHinhDangKyId)) return dungSom('không tra được hồ sơ nào');

    if (batBuoc('mls-tugan')) {
        await ganGiayHangLoat(true);
        if (yeuCauDung) return dungSom('đã dừng sau bước gắn giấy');
    }

    if (batBuoc('mls-tutai')) {
        await taiFileQuet(true);
        if (yeuCauDung) return dungSom('đã dừng sau bước tải file');
    }

    if (batBuoc('mls-tuphanloai')) await guiPhanLoaiHangLoat(true);

    dangChayTatCa = false;
    baoCaoTuDong(batDau, 'xong');
}

/** Tóm tắt cuối lượt chạy tự động, kèm danh sách hồ sơ cần người xem. */
function baoCaoTuDong(batDau, ketCuc) {
    const giay = Math.round((Date.now() - batDau) / 1000);
    const dem = demTheoTrangThai();

    let text = `Chạy tự động ${ketCuc} sau ${giay}s. ` +
        `${ketQua.length} dòng, chưa đạt nhóm 1: ${dem[TRANG_THAI.CHUA_DAT]}.`;
    if (canXemTay.length) text += ` ${canXemTay.length} hồ sơ cần bạn xem tay.`;
    datTrangThai(text);

    const host = document.getElementById('mls-xacnhan');
    if (!host) return;
    if (!canXemTay.length) {
        host.innerHTML = '';
        return;
    }

    host.innerHTML = `
        <div class="mls-xacnhan mls-chon" role="group" aria-labelledby="mls-tay-title">
            <h3 id="mls-tay-title">${canXemTay.length} hồ sơ tool không tự quyết</h3>
            <div class="mls-chon-list">
                ${canXemTay.map((t) => `<div class="mls-chon-item"><span>${escapeHtml(t)}</span></div>`).join('')}
            </div>
            <p class="mls-canhbao">Mở từng hồ sơ trên MPLIS rồi xử lý tay, hoặc tra riêng số đó và bấm nút Gắn giấy để chọn file.</p>
            <div class="mls-actions">
                <button type="button" data-tay="dong">Đã hiểu</button>
            </div>
        </div>
    `;
    host.querySelector('[data-tay="dong"]').addEventListener('click', () => {
        host.innerHTML = '';
    });
}

/**
 * Tự gửi yêu cầu phân loại lại sau khi tra cứu, nếu người dùng bật ô tick.
 *
 * Mặc định tắt vì bước này ghi lên MPLIS. Bật rồi thì không hỏi lại, giống mọi
 * ô tự động khác.
 */
async function tuPhanLoaiNeuBat() {
    if (dangChayTatCa) return false;
    const oTick = document.getElementById('mls-tuphanloai');
    if (!oTick || !oTick.checked || !ketQua.some((r) => r.thuaDatId)) return false;
    await guiPhanLoaiHangLoat(true);
    return true;
}

/**
 * Tự gắn giấy chứng nhận sau khi tra cứu, nếu người dùng bật ô tick.
 *
 * Mặc định tắt vì bước này ghi lên MPLIS. Chạy ở chế độ tự động nên không hỏi
 * từng hồ sơ, nhưng `kiemTraAnToan` vẫn chặn payload nguy hiểm như thường.
 */
async function tuGanGiayNeuBat() {
    if (dangChayTatCa) return false;
    const oTick = document.getElementById('mls-tugan');
    if (!oTick || !oTick.checked || !ketQua.some((r) => r.tinhHinhDangKyId)) return false;
    await ganGiayHangLoat(true);
    return true;
}

/**
 * Tự tải file quét ngay sau khi tra cứu, nếu người dùng bật ô tick.
 *
 * Mặc định tắt: tải hàng chục PDF nặng hơn nhiều so với tra cứu, và trình duyệt
 * hỏi quyền khi tải rời. Ai chỉ cần xem kết quả thì không phải chờ.
 */
async function tuTaiNeuBat() {
    if (dangChayTatCa) return false;
    const oTick = document.getElementById('mls-tutai');
    if (!oTick || !oTick.checked || !ketQua.some((r) => r.tinhHinhDangKyId)) return false;
    await taiFileQuet(true);
    return true;
}

/**
 * Tự ghi sheet sau khi một bước kết thúc, nếu người dùng bật ô tick và đã dán
 * URL Apps Script.
 *
 * Ghi lại sau mỗi bước chứ không chỉ một lần: cột Ghi chú đổi theo tiến trình,
 * từ "hồ sơ quét chưa ký số" thành "… · đã gắn giấy · đã tải file chưa ký".
 *
 * Nối kết quả vào cuối dòng trạng thái thay vì ghi đè, để thông báo của bước vừa
 * xong không biến mất.
 */
async function tuGhiSheetNeuBat() {
    const oTick = document.getElementById('mls-tughi');
    if (!oTick || !oTick.checked || !docUrlSheet() || !ketQua.length) return;

    const truoc = document.getElementById('mls-status')?.textContent?.trim() || '';
    const kq = await ghiKetQuaVaoSheet(true);
    datTrangThai(
        `${truoc} Ghi sheet ${kq.daGhi}/${ketQua.length}.` +
        (kq.loi.length ? ` ${kq.loi.length} lỗi: ${kq.loi[0]}` : '')
    );
}

/**
 * Ghi mọi dòng kết quả hiện có vào Google Sheet.
 *
 * Tách thành nút riêng vì trước đây việc ghi sheet nằm lẫn trong bước gửi phân
 * loại lại. Ai chỉ tra cứu rồi dừng sẽ không thấy sheet đổi gì, mà cũng không có
 * cách nào bắt nó ghi.
 */
async function ghiKetQuaVaoSheet(tuDong = false) {
    if (dangChay && !tuDong) return;

    if (!ketQua.length) {
        if (!tuDong) datTrangThai('Chưa có kết quả nào để ghi. Tra cứu trước đã.');
        return { daGhi: 0, loi: [] };
    }
    if (!docUrlSheet()) {
        if (!tuDong) datTrangThai('Chưa dán URL Apps Script. Bấm Thử kết nối để kiểm tra trước.');
        return { daGhi: 0, loi: [] };
    }

    // Gom theo số phát hành trước khi ghi. Sheet dò dòng bằng số phát hành, mà
    // một giấy phủ nhiều thửa — ghi lần lượt từng thửa thì lần ghi sau đè lên
    // lần trước, cuối cùng cả nhóm mang trạng thái của đúng thửa cuối cùng.
    const nhom = gomTheoSoPhatHanh(ketQua);

    dangChay = true;
    yeuCauDung = false;
    datNut(true);
    datTienDo(0, nhom.length);

    let daGhi = 0;
    const loi = [];
    const nhatKySheet = [];

    for (let i = 0; i < nhom.length; i += 1) {
        if (yeuCauDung) break;
        const { soPhatHanh, dong } = nhom[i];
        const row = dong[0];
        datTrangThai(`Ghi sheet ${i + 1}/${nhom.length}: ${soPhatHanh}`, true);

        const cotK = trangThaiGopSheet(dong);
        const cotL = gopTheoThua(dong, dungGhiChuSheet);
        const cotN = gopTheoThua(dong, dungTraCuuSheet);
        const cotO = gopTheoThua(dong, dungGanGcnSheet);
        const kq = await ghiVaoSheet({ ...row, soPhatHanh, trangThai: cotK }, cotL, cotN, cotO);
        if (kq.ok) {
            daGhi += 1;
            const oDong = (kq.chiTiet?.dong || []).join(', ') || '(không rõ dòng)';
            for (const t of dong) t.trangThaiSheet = `Đã ghi ${oDong}`;
            ghiNhatKy(`Sheet ✓ ${soPhatHanh} → ${cotK}${cotL ? ' · ' + cotL : ''} (${oDong})`, 'ok');
            nhatKySheet.push({ 'Số phát hành': soPhatHanh, 'Thửa': dong.length, 'K': cotK, 'L': cotL, 'N': cotN, 'O': cotO, 'Dòng': oDong });
        } else {
            loi.push(`${soPhatHanh}: ${kq.loi}`);
            for (const t of dong) t.trangThaiSheet = `Lỗi: ${kq.loi}`;
            ghiNhatKy(`Sheet ✗ ${soPhatHanh}: ${kq.loi}`, 'err');
            nhatKySheet.push({ 'Số phát hành': soPhatHanh, 'Thửa': dong.length, 'K': cotK, 'L': cotL, 'N': cotN, 'O': cotO, 'Dòng': 'LỖI: ' + kq.loi });
        }

        datTienDo(i + 1, nhom.length);
        await sleep(200);
    }

    dangChay = false;
    datNut(false);

    moNhom(`Ghi sheet: ${daGhi}/${ketQua.length} dòng`);
    bang('Đã gửi lên sheet', nhatKySheet);
    dongNhom();
    if (loi.length) ghiLoi(`${loi.length} dòng ghi sheet lỗi:`, loi);

    if (!tuDong) {
        datTrangThai(
            `Đã ghi ${daGhi}/${ketQua.length} dòng vào sheet.` +
            (loi.length ? ` ${loi.length} lỗi: ${loi.slice(0, 2).join('; ')}` : '')
        );
    }
    return { daGhi, loi };
}

/**
 * Gửi một bản ghi thử lên Apps Script để biết cầu nối sheet hỏng ở đâu.
 *
 * Không có bước này thì lỗi sheet chỉ hiện lẫn trong dòng trạng thái cuối lượt
 * chạy, và bị cắt bớt, nên không đoán được nguyên nhân.
 */
async function thuKetNoiSheet() {
    const url = document.getElementById('mls-sheeturl').value.trim();
    luuUrlSheet(url);

    if (!url) {
        datTrangThai('Chưa dán URL Apps Script vào ô bên trên.');
        return;
    }
    if (!/^https:\/\/script\.google\.com\/.*\/exec$/.test(url)) {
        datTrangThai('URL phải bắt đầu bằng https://script.google.com/ và kết thúc bằng /exec');
        return;
    }
    if (typeof GM_xmlhttpRequest === 'undefined') {
        datTrangThai('Userscript thiếu quyền GM_xmlhttpRequest. Dán lại bản build mới nhất.');
        return;
    }

    // Kiểm cả danh sách trong ô nhập, không chỉ số đầu tiên: cái đáng biết là
    // số nào vắng mặt trong sheet, và điều đó chỉ lộ ra khi tìm hết.
    const danhSach = parseInputList(document.getElementById('mls-input').value);

    datTrangThai('Đang thử kết nối Apps Script…', true);
    const kq = await ghiVaoSheet(
        { thu: true, danhSach, soPhatHanh: danhSach[0] || '', trangThai: '', maLoiGop: '', daChuyenGcn: '' },
        ''
    );

    if (!kq.ok) {
        datTrangThai(`Sheet lỗi: ${kq.loi}`);
        return;
    }

    const ct = kq.chiTiet || {};
    const nen = `Sheet đã kết nối. Tab "${ct.tab || '?'}", ${ct.soDong ?? '?'} dòng, tìm ở cột ${ct.cotTim || '?'}.`;

    if (!danhSach.length) {
        datTrangThai(`${nen} Dán số phát hành vào ô trên rồi thử lại để kiểm việc tìm dòng.`);
        return;
    }

    const thay = ct.thay || [];
    const khongThay = ct.khongThay || [];
    datTrangThai(
        `${nen} Tìm ${danhSach.length} số: thấy ${thay.length}, không thấy ${khongThay.length}.` +
        (khongThay.length ? ` Vắng mặt: ${khongThay.slice(0, 8).join(', ')}` : '')
    );
}

/** Gom kết quả theo số phát hành, giữ nguyên thứ tự gặp đầu tiên. */
function gomTheoSoPhatHanh(danhSach) {
    const theoSo = new Map();
    for (const row of danhSach) {
        const khoa = chuanHoaDeSo(row.soPhatHanh);
        if (!theoSo.has(khoa)) theoSo.set(khoa, { soPhatHanh: row.soPhatHanh, dong: [] });
        theoSo.get(khoa).dong.push(row);
    }
    return Array.from(theoSo.values());
}

/** "tờ 241 thửa 170" — nhãn nhận diện một thửa trong ghi chú gộp. */
function nhanThua(row) {
    const phan = [];
    if (row.soHieuToBanDo) phan.push(`tờ ${row.soHieuToBanDo}`);
    if (row.soThuTuThua) phan.push(`thửa ${row.soThuTuThua}`);
    return phan.join(' ');
}

/**
 * Gộp nội dung của mọi thửa cùng một giấy chứng nhận thành một ô sheet.
 *
 * Mọi thửa cùng kết quả thì ghi đúng một câu, giữ nguyên mẫu chữ cố định để
 * copy sang bảng tổng. Các thửa khác nhau mới chua tờ/thửa vào trước từng
 * phần — nếu không, một giấy có thửa đạt thửa chưa đạt sẽ chỉ còn lại kết quả
 * của một thửa và người đọc không biết là thửa nào.
 */
function gopTheoThua(dong, dungNoiDung) {
    const phan = dong.map((r) => ({ nhan: nhanThua(r), noiDung: dungNoiDung(r) }));
    const khac = new Set(phan.map((p) => p.noiDung));

    if (khac.size <= 1) return phan[0] ? phan[0].noiDung : '';

    return phan
        .filter((p) => p.noiDung)
        .map((p) => (p.nhan ? `${p.nhan}: ${p.noiDung}` : p.noiDung))
        .join(' | ');
}

/**
 * Trạng thái gộp cho cột K (dropdown ba giá trị).
 *
 * Còn một thửa chưa xong thì cả giấy chưa xong — đánh "Hoàn thành" trong khi
 * còn thửa dở là dạng sai nguy hiểm nhất ở bảng tổng, vì không ai rà lại.
 */
function trangThaiGopSheet(dong) {
    const ds = dong.map((r) => TRANG_THAI_SHEET[r.trangThai] || 'Khác');
    if (ds.includes('Chưa hoàn thành')) return 'Chưa hoàn thành';
    if (ds.every((x) => x === 'Hoàn thành')) return 'Hoàn thành';
    return 'Khác';
}

/**
 * Cột Trạng Thái trong sheet dùng dropdown ba lựa chọn. Ghi chuỗi ngoài danh
 * sách đó thì Google Sheets nhận nhưng đánh dấu ô là giá trị không hợp lệ.
 */
const TRANG_THAI_SHEET = {
    [TRANG_THAI.DAT]: 'Hoàn thành',
    [TRANG_THAI.CHUA_DAT]: 'Chưa hoàn thành',
    [TRANG_THAI.KHONG_THAY]: 'Khác',
    [TRANG_THAI.LOI]: 'Khác',
};

/**
 * Nội dung cột Ghi chú, bám theo cột Trạng Thái. Ba khả năng, không hơn.
 *
 *   Hoàn thành       để trống
 *   Khác             không tìm thấy gcn
 *   Chưa hoàn thành  hsq chưa kí số
 *
 * Chi tiết từng hồ sơ nằm ở console, không nhét vào sheet.
 */
/**
 * Nhật ký tra cứu cho cột N.
 *
 * Cột L chỉ nói kết luận ("hsq chưa kí số"), không nói vì sao. Cột N chép lại
 * đúng những gì bảng kết quả trong panel đang hiện, gộp thành một dòng, để mở
 * sheet là biết hồ sơ vướng gì mà sửa, khỏi phải tra lại.
 */
function dungTraCuuSheet(row) {
    const phan = [row.trangThai || ''];

    // Thiếu cái gì đứng ngay đầu chuỗi: đây là thứ người dùng dò mắt nhiều nhất
    // khi mở sheet, đứng sau mã lỗi thô thì phải đọc lướt qua mới thấy.
    const thieu = Array.from(new Set((row.maLois || []).map((m) => m.nhanMaLoi).filter(Boolean)));
    if (thieu.length) phan.push(`Thiếu: ${thieu.join('; ')}`);

    if (row.maLoiGop) phan.push(`mã lỗi ${row.maLoiGop}`);
    if (row.giayChungNhanLoi) phan.push(`GCN lỗi: ${row.giayChungNhanLoi}`);

    // Cùng cách đếm với ô Chữ ký trong bảng, để hai nơi không nói lệch nhau.
    if (row.soFileQuet === '' || row.soFileQuet === undefined) {
        phan.push('chưa kiểm chữ ký');
    } else {
        const soChuaKy = row.fileChuaKy ? row.fileChuaKy.split(' | ').length : 0;
        const soDaKy = row.fileDaKy ? row.fileDaKy.split(' | ').length : 0;
        const tong = soChuaKy + soDaKy;
        if (!tong) phan.push('không có file GCN khớp');
        else if (soChuaKy) phan.push(`${soChuaKy}/${tong} file chưa ký số`);
        else phan.push(`${soDaKy}/${tong} file đã ký số`);
    }

    if (row.daChuyenGcn) phan.push(row.daChuyenGcn);
    if (row.thongBaoHeThong) phan.push(row.thongBaoHeThong);

    return phan.filter(Boolean).join(' · ');
}

/**
 * Hồ sơ có báo "chưa đồng bộ thông tin ba khối" hay không.
 *
 * Dữ liệu thật: "Chưa đồng bộ thông tin ba khối (không có dữ liệu không gian,
 * không có hồ sơ quét)". Câu này xuất hiện cả ở `errorMessages` lẫn
 * `warningMessages` tuỳ hồ sơ, nên soi cả hai. So trên chuỗi đã bỏ dấu để
 * không vỡ khi máy chủ đổi cách viết hoa hay bỏ dấu.
 */
function chuaDongBoBaKhoi(row) {
    const van = boDau(`${row.thongBaoHeThong || ''} ${row.canhBao || ''}`);
    return van.includes('DONG BO') && (van.includes('BA KHOI') || van.includes('3 KHOI'));
}

/**
 * Nội dung cột Ghi chú (L), bám theo trạng thái nhóm 1 của ĐÚNG thửa đó.
 *
 *   Đạt, còn kẹt liên kết không gian   Chưa LKKG _ đã hoàn thành các nội dung khác
 *   Đạt, sạch                          Nhóm 1
 *   Chưa đạt                           liệt kê đang thiếu cái gì
 *   Không tìm thấy / lỗi tra cứu       nêu đúng lý do đó
 *
 * Sheet này copy sang bảng tổng của người khác nên chữ phải cố định, không
 * thêm bớt tuỳ hồ sơ.
 */
function dungGhiChuSheet(row) {
    if (row.trangThai === TRANG_THAI.DAT) {
        return chuaDongBoBaKhoi(row)
            ? 'Chưa LKKG _ đã hoàn thành các nội dung khác'
            : 'Nhóm 1';
    }
    if (row.trangThai === TRANG_THAI.KHONG_THAY) return 'Không tìm thấy số phát hành';
    if (row.trangThai === TRANG_THAI.LOI) return 'Lỗi tra cứu';

    // Chưa đạt: nói thẳng thiếu cái gì, lấy nhãn tiếng Việt của từng mã lỗi.
    const thieu = (row.maLois || []).map((m) => m.nhanMaLoi).filter(Boolean);
    const gop = Array.from(new Set(thieu)).join('; ');
    return gop || 'Chưa đạt nhóm 1';
}

/**
 * Cột O: tình trạng gắn giấy chứng nhận, tách riêng để copy sang bảng tổng.
 *
 * Chưa tick "Kiểm chữ ký số" thì chưa đọc hồ sơ quét lần nào — để trống còn
 * hơn ghi "Không có GCN" trong khi thực ra chưa nhìn.
 */
function dungGanGcnSheet(row) {
    if (row.soFileQuet === '' || row.soFileQuet === undefined) return '';
    if (row.daChuyenGcn === 'Rồi') return 'Đã gắn GCN';
    if (row.daChuyenGcn === 'Chưa') return 'Chưa gắn GCN';
    return 'Không có GCN';
}

/** Đẩy một Blob xuống máy dưới tên đã chọn. */
function luuBlob(blob, ten) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ten;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Ô "Chữ ký" trong bảng: rỗng khi người dùng không bật kiểm chữ ký. */
function oChuKy(r) {
    if (r.soFileQuet === '' || r.soFileQuet === undefined) {
        return '<span class="mls-badge warn" title="Tick ô Kiểm chữ ký số rồi tra lại">chưa kiểm</span>';
    }
    const soChuaKy = r.fileChuaKy ? r.fileChuaKy.split(' | ').length : 0;
    const soDaKy = r.fileDaKy ? r.fileDaKy.split(' | ').length : 0;
    const tong = soChuaKy + soDaKy;

    // Chỉ cần MỘT bản đã ký là đủ báo "Đã ký" — không đòi mọi bản trùng (kể cả
    // bản cũ còn sót trong hồ sơ quét) đều sạch. Người dùng chỉ cần biết giấy
    // chứng nhận này có bản đã ký hay chưa, không cần dọn hết bản trùng.
    // Lưu ý: hệ thống MPLIS (mã lỗi NOSIGN) vẫn có thể chặn nhóm 1 dù badge này
    // báo "Đã ký", nếu còn bản cũ chưa ký nằm trong hồ sơ quét — xem title.
    if (!tong) return `<span class="mls-badge warn">không có GCN khớp</span>`;
    if (soDaKy) {
        return `<span class="mls-badge ok" title="${soDaKy}/${tong} file đã ký số">Đã ký</span>`;
    }
    return `<span class="mls-badge err" title="${soChuaKy}/${tong} file chưa ký số">Chưa ký</span>`;
}

function oSheet(r) {
    if (!r.trangThaiSheet) {
        return '<span class="mls-badge warn">chưa ghi</span>';
    }
    if (r.trangThaiSheet.startsWith('Lỗi')) {
        return `<span class="mls-badge err" title="${escapeHtml(r.trangThaiSheet)}">lỗi</span>`;
    }
    return `<span class="mls-badge ok" title="${escapeHtml(r.trangThaiSheet)}">đã ghi</span>`;
}

function taiCsv() {
    if (!ketQua.length) return;
    downloadText(`ket-qua-nhom1-${timestampSlug()}.csv`, toCsv(ketQua, CSV_HEADERS));
}

/**
 * Gom các dòng kết quả trỏ về cùng một hồ sơ đăng ký.
 *
 * Một giấy chứng nhận có thể phủ nhiều thửa đất. API tra cứu trả mỗi thửa một
 * record, nên `K 550768` cho ra 2 dòng cùng `tinhHinhDangKyId` 13610673 (thửa
 * 117 và 118), cùng giấy `401710_3`. Nếu tải và gắn theo từng dòng thì cùng một
 * file bị tải hai lần và bị gắn hai lần.
 *
 * Bảng kết quả vẫn hiện đủ mọi thửa. Chỉ bước tải file và gắn giấy mới gom lại.
 */
function gomTheoHoSo(dong) {
    const theoHoSo = new Map();
    for (const row of dong) {
        if (!row.tinhHinhDangKyId) continue;
        const khoa = `${row.tinhHinhDangKyId}|${chuanHoaDeSo(row.soPhatHanh)}`;
        const cu = theoHoSo.get(khoa);
        if (cu) {
            cu.thuaGop.push(row);
        } else {
            theoHoSo.set(khoa, Object.assign(Object.create(Object.getPrototypeOf(row)), row, { thuaGop: [row] }));
        }
    }
    return Array.from(theoHoSo.values());
}

/** Bỏ khoảng trắng và viết hoa, để so `DL 242877` với `24349_GCN_DL 242877.pdf`. */
function chuanHoaDeSo(text) {
    return String(text ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Lọc ra file giấy chứng nhận đúng với số phát hành đang tra.
 *
 * Một hồ sơ quét chứa nhiều giấy chứng nhận: dữ liệu thật của hồ sơ 13610680 có
 * cả `24349_GCN_DL 242877.pdf` lẫn `24349_GCN_DL 242878.pdf`. Lọc theo mỗi chữ
 * `GCN` sẽ lấy nhầm cả giấy của thửa khác, nên phải khớp thêm số phát hành.
 *
 * Trả mảng rỗng khi không file nào khớp, thay vì đoán bừa lấy file đầu tiên.
 * Tải nhầm giấy của thửa khác rồi đặt tên theo số phát hành đang tra thì sai
 * nặng hơn nhiều so với không tải gì và báo cho người dùng biết.
 */
function locFileGiayChungNhan(files, soPhatHanh) {
    return files.filter((f) => laGiayChungNhan(f.ten, soPhatHanh));
}

/** Thay biến trong mẫu tên bằng dữ liệu của dòng kết quả và của file. */
function dungTenFile(mau, row, file) {
    const bien = {
        soPhatHanh: row.soPhatHanh,
        // Số phát hành do máy chủ trả về, để đối chiếu với số người dùng đã dán.
        soPhatHanhHeThong: row.thongTinGiayChungNhan,
        tenGoc: file.ten || file.docId,
        trangThaiKy: file.daKySo ? 'da-ky' : 'chua-ky',
        giayChungNhanId: file.giayChungNhanId,
        versionGcn: file.versionGiayChungNhan,
        toBanDo: row.soHieuToBanDo,
        soThua: row.soThuTuThua,
        xaId: row.xaId,
        tinhHinhDangKyId: row.tinhHinhDangKyId,
    };
    const thay = String(mau || MAU_TEN_MAC_DINH).replace(
        /\{(\w+)\}/g,
        (khop, ten) => (ten in bien ? String(bien[ten] ?? '') : khop)
    );
    const ten = lamSachTenFile(thay, `${row.soPhatHanh || 'khong-ten'}.pdf`);
    return /\.pdf$/i.test(ten) ? ten : `${ten}.pdf`;
}

/**
 * Tải toàn bộ file quét của các dòng đã tra được, đổi tên theo mẫu, gói vào một
 * file ZIP.
 *
 * Gói ZIP thay vì tải rời từng file vì trình duyệt chặn việc tải nhiều file
 * liên tiếp: sau file thứ hai nó hỏi quyền, và người dùng phải bấm xác nhận
 * giữa chừng cho từng hồ sơ.
 */
async function taiFileQuet(tuDong = false) {
    if (dangChay && !tuDong) return;

    const dongCanTai = gomTheoHoSo(ketQua);
    if (!dongCanTai.length) {
        datTrangThai('Không có hồ sơ nào để tải. Tra cứu trước đã.');
        return;
    }

    const mau = document.getElementById('mls-mauten').value.trim() || MAU_TEN_MAC_DINH;
    const chiGcn = document.getElementById('mls-chigcn').checked;
    const chiChuaKy = document.getElementById('mls-chichuaky').checked;
    const taiRoi = document.getElementById('mls-tairoi').checked;
    const hoiChon = document.getElementById('mls-hoichon').checked;

    dangChay = true;
    yeuCauDung = false;
    datNut(true);
    datTienDo(0, dongCanTai.length);
    ghiNhatKy(`Tải file: bắt đầu ${dongCanTai.length} hồ sơ`);

    const tep = [];
    const tenDaDung = new Set();
    const docIdDaTai = new Set();
    const loi = [];
    let daXong = 0;
    let boQuaDaKy = 0;
    let boQua = 0;

    for (const row of dongCanTai) {
        if (yeuCauDung) break;
        datTrangThai(`Đang tải file quét ${daXong + 1}/${dongCanTai.length}: ${row.soPhatHanh}`, true);

        try {
            // Quyết định tải file nào TRƯỚC khi tải, để không kéo về những file
            // sẽ bị loại ngay sau đó.
            // Lấy danh sách trước, lọc sau: quyết định file nào là giấy chứng
            // nhận cần biết cả bộ, vì bước lọc theo số phát hành chỉ áp dụng khi
            // có tên nào mang số.
            const soBo = await kiemTraChuKyTheoDangKy(row.tinhHinhDangKyId);
            const gcnBo = locFileGiayChungNhan(soBo, row.soPhatHanh);
            let ungVien = (chiGcn ? gcnBo : soBo).filter((f) => !(chiChuaKy && f.daKySo));

            if (chiGcn && ungVien.length > 1 && tuDong) {
                canXemTay.push(
                    `${row.soPhatHanh}: ${ungVien.length} file cùng là giấy chứng nhận, ` +
                    `chưa tải — ${ungVien.map((f) => f.ten || f.docId).join(' / ')}`
                );
                boQua += 1;
                daXong += 1;
                datTienDo(daXong, dongCanTai.length);
                continue;
            }

            if (hoiChon && chiGcn && ungVien.length > 1) {
                const chon = await hoiChonFile(row, ungVien);
                if (chon === null) {
                    yeuCauDung = true;
                    break;
                }
                ungVien = ungVien.filter((f) => chon.includes(f.docId));
                if (!ungVien.length) {
                    boQua += 1;
                    daXong += 1;
                    datTienDo(daXong, dongCanTai.length);
                    continue;
                }
            }

            const canTaiId = new Set(ungVien.map((f) => f.docId));

            const files = await kiemTraChuKyTheoDangKy(
                row.tinhHinhDangKyId, true, (f) => canTaiId.has(f.docId)
            );
            const gcn = locFileGiayChungNhan(files, row.soPhatHanh);

            row.soFileQuet = files.length;
            row.soFileGcn = gcn.length;
            row.tenMoiFileQuet = files
                .map((f) => `${laGiayChungNhan(f.ten, row.soPhatHanh) ? '[GCN] ' : ''}${f.ten || f.docId}`)
                .join(' / ');
            row.daChuyenGcn = gcn.length
                ? (gcn.every((f) => f.laGiayChungNhan) ? 'Rồi' : 'Chưa')
                : '';
            row.fileDaKy = gcn.filter((f) => f.daKySo).map((f) => f.ten || f.docId).join(' | ');
            row.fileChuaKy = gcn.filter((f) => !f.daKySo).map((f) => f.ten || f.docId).join(' | ');

            const canLay = files.filter((f) => canTaiId.has(f.docId));

            if (chiGcn && !gcn.length && files.length) {
                loi.push(
                    `${row.soPhatHanh}: không nhận ra file giấy chứng nhận trong ${files.length} file: ` +
                    files.map((f) => f.ten || f.docId).join(' / ')
                );
            } else if (!canLay.length && gcn.length && chiChuaKy) {
                boQuaDaKy += 1;
            }

            for (const file of canLay) {
                if (!file.bytes) {
                    const vi = file.loi || 'không tải được';
                    loi.push(`${row.soPhatHanh}: ${file.ten || file.docId} ${vi}`);
                    continue;
                }
                if (file.laPdf === false) {
                    loi.push(`${row.soPhatHanh}: ${file.ten || file.docId} tải về không phải PDF`);
                    continue;
                }
                if (docIdDaTai.has(file.docId)) continue;
                docIdDaTai.add(file.docId);
                const tenTai = tenKhongTrung(dungTenFile(mau, row, file), tenDaDung);
                tep.push({ ten: tenTai, bytes: file.bytes });
                ghiNhatKy(`Tải file ✓ ${row.soPhatHanh}: ${file.ten || file.docId} → ${tenTai}`, 'ok');
            }
        } catch (err) {
            const vi = err && err.message ? err.message : String(err);
            loi.push(`${row.soPhatHanh}: ${vi}`);
            ghiNhatKy(`Tải file ✗ ${row.soPhatHanh}: ${vi}`, 'err');
        }

        daXong += 1;
        datTienDo(daXong, dongCanTai.length);
        veKetQua();
    }

    dangChay = false;
    datNut(false);

    if (!tep.length) {
        const vi = boQuaDaKy
            ? `Không có file nào cần tải: ${boQuaDaKy} hồ sơ đã ký số hết.`
            : `Không tải được file nào. ${loi.slice(0, 2).join('; ')}`;
        ghiNhatKy(`Tải file: ${vi}`, 'warn');
        datTrangThai(vi);
        return;
    }

    moNhom(`Tải file: ${tep.length} file từ ${daXong} hồ sơ`);
    bang('File đã tải', tep.map((t) => ({ 'Tên': t.ten, 'KB': Math.round(t.bytes.length / 1024) })));
    bang('File bỏ qua', loi.map((t) => ({ 'Chi tiết': t })));
    dongNhom();

    const tongByte = tep.reduce((n, t) => n + t.bytes.length, 0);
    const mb = (tongByte / 1024 / 1024).toFixed(1);
    const duoi = (boQuaDaKy ? ` Bỏ ${boQuaDaKy} hồ sơ đã ký số.` : '') +
        (loi.length ? ` Bỏ qua ${loi.length} file lỗi.` : '');

    if (taiRoi) {
        for (const t of tep) {
            luuBlob(new Blob([t.bytes], { type: 'application/pdf' }), t.ten);
            // Giãn nhịp để trình duyệt kịp xử lý từng lượt tải.
            await sleep(300);
        }
        ghiNhatKy(`Tải file: xong ${tep.length} file rời (${mb} MB)`, 'ok');
        datTrangThai(`Đã tải ${tep.length} file rời (${mb} MB) từ ${daXong} hồ sơ.${duoi}`);
        await tuGhiSheetNeuBat();
        return;
    }

    luuBlob(taoZip(tep), `ho-so-quet-${timestampSlug()}.zip`);
    ghiNhatKy(`Tải file: xong ${tep.length} file trong 1 ZIP (${mb} MB)`, 'ok');
    datTrangThai(`Đã gói ${tep.length} file (${mb} MB) từ ${daXong} hồ sơ.${duoi}`);
    await tuGhiSheetNeuBat();
}

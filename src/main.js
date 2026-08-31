import { taoPanel, nguoiDungDaDong } from './panel.js';
import { kiemTraChuKyTheoDocId, docDanhSachFileQuetTuDom } from './pdf-sign.js';
import { bocMaLoi, tachGiayChungNhanKey, bocFileQuetTuJson, bocHoSoQuetGoc } from './parse.js';
import { dungPayloadGanGiay, guiGanGiay, kiemTraAnToan } from './gan-giay.js';
import { timTheoSoPhatHanh, layThongTinDangKy, urlTaiFileQuet } from './api.js';

/**
 * Chặn userscript chạy hai lần trên cùng một trang.
 *
 * Tampermonkey giữ lại bản cũ khi bạn cài bản mới mà chưa gỡ, và cả hai cùng
 * khớp `@match`. Không có khoá này thì mỗi bản dựng một panel, tự tạo lại lẫn
 * nhau khi người dùng đóng.
 */
const KHOA = '__MLS_DA_CHAY__';

function khoiTao() {
    const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (w[KHOA]) {
        console.warn('[MPLIS Làm sạch] Đã có một bản đang chạy, bản này dừng lại. Gỡ bản userscript thừa trong Tampermonkey.');
        return;
    }
    w[KHOA] = true;

    taoPanel();

    // MPLIS là ứng dụng một trang: chuyển màn có thể xoá panel khỏi DOM. Dựng lại
    // khi đó, nhưng tôn trọng nút Đóng — người dùng đóng thì để yên.
    setInterval(() => {
        if (!nguoiDungDaDong() && !document.getElementById('mls-panel')) taoPanel();
    }, 5000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', khoiTao);
} else {
    khoiTao();
}

/**
 * Mở cho console để thử tay từng mảnh.
 *
 * `dungPayloadGanGiay` và `guiGanGiay` ghi dữ liệu lên MPLIS. Luôn xem
 * `kiemTraAnToan(payload)` trước khi gửi — nó là thứ chặn payload làm mất file.
 */
window.MLS = {
    timTheoSoPhatHanh,
    layThongTinDangKy,
    urlTaiFileQuet,
    kiemTraChuKyTheoDocId,
    docDanhSachFileQuetTuDom,
    bocMaLoi,
    tachGiayChungNhanKey,
    bocFileQuetTuJson,
    bocHoSoQuetGoc,
    dungPayloadGanGiay,
    kiemTraAnToan,
    guiGanGiay,
};

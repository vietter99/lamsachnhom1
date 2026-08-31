/**
 * Log ra console trình duyệt.
 *
 * Sheet chỉ giữ ba trạng thái gọn để lọc. Mọi chi tiết cần khi có sự cố — hồ sơ
 * nào lỗi, lỗi gì, payload ra sao — đổ hết ra đây, nơi chứa được nhiều mà không
 * làm rối bảng tính.
 *
 * Mở console bằng F12, lọc theo chữ MLS.
 */
const TIEN_TO = '%c[MLS]';
const KIEU = 'background:#1E40AF;color:#fff;padding:1px 5px;border-radius:3px';

export function log(...phan) {
    console.log(TIEN_TO, KIEU, ...phan);
}

export function canhBao(...phan) {
    console.warn(TIEN_TO, KIEU, ...phan);
}

export function loi(...phan) {
    console.error(TIEN_TO, KIEU, ...phan);
}

/** Mở một nhóm gập được cho một lượt chạy. */
export function moNhom(ten) {
    console.groupCollapsed(TIEN_TO + ' ' + ten, KIEU);
}

export function dongNhom() {
    console.groupEnd();
}

/**
 * In bảng khi có dữ liệu, in dòng chữ khi rỗng.
 * `console.table([])` in ra bảng trống trông như lỗi.
 */
export function bang(ten, hang) {
    if (!hang || !hang.length) {
        log(`${ten}: không có`);
        return;
    }
    log(`${ten}: ${hang.length}`);
    console.table(hang);
}

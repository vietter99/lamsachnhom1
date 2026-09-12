/**
 * Cầu nối sang Google Sheets.
 *
 * Userscript không gọi thẳng Google Sheets API được: hết CORS lại đến đăng nhập.
 * Đường vòng là một Apps Script Web App do chính người dùng triển khai trong tài
 * khoản của mình, nhận JSON rồi tự ghi vào sheet. Tool cũ `autovbdlis` dùng đúng
 * lối này.
 *
 * `GM_xmlhttpRequest` bỏ qua ràng buộc CORS, nhưng chỉ với miền đã khai trong
 * `@connect` ở phần đầu userscript.
 *
 * Mã Apps Script mẫu nằm ở `apps-script/Code.gs`.
 */
const KHOA_URL = 'mls-sheet-url';

export function docUrlSheet() {
    try {
        return localStorage.getItem(KHOA_URL) || '';
    } catch {
        return '';
    }
}

export function luuUrlSheet(url) {
    try {
        localStorage.setItem(KHOA_URL, String(url || '').trim());
    } catch {
        // localStorage bị chặn thì bỏ qua; URL vẫn dùng được trong phiên này.
    }
}

/**
 * Đẩy một dòng kết quả lên sheet.
 *
 * `ghiChu` là kết luận ngắn cho cột L. `traCuu` là nhật ký tra cứu đầy đủ cho
 * cột N, để người làm biết hồ sơ vướng gì mà sửa. `ganGcn` là tình trạng gắn
 * giấy chứng nhận cho cột O, tách riêng để copy sang bảng tổng của người khác.
 *
 * `to` và `thua` gửi kèm để Apps Script dò đúng dòng: một giấy chứng nhận phủ
 * nhiều thửa, mỗi thửa một dòng riêng và trạng thái nhóm 1 riêng, dò mỗi số
 * phát hành thì ghi đè lung tung sang thửa khác.
 * Trả về `{ ok, loi }`; không ném lỗi, để một hồ sơ hỏng không chặn cả lượt chạy.
 */
export function ghiVaoSheet(row, o = {}) {
    return new Promise((resolve) => {
        const url = docUrlSheet();
        if (!url) return resolve({ ok: false, loi: 'Chưa cấu hình URL Apps Script' });
        if (typeof GM_xmlhttpRequest === 'undefined') {
            return resolve({ ok: false, loi: 'Userscript thiếu quyền GM_xmlhttpRequest' });
        }

        const payload = {
            thu: Boolean(row.thu),
            danhSach: Array.isArray(row.danhSach) ? row.danhSach : undefined,
            soPhatHanh: row.soPhatHanh || '',
            // Tờ và thửa để Apps Script dò đúng dòng: một giấy phủ nhiều thửa,
            // mỗi thửa một dòng riêng và trạng thái nhóm 1 riêng.
            to: row.soHieuToBanDo || '',
            thua: row.soThuTuThua || '',
            tinhHinhDangKyId: row.tinhHinhDangKyId || '',
            thongTinThieu: o.thongTinThieu || '',
            ganGcn: o.ganGcn || '',
            ketLuan: o.ketLuan || '',
            thoiDiem: new Date().toISOString(),
        };

        GM_xmlhttpRequest({
            method: 'POST',
            url,
            data: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            onload: (res) => {
                let body;
                try {
                    body = JSON.parse(res.responseText);
                } catch {
                    // Apps Script chưa triển khai, hoặc URL trỏ vào trang đăng nhập
                    // Google, thì trả về HTML chứ không phải JSON.
                    const dau = String(res.responseText || '').slice(0, 120);
                    return resolve({
                        ok: false,
                        loi: /<html/i.test(dau)
                            ? 'URL trả về trang HTML, không phải Apps Script. Kiểm tra quyền truy cập phải là "Bất kỳ ai" và URL kết thúc bằng /exec'
                            : `Phản hồi lạ: ${dau}`,
                    });
                }
                resolve(body.ok
                    ? { ok: true, chiTiet: body }
                    : { ok: false, loi: body.error || 'Apps Script từ chối' });
            },
            onerror: () => resolve({ ok: false, loi: 'Không kết nối được Apps Script' }),
            ontimeout: () => resolve({ ok: false, loi: 'Apps Script quá hạn phản hồi' }),
            timeout: 15000,
        });
    });
}

/**
 * Dựng một trang tĩnh để xem giao diện panel mà không cần cài Tampermonkey.
 *
 * Markup lấy thẳng từ chuỗi `panel.innerHTML` trong `src/panel.js`, CSS và icon
 * lấy từ module của chúng. Không có bản sao nào ở đây, nên trang xem trước không
 * lệch được với bản chạy thật.
 *
 *   npm run preview   →   preview/index.html
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { PANEL_CSS } from './src/panel-style.js';
import { ICONS } from './src/icons.js';

const MAU_TEN_MAC_DINH = 'Giấy chứng nhận {soPhatHanh}.pdf';

/** Cắt chuỗi template `panel.innerHTML = \`...\`` ra khỏi mã nguồn. */
function layMarkup() {
    const src = readFileSync('src/panel.js', 'utf8');
    const moc = 'panel.innerHTML = `';
    const dau = src.indexOf(moc);
    if (dau < 0) throw new Error('Không tìm thấy khối panel.innerHTML trong src/panel.js');
    const batDau = dau + moc.length;
    const cuoi = src.indexOf('\n    `;', batDau);
    if (cuoi < 0) throw new Error('Không tìm thấy dấu kết thúc khối panel.innerHTML');
    return src.slice(batDau, cuoi);
}

/** Thay các biểu thức `${...}` bằng giá trị tĩnh tương ứng. */
function thayBien(markup) {
    return markup
        .replace(/\$\{ICONS\.(\w+)\}/g, (_, ten) => ICONS[ten] || '')
        .replace(/\$\{escapeHtml\(MAU_TEN_MAC_DINH\)\}/g, MAU_TEN_MAC_DINH)
        .replace(/\$\{escapeHtml\(docUrlSheet\(\)\)\}/g, '');
}

const DONG_MAU = [
    { so: 'DL 242877', trangThai: 'Chưa đạt nhóm 1', muc: 'warn', loi: 'Tình hình đăng ký 13610685 có giấy chứng nhận 2304884_1 có hồ sơ quét chưa ký số', md: null, ky: ['err', 'Chưa ký'], sheet: ['ok', 'đã ghi'] },
    { so: 'CH 655063', trangThai: 'Chưa đạt nhóm 1', muc: 'warn', loi: 'Tình hình đăng ký 13610646 có giấy chứng nhận 2292635_3 có hồ sơ quét chưa liên kết giấy chứng nhận', md: null, ky: ['err', 'Chưa ký'], sheet: ['ok', 'đã ghi'] },
    { so: 'K 550768', trangThai: 'Đạt nhóm 1', muc: 'ok', loi: '', md: null, ky: ['ok', 'Đã ký'], sheet: ['ok', 'đã ghi'] },
    { so: 'AC 491772', trangThai: 'Chưa đạt nhóm 1', muc: 'warn', loi: 'Tình hình đăng ký 13609970 có hộ gia đình 1723401_0 có cá nhân 15517072_0 không có mã định danh cá nhân', md: { ten: 'Hoàng Minh Bính', so: ['042064006947', '042064006974'] }, ky: ['err', 'Chưa ký'], sheet: ['warn', 'chưa ghi'] },
    { so: 'DL 243100', trangThai: 'Không tìm thấy', muc: 'err', loi: '', md: null, ky: null, sheet: ['warn', 'chưa ghi'] },
    { so: 'DL 243155', trangThai: 'Lỗi tra cứu', muc: 'err', loi: 'HTTP 500 Internal Server Error tại /LamSachDuLieuAjax/GetThongKePhanLoaiThuaDatChiTiet', md: null, ky: null, sheet: ['err', 'lỗi'] },
];

const trong = '<span aria-hidden="true">—</span>';

const hangBang = DONG_MAU.map((r) => {
    let oMaDinhDanh = trong;
    if (r.md) {
        const oTen = `<div class="mls-madinhdanh-ten">${r.md.ten}</div>`;
        const oChon = r.md.so.length > 1
            ? `<select class="mls-madinhdanh-chon">${r.md.so.map((s, i) => `<option ${i === 0 ? 'selected' : ''}>${s}</option>`).join('')}</select>
                <span class="mls-hint">${r.md.so.length} số cùng tên, tự chọn đúng</span>`
            : `<code>${r.md.so[0]}</code>`;
        oMaDinhDanh = `<div class="mls-madinhdanh">${oTen}${oChon}</div>`;
    }
    return `<tr>
                <td>${r.so}</td>
                <td class="mls-badge-cell"><span class="mls-badge ${r.muc}">${r.trangThai}</span></td>
                <td>${r.loi || trong}</td>
                <td>${oMaDinhDanh}</td>
                <td class="mls-badge-cell">${r.ky ? `<span class="mls-badge ${r.ky[0]}">${r.ky[1]}</span>` : trong}</td>
                <td class="mls-badge-cell">${r.sheet ? `<span class="mls-badge ${r.sheet[0]}">${r.sheet[1]}</span>` : trong}</td>
            </tr>`;
}).join('\n');

const bangKetQua = `<div class="mls-table-wrap">
            <table>
                <thead>
                    <tr>
                        <th scope="col">Số phát hành</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Báo lỗi</th>
                        <th scope="col">Mã định danh</th>
                        <th scope="col">Chữ ký</th>
                        <th scope="col">Sheet</th>
                    </tr>
                </thead>
                <tbody>
${hangBang}
                </tbody>
            </table>
        </div>`;

const thongKe = `<button type="button" class="mls-stat ok" data-trangthai="Đạt nhóm 1" aria-pressed="false"><b>1</b><span>Đạt</span></button>
            <button type="button" class="mls-stat warn" data-trangthai="Chưa đạt nhóm 1" aria-pressed="false"><b>3</b><span>Chưa đạt</span></button>
            <button type="button" class="mls-stat err" data-trangthai="Không tìm thấy" aria-pressed="false"><b>1</b><span>Không thấy</span></button>
            <button type="button" class="mls-stat err" data-trangthai="Lỗi tra cứu" aria-pressed="false"><b>1</b><span>Lỗi</span></button>`;

// Đổ dữ liệu mẫu vào các vùng mà bản thật điền lúc chạy.
const than = thayBien(layMarkup())
    .replace('<div class="mls-stats" id="mls-stats" hidden></div>',
        `<div class="mls-stats" id="mls-stats">${thongKe}</div>`)
    .replace('<div id="mls-ketqua"></div>', `<div id="mls-ketqua">${bangKetQua}</div>`)
    .replace('aria-valuenow="0"', 'aria-valuenow="67"')
    .replace('aria-label="Tiến độ"><span></span>', 'aria-label="Tiến độ"><span style="width:67%"></span>')
    .replace('Dán danh sách số phát hành rồi bấm Tra cứu.',
        '<span class="mls-spinner"></span>Đang tra 4/6: AC 491066');

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Xem trước giao diện · MPLIS Làm sạch nhóm 1</title>
<style>
    body {
        margin: 0;
        min-height: 100vh;
        padding: 32px;
        background: #E2E8F0;
        font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
        color: #1E293B;
    }
    .ghi-chu { max-width: 620px; font-size: 14px; line-height: 1.6; }
    .ghi-chu h1 { font-size: 18px; margin: 0 0 8px; }
    .ghi-chu p { margin: 0 0 8px; color: #4B5563; }
${PANEL_CSS}
</style>
</head>
<body>
<div class="ghi-chu">
    <h1>Xem trước giao diện</h1>
    <p>Trang này chỉ để nhìn. Nút không chạy, dữ liệu trong bảng là dữ liệu giả.</p>
    <p>Markup lấy thẳng từ <code>src/panel.js</code>, nên nó luôn khớp bản chạy thật trong Tampermonkey.</p>
</div>

<section id="mls-panel" aria-label="Công cụ tra cứu làm sạch nhóm 1">
${than}
</section>
</body>
</html>
`;

mkdirSync('preview', { recursive: true });
writeFileSync('preview/index.html', html, 'utf8');
console.log('Built preview/index.html');

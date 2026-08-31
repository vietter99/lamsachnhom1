import { getVerificationToken } from './utils.js';

// Tính khi gọi, không tính lúc nạp module, để module còn nạp được ngoài trình duyệt (chạy test).
const base = () => `${location.origin}/dc`;

function commonHeaders(contentType) {
    return {
        'content-type': contentType,
        accept: '*/*',
        'x-requested-with': 'XMLHttpRequest',
        __requestverificationtoken: getVerificationToken(),
    };
}

async function postForm(path, bodyParams) {
    const body = new URLSearchParams(bodyParams).toString();
    const res = await fetch(`${base()}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: commonHeaders('application/x-www-form-urlencoded; charset=UTF-8'),
        body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} tại ${path}`);
    return res.json();
}

async function postJson(path, payload) {
    const res = await fetch(`${base()}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: commonHeaders('application/json; charset=UTF-8'),
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} tại ${path}`);
    return res.json();
}

/**
 * Tra cứu thửa đất theo số phát hành giấy chứng nhận.
 * scope: { tinhId, huyenId, xaId } — xaId để rỗng nghĩa là tìm toàn huyện.
 */
export function timTheoSoPhatHanh(soPhatHanh, scope) {
    return postForm('/LamSachDuLieuAjax/GetThongKePhanLoaiThuaDatChiTiet', {
        'traCuu[soThuTuThua]': '',
        'traCuu[soHieuToBanDo]': '',
        'traCuu[soPhatHanh]': soPhatHanh,
        'traCuu[hoTenChu]': '',
        'traCuu[phanLoai]': '-1',
        'traCuu[type]': '-1',
        'traCuu[loaiChu]': '-1',
        'traCuu[tuNgay]': '',
        'traCuu[denNgay]': '',
        'traCuu[query]': '',
        'traCuu[xaId]': scope.xaId ?? '',
        'traCuu[huyenId]': scope.huyenId ?? '',
        'traCuu[tinhId]': scope.tinhId ?? '',
        start: '0',
        length: '10',
        exportWard: 'false',
        subLength: '3000',
        'sort[Field]': '_id',
        'sort[Direction]': '1',
    });
}

/**
 * Tìm hồ sơ tiếp nhận (một cửa) theo tên chủ, để lấy số CMND/CCCD khi thiếu mã
 * định danh cá nhân trên hồ sơ đăng ký.
 *
 * Không lọc theo xaId: quét xã có thể sáp nhập/đổi mã sau khi hồ sơ tiếp nhận
 * được tạo, lọc xã dễ bỏ sót đúng hồ sơ. Lọc theo tỉnh/huyện là đủ, còn lại để
 * người gọi tự đối chiếu qua tên và địa chỉ trong kết quả trả về.
 *
 * scope: { tinhId, huyenId }.
 */
export function timHoSoTiepNhan(hoTen, scope) {
    return postForm('/DangKyAjax/AdvancedSearchHoSoTiepNhan', [
        ['start', '0'],
        ['length', '10'],
        ['model[tinhId]', scope.tinhId ?? ''],
        ['model[huyenId]', scope.huyenId ?? ''],
        ['model[xaId]', ''],
        ['model[quytrinh]', ''],
        ['model[state]', ''],
        ['model[soBienNhan]', ''],
        ['model[laHoSoMotCua]', 'false'],
        ['model[tiepNhanTuNgay]', ''],
        ['model[tiepNhanDenNgay]', ''],
        ['model[henTraTuNgay]', ''],
        ['model[henTraDenNgay]', ''],
        ['model[trangThaiHoSo]', '0'],
        ['model[trangThaiKetISO][]', '0'],
        ['model[diaChiTaiSan]', ''],
        ['model[soThua]', ''],
        ['model[soTo]', ''],
        ['model[hoTen]', hoTen],
        ['model[soDienThoai]', ''],
        ['model[giayChungMinh]', ''],
        ['model[daXuLy]', '-1'],
    ]);
}

/** Lấy chi tiết đăng ký (kèm danh sách giấy chứng nhận) theo tinhHinhDangKyId. */
export function layThongTinDangKy(tinhHinhDangKyIds) {
    return postJson('/LamSachDuLieuAjax/GetThongTinDangKyNhom1', {
        tinhHinhDangKyIds,
        bGetThongTinDangKy: true,
    });
}

/** Lấy danh sách hồ sơ quét kê khai của một tình hình đăng ký. */
export function layHoSoQuet(tinhHinhDangKyId, giaoDichBaoDamId = 0) {
    return postJson('/HoSoQuetAjax/GetHoSoQuetKeKhaiByTinhHinhDangKyId', {
        tinhHinhDangKyId: Number(tinhHinhDangKyId),
        giaoDichBaoDamId,
    });
}

/**
 * Kiểm tra chữ ký số sống cho mọi file của một hoặc nhiều hồ sơ quét.
 *
 * MPLIS dùng đúng API này cho nút "kiểm tra" trên giao diện của họ. Khác với
 * cờ `daKySo` đọc từ `GetHoSoQuetKeKhaiByTinhHinhDangKyId` — cờ đó là dữ liệu
 * cache, ghi nhận thật cho thấy có độ trễ so với trạng thái ký thật. API này
 * kiểm tra ngay lúc gọi, không đợi bên nào đồng bộ.
 */
export function kiemTraFileHoSoQuet(hoSoQuetIds) {
    const ds = (Array.isArray(hoSoQuetIds) ? hoSoQuetIds : [hoSoQuetIds]).map(String);
    if (!ds.length) throw new Error('Thiếu hoSoQuetId để kiểm tra chữ ký');
    return postJson('/HoSoQuetAjax/KiemTraFileHoSoQuet', { hoSoQuetIds: ds });
}

/**
 * Cập nhật hồ sơ quét: gắn file vào giấy chứng nhận, đổi mô tả.
 *
 * GHI DỮ LIỆU. Không gọi hàm này ngoài luồng đã được người dùng xác nhận.
 *
 * Máy chủ nhận multipart với một part `hoSoQuet` (object hồ sơ gốc), rồi
 * `infoHoSoQuet_1`…`infoHoSoQuet_N` cho **toàn bộ** file của hồ sơ, kèm `count`.
 * Gửi thiếu part đồng nghĩa với việc bỏ file đó ra khỏi hồ sơ, nên `danhSachFile`
 * phải là danh sách đầy đủ, không phải chỉ những file vừa sửa.
 */
export function capNhatHoSoQuet(hoSoQuet, danhSachFile, isLuuKhoHoSoQuet = false) {
    if (!hoSoQuet) throw new Error('Thiếu object hồ sơ quét gốc');
    if (!Array.isArray(danhSachFile) || !danhSachFile.length) {
        throw new Error('Danh sách file rỗng: từ chối gửi để không xoá sạch hồ sơ');
    }

    const form = new FormData();
    form.append('hoSoQuet', JSON.stringify(hoSoQuet));
    danhSachFile.forEach((file, i) => {
        form.append(`infoHoSoQuet_${i + 1}`, JSON.stringify(file));
    });
    form.append('count', String(danhSachFile.length));
    form.append('isLuuKhoHoSoQuet', String(isLuuKhoHoSoQuet));

    // Không tự đặt content-type: trình duyệt phải tự sinh boundary cho FormData.
    return fetch(`${base()}/HoSoQuetAjax/UpdateHoSoQuetExistFile`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            accept: '*/*',
            'x-requested-with': 'XMLHttpRequest',
            __requestverificationtoken: getVerificationToken(),
        },
        body: form,
    }).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} khi cập nhật hồ sơ quét`);
        return res.json().catch(() => ({ success: true }));
    });
}

/**
 * Gửi yêu cầu phân loại lại cho một hoặc nhiều thửa đất.
 *
 * GHI DỮ LIỆU. Đây là bước cuối sau khi đã sửa xong dữ liệu thiếu: nó bảo hệ
 * thống chấm lại hồ sơ để đổi trạng thái sang chờ phân loại.
 *
 * MPLIS gửi mỗi lần một thửa (`{"thuaDatIds":[3097809]}`) dù trường là mảng.
 * Tool bắt chước đúng vậy thay vì gộp, vì chưa quan sát được máy chủ xử lý mảng
 * nhiều phần tử ra sao.
 */
export function guiYeuCauPhanLoaiLai(thuaDatIds) {
    const ds = (Array.isArray(thuaDatIds) ? thuaDatIds : [thuaDatIds])
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0);
    if (!ds.length) throw new Error('Không có thửa đất nào để gửi yêu cầu');
    return postJson('/LamSachDuLieuAjax/GuiYeuCauPhanLoaiLai', { thuaDatIds: ds });
}

/** URL tải file hồ sơ quét. docId lấy từ thuộc tính data-nodeid của li.filehosoquet. */
export function urlTaiFileQuet(docId, mimeType = 'application/pdf') {
    return `${base()}/Handlers/FileHandler.ashx?DocId=${encodeURIComponent(docId)}&MimeType=${encodeURIComponent(mimeType)}`;
}

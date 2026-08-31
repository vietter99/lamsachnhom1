import { urlTaiFileQuet, layHoSoQuet, kiemTraFileHoSoQuet } from './api.js';
import { bocFileQuetTuJson, bocKetQuaKiemTraFile } from './parse.js';
import { canhBao } from './log.js';

/**
 * Nhận diện chữ ký số trong file PDF mà không cần mở trình xem.
 *
 * Một PDF đã ký luôn chứa một signature dictionary với khoá /ByteRange và
 * /SubFilter. Ta quét bytes tìm các chuỗi đó thay vì dựng cây đối tượng PDF:
 * đủ để phân biệt đã ký / chưa ký, và không cần thư viện ngoài.
 *
 * Giới hạn đã biết: hàm này chỉ trả lời "có chữ ký số hay không". Nó KHÔNG
 * kiểm tra chữ ký còn hợp lệ, chứng thư còn hạn, hay nội dung có bị sửa sau
 * khi ký. Đừng dùng kết quả này thay cho việc thẩm định chữ ký.
 */

const DAU_HIEU_CHU_KY = ['/ByteRange'];
const DAU_HIEU_SUBFILTER = [
    'adbe.pkcs7.detached',
    'adbe.pkcs7.sha1',
    'adbe.x509.rsa_sha1',
    'ETSI.CAdES.detached',
    'ETSI.RFC3161',
];

function bytesToLatin1(bytes) {
    let out = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return out;
}

/** Kiểm tra bytes PDF đã tải sẵn. */
export function kiemTraChuKyTrongBytes(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const text = bytesToLatin1(bytes);

    const laPdf = text.startsWith('%PDF-');
    const coByteRange = DAU_HIEU_CHU_KY.some((s) => text.includes(s));
    const subFilter = DAU_HIEU_SUBFILTER.find((s) => text.includes(s)) || '';

    return {
        laPdf,
        daKySo: coByteRange && Boolean(subFilter),
        coByteRange,
        subFilter,
        kichThuoc: bytes.length,
    };
}

/** Tải file hồ sơ quét theo docId rồi kiểm tra chữ ký. */
export async function kiemTraChuKyTheoDocId(docId) {
    const res = await fetch(urlTaiFileQuet(docId), { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status} khi tải file ${docId}`);
    const buffer = await res.arrayBuffer();
    return kiemTraChuKyTrongBytes(buffer);
}

/**
 * Thử lần lượt các GUID ứng viên tới khi máy chủ trả về đúng một PDF.
 *
 * Ta chưa biết trường nào trong phản hồi là `DocId` mà `FileHandler.ashx` chấp
 * nhận, nên thay vì đoán, cứ thử và để nội dung trả về tự xác nhận: file bắt
 * đầu bằng `%PDF-` là đúng, còn lại là sai GUID (máy chủ trả HTML lỗi).
 */
/** Tải một file quét về dạng bytes, kèm kết quả soi chữ ký trong nội dung. */
export async function taiVaSoiFile(docId) {
    const res = await fetch(urlTaiFileQuet(docId), { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status} khi tải file ${docId}`);
    const buffer = await res.arrayBuffer();
    return { ...kiemTraChuKyTrongBytes(buffer), bytes: new Uint8Array(buffer) };
}

/**
 * Lấy danh sách file quét của một tình hình đăng ký.
 *
 * Trạng thái ký số đọc thẳng từ cờ `daKySo` trong phản hồi API, không cần tải
 * file về. Trước đây hàm này tải từng PDF chỉ để soi chữ ký; dữ liệu thật cho
 * thấy máy chủ đã trả sẵn cờ đó, nên bỏ hẳn vòng tải cho nhanh.
 *
 * Truyền `taiBytes = true` khi thật sự cần nội dung file (lúc gói ZIP). Khi đó
 * hàm cũng soi chữ ký trong bytes và ghi vào `kySoTrongFile` để đối chiếu với
 * cờ của máy chủ.
 */
export async function kiemTraChuKyTheoDangKy(tinhHinhDangKyId, taiBytes = false, locTruocKhiTai = null) {
    const res = await layHoSoQuet(tinhHinhDangKyId);
    const files = bocFileQuetTuJson(res).map((f) => ({
        ...f,
        laPdf: null,
        kichThuoc: 0,
        kySoTrongFile: null,
        bytes: null,
        loi: '',
    }));

    // Đè cờ daKySo cache bằng kết quả kiểm tra sống của chính MPLIS (API đứng
    // sau nút "kiểm tra" trên UI của họ). Lỗi ở bước này (mất mạng, API đổi...)
    // thì giữ nguyên cờ cache, không chặn cả lượt tra cứu vì một API phụ.
    const dsHoSoQuetId = [...new Set(files.map((f) => f.hoSoQuetId).filter(Boolean))];
    if (dsHoSoQuetId.length) {
        try {
            const resKiemTra = await kiemTraFileHoSoQuet(dsHoSoQuetId);
            const dsKetQua = bocKetQuaKiemTraFile(resKiemTra);
            const theoFileId = new Map(dsKetQua.map((f) => [String(f.fileId), f]));

            let soKhop = 0;
            for (const f of files) {
                const kt = theoFileId.get(String(f.docId));
                if (kt) {
                    f.daKySo = kt.daKySo === true;
                    soKhop += 1;
                }
            }

            // dsKetQua có dữ liệu nhưng không khớp file nào theo docId/fileId thì
            // hai bên đang không cùng không gian id — im lặng bỏ qua sẽ khiến cờ
            // cache cũ (có thể sai) tồn tại mãi mà không ai biết bước này hỏng.
            if (dsKetQua.length && !soKhop) {
                canhBao(
                    `KiemTraFileHoSoQuet trả ${dsKetQua.length} file nhưng không khớp fileId nào ` +
                    `với docId đọc từ layHoSoQuet — giữ nguyên cờ daKySo cache.`
                );
            }
        } catch (err) {
            canhBao(
                `KiemTraFileHoSoQuet lỗi, giữ nguyên cờ daKySo cache: ` +
                (err && err.message ? err.message : String(err))
            );
        }
    }

    if (!taiBytes) return files;

    const canTai = typeof locTruocKhiTai === 'function' ? files.filter(locTruocKhiTai) : files;
    for (const file of canTai) {
        try {
            const soi = await taiVaSoiFile(file.docId);
            file.laPdf = soi.laPdf;
            file.kichThuoc = soi.kichThuoc;
            file.kySoTrongFile = soi.daKySo;
            file.subFilter = soi.subFilter;
            file.bytes = soi.bytes;
        } catch (err) {
            file.loi = err && err.message ? err.message : String(err);
        }
    }
    return files;
}

/**
 * Đọc danh sách file hồ sơ quét đang hiển thị trong DOM.
 * Đường dự phòng khi bóc từ JSON không ra: cần bấm "Xem hồ sơ quét" trước.
 */
export function docDanhSachFileQuetTuDom(root = document) {
    return Array.from(root.querySelectorAll('li.filehosoquet')).map((li) => ({
        docId: li.getAttribute('data-nodeid') || '',
        hoSoQuetId: li.getAttribute('data-hosoquetid') || '',
        tenHienThi: (li.querySelector('.value')?.textContent || '').trim(),
    }));
}

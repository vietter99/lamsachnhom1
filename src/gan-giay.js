/**
 * Gắn file quét vào giấy chứng nhận tương ứng.
 *
 * Đây là phần DUY NHẤT của công cụ ghi dữ liệu lên MPLIS. Mọi thứ khác chỉ đọc.
 *
 * Thiết kế xoay quanh một rủi ro: `UpdateHoSoQuetExistFile` nhận lại **toàn bộ**
 * danh sách file của hồ sơ. Gửi thiếu một part đồng nghĩa với việc bỏ file đó
 * khỏi hồ sơ. Vì vậy hàm dựng payload luôn bắt đầu từ danh sách đầy đủ máy chủ
 * vừa trả về, gửi lại nguyên văn từng object, và chỉ sửa đúng file cần gắn.
 *
 * Trước khi gửi, `kiemTraAnToan` chặn mọi payload không thoả các điều kiện đó.
 */
import { layHoSoQuet, layThongTinDangKy, capNhatHoSoQuet } from './api.js';
import { bocFileQuetTuJson, bocHoSoQuetGoc, bocGiayChungNhan } from './parse.js';

/** Bỏ khoảng trắng và viết hoa, để so `DL 242877` với `24349_GCN_DL 242877.pdf`. */
export function chuanHoaDeSo(text) {
    return String(text ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Dựng payload cho một hồ sơ, chưa gửi đi.
 *
 * Trả về đủ thông tin để hiển thị cho người dùng duyệt: file nào bị sửa, sửa
 * thành gì, và tổng số part sẽ gửi.
 */
export async function dungPayloadGanGiay({ tinhHinhDangKyId, soPhatHanh, docIdCanGan, mauMoTa }) {
    // Nhận một docId hoặc nhiều: một hồ sơ quét chứa được nhiều ảnh của cùng một
    // giấy chứng nhận, và dữ liệu thật cho thấy MPLIS chấp nhận nhiều file cùng
    // trỏ về một `giayChungNhanId`.
    const dsCanGan = Array.isArray(docIdCanGan) ? docIdCanGan : [docIdCanGan];
    const resHoSo = await layHoSoQuet(tinhHinhDangKyId);
    const tatCaFile = bocFileQuetTuJson(resHoSo);
    if (!tatCaFile.length) {
        throw new Error('Không đọc được file nào trong hồ sơ quét');
    }

    const dsFileGan = dsCanGan.map((id) => {
        const f = tatCaFile.find((x) => x.docId === id);
        if (!f) throw new Error(`Không thấy file ${id} trong hồ sơ`);
        return f;
    });
    const canGan = dsFileGan[0];

    const khacHoSoQuet = dsFileGan.filter(
        (f) => String(f.hoSoQuetId) !== String(canGan.hoSoQuetId)
    );
    if (khacHoSoQuet.length) {
        throw new Error('Các file cần gắn không nằm cùng một hồ sơ quét');
    }

    const { hoSoQuet: hoSoQuetGoc, viTri, dsHoSoQuetId } = bocHoSoQuetGoc(resHoSo, canGan.hoSoQuetId);
    if (!hoSoQuetGoc) {
        throw new Error(
            `Không đọc được object hồ sơ quét gốc: tìm hoSoQuetId ${canGan.hoSoQuetId}, ` +
            (dsHoSoQuetId.length
                ? `phản hồi chỉ có ${dsHoSoQuetId.join(', ')}`
                : 'phản hồi không có hồ sơ quét nào theo cặp khoá hoSoQuetId+thongTinHoSoId')
        );
    }

    // Tìm giấy chứng nhận khớp số phát hành.
    const resDangKy = await layThongTinDangKy([Number(tinhHinhDangKyId)]);
    const dsGiay = bocGiayChungNhan(resDangKy);
    const khoa = chuanHoaDeSo(soPhatHanh);
    const giay = dsGiay.find((g) => chuanHoaDeSo(g.soPhatHanh) === khoa);
    if (!giay) {
        throw new Error(
            `Không thấy giấy chứng nhận nào có số phát hành ${soPhatHanh}` +
            (dsGiay.length ? `. Hệ thống có: ${dsGiay.map((g) => g.soPhatHanh).join(', ')}` : '')
        );
    }

    const moTaMoi = String(mauMoTa || 'Giấy chứng nhận {soPhatHanh}')
        .replace(/\{soPhatHanh\}/g, giay.soPhatHanh)
        .replace(/\{giayChungNhanId\}/g, String(giay.giayChungNhanId))
        .replace(/\{versionGcn\}/g, String(giay.version))
        .trim();

    // Chỉ gửi lại file thuộc chính hồ sơ quét đang sửa. Payload thật của hồ sơ
    // quét 4371533 có `count: 2` đúng bằng số file của riêng nó, không phải tổng
    // số file của mọi hồ sơ quét trong tình hình đăng ký.
    const fileCuaHoSo = tatCaFile.filter(
        (f) => String(f.hoSoQuetId) === String(canGan.hoSoQuetId)
    );

    // Gửi lại nguyên văn mọi file; chỉ file cần gắn mới bị sửa.
    const boGan = new Set(dsCanGan);
    const parts = fileCuaHoSo.map((f, i) => {
        const part = { ...f.goc, _id: i + 1, files: null };
        if (boGan.has(f.docId)) {
            part.moTa = moTaMoi;
            part.laGiayChungNhan = true;
            part.giayChungNhanId = String(giay.giayChungNhanId);
            part.versionGiayChungNhan = Number(giay.version);
            part.loaiHoSoQuet = 1;
            part.tenGiayTo = part.tenGiayTo ?? '';
            part.trichYeu = part.trichYeu ?? '';
        }
        return part;
    });

    // Ảnh chụp liên kết giấy trước khi sửa, để phát hiện file nào bị rơi mất
    // `giayChungNhanId` trong payload sắp gửi.
    const truocKhiSua = fileCuaHoSo.map((f) => ({
        docId: f.docId,
        ten: f.ten,
        laGiayChungNhan: f.laGiayChungNhan,
        giayChungNhanId: f.goc?.giayChungNhanId ?? null,
    }));

    return {
        // `_id` là vị trí hồ sơ quét trong danh sách, đếm từ 1. Đặt cứng 1 sẽ
        // sai khi tình hình đăng ký có nhiều hồ sơ quét.
        hoSoQuet: { ...hoSoQuetGoc, _id: viTri },
        parts,
        truocKhiSua,
        soPart: parts.length,
        tongFileTrongHoSo: fileCuaHoSo.length,
        fileSua: {
            docId: canGan.docId,
            docIds: dsCanGan,
            tenCu: dsFileGan.map((f) => f.ten || f.docId).join(' / '),
            tenMoi: moTaMoi,
            daKySo: dsFileGan.every((f) => f.daKySo),
            daGanTruocDo: dsFileGan.every((f) => f.laGiayChungNhan),
        },
        giay,
    };
}

const coGiaTri = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/**
 * Chặn payload nguy hiểm trước khi gửi.
 * Trả mảng lỗi; rỗng nghĩa là đạt.
 *
 * Các mức chặn đến từ payload thật quan sát được:
 *
 * - `count` phải khớp tổng số file. Gửi thiếu part là bỏ file khỏi hồ sơ.
 * - Một hồ sơ có thể có nhiều hơn một file mang cờ `laGiayChungNhan`. Payload
 *   thật của MPLIS có hai. Vì vậy không ép "đúng một file".
 * - Không file nào được rơi mất `giayChungNhanId` so với trước khi sửa. Giao
 *   diện MPLIS từng xoá `giayChungNhanId` của một file khi lưu, biến nó thành
 *   giấy chứng nhận không trỏ tới giấy nào. Tool không lặp lại lỗi đó.
 */
export function kiemTraAnToan(payload) {
    const loi = [];
    if (!payload || !payload.hoSoQuet) loi.push('Thiếu object hồ sơ quét gốc');

    const parts = payload?.parts;
    if (!Array.isArray(parts) || !parts.length) {
        loi.push('Danh sách part rỗng');
        return loi;
    }

    if (payload.soPart !== payload.tongFileTrongHoSo) {
        loi.push(
            `Số part gửi đi (${payload.soPart}) khác tổng số file trong hồ sơ ` +
            `(${payload.tongFileTrongHoSo}). Gửi tiếp sẽ làm mất file.`
        );
    }

    const thieuNode = parts.filter((p) => !p.nodeId).length;
    if (thieuNode) loi.push(`${thieuNode} part thiếu nodeId`);

    const truoc = new Map((payload.truocKhiSua || []).map((f) => [f.docId, f]));
    const roiLienKet = parts.filter((p) => {
        const cu = truoc.get(p.nodeId);
        return cu && coGiaTri(cu.giayChungNhanId) && !coGiaTri(p.giayChungNhanId);
    });
    if (roiLienKet.length) {
        loi.push(
            `${roiLienKet.length} file mất liên kết giấy chứng nhận so với trước khi sửa: ` +
            roiLienKet.map((p) => p.moTa || p.nodeId).join(', ')
        );
    }

    const canGanIds = payload.fileSua?.docIds || [payload.fileSua?.docId];
    const suaGan = parts.filter((p) => canGanIds.includes(p.nodeId));
    if (suaGan.length !== canGanIds.length) {
        loi.push(`Tìm thấy ${suaGan.length} part khớp, cần ${canGanIds.length} file cần gắn`);
    }
    const thieuGcnId = suaGan.filter((p) => !coGiaTri(p.giayChungNhanId));
    if (thieuGcnId.length) {
        loi.push(`${thieuGcnId.length} file cần gắn không có giayChungNhanId`);
    }

    const ganTruoc = (payload.truocKhiSua || []).filter((f) => f.laGiayChungNhan).length;
    const ganSau = parts.filter((p) => p.laGiayChungNhan === true).length;
    if (ganSau < ganTruoc) {
        loi.push(`Số file gắn giấy giảm từ ${ganTruoc} xuống ${ganSau}`);
    }

    if (!payload.fileSua?.tenMoi) loi.push('Mô tả mới rỗng');
    return loi;
}

/** Gửi payload đã dựng. Ném lỗi nếu kiểm tra an toàn không đạt. */
export async function guiGanGiay(payload) {
    const loi = kiemTraAnToan(payload);
    if (loi.length) throw new Error(`Từ chối gửi: ${loi.join('; ')}`);
    return capNhatHoSoQuet(payload.hoSoQuet, payload.parts, false);
}

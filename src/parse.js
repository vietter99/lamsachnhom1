import { formatNetDate } from './utils.js';

/**
 * Nhãn tiếng Việt cho mã lỗi. Danh sách này chắc chắn chưa đủ — mã lạ sẽ được
 * hiển thị nguyên văn thay vì bị nuốt, để không phân loại sai trường hợp mới.
 */
const NHAN_MA_LOI = {
    NOSIGN: 'Hồ sơ quét chưa ký số',
    NOLINK: 'Hồ sơ quét chưa gắn giấy chứng nhận',
    maSoDinhDanh: 'Thiếu mã số định danh',
    thoiHanSuDung: 'Thiếu thời hạn sử dụng',
    // Gặp trong dữ liệu thật khi chạy 54 thửa: trước đây rơi thẳng ra sheet
    // dưới dạng mã trần ("soGiayTo; ngayVaoSo"), người nhận bảng tổng không
    // đoán được là thiếu gì.
    ngayVaoSo: 'Thiếu ngày vào sổ',
    soVaoSo: 'Thiếu số vào sổ',
    soGiayTo: 'Thiếu số giấy tờ',
    diaChi: 'Thiếu địa chỉ',
    ngaySinh: 'Thiếu ngày sinh',
    namSinh: 'Thiếu năm sinh',
    gioiTinh: 'Thiếu giới tính',
    dienTich: 'Thiếu diện tích',
    mucDichSuDung: 'Thiếu mục đích sử dụng',
    nguonGocSuDung: 'Thiếu nguồn gốc sử dụng',
    null: 'Thiếu dữ liệu',
};

/**
 * Đổi mã lỗi thành câu tiếng Việt.
 *
 * Mã lạ giữ nguyên văn để không phân loại sai trường hợp mới — trừ mã chỉ gồm
 * chữ số ("0"), thứ không nói được gì với người đọc bảng tổng. Dữ liệu thật đã
 * đẩy một ô Ghi chú thành đúng chuỗi "ngayVaoSo; 0".
 */
function nhanChoMaLoi(maLoi) {
    if (NHAN_MA_LOI[maLoi]) return NHAN_MA_LOI[maLoi];
    if (/^\d+$/.test(String(maLoi ?? '').trim())) return 'Thiếu dữ liệu';
    return maLoi;
}

const NHAN_NHOM = {
    HOSOQUET: 'Hồ sơ quét',
    DIACHI: 'Địa chỉ',
};

/**
 * Bóc một mã lỗi dạng:
 *   TINHHINHDANGKY.13610685|GIAYCHUNGNHAN.2304915_1|HOSOQUET|NOSIGN
 * Phần cuối là mã lỗi, phần áp cuối là nhóm dữ liệu, các phần đầu là thực thể.
 */
export function bocMaLoi(raw) {
    const parts = String(raw ?? '').split('|').map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return null;

    const maLoi = parts[parts.length - 1];

    // Phần áp cuối là nhóm dữ liệu chỉ khi nó không mang dấu chấm. Có dấu chấm
    // nghĩa là một thực thể `LOAI.id`, và mã đó không kèm nhóm:
    //   TINHHINHDANGKY.13610685|GIAYCHUNGNHAN.2304915_1|HOSOQUET|NOSIGN  nhóm HOSOQUET
    //   TINHHINHDANGKY.13610673|HOGIADINH.555178_1|CANHAN.2081061_1|maSoDinhDanh  không nhóm
    const apCuoi = parts.length >= 2 ? parts[parts.length - 2] : '';
    const laThucThe = apCuoi.includes('.');
    const nhom = laThucThe ? '' : apCuoi;

    const thucThe = {};
    const phanThucThe = parts.slice(0, parts.length - (laThucThe ? 1 : 2));
    for (const part of phanThucThe) {
        const dot = part.indexOf('.');
        if (dot > 0) thucThe[part.slice(0, dot)] = part.slice(dot + 1);
    }

    return {
        raw,
        maLoi,
        nhom,
        thucThe,
        tinhHinhDangKyId: thucThe.TINHHINHDANGKY || '',
        giayChungNhanKey: thucThe.GIAYCHUNGNHAN || '',
        nhanNhom: NHAN_NHOM[nhom] || nhom,
        nhanMaLoi: nhanChoMaLoi(maLoi),
    };
}

/** "2304915_1" -> { giayChungNhanId: "2304915", version: "1" } */
export function tachGiayChungNhanKey(key) {
    const [giayChungNhanId = '', version = ''] = String(key ?? '').split('_');
    return { giayChungNhanId, version };
}

/** Gom một bản ghi trong data[] của API tra cứu thành dòng kết quả phẳng. */
/**
 * Modal "Cập nhật dữ liệu thiếu" của MPLIS có các ô riêng cho cùng một cá nhân:
 *
 *   CANHAN.15517072_0|maSoDinhDanh                        "Mã số định danh"
 *   CANHAN.15517072_0|GIAYTOTUYTHAN.7477731|soGiayTo       "Số giấy tờ"
 *   HOGIADINH.1723401_0|DIACHI|null                        "Địa chỉ"
 *
 * Các ô này thường trùng với dữ liệu đã có sẵn nơi khác trong hồ sơ, nhưng có
 * thể lệch: một ô có, ô kia trống. Quét khắp cây bản ghi tìm mọi node mang
 * đúng `caNhanId` này, gom mọi giá trị {maSoDinhDanh, soGiayTo,
 * maDinhDanhCaNhan, diaChi, diaChiChiTiet} khác rỗng — có sẵn thì dùng luôn,
 * khỏi cần tra một cửa.
 *
 * Giấy chứng nhận đứng tên vợ chồng (2 chủ) thì máy chủ nối 2 giá trị bằng
 * " - " ở field tóm tắt (`ChuSoHuu[].soGiayTo`), nhưng ở đây tìm thẳng theo
 * `caNhanId` của đúng người đang thiếu — không tách chuỗi theo vị trí, nên
 * không có rủi ro lấy nhầm sang người kia.
 */
export function timGiaTriDinhDanhTheoCaNhan(record, caNhanId) {
    const idSach = String(caNhanId ?? '').split('_')[0];
    if (!idSach) return { so: [], diaChi: [] };

    const so = new Set();
    const diaChi = new Set();
    const daTham = new Set();
    const duyet = (node) => {
        if (!node || typeof node !== 'object' || daTham.has(node)) return;
        daTham.add(node);
        if (Array.isArray(node)) {
            node.forEach(duyet);
            return;
        }
        if (String(node.caNhanId ?? '') === idSach) {
            for (const khoa of ['maSoDinhDanh', 'soGiayTo', 'maDinhDanhCaNhan']) {
                const gt = node[khoa];
                if (gt) so.add(String(gt).trim());
            }
            for (const khoa of ['diaChiChiTiet', 'diaChi']) {
                const dc = node[khoa];
                if (dc) diaChi.add(String(dc).trim());
            }
        }
        Object.values(node).forEach(duyet);
    };
    duyet(record);
    return { so: Array.from(so), diaChi: Array.from(diaChi) };
}

export function bocKetQuaTraCuu(soPhatHanh, record) {
    const maLois = (record.thongTinDangKyChuaDapUngNhom1 || [])
        .map(bocMaLoi)
        .filter(Boolean);

    // Hồ sơ nào thiếu mã định danh (mã lỗi maSoDinhDanh) thì tìm luôn xem chính
    // bản ghi này đã có sẵn số và địa chỉ ở ô khác chưa — có thì "Tìm mã định
    // danh" dùng ngay, không cần gọi một cửa.
    const caNhanThieu = maLois.filter((m) => m.maLoi === 'maSoDinhDanh' && m.thucThe.CANHAN);
    const dinhDanhCoSanTuHoSo = Array.from(new Set(
        caNhanThieu.flatMap((m) => timGiaTriDinhDanhTheoCaNhan(record, m.thucThe.CANHAN).so)
    ));
    const diaChiCoSanTuHoSo = Array.from(new Set(
        caNhanThieu.flatMap((m) => timGiaTriDinhDanhTheoCaNhan(record, m.thucThe.CANHAN).diaChi)
    ));

    return {
        soPhatHanh,
        tinhHinhDangKyId: record.tinhHinhDangKyId ?? '',
        thuaDatId: record.thuaDatId ?? '',
        soHieuToBanDo: record.soHieuToBanDo ?? '',
        soThuTuThua: record.soThuTuThua ?? '',
        xaId: record.xaId ?? '',
        thongTinChu: record.thongTinChu ?? '',
        thongTinGiayChungNhan: record.thongTinGiayChungNhan ?? '',
        dapUngNhom1: record.thongTinDangKyDapUngNhom1 === true,
        maLois,
        maLoiGop: maLois.map((m) => m.maLoi).join(', '),
        nhomGop: maLois.map((m) => m.nhom).join(', '),
        giayChungNhanLoi: maLois.map((m) => m.giayChungNhanKey).filter(Boolean).join(', '),
        moTaLoi: maLois.map((m) => m.nhanMaLoi).join('; '),
        thongBaoHeThong: (record.errorMessages || []).join(' | '),
        canhBao: (record.warningMessages || []).join(' | '),
        capNhatLuc: formatNetDate(record.lastTimeUpdated),
        dinhDanhCoSanTuHoSo,
        diaChiCoSanTuHoSo,
    };
}

/**
 * Bóc danh sách file quét từ phản hồi GetHoSoQuetKeKhaiByTinhHinhDangKyId.
 *
 * Mỗi file là một object phẳng có dạng:
 *
 *   {
 *     "nodeId": "a0959bdc-5627-4023-a27c-8191fb5e9f3a",   // DocId cho FileHandler
 *     "moTa": "24349_GCN_DL 242877.pdf",                  // tên hiển thị
 *     "daKySo": false,                                    // đã ký số hay chưa
 *     "laGiayChungNhan": false,
 *     "hoSoQuetId": 2188437
 *   }
 *
 * Các object này nằm rải rác nhiều tầng trong phản hồi nên hàm duyệt toàn cây
 * thay vì đi theo đường dẫn cứng.
 *
 * Một `nodeId` xuất hiện nhiều lần dưới các `hoSoQuetId` khác nhau, mỗi lần một
 * cách viết `moTa` (`24349_GCN_DL 242877` và `24349_GCN_DL 242877.pdf`). Chúng
 * trỏ về cùng một file, nên hàm gộp theo `nodeId` và giữ tên có đuôi `.pdf`.
 *
 * `laGiayChungNhan` đánh dấu file ĐÃ được gắn vào một giấy chứng nhận trong hệ
 * thống. So hai trạng thái trong dữ liệu thật:
 *
 *   chưa gắn: laGiayChungNhan false, loaiHoSoQuet 0,
 *             giayChungNhanId null, versionGiayChungNhan null, daKySo false
 *   đã gắn:   laGiayChungNhan true,  loaiHoSoQuet 1,
 *             giayChungNhanId 1001333, versionGiayChungNhan 2, daKySo true
 *
 * Người dùng chọn giấy để gắn theo Số phát hành. Cây chọn hiển thị mỗi giấy
 * dưới dạng `Giấy chứng nhận <giayChungNhanId>_<versionGiayChungNhan>` kèm dòng
 * `- Số phát hành: DĐ 659138 - ...`.
 *
 * Phần `moTa` không đổi theo thao tác gắn; người dùng tự sửa tên. Vì vậy không
 * lọc file cần xử lý theo cờ này: file cần xử lý chính là file có cờ `false`.
 * Nhận diện giấy chứng nhận chưa gắn phải dựa vào tên.
 */
export function bocFileQuetTuJson(response, gioiHan = 500) {
    const theoNodeId = new Map();
    const daTham = new Set();

    const duyet = (node) => {
        if (!node || typeof node !== 'object' || theoNodeId.size >= gioiHan) return;
        if (daTham.has(node)) return;
        daTham.add(node);

        if (Array.isArray(node)) {
            node.forEach(duyet);
            return;
        }

        const nodeId = typeof node.nodeId === 'string' ? node.nodeId.trim() : '';
        if (nodeId && ('moTa' in node || 'daKySo' in node)) {
            const ten = String(node.moTa ?? '').trim();
            const cu = theoNodeId.get(nodeId);
            const moi = {
                docId: nodeId,
                ten,
                daKySo: node.daKySo === true,
                laGiayChungNhan: node.laGiayChungNhan === true,
                loaiHoSoQuet: node.loaiHoSoQuet ?? '',
                giayChungNhanId: node.giayChungNhanId ?? '',
                versionGiayChungNhan: node.versionGiayChungNhan ?? '',
                hoSoQuetId: node.hoSoQuetId ?? '',
                // Giữ nguyên object máy chủ trả về. Khi gọi UpdateHoSoQuetExistFile
                // ta phải gửi lại đủ mọi file của hồ sơ; gửi lại bản gốc rồi chỉ
                // sửa đúng trường cần đổi thì không đánh rơi trường lạ nào.
                goc: node,
            };
            const daKySoGop = moi.daKySo || (cu ? cu.daKySo : false);

            if (!cu) {
                theoNodeId.set(nodeId, moi);
            } else {
                // Cùng một file (nodeId) lặp ở ba nhánh JSON, và dữ liệu thật cho
                // thấy các bản lặp có thể mang `hoSoQuetId` KHÁC NHAU: một bản
                // thuộc hồ sơ quét hiện hành, một bản (thường kèm đuôi .PDF,
                // `isOldFile: true`) thuộc hồ sơ quét đã bị thay/không còn tồn
                // tại. `uuTienTen` chỉ chọn hộ TÊN đẹp hơn để hiển thị — dùng nó
                // để chọn cả `hoSoQuetId`/`goc` từng khiến tool gắn nhầm vào hồ
                // sơ quét đã lùi vào lịch sử, vì bản `isOldFile:true` hay có tên
                // dài hơn/kèm đuôi .pdf nên luôn thắng. Ưu tiên `isOldFile:false`
                // trước, chỉ dùng `uuTienTen` khi cả hai cùng cũ hoặc cùng mới.
                const moiCu = node.isOldFile === true;
                const cuCu = cu.goc?.isOldFile === true;

                if (cuCu && !moiCu) {
                    moi.daKySo = daKySoGop;
                    theoNodeId.set(nodeId, moi);
                } else if (!cuCu && moiCu) {
                    cu.daKySo = daKySoGop;
                } else if (uuTienTen(moi.ten, cu.ten)) {
                    moi.daKySo = daKySoGop;
                    theoNodeId.set(nodeId, moi);
                } else {
                    cu.daKySo = daKySoGop;
                }
            }
        }

        Object.values(node).forEach(duyet);
    };

    duyet(response?.Value ?? response?.value ?? response);
    return Array.from(theoNodeId.values());
}

/**
 * Bóc kết quả kiểm tra chữ ký sống từ phản hồi KiemTraFileHoSoQuet.
 *
 * Dạng phẳng sẵn, không cần đệ quy như các hàm bóc khác:
 *   { hoSoQuetId, fileId, moTa, fileSize, daKySo, errorMessage }
 * `fileId` cùng không gian id với `nodeId`/`docId` ở `bocFileQuetTuJson`, nên
 * đối chiếu được thẳng theo khoá đó.
 */
export function bocKetQuaKiemTraFile(response) {
    const list = response?.value ?? response?.Value ?? [];
    return Array.isArray(list) ? list : [];
}

/**
 * Bóc danh sách người nộp đơn (kèm CMND/CCCD) từ phản hồi
 * AdvancedSearchHoSoTiepNhan, gộp trùng theo `giayChungMinh`.
 *
 * Một người có thể nộp nhiều hồ sơ, ra nhiều bản ghi `nguoiNopDon` giống hệt
 * nhau — gộp lại còn đúng số CMND riêng biệt. Dữ liệu thật cho thấy có hồ sơ
 * cùng tên nhưng số CMND lệch nhau (lỗi gõ ở một hồ sơ cũ: `042064006947` với
 * `042064006974`, đảo 2 số cuối) — nên trả về NGUYÊN danh sách các số khác
 * nhau kèm số lần gặp, không tự chọn hộ số nào đúng. Chỗ gọi hàm này quyết
 * định coi là chắc chắn hay không, không quyết định ở đây.
 */
export function bocNguoiNopDon(response) {
    const list = response?.data ?? response?.Data ?? [];
    const theoSo = new Map();

    for (const item of Array.isArray(list) ? list : []) {
        const nnd = item?.nguoiNopDon;
        const so = String(nnd?.giayChungMinh ?? '').trim();
        if (!so) continue;

        const cu = theoSo.get(so);
        if (cu) {
            cu.soLan += 1;
        } else {
            theoSo.set(so, {
                giayChungMinh: so,
                hoTen: nnd?.hoTen ?? '',
                diaChi: nnd?.diachi ?? '',
                soDienThoai: nnd?.soDienThoai ?? '',
                soLan: 1,
            });
        }
    }

    return Array.from(theoSo.values());
}

/** Tên có đuôi .pdf sát thực tế hơn, ưu tiên giữ. */
function uuTienTen(ten, tenCu) {
    const coDuoi = /\.pdf$/i.test(ten);
    const cuCoDuoi = /\.pdf$/i.test(tenCu);
    if (coDuoi !== cuCoDuoi) return coDuoi;
    return ten.length > tenCu.length;
}

/**
 * Lấy object hồ sơ quét gốc — phần `hoSoQuet` mà `UpdateHoSoQuetExistFile` yêu
 * cầu ở part đầu tiên.
 *
 * Nhận diện bằng cặp khoá `hoSoQuetId` và `thongTinHoSoId`. Trong phản hồi thật
 * object này lặp ở ba nhánh (`ListHoSoQuet`, `DanhSachThongTinHoSo[].DanhSachHoSoQuet`,
 * và `ListHoSoQuetInfo[].ListHoSoQuet`) với nội dung giống hệt nhau.
 */
export function bocDanhSachHoSoQuet(response) {
    const daTham = new Set();
    const theoId = new Map();

    const duyet = (node) => {
        if (!node || typeof node !== 'object') return;
        if (daTham.has(node)) return;
        daTham.add(node);

        if (Array.isArray(node)) {
            node.forEach(duyet);
            return;
        }

        if ('hoSoQuetId' in node && 'thongTinHoSoId' in node && !('nodeId' in node)) {
            const khoa = String(node.hoSoQuetId);
            if (!theoId.has(khoa)) theoId.set(khoa, node);
            return;
        }
        Object.values(node).forEach(duyet);
    };

    duyet(response?.Value ?? response?.value ?? response);
    return Array.from(theoId.values());
}

/**
 * Lấy object hồ sơ quét gốc kèm chỉ số của nó trong danh sách.
 *
 * `UpdateHoSoQuetExistFile` gửi kèm `_id` cho part `hoSoQuet`, và giá trị đó là
 * vị trí hồ sơ quét trong danh sách, đánh từ 1. Bản ghi thật của tình hình đăng
 * ký 13610646 có hai hồ sơ quét: 4371534 đứng thứ nhất, 4371533 thứ hai — và
 * khi gắn giấy cho 4371533 thì MPLIS gửi `_id: 2`.
 *
 * Trả `{ hoSoQuet, viTri, dsHoSoQuetId }`; `viTri` là số đếm từ 1, hoặc 0 khi
 * không tìm thấy. `dsHoSoQuetId` là mọi id đọc được trong phản hồi, để chỗ gọi
 * báo lỗi nói rõ đang tìm gì mà không thấy, thay vì chỉ báo "không đọc được".
 */
export function bocHoSoQuetGoc(response, hoSoQuetId) {
    const ds = bocDanhSachHoSoQuet(response);
    const dsHoSoQuetId = ds.map((h) => h.hoSoQuetId);
    if (!ds.length) return { hoSoQuet: null, viTri: 0, dsHoSoQuetId };

    if (!hoSoQuetId) return { hoSoQuet: ds[0], viTri: 1, dsHoSoQuetId };

    const i = ds.findIndex((h) => String(h.hoSoQuetId) === String(hoSoQuetId));
    return i < 0
        ? { hoSoQuet: null, viTri: 0, dsHoSoQuetId }
        : { hoSoQuet: ds[i], viTri: i + 1, dsHoSoQuetId };
}

/** Lấy danh sách giấy chứng nhận từ phản hồi GetThongTinDangKyNhom1. */
export function bocGiayChungNhan(detailResponse) {
    const values = detailResponse?.value || detailResponse?.Value || [];
    const list = Array.isArray(values) ? values : [values];
    const out = [];
    for (const item of list) {
        for (const gcn of item?.ListGiayChungNhan || []) {
            out.push({
                tinhHinhDangKyId: item.tinhHinhDangKyId ?? '',
                giayChungNhanId: gcn.giayChungNhanId ?? '',
                version: gcn.version ?? '',
                soPhatHanh: gcn.soPhatHanh ?? '',
                soVaoSo: gcn.soVaoSo ?? '',
                ngayVaoSo: formatNetDate(gcn.ngayVaoSo),
            });
        }
    }
    return out;
}

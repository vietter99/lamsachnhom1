/**
 * Ghi file ZIP theo phương thức "store" (không nén).
 *
 * Tự viết vì userscript không nạp được thư viện ngoài: máy cơ quan có thể chặn
 * CDN, và trang MPLIS không phải trang của ta để chèn script lạ vào.
 *
 * Không nén là lựa chọn có chủ ý. PDF đã nén sẵn bên trong, chạy deflate lần
 * nữa gần như không giảm dung lượng mà tốn thời gian. Đổi lại, mã ở đây ngắn
 * và không cần phụ thuộc nào.
 */

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

/** Giờ và ngày theo định dạng MS-DOS mà ZIP dùng. */
function dosDateTime(date) {
    const time =
        (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
    const day =
        ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time: time & 0xffff, day: day & 0xffff };
}

/**
 * Gói danh sách file thành một Blob ZIP.
 * files: [{ ten: string, bytes: Uint8Array }]
 */
export function taoZip(files, thoiDiem = new Date()) {
    const { time, day } = dosDateTime(thoiDiem);
    const encoder = new TextEncoder();

    const phan = [];
    const muc = [];
    let offset = 0;

    for (const file of files) {
        const nameBytes = encoder.encode(file.ten);
        const data = file.bytes;
        const crc = crc32(data);

        const header = new Uint8Array(30 + nameBytes.length);
        const hv = new DataView(header.buffer);
        hv.setUint32(0, 0x04034b50, true); // chữ ký local file header
        hv.setUint16(4, 20, true); // cần phiên bản 2.0
        hv.setUint16(6, 0x0800, true); // cờ báo tên file mã hoá UTF-8
        hv.setUint16(8, 0, true); // phương thức 0 = store
        hv.setUint16(10, time, true);
        hv.setUint16(12, day, true);
        hv.setUint32(14, crc, true);
        hv.setUint32(18, data.length, true);
        hv.setUint32(22, data.length, true);
        hv.setUint16(26, nameBytes.length, true);
        hv.setUint16(28, 0, true); // không có extra field
        header.set(nameBytes, 30);

        phan.push(header, data);

        const central = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(central.buffer);
        cv.setUint32(0, 0x02014b50, true); // chữ ký central directory
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, time, true);
        cv.setUint16(14, day, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);
        cv.setUint16(32, 0, true);
        cv.setUint16(34, 0, true);
        cv.setUint16(36, 0, true);
        cv.setUint32(38, 0, true);
        cv.setUint32(42, offset, true);
        central.set(nameBytes, 46);
        muc.push(central);

        offset += header.length + data.length;
    }

    const cdOffset = offset;
    const cdSize = muc.reduce((tong, m) => tong + m.length, 0);

    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true); // chữ ký end of central directory
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...phan, ...muc, eocd], { type: 'application/zip' });
}

/** Bỏ ký tự Windows cấm trong tên file. Giữ dấu tiếng Việt. */
export function lamSachTenFile(ten, mac_dinh = 'khong-ten') {
    const sach = String(ten ?? '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/[\x00-\x1f]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^\.+|\.+$/g, '')
        .trim();
    return sach || mac_dinh;
}

/** Thêm hậu tố _2, _3 khi tên đã tồn tại trong danh sách. */
export function tenKhongTrung(ten, daDung) {
    if (!daDung.has(ten)) {
        daDung.add(ten);
        return ten;
    }
    const cham = ten.lastIndexOf('.');
    const goc = cham > 0 ? ten.slice(0, cham) : ten;
    const duoi = cham > 0 ? ten.slice(cham) : '';
    for (let i = 2; ; i += 1) {
        const thu = `${goc}_${i}${duoi}`;
        if (!daDung.has(thu)) {
            daDung.add(thu);
            return thu;
        }
    }
}

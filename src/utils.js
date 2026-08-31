export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[c]);
}

/**
 * Đọc anti-forgery token mà trang đã render sẵn. Không hardcode token —
 * nó đổi mỗi phiên đăng nhập.
 */
export function getVerificationToken() {
    const input = document.querySelector('input[name="__RequestVerificationToken"]');
    return input ? input.value : '';
}

/** Chuẩn hoá số phát hành người dùng dán từ sheet: "dl242877" -> "DL 242877". */
export function normalizeSoPhatHanh(raw) {
    const text = String(raw ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!text) return '';
    const m = text.match(/^([A-Z]{1,3})\s*([0-9]+)$/);
    return m ? `${m[1]} ${m[2]}` : text;
}

/** Tách danh sách người dùng dán: mỗi dòng, hoặc ngăn bằng dấu phẩy / tab. */
export function parseInputList(text) {
    const seen = new Set();
    const out = [];
    for (const part of String(text ?? '').split(/[\r\n,;\t]+/)) {
        const value = normalizeSoPhatHanh(part);
        if (value && !seen.has(value)) {
            seen.add(value);
            out.push(value);
        }
    }
    return out;
}

/** Ngày .NET "/Date(1701277200000)/" -> "30/11/2023". Trả chuỗi rỗng nếu không parse được. */
export function formatNetDate(value) {
    const m = /\/Date\((-?\d+)\)\//.exec(String(value ?? ''));
    if (!m) return '';
    const d = new Date(Number(m[1]));
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Bọc giá trị cho CSV: nhân đôi dấu nháy kép, luôn bọc trong nháy. */
export function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function toCsv(rows, headers) {
    const lines = [headers.map((h) => csvCell(h.label)).join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => csvCell(row[h.key])).join(','));
    }
    // BOM để Excel mở đúng tiếng Việt.
    return '﻿' + lines.join('\r\n');
}

export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function timestampSlug() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

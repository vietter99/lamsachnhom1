/**
 * Icon dạng SVG inline, lấy hình từ bộ Lucide (giấy phép ISC).
 * Không dùng emoji làm icon: emoji đổi hình theo hệ điều hành và trình đọc màn
 * hình đọc thành lời, nên nghĩa bị lệch.
 *
 * Mọi icon đều mang aria-hidden — nhãn nằm ở phần chữ cạnh nó, hoặc ở
 * aria-label của nút khi nút không có chữ.
 */
const svg = (paths) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const ICONS = {
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
    download: svg('<path d="M12 3v12"/><path d="m7 12 5 5 5-5"/><path d="M4 21h16"/>'),
    thuGon: svg('<path d="m6 15 6-6 6 6"/>'),
    moRa: svg('<path d="m6 9 6 6 6-6"/>'),
    close: svg('<path d="M6 6l12 12"/><path d="M18 6 6 18"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
    send: svg('<path d="m4 4 16 8-16 8 3-8z"/><path d="M7 12h9"/>'),
    tudong: svg('<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v4h4"/><path d="m10 10 5 3-5 3z"/>'),
    archive: svg('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>'),
    phongTo: svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
    thuNho: svg('<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>'),
    caiDat: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    quayLai: svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
};

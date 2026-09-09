/**
 * CSS của panel.
 *
 * Hai ràng buộc quyết định mọi lựa chọn ở đây:
 *
 * 1. Panel chèn vào trang của MPLIS, nơi Bootstrap đang chạy. Mọi selector đều
 *    neo vào #mls-panel để CSS của ta không rò ra trang chủ, và để độ ưu tiên
 *    (id + element = 1-0-1) thắng các class Bootstrap (0-1-0).
 * 2. Máy cơ quan có thể chặn mạng ngoài. Không nạp Google Fonts, không CDN.
 *    Dùng font hệ thống.
 *
 * Bảng màu lấy từ ui-ux-pro-max, đã chỉnh cho đạt WCAG AA. Ba màu gốc trượt
 * ngưỡng nên bị thay: xanh lá #16A34A lên #15803D (chữ trắng đè lên chỉ đạt
 * 3.30:1), viền #CBD5E1 lên #7C8794 (viền ô nhập cần 3:1 theo WCAG 1.4.11),
 * chữ mờ #94A3B8 lên #64748B.
 *
 * Một màu chính (xanh dương) chạy xuyên suốt — thanh tiêu đề, nút an toàn, ô
 * đang focus — thay vì mỗi chỗ một màu khác nhau. Xanh lá và vàng chỉ còn dùng
 * cho trạng thái (đạt/cảnh báo), đỏ chỉ còn dùng cho thao tác ghi dữ liệu; bớt
 * số màu cùng hiện một lúc thì mắt đỡ phải phân loại nhiều thứ cùng lúc.
 *
 * Các khối không còn đóng khung: cách nhau bằng khoảng trắng và một đường kẻ
 * mảnh phía trên, không phải hộp viền + nền riêng. Viền hộp dày từng khiến giao
 * diện đọc như một chuỗi form lồng nhau; bỏ nó đi, giữ lại viền cho đúng chỗ cần
 * phân biệt ranh giới thao tác được (ô nhập, nút, bảng).
 *
 * `--mls-divider` dùng cho biên trang trí thuần tuý (đường kẻ giữa các khối);
 * `--mls-border` dùng cho biên của thành phần tương tác (ô nhập, nút, bảng) —
 * WCAG 1.4.11 chỉ bắt buộc 3:1 ở nhóm thứ hai.
 *
 * Giao diện chỉ có chế độ sáng, vì MPLIS chỉ có chế độ sáng. Panel tối đặt trên
 * nền trang sáng đọc như lỗi hiển thị.
 */
export const PANEL_CSS = `
#mls-panel {
    --mls-primary: #1E40AF;
    --mls-primary-dark: #1E3A8A;
    --mls-on-primary: #FFFFFF;
    --mls-danger: #DC2626;
    --mls-danger-dark: #B91C1C;
    --mls-fg: #1E293B;
    --mls-fg-muted: #4B5563;
    --mls-bg: #FFFFFF;
    --mls-bg-subtle: #F1F5F9;
    --mls-bg-hover: #E7ECF3;
    --mls-border: #7C8794;
    --mls-border-strong: #475569;
    --mls-divider: #E2E7EE;
    --mls-ring: #1E40AF;

    --mls-ok-bg: #ECFDF3;
    --mls-ok-fg: #15803D;
    --mls-warn-bg: #FEF6E7;
    --mls-warn-fg: #A16207;
    --mls-err-bg: #FEF2F2;
    --mls-err-fg: #B91C1C;

    /* Thang giãn cách đặc, hợp bảng dữ liệu: 4 / 8 / 12 / 16 / 24 / 32 */
    --mls-s1: 4px;
    --mls-s2: 8px;
    --mls-s3: 12px;
    --mls-s4: 16px;
    --mls-s5: 24px;
    --mls-s6: 32px;

    --mls-radius: 10px;
    --mls-radius-sm: 6px;
    --mls-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
    --mls-t: 160ms;

    position: fixed;
    top: 72px;
    right: 16px;
    width: 512px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 104px);
    display: flex;
    flex-direction: column;
    background: var(--mls-bg);
    color: var(--mls-fg);
    border: 1px solid var(--mls-divider);
    border-radius: var(--mls-radius);
    box-shadow: var(--mls-shadow);
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    z-index: 2147483647;
    transition: width var(--mls-t) ease, max-height var(--mls-t) ease;
}
#mls-panel, #mls-panel * { box-sizing: border-box; }

/* Phóng to: rộng và cao hẳn lên để đọc mã lỗi, GCN lỗi, thông báo hệ thống dài
   mà không phải cuộn ngang từng chữ trong bảng kết quả. */
#mls-panel.mls-phong-to {
    width: 860px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
}
#mls-panel.mls-phong-to .mls-table-wrap { max-height: 62vh; }
#mls-panel.mls-phong-to table { font-size: 12.5px; }

/* Câu báo lỗi đọc thẳng từ server dài ngắn thất thường. Bó lại 2 dòng ở cỡ
   bảng gọn để hàng không cao lênh khênh; rê chuột (title) hoặc bấm Phóng to
   xem trọn câu — không mất chữ, chỉ giấu bớt. */
#mls-panel .mls-baoloi {
    display: -webkit-box;
    width: 100%;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    /* word-break kế thừa từ td ngắt được ở bất kỳ đâu; trong hộp -webkit-box
       không có bề rộng tường minh, việc đó khiến Chrome coi mỗi ký tự là một
       dòng riêng — vỡ chữ xếp dọc. overflow-wrap chỉ ngắt khi một từ dài hơn
       cả dòng, không ngắt tuỳ tiện, nên không còn vỡ dòng kiểu đó nữa. */
    word-break: normal;
    overflow-wrap: break-word;
}
#mls-panel.mls-phong-to .mls-baoloi { -webkit-line-clamp: 4; }

#mls-panel .mls-madinhdanh {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
}
#mls-panel .mls-madinhdanh-ten {
    flex: 1 0 100%;
    font-weight: 600;
    overflow-wrap: break-word;
}
#mls-panel .mls-madinhdanh code { font-weight: 600; }
#mls-panel .mls-madinhdanh-chon {
    padding: 2px 6px;
    background: var(--mls-warn-bg);
    color: var(--mls-warn-fg);
    border: 1px solid var(--mls-warn-fg);
    border-radius: var(--mls-radius-sm);
    font-family: Consolas, "Courier New", monospace;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
}
#mls-panel .mls-madinhdanh .mls-hint { margin: 0; font-size: 10px; }
#mls-panel .mls-madinhdanh-copy {
    padding: 2px 7px;
    background: transparent;
    color: var(--mls-primary);
    border: 1px solid var(--mls-border);
    border-radius: var(--mls-radius-sm);
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
}
#mls-panel .mls-madinhdanh-copy:hover { background: var(--mls-bg-subtle); }
#mls-panel .mls-madinhdanh-diachi {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px dashed var(--mls-divider);
}
#mls-panel .mls-madinhdanh-diachi code { font-weight: 400; white-space: normal; }

#mls-panel .mls-thua-to {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 10.5px;
    color: var(--mls-fg-muted);
}
#mls-panel .mls-thua-to b { color: var(--mls-fg); font-weight: 700; }

#mls-panel :focus-visible {
    outline: 2px solid var(--mls-ring);
    outline-offset: 2px;
    border-radius: var(--mls-radius-sm);
}
#mls-panel .mls-head :focus-visible { outline-color: #FFFFFF; }

/* ---------- Thanh tiêu đề ---------- */
#mls-panel .mls-head {
    display: flex;
    align-items: center;
    gap: var(--mls-s2);
    padding: var(--mls-s3);
    background: var(--mls-primary);
    color: var(--mls-on-primary);
    border-radius: 9px 9px 0 0;
    cursor: grab;
    user-select: none;
    flex: 0 0 auto;
}
#mls-panel .mls-head.mls-dragging { cursor: grabbing; }
#mls-panel .mls-head h2 {
    flex: 1;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: inherit;
}
#mls-panel .mls-head-badge {
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
}
/* Trạng thái đang chạy đảo màu để nổi hẳn khỏi thanh tiêu đề. Làm nền đậm hơn
   thì chữ vẫn đọc được nhưng badge chìm vào nền xanh, không còn báo được gì. */
#mls-panel .mls-head-badge.dangchay {
    background: #FFFFFF;
    color: var(--mls-primary);
}

#mls-panel .mls-head button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: rgba(255, 255, 255, 0.16);
    border: 0;
    border-radius: var(--mls-radius-sm);
    color: inherit;
    cursor: pointer;
    transition: background var(--mls-t) ease;
}
#mls-panel .mls-head button:hover { background: rgba(255, 255, 255, 0.32); }
#mls-panel .mls-head svg { width: 15px; height: 15px; display: block; }

/* ---------- Thân ---------- */
#mls-panel .mls-body {
    padding: var(--mls-s3);
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1 1 auto;
}
#mls-panel.mls-collapsed { max-height: none; }
#mls-panel.mls-collapsed .mls-body { display: none; }

/* ---------- Màn Cài đặt (thay hẳn màn chính, không phải phần cuộn thêm) ---------- */
#mls-panel .mls-caidat-head {
    display: flex;
    align-items: center;
    gap: var(--mls-s2);
    margin: 0 0 var(--mls-s4);
}
#mls-panel .mls-caidat-head h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
}
#mls-panel .mls-caidat-head button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px 4px 4px;
    background: transparent;
    border: 0;
    border-radius: var(--mls-radius-sm);
    color: var(--mls-primary);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
#mls-panel .mls-caidat-head button:hover { background: var(--mls-bg-subtle); }
#mls-panel .mls-caidat-head svg { width: 16px; height: 16px; }

#mls-panel fieldset.mls-nhom {
    margin: 0;
    padding: var(--mls-s5) 0 0;
    border: 0;
    border-top: 1px solid var(--mls-divider);
    min-width: 0;
}
#mls-panel fieldset.mls-nhom:first-of-type {
    padding-top: 0;
    border-top: 0;
}
#mls-panel fieldset.mls-nhom .mls-field:last-child,
#mls-panel fieldset.mls-nhom details.mls-thugon:last-child,
#mls-panel fieldset.mls-nhom .mls-actions:last-child { margin-bottom: 0; }
#mls-panel fieldset.mls-nhom > legend {
    padding: 0;
    margin: 0 0 var(--mls-s3);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--mls-fg-muted);
}
#mls-panel fieldset.mls-nhom > *:last-child { margin-bottom: 0; }

/* Vùng ghi dữ liệu: chỉ đổi màu nhãn mục và đường kẻ dưới ghi chú, không đóng
   khung cả khối — mức rủi ro vẫn nổi rõ mà không cộng thêm một hộp màu nữa. */
#mls-panel fieldset.mls-nhom-ghi > legend { color: var(--mls-err-fg); }
#mls-panel .mls-nhom-note {
    margin: 0 0 var(--mls-s4);
    padding: var(--mls-s2) var(--mls-s3);
    border-left: 3px solid var(--mls-danger);
    background: var(--mls-err-bg);
    border-radius: 0 var(--mls-radius-sm) var(--mls-radius-sm) 0;
    font-size: 11px;
    line-height: 1.45;
    color: var(--mls-err-fg);
}

#mls-panel kbd {
    /* Bootstrap của MPLIS đặt màu chữ trắng cho thẻ kbd, nên phải khai màu rõ
       ràng ở đây, không thì phím tắt hiện trắng trên nền trắng. */
    color: var(--mls-fg);
    padding: 0 4px;
    border: 1px solid var(--mls-border);
    border-bottom-width: 2px;
    border-radius: 3px;
    background: var(--mls-bg-subtle);
    font-family: Consolas, "Courier New", monospace;
    font-size: 10px;
}

#mls-panel .mls-field { margin-bottom: var(--mls-s3); }
#mls-panel label {
    display: block;
    margin: 0 0 var(--mls-s1);
    font-size: 12px;
    font-weight: 600;
    color: var(--mls-fg);
}
#mls-panel .mls-hint {
    margin: var(--mls-s1) 0 0;
    font-size: 11px;
    color: var(--mls-fg-muted);
}

#mls-panel textarea,
#mls-panel input[type="text"] {
    width: 100%;
    padding: var(--mls-s2);
    background: var(--mls-bg);
    color: var(--mls-fg);
    border: 1px solid var(--mls-border);
    border-radius: var(--mls-radius-sm);
    font-family: Consolas, "Courier New", monospace;
    font-size: 12.5px;
    transition: border-color var(--mls-t) ease;
}
#mls-panel textarea { height: 96px; min-height: 64px; resize: vertical; }
#mls-panel textarea:hover,
#mls-panel input[type="text"]:hover { border-color: var(--mls-border-strong); }
#mls-panel textarea::placeholder,
#mls-panel input::placeholder { color: #64748B; }

#mls-panel .mls-check {
    display: flex;
    align-items: flex-start;
    gap: var(--mls-s2);
}
#mls-panel .mls-check input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin: 2px 0 0;
    flex: 0 0 auto;
    accent-color: var(--mls-primary);
    cursor: pointer;
}
#mls-panel .mls-check label { cursor: pointer; }
#mls-panel .mls-check .mls-hint { margin-top: 2px; }

#mls-panel .mls-tick-doc { flex-direction: column; gap: var(--mls-s1); }
#mls-panel b.mls-ghi {
    display: inline-block;
    margin-left: 2px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--mls-danger);
    color: #FFFFFF;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
}

#mls-panel .mls-tick {
    display: flex;
    flex-wrap: wrap;
    gap: var(--mls-s1) var(--mls-s3);
}
#mls-panel .mls-tick label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: 0;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
}
#mls-panel .mls-tick input[type="checkbox"] {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--mls-primary);
    cursor: pointer;
}

#mls-panel details.mls-thugon {
    margin: 0 0 var(--mls-s3);
    border: 1px solid var(--mls-divider);
    border-radius: var(--mls-radius-sm);
    overflow: hidden;
}
#mls-panel details.mls-thugon > summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--mls-s2) var(--mls-s3);
    cursor: pointer;
    background: var(--mls-bg-subtle);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--mls-fg);
    list-style: none;
    transition: background var(--mls-t) ease;
}
#mls-panel details.mls-thugon > summary::-webkit-details-marker { display: none; }
#mls-panel details.mls-thugon > summary::before {
    content: "";
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-right: 1.5px solid var(--mls-fg-muted);
    border-bottom: 1.5px solid var(--mls-fg-muted);
    transform: rotate(-45deg);
    transition: transform var(--mls-t) ease;
}
#mls-panel details.mls-thugon[open] > summary::before { transform: rotate(45deg); }
#mls-panel details.mls-thugon > summary:hover { background: var(--mls-bg-hover); }
#mls-panel details.mls-thugon[open] > summary { border-bottom: 1px solid var(--mls-divider); }
#mls-panel details.mls-thugon > summary:focus-visible { outline-offset: -2px; }
#mls-panel details.mls-thugon > *:not(summary) {
    margin: 0;
    padding: 0 var(--mls-s3);
}
#mls-panel details.mls-thugon > *:not(summary):first-of-type { padding-top: var(--mls-s3); }
#mls-panel details.mls-thugon > *:not(summary):last-child { padding-bottom: var(--mls-s3); }
#mls-panel .mls-field-sub {
    margin: var(--mls-s3) 0 0 !important;
    padding-top: var(--mls-s3) !important;
    border-top: 1px solid var(--mls-divider);
}
#mls-panel .mls-thugon-dem {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--mls-bg-subtle);
    color: var(--mls-fg-muted);
    font-size: 10px;
    font-weight: 700;
    text-transform: none;
    letter-spacing: normal;
}
#mls-panel .mls-thugon-dem-ok { background: var(--mls-ok-bg); color: var(--mls-ok-fg); }

#mls-panel details.mls-hint > summary {
    cursor: pointer;
    font-weight: 600;
    color: var(--mls-fg-muted);
    list-style-position: inside;
}
#mls-panel details.mls-hint[open] > summary { margin-bottom: var(--mls-s1); }

/* ---------- Nhật ký hoạt động ---------- */
#mls-panel .mls-nhatky-wrap { margin-top: var(--mls-s3); }
#mls-panel .mls-nhatky-wrap .mls-actions-nho { margin: var(--mls-s2) 0; }
#mls-panel .mls-nhatky {
    max-height: 160px;
    overflow-y: auto;
    padding: var(--mls-s2);
    background: var(--mls-bg-subtle);
    border: 1px solid var(--mls-border);
    border-radius: var(--mls-radius-sm);
    font-family: Consolas, "Courier New", monospace;
    font-size: 11px;
    line-height: 1.6;
}
#mls-panel .mls-nhatky-dong {
    padding: 1px 0 1px 8px;
    border-left: 2px solid var(--mls-border);
    color: var(--mls-fg);
    white-space: pre-wrap;
    word-break: break-word;
}
#mls-panel .mls-nhatky-dong + .mls-nhatky-dong { margin-top: 2px; }
#mls-panel .mls-nhatky-ok { border-left-color: var(--mls-ok-fg); }
#mls-panel .mls-nhatky-warn { border-left-color: var(--mls-warn-fg); }
#mls-panel .mls-nhatky-err { border-left-color: var(--mls-err-fg); color: var(--mls-err-fg); }

/* ---------- Nút ---------- */
#mls-panel .mls-actions {
    display: flex;
    gap: var(--mls-s2);
    margin-bottom: var(--mls-s3);
}
#mls-panel .mls-actions button {
    flex: 1 1 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: var(--mls-s2) var(--mls-s3);
    background: transparent;
    color: var(--mls-fg);
    border: 1px solid var(--mls-border);
    border-radius: var(--mls-radius-sm);
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--mls-t) ease, border-color var(--mls-t) ease;
}
#mls-panel .mls-actions button svg { width: 14px; height: 14px; flex: 0 0 auto; }
#mls-panel .mls-actions button:hover:not(:disabled) { background: var(--mls-bg-subtle); border-color: var(--mls-border-strong); }
#mls-panel .mls-actions button.mls-primary {
    background: var(--mls-primary);
    border-color: var(--mls-primary);
    color: #FFFFFF;
}
#mls-panel .mls-actions button.mls-primary:hover:not(:disabled) { background: var(--mls-primary-dark); border-color: var(--mls-primary-dark); }
#mls-panel .mls-actions button.mls-stop {
    background: var(--mls-danger);
    border-color: var(--mls-danger);
    color: #FFFFFF;
}
#mls-panel .mls-actions button.mls-stop:hover:not(:disabled) { background: var(--mls-danger-dark); border-color: var(--mls-danger-dark); }
#mls-panel .mls-actions button:disabled { opacity: 0.45; cursor: not-allowed; }
#mls-panel .mls-actions button.mls-rong { flex: 2 1 0; }
#mls-panel .mls-actions-nho { margin-top: var(--mls-s2); margin-bottom: 0; }
#mls-panel .mls-actions-nho button { min-height: 28px; font-size: 11.5px; font-weight: 600; background: var(--mls-bg-subtle); }
#mls-panel .mls-actions-nho button:hover:not(:disabled) { background: var(--mls-bg-hover); }

/* ---------- Tiến độ và trạng thái ---------- */
#mls-panel .mls-progress {
    height: 6px;
    margin-bottom: var(--mls-s2);
    background: var(--mls-bg-subtle);
    border-radius: 999px;
    overflow: hidden;
}
#mls-panel .mls-progress span {
    display: block;
    height: 100%;
    width: 0;
    background: var(--mls-primary);
    border-radius: 999px;
    transition: width var(--mls-t) linear;
}
#mls-panel .mls-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--mls-s2);
    margin-bottom: var(--mls-s3);
    background: var(--mls-bg-subtle);
    border-radius: var(--mls-radius-sm);
    font-size: 12px;
    color: var(--mls-fg);
    min-height: 32px;
}
#mls-panel .mls-spinner {
    width: 13px;
    height: 13px;
    flex: 0 0 auto;
    border: 2px solid var(--mls-border-strong);
    border-top-color: var(--mls-primary);
    border-radius: 50%;
    animation: mls-spin 700ms linear infinite;
}
@keyframes mls-spin { to { transform: rotate(360deg); } }

#mls-panel .mls-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--mls-s2);
    margin-bottom: var(--mls-s3);
}
#mls-panel .mls-stat {
    width: 100%;
    padding: var(--mls-s2);
    background: var(--mls-bg);
    border: 1px solid var(--mls-divider);
    border-radius: var(--mls-radius-sm);
    text-align: center;
    font-family: inherit;
    cursor: pointer;
    transition: background var(--mls-t) ease, border-color var(--mls-t) ease;
}
#mls-panel .mls-stat:hover { background: var(--mls-bg-subtle); }
#mls-panel .mls-stat b { display: block; font-size: 17px; font-weight: 700; line-height: 1.2; }
#mls-panel .mls-stat span { display: block; margin-top: 2px; font-size: 10.5px; color: var(--mls-fg-muted); }
#mls-panel .mls-stat.ok b { color: var(--mls-ok-fg); }
#mls-panel .mls-stat.warn b { color: var(--mls-warn-fg); }
#mls-panel .mls-stat.err b { color: var(--mls-err-fg); }
/* Ô đang bật lọc: viền đậm cùng màu trạng thái, để biết ngay đang lọc gì mà
   không phải đọc dòng chữ nhỏ bên dưới bảng. */
#mls-panel .mls-stat-bat { border-width: 2px; padding: calc(var(--mls-s2) - 1px); }
#mls-panel .mls-stat-bat.ok { border-color: var(--mls-ok-fg); background: var(--mls-ok-bg); }
#mls-panel .mls-stat-bat.warn { border-color: var(--mls-warn-fg); background: var(--mls-warn-bg); }
#mls-panel .mls-stat-bat.err { border-color: var(--mls-err-fg); background: var(--mls-err-bg); }

#mls-panel .mls-loc-hint {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0 0 var(--mls-s2);
}
#mls-panel .mls-loc-xoa {
    padding: 1px 8px;
    background: transparent;
    border: 1px solid var(--mls-border);
    border-radius: 999px;
    color: var(--mls-fg);
    font-size: 10.5px;
    font-weight: 600;
    cursor: pointer;
}
#mls-panel .mls-loc-xoa:hover { background: var(--mls-bg-subtle); }

/* ---------- Bảng kết quả ---------- */
#mls-panel .mls-table-wrap {
    max-height: 300px;
    overflow: auto;
    border: 1px solid var(--mls-divider);
    border-radius: var(--mls-radius-sm);
}
#mls-panel table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11.5px; }
#mls-panel th, #mls-panel td {
    padding: 5px var(--mls-s2);
    border-bottom: 1px solid var(--mls-divider);
    text-align: left;
    vertical-align: top;
    word-break: break-word;
    color: var(--mls-fg);
}
/* Số phát hành, Trạng thái, Chữ ký, Sheet đều ngắn/cố định — Báo lỗi lấy hết
   phần rộng còn lại. table-layout: fixed chặn hẳn kiểu tự-co bất thường mà
   auto layout có thể tạo ra khi một ô có nội dung không có bề rộng tự nhiên
   rõ ràng (như hộp -webkit-line-clamp). */
#mls-panel th:nth-child(1), #mls-panel td:nth-child(1) { width: 9%; }
#mls-panel th:nth-child(2), #mls-panel td:nth-child(2) { width: 11%; }
#mls-panel th:nth-child(3), #mls-panel td:nth-child(3) { width: 16%; }
#mls-panel th:nth-child(4), #mls-panel td:nth-child(4) { width: 24%; }
#mls-panel th:nth-child(5), #mls-panel td:nth-child(5) { width: 20%; }
#mls-panel th:nth-child(6), #mls-panel td:nth-child(6) { width: 10%; }
#mls-panel th:nth-child(7), #mls-panel td:nth-child(7) { width: 10%; }
#mls-panel th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--mls-bg-subtle);
    font-weight: 600;
    white-space: nowrap;
}
#mls-panel tbody tr:last-child td { border-bottom: 0; }
#mls-panel td.mls-badge-cell { white-space: nowrap; }
/* Cột Trạng thái (thứ 3: Số phát hành, Thửa/Tờ, Trạng thái...) dùng chung
   class mls-badge-cell với Chữ ký/Sheet, nhưng chữ dài hơn hẳn ("Chưa đạt
   nhóm 1", "Không tìm thấy"). Giữ nowrap chung cho cả nhóm từng khiến badge
   Trạng thái tràn ngang, đè lên chữ cột Báo lỗi kế bên — trả nó về ngắt dòng
   bình thường. */
#mls-panel td:nth-child(3).mls-badge-cell { white-space: normal; }
#mls-panel .mls-badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
    /* KHÔNG đặt nowrap ở đây: cột Trạng thái, Chữ ký, Sheet dùng chung class
       .mls-badge-cell, không tách riêng được badge ngắn với badge dài như
       "Chưa đạt nhóm 1" qua CSS. Ép nowrap từng khiến badge dài tràn ngang,
       đè lên chữ cột Báo lỗi kế bên — để badge tự xuống dòng bình thường. */
    /* td cha có word-break: break-word, kế thừa xuống đây thì badge xuống
       dòng vỡ giữa từ ("nhóm" thành "nhó" / "m 1"). Badge chỉ nên ngắt ở chỗ
       có khoảng trắng, không ngắt tuỳ tiện trong một từ. */
    word-break: normal;
    overflow-wrap: normal;
}
#mls-panel .mls-badge.ok { background: var(--mls-ok-bg); color: var(--mls-ok-fg); }
#mls-panel .mls-badge.warn { background: var(--mls-warn-bg); color: var(--mls-warn-fg); }
#mls-panel .mls-badge.err { background: var(--mls-err-bg); color: var(--mls-err-fg); }
#mls-panel code {
    padding: 1px 4px;
    background: var(--mls-bg-subtle);
    border-radius: 3px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 10.5px;
    color: var(--mls-fg);
}

#mls-panel .mls-empty {
    padding: var(--mls-s5) var(--mls-s3);
    border: 1px dashed var(--mls-divider);
    border-radius: var(--mls-radius-sm);
    text-align: center;
    font-size: 12px;
    color: var(--mls-fg-muted);
}

#mls-panel .mls-foot {
    margin: var(--mls-s4) 0 0;
    padding-top: var(--mls-s3);
    border-top: 1px solid var(--mls-divider);
    font-size: 11px;
    color: var(--mls-fg-muted);
}

/* ---------- Hộp xác nhận ghi dữ liệu ---------- */
#mls-panel .mls-xacnhan {
    margin-bottom: var(--mls-s3);
    padding: var(--mls-s3);
    border: 2px solid var(--mls-danger);
    border-radius: var(--mls-radius-sm);
    background: var(--mls-err-bg);
}
#mls-panel .mls-xacnhan h3 {
    margin: 0 0 var(--mls-s2);
    font-size: 12.5px;
    font-weight: 700;
    color: var(--mls-err-fg);
}
#mls-panel .mls-xacnhan dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 3px var(--mls-s2);
    margin: 0 0 var(--mls-s3);
    font-size: 11.5px;
}
#mls-panel .mls-xacnhan dt { font-weight: 600; color: var(--mls-fg-muted); }
#mls-panel .mls-xacnhan dd { margin: 0; word-break: break-word; }
#mls-panel .mls-xacnhan .mls-canhbao {
    margin: 0 0 var(--mls-s3);
    font-size: 11.5px;
    color: var(--mls-err-fg);
    font-weight: 600;
}
#mls-panel .mls-xacnhan .mls-actions { margin-bottom: 0; }

#mls-panel .mls-chon {
    border-color: var(--mls-primary);
    background: var(--mls-bg-subtle);
}
#mls-panel .mls-chon h3 { color: var(--mls-primary); }
#mls-panel .mls-chon-list {
    display: flex;
    flex-direction: column;
    gap: var(--mls-s1);
    margin-bottom: var(--mls-s3);
}
#mls-panel .mls-chon-item {
    display: flex;
    align-items: flex-start;
    gap: var(--mls-s2);
    margin: 0;
    padding: 5px var(--mls-s2);
    background: var(--mls-bg);
    border: 1px solid var(--mls-border);
    border-radius: var(--mls-radius-sm);
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
}
#mls-panel .mls-chon-item:hover { border-color: var(--mls-primary); }
#mls-panel .mls-chon-item input[type="checkbox"] {
    width: 14px;
    height: 14px;
    margin: 2px 0 0;
    flex: 0 0 auto;
    accent-color: var(--mls-primary);
    cursor: pointer;
}
#mls-panel .mls-chon-item em {
    display: block;
    font-style: normal;
    font-size: 10.5px;
    color: var(--mls-fg-muted);
}
#mls-panel .mls-chon .mls-canhbao { color: var(--mls-fg-muted); font-weight: 500; }

#mls-molai {
    position: fixed;
    right: 16px;
    bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: #1E40AF;
    color: #FFFFFF;
    border: 0;
    border-radius: 50%;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.28);
    cursor: pointer;
    z-index: 2147483647;
    transition: background 160ms ease;
}
#mls-molai:hover { background: #1E3A8A; }
#mls-molai:focus-visible { outline: 2px solid #1E40AF; outline-offset: 3px; }
#mls-molai svg { width: 20px; height: 20px; }

#mls-panel .mls-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
}

@media (prefers-reduced-motion: reduce) {
    #mls-panel *, #mls-panel *::before, #mls-panel *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
`;

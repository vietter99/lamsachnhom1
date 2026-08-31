# Hướng dẫn sử dụng bộ Skills đã cài

Tất cả skill nằm ở `C:\Users\User\.claude\skills\`. Đây là personal skills, dùng được ở **mọi project**, không riêng thư mục này.

---

## 1. Đã cài gì

**16 skills** và **3 subagents**.

| Nguồn | Skills |
|---|---|
| `skills/prompt-master-main.zip` | `prompt-master` |
| `skills/stop-slop-main.zip` | `stop-slop` |
| `skills/caveman-1.10.0.zip` | `caveman`, `caveman-commit`, `caveman-review`, `caveman-compress`, `caveman-stats`, `caveman-help`, `cavecrew` |
| `github.com/nextlevelbuilder/ui-ux-pro-max-skill` | `ui-ux-pro-max`, `design`, `design-system`, `ui-styling`, `brand`, `slides`, `banner-design` |

Subagents ở `C:\Users\User\.claude\agents\`: `cavecrew-investigator`, `cavecrew-builder`, `cavecrew-reviewer`. Skill `cavecrew` hỏng nếu thiếu chúng.

Restart Claude Code một lần sau khi cài để nạp skills.

---

## 2. Cách gọi skill

Ba cách, hiệu quả như nhau:

1. **Gõ slash command**: `/ui-ux-pro-max`, `/caveman`, `/stop-slop`
2. **Nói tự nhiên** — skill tự kích hoạt theo mô tả. "Thiết kế trang landing cho tiệm spa" bật `ui-ux-pro-max`.
3. **Chỉ định thẳng**: "dùng skill design-system để tạo token cho project này"

Cách 1 chắc chắn nhất khi bạn biết mình cần gì.

---

## 3. Nhóm UI/UX

### `ui-ux-pro-max`

Database tra cứu offline: 84 style, 192 bảng màu, 74 cặp font, 98 quy tắc UX, 25 loại biểu đồ, 22 tech stack.

Bắt đầu project mới, chạy bước này trước:

```powershell
python "C:/Users/User/.claude/skills/ui-ux-pro-max/scripts/search.py" "<loại sản phẩm> <ngành> <từ khóa style>" --design-system -p "Tên Project"
```

Lưu design system ra file để dùng lại giữa các session:

```powershell
python "C:/Users/User/.claude/skills/ui-ux-pro-max/scripts/search.py" "<query>" --design-system --persist -p "ToolSoHoa" --output-dir "c:/Users/User/Desktop/toolsohoa"
```

Tạo `design-system/toolsohoa/MASTER.md` làm nguồn chân lý, và thư mục `pages/` cho override từng trang.

Tra cứu lẻ theo domain:

```powershell
python "C:/Users/User/.claude/skills/ui-ux-pro-max/scripts/search.py" "<từ khóa>" --domain <domain> -n 5
```

| Cần gì | `--domain` |
|---|---|
| Mẫu theo loại sản phẩm | `product` |
| Style giao diện | `style` |
| Bảng màu | `color` |
| Cặp font | `typography` |
| Google Fonts lẻ | `google-fonts` |
| Chọn loại biểu đồ | `chart` |
| Quy tắc UX và accessibility | `ux` |
| Cấu trúc landing page | `landing` |
| Bộ icon | `icons` |
| Animation GSAP | `gsap` |
| Tối ưu React/Next | `react` |
| Guideline app và native | `web` |

Tra theo stack: `--stack nextjs`, hoặc `react`, `vue`, `svelte`, `flutter`, `swiftui`, `tailwind`, `shadcn`, `wpf`, `winui`, `avalonia`, `threejs`.

Ba nút chỉnh: `--variance 1-10` (mức phá cách), `--motion 1-10` (mức animation), `--density 1-10` (mật độ thông tin).

**Kết quả không phải lúc nào cũng đúng.** Skill khớp theo từ khóa, nên hỏi về một panel công cụ nội bộ nó vẫn có thể trả về style landing page. Đọc rồi bỏ phần không hợp, đừng áp máy móc.

### `ui-styling`
shadcn/ui, Tailwind, Radix. Dùng khi code component thật: dialog, form, table, dark mode, responsive layout.

### `design-system`
Token 3 lớp (primitive, semantic, component), CSS variables, thang spacing và typography, spec component.

### `design`
Logo 55 style, bộ nhận diện CIP 50 hạng mục, slide HTML, banner, icon SVG, ảnh social. Phần sinh ảnh bằng Gemini cần API key:

```powershell
$env:GEMINI_API_KEY = "your-key"   # lấy ở https://aistudio.google.com/apikey
```

Tra cứu không cần key:

```powershell
python "C:/Users/User/.claude/skills/design/scripts/logo/search.py" "tech startup modern" --design-brief -p "TenBrand"
```

### `brand`
Brand voice, messaging framework, quản lý asset, checklist đồng bộ thương hiệu.

### `slides`
Slide HTML có Chart.js, dùng design token, công thức copywriting.

### `banner-design`
**Chạy hạn chế.** Skill gọi sang `ai-artist`, `ai-multimodal`, `chrome-devtools` — ba skill repo không kèm theo. Phần sinh ảnh và chụp screenshot sẽ lỗi. Phần tra kích thước banner theo nền tảng (`references/banner-sizes-and-styles.md`) vẫn dùng tốt.

---

## 4. Nhóm caveman

### `caveman`
Cắt khoảng 65% output token, giữ nguyên độ chính xác kỹ thuật.

| Lệnh | Mức nén |
|---|---|
| `/caveman lite` | Bỏ chữ thừa, giữ nguyên câu |
| `/caveman` | Mặc định. Bỏ mạo từ và lời rào đón, câu cụt được |
| `/caveman ultra` | Nén tối đa, ưu tiên bảng thay văn xuôi |
| `/caveman wenyan-lite\|full\|ultra` | Kiểu văn ngôn Hán cổ |
| `/caveman off` | Tắt |

Dùng khi session dài, refactor nhiều file, đọc log. Đừng dùng khi đang học hoặc cần hiểu lý do.

### `caveman-commit`
Commit message Conventional Commits, subject tối đa 50 ký tự, chỉ có body khi "tại sao" không hiển nhiên.

### `caveman-review`
Review code và PR. Mỗi lỗi một dòng `file:L12: vấn đề. cách sửa.` Tag mức độ 🔴 bug, 🟡 risk, 🔵 nit, ❓ hỏi.

### `caveman-compress`
Nén file memory (`CLAUDE.md`, todo, preferences) để giảm input token. Ghi đè file gốc, backup bản đọc được vào `%LOCALAPPDATA%\caveman-compress\backups\`.

```
/caveman-compress CLAUDE.md
```

### `cavecrew`
Giao việc cho subagent, kết quả trả về đã nén khoảng 60%:

| Việc | Agent |
|---|---|
| X định nghĩa ở đâu, cái gì gọi Y | `cavecrew-investigator` |
| Sửa gọn 1-2 file | `cavecrew-builder` |
| Review diff | `cavecrew-reviewer` |

### `caveman-stats`
**Không cho số ở bản cài này.** Nó lấy dữ liệu từ hook `caveman-mode-tracker.js` mà tôi chưa cài. Xem mục 6.

---

## 5. Nhóm viết lách

### `prompt-master`
Viết và sửa prompt cho AI tool cụ thể: LLM, Cursor, Midjourney, AI ảnh, AI video, coding agent. Nó hỏi bạn nhắm tool nào trước khi xuất, trả lời rõ để khỏi mất lượt.

```
/prompt-master viết prompt cho Midjourney: ảnh sản phẩm mỹ phẩm nền tối
```

### `stop-slop`
Xoá dấu vết văn AI trong prose: cắt filler, bỏ trạng từ, phá cấu trúc công thức, ép câu chủ động. Dùng khi viết README, docs, mô tả sản phẩm, nội dung marketing.

```
/stop-slop     rồi dán đoạn văn cần sửa
```

---

## 6. Điều tôi đã không cài, và tại sao

Caveman gốc là plugin đầy đủ gồm hooks và statusline. Tôi chỉ cài phần skills để **không ghi đè `~/.claude/settings.json`** của bạn. Đó là thay đổi toàn cục, khó gỡ.

Hệ quả:

- `/caveman` chỉ có hiệu lực trong session hiện tại. Mở session mới phải gõ lại.
- `/caveman-stats` không hiển thị số liệu tiết kiệm token.
- Không có badge `[CAVEMAN]` ở statusline.

Muốn đủ tính năng, chạy hai lệnh này. Chúng thêm hook vào `settings.json` và tự backup thành `settings.json.bak`:

```powershell
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman
```

Gỡ sau này: `npx -y github:JuliusBrussee/caveman -- --uninstall`

`ui-ux-pro-max` bản gốc thiết kế để cài dạng plugin. Tôi đã sửa 11 đường dẫn `${CLAUDE_PLUGIN_ROOT}/...` trong `ui-ux-pro-max/SKILL.md` thành đường dẫn tuyệt đối để nó chạy đúng ở chế độ personal skill. Cập nhật skill từ repo sau này thì phải sửa lại.

---

## 7. Quy trình cho tool số hoá

Trước khi viết dòng code đầu tiên:

1. Chốt tech stack. `ui-ux-pro-max` route recommendation theo stack, đoán sai là lệch hết.
2. Sinh và lưu design system:
   ```powershell
   python "C:/Users/User/.claude/skills/ui-ux-pro-max/scripts/search.py" "<mô tả tool>" --design-system --persist -p "ToolSoHoa" --output-dir "c:/Users/User/Desktop/toolsohoa"
   ```
3. Đọc `design-system/toolsohoa/MASTER.md`, chỉnh tay chỗ nào không ưng.

Khi code UI: `ui-ux-pro-max` và `ui-styling` tự kích hoạt, cứ để chúng chạy nền.

Khi commit: `/caveman-commit`

Trước khi merge: `/caveman-review`

Khi viết README hoặc docs: `/stop-slop`

---

## 8. Kiểm tra nhanh

```powershell
# Đếm skill đã cài, kỳ vọng 16
(Get-ChildItem "C:\Users\User\.claude\skills" -Directory).Count

# Test script tra cứu
python "C:/Users/User/.claude/skills/ui-ux-pro-max/scripts/search.py" "dashboard" --domain style -n 2
```

Python có sẵn: `C:\Users\User\AppData\Local\Programs\Python\Python314\python.exe`
Node có sẵn: `C:\Program Files\nodejs\node.exe`

---

## 9. Gỡ skill

```powershell
Remove-Item -Recurse -Force "C:\Users\User\.claude\skills\<ten-skill>"
```

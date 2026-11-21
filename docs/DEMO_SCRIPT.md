# AvaGuard — Kịch bản quay và nội dung slide

Timeline dự kiến là **2 phút 48 giây**, chừa 12 giây so với giới hạn 3 phút. Người trình bày tự thao tác trên app, thuyết minh bằng tiếng Việt và dùng các nhãn tiếng Anh trên giao diện làm mốc chỉ dẫn. Bản quay dùng lượt quét mới để trình diễn **Scan** và **Export**, rồi dùng báo cáo G5 đã ký để trình diễn **Lookup**, **Import** và **Replay**.

## Chuẩn bị trước khi quay

- Mở [Scan](http://localhost:3001/) và [Lookup](http://localhost:3001/lookup). Kiểm tra phía trên hiện `Avalanche Fuji · 43113`. Dùng lệnh khởi động trong [README](../README.md) nếu app chưa chạy.
- Đặt JSON G5 Mint/pause vào một thư mục dễ tìm. Chọn thư mục khác cho file xuất trong lúc quay để tên file và snapshot dễ phân biệt.
- Mở bảng kết quả G5 ở cuối video. Với phần ví ký, dùng đoạn đã ghi hoặc hồ sơ giao dịch G5 và ghi rõ rằng đây là lần publish đã thực hiện. Tại Lookup, chọn bản ghi theo snapshot trong bảng dưới đây.

| Mốc Mint/pause dùng trong video | Giá trị đã kiểm chứng |
| --- | --- |
| Contract | `0xE2F96cA00564CEE3505Ac3B22D4cF0F66B730eC6` |
| Snapshot G5 | `61246821` |
| Điểm và phạm vi | `45 / 100 · Some signals`. 12 mục đã kiểm tra, 7 mục ngoài phạm vi, 0 mục không đọc được. |
| Tín hiệu có trọng số | `R-MINT +25`, `R-PAUSE +10`, `R-OWNER-EOA +10` |
| Report hash | `0xf8fb1ca6fae7e6ebb9e79694c30c1e1a89834c0aa6ad89997634d67d04cdc74c` |
| Giao dịch đã xác minh | `0xe1ba2e32585c0fcedab582c3e71618b81b3261c870744e6e56bfc6f593eb03f2`, block receipt `61247120` |
| File và kết quả | [JSON gốc](releases/m7-fuji/avaguard-0xe2f96ca00564cee3505ac3b22d4cf0f66b730ec6-61246821.json) · [Receipt](releases/m7-fuji/g5-mintpause-publication-2026-11-18.json) · [Replay và so sánh](releases/m7-fuji/g5-mintpause-validation-2026-11-18.json) |

## Kịch bản quay

### 0:00–0:14 — Giới thiệu

**Màn hình.** Trang Scan trên Fuji, giữ tên sản phẩm và nhãn mạng trong khung.

> Điểm tín hiệu của một token được tính từ dữ liệu nào? AvaGuard quét hợp đồng ERC hai mươi trên mạng thử nghiệm Avalanche Fuji, và cho bạn xem bằng chứng tại đúng block dùng để tính điểm.

### 0:14–0:46 — Quét và đọc bằng chứng

**Màn hình.** Dán địa chỉ Mint/pause, bấm **Scan contract**. Khi có kết quả, chỉ block, điểm và **Coverage**, rồi mở `R-MINT` và **Template explanation**. Đọc điểm và phạm vi đang hiện nếu cần nêu con số của lượt quét này.

> Mình thử quét hợp đồng mẫu Mint Pause. AvaGuard chốt dữ liệu tại một block cụ thể. Báo cáo hiện số block, mã băm của block, và điểm tín hiệu. Phần Coverage cho biết những mục nào đã được kiểm tra.
>
> Khi mở tín hiệu mint, mình thấy một mẫu trong bytecode, gợi ý rằng hợp đồng có thể có chức năng phát hành thêm token. Phần chi tiết giải thích AvaGuard nhận ra tín hiệu này bằng cách nào.

### 0:46–1:12 — Xuất JSON và chỉ giao dịch đã ký

**Màn hình.** Bấm **Export canonical JSON**. Sau đó chuyển sang đoạn đã ghi hoặc biên nhận Mint/pause G5. Giữ dòng snapshot `61246821` và block giao dịch `61247120` đủ lâu để đọc. Gắn chú thích **Giao dịch G5 đã xác minh**.

> Tiếp theo, mình xuất file JSON của lượt quét vừa rồi. Với bước công bố, mình mở biên nhận của một lần công bố trước đó, cho cùng token này. Ví đã được cấp quyền ký giao dịch qua MetaMask. Hợp đồng RiskRegistry ghi mã băm và phần tóm tắt của báo cáo lên Fuji.

### 1:12–1:52 — Tra commitment và nạp đúng JSON

**Màn hình.** Vào **Lookup**, dán cùng địa chỉ và bấm **Find latest**. Nếu cần, nhập `0` ở **History index** rồi bấm **Read history entry**. Kiểm tra snapshot `61246821`. Dừng một nhịp ở `Report body unavailable.`, rồi import JSON Mint/pause G5 và chỉ dòng `Commitment matches.`.

> Giờ mình sang trang tra cứu, nhập lại địa chỉ token, và chọn bản ghi của giao dịch vừa xem. Lúc này, AvaGuard mới chỉ hiện phần tóm tắt đọc từ Fuji. Để xem đầy đủ bằng chứng, mình nạp file JSON gốc của lần công bố đó.
>
> Thông báo trên màn hình xác nhận mã băm của báo cáo và các trường tóm tắt đều khớp với bản ghi trên Fuji.

### 1:52–2:24 — Replay block gốc và so sánh trạng thái mới

**Màn hình.** Bấm **Replay original block** và giữ kết quả `replay-matches` nếu app trả về như vậy. Sau đó bấm **Scan current state** và chỉ số block mới. Đọc thông báo thực tế trên màn hình.

> Bây giờ, mình chạy lại phép quét tại block gốc. Kết quả cho thấy báo cáo tạo lại có cùng mã băm với bản đã công bố.
>
> Sau đó, mình quét trạng thái hiện tại. AvaGuard lấy dữ liệu ở một block mới, rồi so sánh các tín hiệu và bằng chứng mà ứng dụng đang theo dõi.

### 2:24–2:48 — Kết quả và đường dẫn kiểm chứng

**Màn hình.** Hiện bảng bốn mẫu ở slide 3 rồi quay về bảng báo cáo trong README. Chỉ dòng Mint/pause để người xem chọn đúng JSON và receipt.

> Điểm tín hiệu của bốn mẫu lần lượt là không, bốn mươi lăm, sáu mươi và không. Các điểm này phản ánh phạm vi AvaGuard đã kiểm tra. Cả bốn báo cáo đều khớp với bản ghi, và cho cùng mã băm khi chạy lại tại block gốc. Bạn có thể mở README của AvaGuard trên GitHub, tải file JSON, và tự kiểm chứng.

## Xử lý nếu RPC phản hồi chậm

- Nếu cần rút thời lượng, giữ **Scan**, **Export**, **Lookup**, **Import** và **Replay**. Rút phần so sánh trạng thái mới hoặc cắt đoạn chờ và đánh dấu chuyển cảnh.
- Nếu replay báo `historical-state-unavailable`, giữ thông báo đang hiện. Khi dùng ảnh kết quả đã ghi nhận, gắn nhãn **Replay G5 tại block 61246821**.
- Nếu Scan báo `inconclusive`, thể hiện lý do và dòng `No score available`. Kiểm tra nhãn mạng và thử lại trước khi thu đoạn quét.
- Nếu quay lại một receipt đang chờ, dùng hash giao dịch đã hiển thị để tra cứu. Báo cáo dùng trong đoạn kiểm chứng vẫn là JSON đúng snapshot G5.

## Nội dung 5 slide tiếng Việt

### Slide 1 — Điểm tín hiệu có thể kiểm chứng

- **Vấn đề** — Người xem cần biết điểm rủi ro của ERC-20 dựa trên dữ liệu nào, ở block nào.
- **AvaGuard** — Hiện tín hiệu, bằng chứng, độ bao phủ và phương pháp quan sát trong một báo cáo Fuji.
- **Giá trị** — Một người khác có thể tải file báo cáo và tự đối chiếu.

**Hình gợi ý.** Một ảnh Scan có điểm, snapshot và **Coverage**. Dùng callout ngắn trỏ vào từng vùng.

### Slide 2 — Từ block Fuji đến bằng chứng tái lập

- **Quét** — Cố định chain `43113`, số block và block hash, rồi đọc bytecode và trạng thái.
- **Công bố** — Ví attester ghi hash và các trường tóm tắt vào `RiskRegistry`. JSON gốc được lưu thành file.
- **Kiểm chứng** — Người xem tra commitment, import JSON, rồi chạy lại trên block gốc.

**Hình gợi ý.** Vẽ hai nhánh từ **Quét** đến **File JSON** và **Ví → RiskRegistry**. Cả hai nhánh cùng đi vào **Lookup → Replay**.

### Slide 3 — Kết quả của bốn mẫu trên Fuji

| Mẫu | Điểm tín hiệu | Block snapshot | Tín hiệu quan sát |
| --- | ---: | ---: | --- |
| Baseline | 0 / 100 | 61245287 | Không có tín hiệu có trọng số |
| Mint/pause | 45 / 100 | 61246821 | Mint, pause và địa chỉ owner không có runtime code |
| Proxy | 60 / 100 | 61260485 | ERC-1967, mint và địa chỉ owner không có runtime code |
| Decoy | 0 / 100 | 61260797 | Không có `R-MINT`. Chỉ có ghi chú phạm vi `R-SOURCE-UNKNOWN`. |

**Dòng chốt trên slide.** Đọc điểm cùng phạm vi và phương pháp quan sát. [Nguồn bốn báo cáo](releases/m7-fuji/README.md#report-and-submission-ledger)

### Slide 4 — Bốn giao dịch và bốn lần replay khớp

- **4/4** biên nhận giao dịch Fuji thành công, đủ bốn JSON gốc.
- **4/4** commitment khớp qua đọc độc lập tại block `61260827`. Phiên trình duyệt không ví import khớp cả bốn file.
- **4/4** replay khớp theo bằng chứng trình duyệt. Báo cáo Mint/pause cũng replay khớp trong lần kiểm tra độc lập.

**Hình gợi ý.** Ảnh Lookup Mint/pause với hai dòng `Commitment matches` và `replay-matches`. [Bằng chứng G5](releases/m7-fuji/g5-acceptance-2026-11-18.json)

### Slide 5 — Tự kiểm chứng từ GitHub

- **Mở README** để chọn report Mint/pause và lấy JSON gốc.
- **Mở Lookup trên Fuji** để đối chiếu snapshot `61246821`, import file và bấm **Replay original block**.
- **Đọc bằng chứng** để xem receipt đã ký và liên kết source hợp đồng đã xác minh trên Builder Hub.

**Hình gợi ý.** Ba bước **GitHub → JSON → Replay** và ảnh dòng kết quả. Dẫn về [README](../README.md).

## Kiểm tra trước khi nộp

- [x] Dữ liệu G5 trong kịch bản và slide trỏ tới bốn JSON gốc, receipt và kết quả replay đã ghi nhận.
- [ ] Thu video tiếng Việt, xem lại thời lượng theo file xuất và xác nhận tối đa 3:00.
- [ ] Dàn 5 slide từ nội dung trên, xuất file và kiểm tra chữ, đường dẫn ở kích thước trình chiếu.
- [ ] Điền liên kết video và slide vào README, kiểm tra truy cập khi không đăng nhập rồi chuẩn bị nộp. G4 hosting là tùy chọn.

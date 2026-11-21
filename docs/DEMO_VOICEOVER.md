# AvaGuard | Lời thuyết minh demo

**Thời lượng dựng dự kiến 2:48.** Quay theo [kịch bản màn hình](DEMO_SCRIPT.md), cắt các đoạn chờ rồi thu giọng thành sáu đoạn. Đọc phần trích dẫn. Chừa một nhịp ở đầu và cuối mỗi đoạn để dễ ráp tiếng.

## Dùng với AI lồng tiếng

- Mỗi đoạn trích dẫn là một lần tạo giọng. Dán nguyên văn đoạn đó vào công cụ text to speech, không kèm tiêu đề hay ghi chú in nghiêng.
- Lời đọc đã viết số bằng chữ và bỏ ký hiệu như `/`, `·` hay địa chỉ hex để giọng đọc không đọc sai. Dấu phẩy và dấu chấm là chỗ ngắt nhịp.
- Chọn giọng tiếng Việt, tốc độ bình thường hoặc nhanh hơn một chút. Nghe lại từng đoạn và so thời lượng với khung giờ ở tiêu đề. Nếu đoạn nào dài quá, tăng nhẹ tốc độ hoặc cắt khoảng lặng thay vì bỏ chữ.
- Nếu công cụ đọc sai tên tiếng Anh, thay tên đó trong ô nhập bằng cách viết theo âm dưới đây. Chỉ đổi trong ô nhập của công cụ, giữ nguyên file này.

| Từ trong lời đọc | Viết theo âm khi cần |
| --- | --- |
| AvaGuard | A va gát |
| Avalanche Fuji | A va lăn Phu gi |
| ERC hai mươi | E rờ xê hai mươi |
| Mint Pause | Min pót |
| bytecode | bai cốt |
| Coverage | Cá vờ rịch |
| JSON | Giây sơn |
| MetaMask | Mê ta mát |
| RiskRegistry | Rít rê gít tri |
| README | Rít mi |
| GitHub | Gít hấp |

## 0:00–0:14 — Giới thiệu

*Ráp tiếng khi tên AvaGuard và nhãn Avalanche Fuji cùng hiện trên màn hình.*

> Điểm tín hiệu của một token được tính từ dữ liệu nào? AvaGuard quét hợp đồng ERC hai mươi trên mạng thử nghiệm Avalanche Fuji, và cho bạn xem bằng chứng tại đúng block dùng để tính điểm.

## 0:14–0:46 — Quét và đọc bằng chứng

*Dán địa chỉ mẫu Mint/pause và bấm **Scan contract**. Khi kết quả hiện, giữ khung hình có điểm, số block và **Coverage**. Mở `R-MINT`, rồi chỉ phần phương pháp quan sát và **Template explanation**.*

> Mình thử quét hợp đồng mẫu Mint Pause. AvaGuard chốt dữ liệu tại một block cụ thể. Báo cáo hiện số block, mã băm của block, và điểm tín hiệu. Phần Coverage cho biết những mục nào đã được kiểm tra.
>
> Khi mở tín hiệu mint, mình thấy một mẫu trong bytecode, gợi ý rằng hợp đồng có thể có chức năng phát hành thêm token. Phần chi tiết giải thích AvaGuard nhận ra tín hiệu này bằng cách nào.

## 0:46–1:12 — Xuất JSON và mở giao dịch đã xác minh

*Bấm **Export canonical JSON** ở câu đầu. Chuyển sang biên nhận với nhãn **Giao dịch G5 đã xác minh** khi lời đọc nhắc đến lần công bố trước. Giữ snapshot `61246821` và block giao dịch `61247120` trên hình.*

> Tiếp theo, mình xuất file JSON của lượt quét vừa rồi. Với bước công bố, mình mở biên nhận của một lần công bố trước đó, cho cùng token này. Ví đã được cấp quyền ký giao dịch qua MetaMask. Hợp đồng RiskRegistry ghi mã băm và phần tóm tắt của báo cáo lên Fuji.

## 1:12–1:52 — Tra bản ghi và nạp JSON gốc

*Trong **Lookup**, mở bản ghi Mint/pause có snapshot `61246821`. Giữ dòng `Report body unavailable.` một nhịp. Nạp [JSON gốc Mint/pause](releases/m7-fuji/avaguard-0xe2f96ca00564cee3505ac3b22d4cf0f66b730ec6-61246821.json). Ráp đoạn đọc thứ hai khi thấy `Commitment matches.`.*

> Giờ mình sang trang tra cứu, nhập lại địa chỉ token, và chọn bản ghi của giao dịch vừa xem. Lúc này, AvaGuard mới chỉ hiện phần tóm tắt đọc từ Fuji. Để xem đầy đủ bằng chứng, mình nạp file JSON gốc của lần công bố đó.
>
> Thông báo trên màn hình xác nhận mã băm của báo cáo và các trường tóm tắt đều khớp với bản ghi trên Fuji.

## 1:52–2:24 — Chạy lại ở block gốc

*Bấm **Replay original block**. Ráp câu báo khớp khi thấy `replay-matches`. Nếu giữ cảnh **Scan current state**, chỉ số block mới ở đoạn đọc thứ hai.*

> Bây giờ, mình chạy lại phép quét tại block gốc. Kết quả cho thấy báo cáo tạo lại có cùng mã băm với bản đã công bố.
>
> Sau đó, mình quét trạng thái hiện tại. AvaGuard lấy dữ liệu ở một block mới, rồi so sánh các tín hiệu và bằng chứng mà ứng dụng đang theo dõi.

## 2:24–2:48 — Kết quả và cách tự kiểm chứng

*Hiện bảng theo thứ tự Baseline, Mint/pause, Proxy, Decoy. Khi nhắc GitHub, chuyển sang bảng báo cáo trong README và giữ dòng Mint/pause để người xem thấy link JSON và biên nhận.*

> Điểm tín hiệu của bốn mẫu lần lượt là không, bốn mươi lăm, sáu mươi và không. Các điểm này phản ánh phạm vi AvaGuard đã kiểm tra. Cả bốn báo cáo đều khớp với bản ghi, và cho cùng mã băm khi chạy lại tại block gốc. Bạn có thể mở README của AvaGuard trên GitHub, tải file JSON, và tự kiểm chứng.

## Lời đọc thay thế khi dựng

- **Nếu replay hiện `historical-state-unavailable`.** Giữ thông báo trên hình và thay đoạn đọc đầu ở `1:52` bằng câu sau. Nếu chèn ảnh kết quả cũ, gắn nhãn **Replay G5 tại block 61246821**, rồi thêm câu thứ hai.

  > Trong lượt quay này, nguồn dữ liệu chưa trả đủ trạng thái tại block gốc, nên chưa chạy lại được phép quét.
  >
  > Đây là kết quả khớp đã ghi nhận tại block gốc, trong lần kiểm tra G năm.

- **Nếu cần rút thời lượng.** Bỏ cảnh **Scan current state** cùng đoạn lời đọc tương ứng. Giữ đủ thời gian để người xem đọc kết quả đối chiếu JSON và replay. Kiểm tra thời lượng trên file video xuất cuối, tối đa **3:00**.

Số liệu và kết quả đã ghi nhận có trong [bằng chứng G5](releases/m7-fuji/g5-acceptance-2026-11-18.json).

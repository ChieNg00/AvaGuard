# AvaGuard | Lời thuyết minh demo

**Thời lượng dựng dự kiến 2:48.** Quay theo [kịch bản màn hình](DEMO_SCRIPT.md), cắt các đoạn chờ rồi thu giọng thành sáu đoạn. Đọc phần trích dẫn. Chừa một nhịp ở đầu và cuối mỗi đoạn để dễ ráp tiếng.

## 0:00–0:14 — Giới thiệu

*Ráp tiếng khi tên AvaGuard và nhãn Avalanche Fuji cùng hiện trên màn hình.*

> Điểm rủi ro của một token dựa vào dữ liệu nào? AvaGuard quét hợp đồng ERC-20 trên Avalanche Fuji và cho thấy bằng chứng tại block dùng để tính điểm.

## 0:14–0:46 — Quét và đọc bằng chứng

*Dán địa chỉ mẫu Mint/pause và bấm **Scan contract**. Khi kết quả hiện, giữ khung hình có điểm, số block và **Coverage**. Mở `R-MINT`, rồi chỉ phần phương pháp quan sát và **Template explanation**.*

> Mình quét hợp đồng Mint Pause. AvaGuard lấy dữ liệu của lượt quét tại một block. Báo cáo hiện số block, mã băm của block và điểm tín hiệu. Mục Coverage cho biết những phần đã được kiểm tra.
>
> Khi mở tín hiệu mint, mình thấy một mẫu trong bytecode gợi ý hợp đồng có thể có chức năng phát hành thêm token. Phần chi tiết cho biết AvaGuard nhận diện tín hiệu này bằng cách nào.

## 0:46–1:12 — Xuất JSON và mở giao dịch đã xác minh

*Bấm **Export canonical JSON** ở câu đầu. Chuyển sang biên nhận với nhãn **Giao dịch G5 đã xác minh** khi lời đọc nhắc đến lần công bố trước. Giữ snapshot `61246821` và block giao dịch `61247120` trên hình.*

> Mình xuất file JSON của lượt quét vừa chạy. Đến phần công bố, mình mở biên nhận đã xác minh của một lần công bố trước cho cùng token. Ví được cấp quyền đã ký giao dịch qua MetaMask. Hợp đồng RiskRegistry ghi mã băm và các trường tóm tắt của báo cáo lên Fuji.

## 1:12–1:52 — Tra bản ghi và nạp JSON gốc

*Trong **Lookup**, mở bản ghi Mint/pause có snapshot `61246821`. Giữ dòng `Report body unavailable.` một nhịp. Nạp [JSON gốc Mint/pause](releases/m7-fuji/avaguard-0xe2f96ca00564cee3505ac3b22d4cf0f66b730ec6-61246821.json). Ráp đoạn đọc thứ hai khi thấy `Commitment matches.`.*

> Mình sang trang tra cứu, nhập lại địa chỉ token và chọn bản ghi của giao dịch vừa xem. Ban đầu, AvaGuard hiện bản tóm tắt đọc từ Fuji. Để xem đầy đủ bằng chứng, mình nạp file JSON gốc của lần công bố đó.
>
> Dòng Commitment matches cho biết mã băm tính lại từ báo cáo và các trường tóm tắt đều khớp với bản ghi trên Fuji.

## 1:52–2:24 — Chạy lại ở block gốc

*Bấm **Replay original block**. Ráp câu báo khớp khi thấy `replay-matches`. Nếu giữ cảnh **Scan current state**, chỉ số block mới ở đoạn đọc thứ hai.*

> Giờ mình chạy lại phép quét ở block gốc. Kết quả trên màn hình cho thấy báo cáo tái tạo có cùng mã băm với bản đã công bố.
>
> Tiếp theo, mình quét trạng thái hiện tại. AvaGuard lấy dữ liệu ở một block mới để so sánh các tín hiệu và bằng chứng mà ứng dụng theo dõi.

## 2:24–2:48 — Kết quả và cách tự kiểm chứng

*Hiện bảng theo thứ tự Baseline, Mint/pause, Proxy, Decoy. Khi nhắc GitHub, chuyển sang bảng báo cáo trong README và giữ dòng Mint/pause để người xem thấy link JSON và biên nhận.*

> Bốn mẫu trên Fuji có điểm lần lượt là không, bốn mươi lăm, sáu mươi và không. Cả bốn báo cáo đều khớp với bản ghi và cho cùng mã băm khi chạy lại ở block gốc. Mở README của AvaGuard trên GitHub để lấy file JSON và tự kiểm chứng.

## Lời đọc thay thế khi dựng

- **Nếu replay hiện `historical-state-unavailable`.** Giữ thông báo trên hình và thay đoạn đọc đầu ở `1:52` bằng câu sau. Nếu chèn ảnh kết quả cũ, gắn nhãn **Replay G5 tại block 61246821**, rồi thêm câu thứ hai.

  > Trong lượt quay này, nguồn dữ liệu chưa trả đủ trạng thái ở block gốc để chạy lại phép quét.
  >
  > Đây là kết quả khớp đã ghi nhận ở block gốc trong lần kiểm tra G5.

- **Nếu cần rút thời lượng.** Bỏ cảnh **Scan current state** cùng đoạn lời đọc tương ứng. Giữ đủ thời gian để người xem đọc kết quả đối chiếu JSON và replay. Kiểm tra thời lượng trên file video xuất cuối, tối đa **3:00**.

Số liệu và kết quả đã ghi nhận có trong [bằng chứng G5](releases/m7-fuji/g5-acceptance-2026-11-18.json).

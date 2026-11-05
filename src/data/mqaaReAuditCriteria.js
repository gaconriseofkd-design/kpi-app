// Criteria definition for MQAA Tái Đánh Giá (10 Sections)
// Extracted directly from MQAA TÁI ĐÁNH GIÁ.xlsx

export const MQAA_RE_AUDIT_SECTIONS = [
  { id: "Raw Material & FGs Warehouse", name: "1. Raw Material & FGs Warehouse", vnName: "Kho Nguyên Liệu & Thành Phẩm", excelSumRow: 15 },
  { id: "Lamination", name: "2. Lamination", vnName: "Công đoạn dán (Cán màng)", excelSumRow: 16 },
  { id: "Saw Cutting (Pre-fitting)", name: "3. Saw Cutting (Pre-fitting)", vnName: "Công đoạn cắt tấm", excelSumRow: 17 },
  { id: "Moulding (Hot-Press)", name: "4. Moulding (Hot-Press)", vnName: "Công đoạn thành hình (Ép nhiệt)", excelSumRow: 18 },
  { id: "Cutting Pairs", name: "5. Cutting Pairs", vnName: "Công đoạn chặt đôi", excelSumRow: 19 },
  { id: "Logo Printing", name: "6. Logo Printing", vnName: "Công đoạn In Logo", excelSumRow: 20 },
  { id: "Packing", name: "7. Packing", vnName: "Công đoạn Đóng gói", excelSumRow: 21 },
  { id: "Cutting Die & Board Management", name: "8. Cutting Die & Board Management", vnName: "Quản lý Dao và Thớt chặt", excelSumRow: 22 },
  { id: "Logo WIP Inventory Management", name: "9. Logo WIP Inventory Management", vnName: "Quản lý Logo tồn trong sản xuất", excelSumRow: 23 },
  { id: "Laboratory", name: "10. Laboratory", vnName: "Phòng thí nghiệm", excelSumRow: 24 }
];

export const MQAA_RE_AUDIT_CRITERIA = {
  "Raw Material & FGs Warehouse": {
    "meta": {
      "id": "Raw Material & FGs Warehouse",
      "name": "1. Kho Nguyên Liệu & Thành Phẩm / Raw Material & Finished Goods Warehouse",
      "start_row": 29,
      "end_row": 44,
      "summary_row": 45,
      "sum_row_in_summary": 15
    },
    "items": [
      {
        "excelRow": 29,
        "no": "1.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Tất cả các nguyên liệu được đặt trong kho, tránh mưa, nắng.",
        "titleEn": "All raw materials are stored in a warehouse, protected from rain and sunlight.",
        "rawText": "*1.1.1. Tất cả các nguyên liệu được đặt trong kho, tránh mưa, nắng.\nAll raw materials are stored in a warehouse, protected from rain and sunlight."
      },
      {
        "excelRow": 30,
        "no": "1.1.2",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Tất cả các nguyên liệu hoặc thành phẩm được đặt trên pallet và có nhãn ghi chú những thông tin tối thiểu như: tên nguyên liệu, nhà cung cấp, mã số lô, hạn dùng, SDS, TDS được dán trên nguyên liệu.",
        "titleEn": "All raw materials or finished goods shall be placed on pallets and labeled with, at a minimum, the following information: material name, supplier, batch number, and expiry date; SDS and TDS documentation shall also be affixed to the materials.",
        "rawText": "1.1.2. Tất cả các nguyên liệu hoặc thành phẩm được đặt trên pallet và có nhãn ghi chú những thông tin tối thiểu như: tên nguyên liệu, nhà cung cấp, mã số lô, hạn dùng, SDS, TDS được dán trên nguyên liệu.\nAll raw materials or finished goods shall be placed on pallets and labeled with, at a minimum, the following information: material name, supplier, batch number, and expiry date; SDS and TDS documentation shall also be affixed to the materials."
      },
      {
        "excelRow": 31,
        "no": "1.1.3",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Điều kiện nhiệt độ và độ ẩm tại khu vực kho được theo dõi bằng đồng hồ nhiệt độ và độ ẩm và ghi nhận vào nhật ký.",
        "titleEn": "Temperature and humidity conditions in the warehouse area are monitored using temperature and humidity gauges and recorded in the logbook.",
        "rawText": "*1.1.3. Điều kiện nhiệt độ và độ ẩm tại khu vực kho được theo dõi bằng đồng hồ nhiệt độ và độ ẩm và ghi nhận vào nhật ký. \nTemperature and humidity conditions in the warehouse area are monitored using temperature and humidity gauges and recorded in the logbook."
      },
      {
        "excelRow": 32,
        "no": "1.1.4",
        "isCritical": false,
        "maxScore": "N/A",
        "titleVn": "Kho có hệ thống cảnh báo khi nhiệt độ, độ ẩm tương đối vượt ngưỡng đối với vật liệu nhạy cảm không?",
        "titleEn": "Does the warehouse have an alarm system for when temperature or relative humidity exceeds the thresholds for sensitive materials?",
        "rawText": "1.1.4. Kho có hệ thống cảnh báo khi nhiệt độ, độ ẩm tương đối vượt ngưỡng đối với vật liệu nhạy cảm không?\nDoes the warehouse have an alarm system for when temperature or relative humidity exceeds the thresholds for sensitive materials?"
      },
      {
        "excelRow": 33,
        "no": "1.1.5",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Trạng thái chất lượng của vật liệu trong kho có được duy trì nhận diện rõ ràng không?",
        "titleEn": "Is the quality status of materials in the warehouse clearly maintained and identifiable?",
        "rawText": "*1.1.5. Trạng thái chất lượng của vật liệu trong kho có được duy trì nhận diện rõ ràng không?\nIs the quality status of materials in the warehouse clearly maintained and identifiable?"
      },
      {
        "excelRow": 34,
        "no": "1.1.6",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Việc nhận diện mã hàng, quy cách vật liệu có được định nghĩa rõ ràng không?",
        "titleEn": "Are the identification of item codes and material specifications clearly defined?",
        "rawText": "1.1.6. Việc nhận diện mã hàng, quy cách vật liệu có được định nghĩa rõ ràng không?\nAre the identification of item codes and material specifications clearly defined?"
      },
      {
        "excelRow": 35,
        "no": "1.1.7",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Hệ thống theo dõi số lô (Lot tracking/Traceability) có được triển khai trong kho không?",
        "titleEn": "Is a lot tracking (or traceability) system implemented in the warehouse?",
        "rawText": "1.1.7. Hệ thống theo dõi số lô (Lot tracking/Traceability) có được triển khai trong kho không?\nIs a lot tracking (or traceability) system implemented in the warehouse?"
      },
      {
        "excelRow": 36,
        "no": "1.1.8",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Việc tuân thủ nguyên tắc Vào trước - Xuất trước (FIFO) có được xác thực hiệu quả không?",
        "titleEn": "Is compliance with the First-In, First-Out (FIFO) principle effectively verified?",
        "rawText": "1.1.8. Việc tuân thủ nguyên tắc Vào trước - Xuất trước (FIFO) có được xác thực hiệu quả không?\nIs compliance with the First-In, First-Out (FIFO) principle effectively verified?"
      },
      {
        "excelRow": 37,
        "no": "1.1.9",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hạn sử dụng của vật liệu (như keo, mực, hóa chất) có được giám sát không?",
        "titleEn": "Are the expiration dates of materials (such as adhesives, inks, and chemicals) monitored?",
        "rawText": "*1.1.9. Hạn sử dụng của vật liệu (như keo, mực, hóa chất) có được giám sát không?\nAre the expiration dates of materials (such as adhesives, inks, and chemicals) monitored?"
      },
      {
        "excelRow": 38,
        "no": "1.1.10",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Việc phân loại, cách ly và bảo quản hóa chất có tuân thủ bảng chỉ dẫn an toàn hóa chất (SDS) không?",
        "titleEn": "Do the classification, segregation, and storage of chemicals comply with the Safety Data Sheet (SDS)?",
        "rawText": "*1.1.10. Việc phân loại, cách ly và bảo quản hóa chất có tuân thủ bảng chỉ dẫn an toàn hóa chất (SDS) không?\nDo the classification, segregation, and storage of chemicals comply with the Safety Data Sheet (SDS)?"
      },
      {
        "excelRow": 39,
        "no": "1.1.11",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hạn sử dụng của các vật liệu bán thành phẩm hoặc hóa chất pha trộn có được giám sát không?",
        "titleEn": "Are the expiration dates of semi-finished materials or blended chemicals monitored?",
        "rawText": "*1.1.11. Hạn sử dụng của các vật liệu bán thành phẩm hoặc hóa chất pha trộn có được giám sát không?\nAre the expiration dates of semi-finished materials or blended chemicals monitored?"
      },
      {
        "excelRow": 40,
        "no": "1.1.12",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Khả năng truy xuất nguồn gốc vật liệu từ kho ra đến chuyền sản xuất có được đảm bảo không?",
        "titleEn": "Is the traceability of materials from the warehouse to the production line ensured?",
        "rawText": "1.1.12. Khả năng truy xuất nguồn gốc vật liệu từ kho ra đến chuyền sản xuất có được đảm bảo không? \nIs the traceability of materials from the warehouse to the production line ensured?"
      },
      {
        "excelRow": 41,
        "no": "1.1.13",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Môi trường kho có các biện pháp phòng chống tổn hại vật liệu (mưa dột, chuột bọ, côn trùng...) không?",
        "titleEn": "Does the warehouse environment have measures in place to prevent damage to materials (e.g., from rain leaks, rodents, insects)?",
        "rawText": "*1.1.13. Môi trường kho có các biện pháp phòng chống tổn hại vật liệu (mưa dột, chuột bọ, côn trùng...) không?\nDoes the warehouse environment have measures in place to prevent damage to materials (e.g., from rain leaks, rodents, insects)?"
      },
      {
        "excelRow": 42,
        "no": "1.1.14",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Kho có tuân thủ quy định về sử dụng và kiểm soát các công cụ kim loại của nhà máy không?",
        "titleEn": "Does the warehouse comply with the factory's regulations regarding the use and control of metal tools?",
        "rawText": "*1.1.14. Kho có tuân thủ quy định về sử dụng và kiểm soát các công cụ kim loại của nhà máy không?\nDoes the warehouse comply with the factory's regulations regarding the use and control of metal tools?"
      },
      {
        "excelRow": 43,
        "no": "1.1.15",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Kho có tuân thủ quy định về chiều cao tối đa và loại pallet phù hợp khi chất nguyên liệu và thành phẩm trên kệ không? Does the warehouse comply with regulations regarding maximum height and appropriate pallet types when stacking raw materials and finished goods on the racks?",
        "titleEn": "",
        "rawText": "*1.1.15. Kho có tuân thủ quy định về chiều cao tối đa và loại pallet phù hợp khi chất nguyên liệu và thành phẩm trên kệ không? Does the warehouse comply with regulations regarding maximum height and appropriate pallet types when stacking raw materials and finished goods on the racks?"
      },
      {
        "excelRow": 44,
        "no": "1.1.16",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Kho có sơ đồ quản lý kệ theo chủng loại, màu sắc và khách hàng không? Kiểm tra ngẫu nhiên sản phẩm thực tế so với sơ đồ quản lý. Does the warehouse have a rack management layout organized by product type, color, and customer? Conduct random checks comparing actual products against the management layout.",
        "titleEn": "",
        "rawText": "*1.1.16. Kho có sơ đồ quản lý kệ theo chủng loại, màu sắc và khách hàng không? Kiểm tra ngẫu nhiên sản phẩm thực tế so với sơ đồ quản lý. Does the warehouse have a rack management layout organized by product type, color, and customer? Conduct random checks comparing actual products against the management layout."
      }
    ]
  },
  "Lamination": {
    "meta": {
      "id": "Lamination",
      "name": "2. Công đoạn dán / Lamination",
      "start_row": 49,
      "end_row": 71,
      "summary_row": 72,
      "sum_row_in_summary": 16
    },
    "items": [
      {
        "excelRow": 49,
        "no": "2.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?",
        "titleEn": "Are the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?",
        "rawText": "*2.1.1. Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?\nAre the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?"
      },
      {
        "excelRow": 50,
        "no": "2.1.2",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không?  Are the critical process parameters (Critical Parameters/CTQ) clearly identified?",
        "titleEn": "",
        "rawText": "2.1.2. Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không?  Are the critical process parameters (Critical Parameters/CTQ) clearly identified?"
      },
      {
        "excelRow": 51,
        "no": "2.1.3",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành dán?",
        "titleEn": "Raw materials are inspected against standards before the laminating process begins.?",
        "rawText": "2.1.3. Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành dán?\nRaw materials are inspected against standards before the laminating process begins.?"
      },
      {
        "excelRow": 52,
        "no": "2.1.4",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không?",
        "titleEn": "Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?",
        "rawText": "2.1.4. Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không?\nIs in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?"
      },
      {
        "excelRow": 53,
        "no": "2.1.5",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Quy trình sửa hàng lỗi (Rework) và xử lý khắc phục có được tiêu chuẩn hóa để tránh lỗi lặp lại không?",
        "titleEn": "Are the rework and corrective action processes standardized to prevent the recurrence of errors?",
        "rawText": "2.1.5. Quy trình sửa hàng lỗi (Rework) và xử lý khắc phục có được tiêu chuẩn hóa để tránh lỗi lặp lại không?\nAre the rework and corrective action processes standardized to prevent the recurrence of errors?"
      },
      {
        "excelRow": 54,
        "no": "2.1.6",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?",
        "titleEn": "Are quality risk mitigation measures being effectively implemented in the field?",
        "rawText": "2.1.6. Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?\nAre quality risk mitigation measures being effectively implemented in the field?"
      },
      {
        "excelRow": 55,
        "no": "2.1.7",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Tốc độ cán màng được kiểm tra và ghi nhận để đảm bảo rằng đủ thời gian sấy phù hợp với tiêu chuẩn?",
        "titleEn": "Is the lamination speed checked and recorded to ensure sufficient drying time in accordance with the standards?",
        "rawText": "2.1.7. Tốc độ cán màng được kiểm tra và ghi nhận để đảm bảo rằng đủ thời gian sấy phù hợp với tiêu chuẩn?\nIs the lamination speed checked and recorded to ensure sufficient drying time in accordance with the standards?"
      },
      {
        "excelRow": 56,
        "no": "2.1.8",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có quạt làm mát sau quy trình cán màng để ổn định tình trạng của thành phẩm?",
        "titleEn": "Is there a cooling fan after the lamination process to stabilize the condition of the finished product?",
        "rawText": "2.1.8. Có quạt làm mát sau quy trình cán màng để ổn định tình trạng của thành phẩm?\nIs there a cooling fan after the lamination process to stabilize the condition of the finished product?"
      },
      {
        "excelRow": 57,
        "no": "2.1.9",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có dùng dụng cụ chuyên dụng để kiểm tra nhiệt độ thực tế trống nhiệt của máy dán?",
        "titleEn": "Is specialized equipment used to check the actual temperature of the laminating machine's heat drum?",
        "rawText": "2.1.9.  Có dùng dụng cụ chuyên dụng để kiểm tra nhiệt độ thực tế trống nhiệt của máy dán?\nIs specialized equipment used to check the actual temperature of the laminating machine's heat drum?"
      },
      {
        "excelRow": 58,
        "no": "2.1.10",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Thông số cài đặt máy cán màng có tuân thủ bảng quy định điều kiện máy cho từng dạng kết hợp nguyên liệu? Do the lamination machine settings comply with the specified operating conditions for each material combination?",
        "titleEn": "",
        "rawText": "*2.1.10. Thông số cài đặt máy cán màng có tuân thủ bảng quy định điều kiện máy cho từng dạng kết hợp nguyên liệu? Do the lamination machine settings comply with the specified operating conditions for each material combination?"
      },
      {
        "excelRow": 59,
        "no": "2.1.11",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nhiệt độ của máy cán màng có được ghi nhận vào sổ theo dõi không?",
        "titleEn": "Is the temperature of the laminating machine recorded in the logbook?",
        "rawText": "2.1.11. Nhiệt độ của máy cán màng có được ghi nhận vào sổ theo dõi không?\nIs the temperature of the laminating machine recorded in the logbook?"
      },
      {
        "excelRow": 60,
        "no": "2.1.12",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Quạt gió có tuân thủ quy định không được thổi trực tiếp vào trống nhiệt máy cán màng không?",
        "titleEn": "Does the cooling fan comply with the requirement not to blow directly onto the laminating machine's heated roller?",
        "rawText": "*2.1.12. Quạt gió có tuân thủ quy định không được thổi trực tiếp vào trống nhiệt máy cán màng không?\nDoes the cooling fan comply with the requirement not to blow directly onto the laminating machine's heated roller?"
      },
      {
        "excelRow": 61,
        "no": "2.1.13",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Thiết bị đo lường còn hiệu lực hiệu chuẩn không? Như là Caliper kỹ thuật số, đồng hồ đo độ cứng Asker, máy đo nhiệt độ trống nhiệt máy cán màng? Are the measuring instruments still within their calibration validity period? Examples include digital calipers, Asker hardness testers, and temperature gauges for laminating machine heating drums?",
        "titleEn": "",
        "rawText": "*2.1.13. Thiết bị đo lường còn hiệu lực hiệu chuẩn không? Như là Caliper kỹ thuật số, đồng hồ đo độ cứng Asker, máy đo nhiệt độ trống nhiệt máy cán màng? Are the measuring instruments still within their calibration validity period? Examples include digital calipers, Asker hardness testers, and temperature gauges for laminating machine heating drums?"
      },
      {
        "excelRow": 62,
        "no": "2.1.14",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không?",
        "titleEn": "Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?",
        "rawText": "*2.1.14. Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? \nDo production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?"
      },
      {
        "excelRow": 63,
        "no": "2.1.15",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?",
        "titleEn": "Are non-conforming goods segregated and clearly labeled for identification?",
        "rawText": "*2.1.15. Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?\nAre non-conforming goods segregated and clearly labeled for identification?"
      },
      {
        "excelRow": 64,
        "no": "2.1.16",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?",
        "rawText": "2.1.16. Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nAre raw materials stored in the production area in accordance with regulations and clearly labeled for identification?"
      },
      {
        "excelRow": 65,
        "no": "2.1.17",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Is WIP stored in the designated area within the production zone and clearly labeled for identification?",
        "rawText": "2.1.17. WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nIs WIP stored in the designated area within the production zone and clearly labeled for identification?"
      },
      {
        "excelRow": 66,
        "no": "2.1.18",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Keo, dung môi dùng ở công đoạn cán màng có đủ tài liệu SDS, TDS không?",
        "titleEn": "Do the adhesives and solvents used in the lamination process have the necessary SDS and TDS documentation?",
        "rawText": "*2.1.18. Keo, dung môi dùng ở công đoạn cán màng có đủ tài liệu SDS, TDS không?\nDo the adhesives and solvents used in the lamination process have the necessary SDS and TDS documentation?"
      },
      {
        "excelRow": 67,
        "no": "2.1.19",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có công cụ hoặc phương pháp kiểm tra và xác nhận lượng keo trên trục lăn keo không?",
        "titleEn": "Are there any tools or methods to check and verify the amount of adhesive on the glue roller?",
        "rawText": "*2.1.19. Có công cụ hoặc phương pháp kiểm tra và xác nhận lượng keo trên trục lăn keo không?\nAre there any tools or methods to check and verify the amount of adhesive on the glue roller?"
      },
      {
        "excelRow": 68,
        "no": "2.1.20",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Keo trong khay chứa của máy cán màng có quá ít, tràn, bị vón cục hoặc lẫn tạp chất không?",
        "titleEn": "Is the amount of adhesive in the laminating machine's reservoir too low, overflowing, clumping, or contaminated with impurities?",
        "rawText": "2.1.20. Keo trong khay chứa của máy cán màng có quá ít, tràn, bị vón cục hoặc lẫn tạp chất không?\nIs the amount of adhesive in the laminating machine's reservoir too low, overflowing, clumping, or contaminated with impurities?"
      },
      {
        "excelRow": 69,
        "no": "2.1.21",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hiện trạng phủ keo trên bề mặt PU có được kiểm tra và xác nhận không?",
        "titleEn": "Is the condition of the adhesive coating on the PU surface inspected and verified?",
        "rawText": "*2.1.21. Hiện trạng phủ keo trên bề mặt PU có được kiểm tra và xác nhận không?\nIs the condition of the adhesive coating on the PU surface inspected and verified?"
      },
      {
        "excelRow": 70,
        "no": "2.1.22",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Bán thành phẩm sau cán dán có được kiểm tra và xác nhận độ bám dính không?",
        "titleEn": "Are semi-finished products checked and verified for adhesion after the lamination process?",
        "rawText": "*2.1.22. Bán thành phẩm sau cán dán có được kiểm tra và xác nhận độ bám dính không?\nAre semi-finished products checked and verified for adhesion after the lamination process?"
      },
      {
        "excelRow": 71,
        "no": "2.1.23",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định về tiêu chuẩn ánh sáng ở công đoạn kiểm tra ngoại quan sản phẩm không?",
        "titleEn": "Are the regulations regarding lighting standards for the product visual inspection stage being complied with?",
        "rawText": "*2.1.23. Có tuân thủ quy định về tiêu chuẩn ánh sáng ở công đoạn kiểm tra ngoại quan sản phẩm không?\nAre the regulations regarding lighting standards for the product visual inspection stage being complied with?"
      }
    ]
  },
  "Saw Cutting (Pre-fitting)": {
    "meta": {
      "id": "Saw Cutting (Pre-fitting)",
      "name": "3. Công đoạn cắt tấm / Saw Cutting (Pre-fitting)",
      "start_row": 76,
      "end_row": 86,
      "summary_row": 87,
      "sum_row_in_summary": 17
    },
    "items": [
      {
        "excelRow": 76,
        "no": "3.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?",
        "titleEn": "Are the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?",
        "rawText": "*3.1.1. Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?\nAre the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?"
      },
      {
        "excelRow": 77,
        "no": "3.1.2",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?",
        "titleEn": "",
        "rawText": "3.1.2. Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?"
      },
      {
        "excelRow": 78,
        "no": "3.1.3",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành cắt thành bán thành phẩm?",
        "titleEn": "Are raw materials inspected against standards before the bonding process begins?",
        "rawText": "3.1.3. Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành cắt thành bán thành phẩm?\nAre raw materials inspected against standards before the bonding process begins?"
      },
      {
        "excelRow": 79,
        "no": "3.1.4",
        "isCritical": false,
        "maxScore": "N/A",
        "titleVn": "Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không?",
        "titleEn": "Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?",
        "rawText": "3.1.4. Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không?\nIs in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?"
      },
      {
        "excelRow": 80,
        "no": "3.1.5",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?",
        "titleEn": "Are quality risk mitigation measures being effectively implemented in the field?",
        "rawText": "3.1.5. Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?\nAre quality risk mitigation measures being effectively implemented in the field?"
      },
      {
        "excelRow": 81,
        "no": "3.1.6",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không?",
        "titleEn": "Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?",
        "rawText": "*3.1.6. Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? \nDo production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?"
      },
      {
        "excelRow": 82,
        "no": "3.1.7",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?",
        "titleEn": "Are non-conforming goods segregated and clearly labeled for identification?",
        "rawText": "*3.1.7. Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?\nAre non-conforming goods segregated and clearly labeled for identification?"
      },
      {
        "excelRow": 83,
        "no": "3.1.8",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?",
        "rawText": "3.1.8. Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nAre raw materials stored in the production area in accordance with regulations and clearly labeled for identification?"
      },
      {
        "excelRow": 84,
        "no": "3.1.9",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Is WIP stored in the designated area within the production zone and clearly labeled for identification?",
        "rawText": "3.1.9. WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nIs WIP stored in the designated area within the production zone and clearly labeled for identification?"
      },
      {
        "excelRow": 85,
        "no": "3.1.10",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Bán thành phẩm trên chuyền có được cắt đúng kích thước yêu cầu của đơn hàng?",
        "titleEn": "Have the work-in-process been cut to the dimensions required by the order?",
        "rawText": "3.1.10. Bán thành phẩm trên chuyền có được cắt đúng kích thước yêu cầu của đơn hàng?\nHave the work-in-process been cut to the dimensions required by the order?"
      },
      {
        "excelRow": 86,
        "no": "3.1.11",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Bán thành phẩm sau cắt có được sắp đặt và che chắn theo quy định không?",
        "titleEn": "Are work-in-process arranged and covered in accordance with regulations after cutting?",
        "rawText": "3.1.11. Bán thành phẩm sau cắt có được sắp đặt và che chắn theo quy định không?\nAre work-in-process arranged and covered in accordance with regulations after cutting?"
      }
    ]
  },
  "Moulding (Hot-Press)": {
    "meta": {
      "id": "Moulding (Hot-Press)",
      "name": "4. Công đoạn thành hình / Moulding (Hot-Press)",
      "start_row": 91,
      "end_row": 110,
      "summary_row": 111,
      "sum_row_in_summary": 18
    },
    "items": [
      {
        "excelRow": 91,
        "no": "4.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?",
        "titleEn": "Are the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?",
        "rawText": "*4.1.1. Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?\nAre the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?"
      },
      {
        "excelRow": 92,
        "no": "4.1.2",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?",
        "titleEn": "",
        "rawText": "4.1.2. Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?"
      },
      {
        "excelRow": 93,
        "no": "4.1.3",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành ép",
        "titleEn": "Are raw materials inspected against standards before the bonding process begins?",
        "rawText": "4.1.3. Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành ép\nAre raw materials inspected against standards before the bonding process begins?"
      },
      {
        "excelRow": 94,
        "no": "4.1.4",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không?",
        "titleEn": "Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?",
        "rawText": "4.1.4. Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không?\nIs in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?"
      },
      {
        "excelRow": 95,
        "no": "4.1.5",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?",
        "titleEn": "Are quality risk mitigation measures being effectively implemented in the field?",
        "rawText": "4.1.5. Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?\nAre quality risk mitigation measures being effectively implemented in the field?"
      },
      {
        "excelRow": 96,
        "no": "4.1.6",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không?",
        "titleEn": "Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?",
        "rawText": "*4.1.6. Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? \nDo production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?"
      },
      {
        "excelRow": 97,
        "no": "4.1.7",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?",
        "titleEn": "Are non-conforming goods segregated and clearly labeled for identification?",
        "rawText": "*4.1.7. Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?\nAre non-conforming goods segregated and clearly labeled for identification?"
      },
      {
        "excelRow": 98,
        "no": "4.1.8",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?",
        "rawText": "4.1.8. Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nAre raw materials stored in the production area in accordance with regulations and clearly labeled for identification?"
      },
      {
        "excelRow": 99,
        "no": "4.1.9",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Is WIP stored in the designated area within the production zone and clearly labeled for identification?",
        "rawText": "4.1.9. WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nIs WIP stored in the designated area within the production zone and clearly labeled for identification?"
      },
      {
        "excelRow": 100,
        "no": "4.1.10",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Nhiệt độ khuôn cài đặt và thực tế có được kiểm tra và ghi nhận vào sổ nhật ký sản xuất không?",
        "titleEn": "Are the set and actual mold temperatures checked and recorded in the production log?",
        "rawText": "*4.1.10. Nhiệt độ khuôn cài đặt và thực tế có được kiểm tra và ghi nhận vào sổ nhật ký sản xuất không?\nAre the set and actual mold temperatures checked and recorded in the production log?"
      },
      {
        "excelRow": 101,
        "no": "4.1.11",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Bán thành phẩm sau ép có được sắp đặt và che chắn theo quy định không?",
        "titleEn": "Are work-in-process arranged and covered in accordance with regulations after moulding?",
        "rawText": "4.1.11. Bán thành phẩm sau ép có được sắp đặt và che chắn theo quy định không?\nAre work-in-process arranged and covered in accordance with regulations after moulding?"
      },
      {
        "excelRow": 102,
        "no": "4.1.12",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Quạt gió có tuân thủ quy định không được thổi trực tiếp vào khuôn đang ở nhiệt độ cao không?",
        "titleEn": "Does the fan comply with the regulation prohibiting direct airflow onto the mold while it is at a high temperature?",
        "rawText": "*4.1.12. Quạt gió có tuân thủ quy định không được thổi trực tiếp vào khuôn đang ở nhiệt độ cao không?\nDoes the fan comply with the regulation prohibiting direct airflow onto the mold while it is at a high temperature?"
      },
      {
        "excelRow": 103,
        "no": "4.1.13",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Kết quả kiểm tra ngẫu nhiên nhiệt độ khuôn thực tế tài thời điểm đánh giá?",
        "titleEn": "Results of the random check of actual mold temperature at the time of assessment?",
        "rawText": "4.1.13. Kết quả kiểm tra ngẫu nhiên nhiệt độ khuôn thực tế tài thời điểm đánh giá?\nResults of the random check of actual mold temperature at the time of assessment?"
      },
      {
        "excelRow": 104,
        "no": "4.1.14",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Chức năng hiển thị thời gian ép và nhiệt độ ép trên máy có hoạt động không?",
        "titleEn": "Does the function that displays the pressing time and temperature on the machine work?",
        "rawText": "4.1.14. Chức năng hiển thị thời gian ép và nhiệt độ ép trên máy có hoạt động không?\nDoes the function that displays the pressing time and temperature on the machine work?"
      },
      {
        "excelRow": 105,
        "no": "4.1.15",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Trình tự thao tác ép nhiệt có tuân thủ hướng dẫn công việc / SOP không?",
        "titleEn": "Does the heat-pressing procedure comply with the work instructions / SOP?",
        "rawText": "4.1.15. Trình tự thao tác ép nhiệt có tuân thủ hướng dẫn công việc / SOP không?\nDoes the heat-pressing procedure comply with the work instructions / SOP?"
      },
      {
        "excelRow": 106,
        "no": "4.1.16",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Thiết bị đo lường còn hiệu lực hiệu chuẩn không? Như là Caliper kỹ thuật số,  máy và cảm biến đo nhiệt độ bề mặt khuôn ép. Is the calibration for the measuring equipment—such as digital calipers and injection mold surface temperature sensors—still valid?",
        "titleEn": "",
        "rawText": "*4.1.16. Thiết bị đo lường còn hiệu lực hiệu chuẩn không? Như là Caliper kỹ thuật số,  máy và cảm biến đo nhiệt độ bề mặt khuôn ép. Is the calibration for the measuring equipment—such as digital calipers and injection mold surface temperature sensors—still valid?"
      },
      {
        "excelRow": 107,
        "no": "4.1.17",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Bán thành phẩm sau ép có được kiểm tra độ dày mặt cắt khi thay đổi khuôn?",
        "titleEn": "Is the cross-sectional thickness of semi-finished moulded insoles be inspected after pressing when the mold is changed?",
        "rawText": "*4.1.17. Bán thành phẩm sau ép có được kiểm tra độ dày mặt cắt khi thay đổi khuôn?\nIs the cross-sectional thickness of semi-finished moulded insoles be inspected after pressing when the mold is changed?"
      },
      {
        "excelRow": 108,
        "no": "4.1.18",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Tỷ lệ lỗi ở công đoạn ép nhiệt thành hình có được theo dõi và cải thiện khi vượt quá mục tiêu cho phép không? Is the defect rate at the heat-molding stage monitored and improved when it exceeds the allowable target?",
        "titleEn": "",
        "rawText": "4.1.18. Tỷ lệ lỗi ở công đoạn ép nhiệt thành hình có được theo dõi và cải thiện khi vượt quá mục tiêu cho phép không? Is the defect rate at the heat-molding stage monitored and improved when it exceeds the allowable target?"
      },
      {
        "excelRow": 109,
        "no": "4.1.19",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Khuôn chờ sản xuất, lông đền kim loại có được quản lý và đặt để đúng quy định không?",
        "titleEn": "Are production molds and metal washers managed and stored in accordance with regulations?",
        "rawText": "4.1.19. Khuôn chờ sản xuất, lông đền kim loại có được quản lý và đặt để đúng quy định không?\nAre production molds and metal washers managed and stored in accordance with regulations?"
      },
      {
        "excelRow": 110,
        "no": "4.1.20",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định đặt để, bảo quản và sử dụng chất chống bám dính trên khuôn không?",
        "titleEn": "Are the regulations regarding the placement, storage, and use of mold release agents being followed?",
        "rawText": "*4.1.20. Có tuân thủ quy định đặt để, bảo quản và sử dụng chất chống bám dính trên khuôn không?\nAre the regulations regarding the placement, storage, and use of mold release agents being followed?"
      }
    ]
  },
  "Cutting Pairs": {
    "meta": {
      "id": "Cutting Pairs",
      "name": "5. Công đoạn chặt đôi / Cutting Pairs",
      "start_row": 115,
      "end_row": 130,
      "summary_row": 131,
      "sum_row_in_summary": 19
    },
    "items": [
      {
        "excelRow": 115,
        "no": "5.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?",
        "titleEn": "Are the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?",
        "rawText": "*5.1.1. Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?\nAre the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?"
      },
      {
        "excelRow": 116,
        "no": "5.1.2",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?",
        "titleEn": "",
        "rawText": "5.1.2. Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?"
      },
      {
        "excelRow": 117,
        "no": "5.1.3",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành chặt",
        "titleEn": "Are raw materials inspected against standards before the bonding process begins?",
        "rawText": "5.1.3. Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành chặt\nAre raw materials inspected against standards before the bonding process begins?"
      },
      {
        "excelRow": 118,
        "no": "5.1.4",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không? Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?",
        "titleEn": "",
        "rawText": "5.1.4. Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không? Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?"
      },
      {
        "excelRow": 119,
        "no": "5.1.5",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?",
        "titleEn": "Are quality risk mitigation measures being effectively implemented in the field?",
        "rawText": "5.1.5. Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?\nAre quality risk mitigation measures being effectively implemented in the field?"
      },
      {
        "excelRow": 120,
        "no": "5.1.6",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?",
        "titleEn": "",
        "rawText": "*5.1.6. Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?"
      },
      {
        "excelRow": 121,
        "no": "5.1.7",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?",
        "titleEn": "Are non-conforming goods segregated and clearly labeled for identification?",
        "rawText": "*5.1.7. Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?\nAre non-conforming goods segregated and clearly labeled for identification?"
      },
      {
        "excelRow": 122,
        "no": "5.1.8",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng? Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?",
        "titleEn": "",
        "rawText": "5.1.8. Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng? Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?"
      },
      {
        "excelRow": 123,
        "no": "5.1.9",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Is WIP stored in the designated area within the production zone and clearly labeled for identification?",
        "rawText": "5.1.9. WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nIs WIP stored in the designated area within the production zone and clearly labeled for identification?"
      },
      {
        "excelRow": 124,
        "no": "5.1.10",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Tem nhận diện dao chặt có còn nguyên vẹn và đầy đủ thông tin không?",
        "titleEn": "Is the identification label on the cutting die intact and does it contain complete information?",
        "rawText": "*5.1.10. Tem nhận diện dao chặt có còn nguyên vẹn và đầy đủ thông tin không?\nIs the identification label on the cutting die intact and does it contain complete information?"
      },
      {
        "excelRow": 125,
        "no": "5.1.11",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định loại thớt chặt dùng trên máy tự động hoặc máy thường không? Có thay đổi mặt thớt khi chặt theo quy định không?",
        "titleEn": "Are the regulations regarding the type of cutting board used on automatic or manual machines being followed? Are the cutting board surfaces flipped over during the operating process in accordance with the regulations?",
        "rawText": "*5.1.11. Có tuân thủ quy định loại thớt chặt dùng trên máy tự động hoặc máy thường không? Có thay đổi mặt thớt khi chặt theo quy định không?\nAre the regulations regarding the type of cutting board used on automatic or manual machines being followed? Are the cutting board surfaces flipped over during the operating process in accordance with the regulations?"
      },
      {
        "excelRow": 126,
        "no": "5.1.12",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Lưỡi dao chặt có được kiểm tra đảm bảo không bị mẻ, biến dạng không?",
        "titleEn": "Is the cutting die blade inspected to ensure it is free from chips or deformation?",
        "rawText": "*5.1.12. Lưỡi dao chặt có được kiểm tra đảm bảo không bị mẻ, biến dạng không?\nIs the cutting die blade inspected to ensure it is free from chips or deformation?"
      },
      {
        "excelRow": 127,
        "no": "5.1.13",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định số lớp tối đa được phép chồng lên nhau khi chặt hàng Die Cut và hàng thành hình không? Are the regulations regarding the maximum number of stacked layers for die-cut and formed products being followed?",
        "titleEn": "",
        "rawText": "5.1.13. Có tuân thủ quy định số lớp tối đa được phép chồng lên nhau khi chặt hàng Die Cut và hàng thành hình không? Are the regulations regarding the maximum number of stacked layers for die-cut and formed products being followed?"
      },
      {
        "excelRow": 128,
        "no": "5.1.14",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định khi tra dầu chống dính vào lưỡi dao không?",
        "titleEn": "Are the regulations followed when applying non-stick oil to the blade of cutting die?",
        "rawText": "5.1.14. Có tuân thủ quy định khi tra dầu chống dính vào lưỡi dao không?\nAre the regulations followed when applying non-stick oil to the blade of cutting die?"
      },
      {
        "excelRow": 129,
        "no": "5.1.15",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Dầu chống dính dùng cho dao chặt có SDS và báo cáo RSL đạt chuẩn AFIRM không?",
        "titleEn": "Does the anti-stick oil used for cutting die have an SDS and an RSL report that meets AFIRM standards?",
        "rawText": "*5.1.15. Dầu chống dính dùng cho dao chặt có SDS và báo cáo RSL đạt chuẩn AFIRM không?\nDoes the anti-stick oil used for cutting die have an SDS and an RSL report that meets AFIRM standards?"
      },
      {
        "excelRow": 130,
        "no": "5.1.16",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Dao chặt có được sắp xếp gọn gàng, đặt đúng vị trí theo quy định, tránh mặt dao tiếp xúc với bề mặt kim loại khác không? Are the cutting die arranged neatly and placed in their designated locations, ensuring the blade does not come into contact with other metal surfaces?",
        "titleEn": "",
        "rawText": "5.1.16. Dao chặt có được sắp xếp gọn gàng, đặt đúng vị trí theo quy định, tránh mặt dao tiếp xúc với bề mặt kim loại khác không? Are the cutting die arranged neatly and placed in their designated locations, ensuring the blade does not come into contact with other metal surfaces?"
      }
    ]
  },
  "Logo Printing": {
    "meta": {
      "id": "Logo Printing",
      "name": "6. Công đoạn In Logo / Logo Printing",
      "start_row": 135,
      "end_row": 155,
      "summary_row": 156,
      "sum_row_in_summary": 20
    },
    "items": [
      {
        "excelRow": 135,
        "no": "6.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?",
        "titleEn": "Are the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?",
        "rawText": "*6.1.1. Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?\nAre the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?"
      },
      {
        "excelRow": 136,
        "no": "6.1.2",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?",
        "titleEn": "",
        "rawText": "6.1.2. Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?"
      },
      {
        "excelRow": 137,
        "no": "6.1.3",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành in",
        "titleEn": "Are raw materials inspected against standards before the bonding process begins?",
        "rawText": "6.1.3. Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành in\nAre raw materials inspected against standards before the bonding process begins?"
      },
      {
        "excelRow": 138,
        "no": "6.1.4",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không? Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?",
        "titleEn": "",
        "rawText": "6.1.4. Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không? Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?"
      },
      {
        "excelRow": 139,
        "no": "6.1.5",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?",
        "titleEn": "Are quality risk mitigation measures being effectively implemented in the field?",
        "rawText": "6.1.5. Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?\nAre quality risk mitigation measures being effectively implemented in the field?"
      },
      {
        "excelRow": 140,
        "no": "6.1.6",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?",
        "titleEn": "",
        "rawText": "*6.1.6. Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?"
      },
      {
        "excelRow": 141,
        "no": "6.1.7",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?",
        "titleEn": "Are non-conforming goods segregated and clearly labeled for identification?",
        "rawText": "*6.1.7. Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?\nAre non-conforming goods segregated and clearly labeled for identification?"
      },
      {
        "excelRow": 142,
        "no": "6.1.8",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng? Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?",
        "titleEn": "",
        "rawText": "6.1.8. Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng? Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?"
      },
      {
        "excelRow": 143,
        "no": "6.1.9",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Is WIP stored in the designated area within the production zone and clearly labeled for identification?",
        "rawText": "6.1.9. WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nIs WIP stored in the designated area within the production zone and clearly labeled for identification?"
      },
      {
        "excelRow": 144,
        "no": "6.1.10",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Thời gian và nhiện độ in có được kiểm tra và ghi nhận vào sổ nhật ký sản xuất không?",
        "titleEn": "Are the printing time and temperature checked and recorded in the production log book?",
        "rawText": "*6.1.10. Thời gian và nhiện độ in có được kiểm tra và ghi nhận vào sổ nhật ký sản xuất không?\nAre the printing time and temperature checked and recorded in the production log book?"
      },
      {
        "excelRow": 145,
        "no": "6.1.11",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Chức năng hiển thị thời gian ép và nhiệt độ ép trên máy có hoạt động không?",
        "titleEn": "Does the function that displays the pressing time and temperature on the machine work?",
        "rawText": "6.1.11. Chức năng hiển thị thời gian ép và nhiệt độ ép trên máy có hoạt động không?\nDoes the function that displays the pressing time and temperature on the machine work?"
      },
      {
        "excelRow": 146,
        "no": "6.1.12",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Thiết bị đo lường còn hiệu lực hiệu chuẩn không? Như là máy và cảm biến đo nhiệt độ bề mặt trục in.",
        "titleEn": "Is the calibration of the measuring equipment still valid? For example, the instruments and sensors used to measure the surface temperature of the printing bar.",
        "rawText": "*6.1.12.  Thiết bị đo lường còn hiệu lực hiệu chuẩn không? Như là máy và cảm biến đo nhiệt độ bề mặt trục in.\nIs the calibration of the measuring equipment still valid? For example, the instruments and sensors used to measure the surface temperature of the printing bar."
      },
      {
        "excelRow": 147,
        "no": "6.1.13",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Quạt gió có tuân thủ quy định không được thổi trực tiếp vào trục in đang ở nhiệt độ cao không?",
        "titleEn": "Does the fan comply with the regulation prohibiting direct airflow onto the printing-bar while it is at a high temperature?",
        "rawText": "6.1.13. Quạt gió có tuân thủ quy định không được thổi trực tiếp vào trục in đang ở nhiệt độ cao không?\nDoes the fan comply with the regulation prohibiting direct airflow onto the printing-bar while it is at a high temperature?"
      },
      {
        "excelRow": 148,
        "no": "6.1.14",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Tỷ lệ lỗi ở công đoạn in Logo có được theo dõi và cải thiện khi vượt quá mục tiêu cho phép không?",
        "titleEn": "Is the defect rate at the logo printing stage monitored and improved when it exceeds the allowable target?",
        "rawText": "6.1.14. Tỷ lệ lỗi ở công đoạn in Logo có được theo dõi và cải thiện khi vượt quá mục tiêu cho phép không?\nIs the defect rate at the logo printing stage monitored and improved when it exceeds the allowable target?"
      },
      {
        "excelRow": 149,
        "no": "6.1.15",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Kết quả kiểm tra ngẫu nhiên nhiệt độ trục in thực tế tài thời điểm đánh giá?",
        "titleEn": "Results of the random check of actual printing bar temperature at the time of assessment?",
        "rawText": "6.1.15. Kết quả kiểm tra ngẫu nhiên nhiệt độ trục in thực tế tài thời điểm đánh giá?\nResults of the random check of actual printing bar temperature at the time of assessment?"
      },
      {
        "excelRow": 150,
        "no": "6.1.16",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Máy có hổ trợ công nhân xác định vị trí in logo không, như là đèn laser định vị trí logo khi in?",
        "titleEn": "Does the machine assist the operator in positioning the logo for printing—for example, by using a laser guide to mark the logo's position?",
        "rawText": "6.1.16. Máy có hổ trợ công nhân xác định vị trí in logo không, như là đèn laser định vị trí logo khi in?\nDoes the machine assist the operator in positioning the logo for printing—for example, by using a laser guide to mark the logo's position?"
      },
      {
        "excelRow": 151,
        "no": "6.1.17",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định dùng rập kiểm tra vị trí logo trên đế thành phẩm tại công đoạn không?",
        "titleEn": "Is the requires of using a template to check the logo position on the finished insoles at printing stage being followed?",
        "rawText": "6.1.17. Có tuân thủ quy định dùng rập kiểm tra vị trí logo trên đế thành phẩm tại công đoạn không?\nIs the requires of using a template to check the logo position on the finished insoles at printing stage being followed?"
      },
      {
        "excelRow": 152,
        "no": "6.1.18",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Logo sau in có được kiểm tra độ bám dính và ghi nhận vào sổ nhật ký sản xuất không?",
        "titleEn": "Is the bonding of the logo checked after printing and recorded in the production log?",
        "rawText": "*6.1.18. Logo sau in có được kiểm tra độ bám dính và ghi nhận vào sổ nhật ký sản xuất không?\nIs the bonding of the logo checked after printing and recorded in the production log?"
      },
      {
        "excelRow": 153,
        "no": "6.1.19",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có kế hoạch kiểm tra, vệ sinh và thay thế trục in định kỳ không?",
        "titleEn": "Is there a plan for the periodic inspection, cleaning, and replacement of the printing bar?",
        "rawText": "*6.1.19. Có kế hoạch kiểm tra, vệ sinh và thay thế trục in định kỳ không?\nIs there a plan for the periodic inspection, cleaning, and replacement of the printing bar?"
      },
      {
        "excelRow": 154,
        "no": "6.1.20",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Chai lọ đựng dung môi, hóa chất dùng tại công đoạn in có nắp an toàn và tem nhãn nhận dạng và cảnh báo an toàn không?",
        "titleEn": "Do the containers for solvents and chemicals used in the printing process have safety caps and labels for identification and safety warnings?",
        "rawText": "*6.1.20. Chai lọ đựng dung môi, hóa chất dùng tại công đoạn in có nắp an toàn và tem nhãn nhận dạng và cảnh báo an toàn không?\nDo the containers for solvents and chemicals used in the printing process have safety caps and labels for identification and safety warnings?"
      },
      {
        "excelRow": 155,
        "no": "6.1.21",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có hướng dẫn công việc và lưu ý an toàn khi thay thế trục in ở nhiệt độ cao không?",
        "titleEn": "Are there work instructions and safety precautions for replacing high-temperature printing bar?",
        "rawText": "*6.1.21. Có hướng dẫn công việc và lưu ý an toàn khi thay thế trục in ở nhiệt độ cao không?\nAre there work instructions and safety precautions for replacing high-temperature printing bar?"
      }
    ]
  },
  "Packing": {
    "meta": {
      "id": "Packing",
      "name": "7. Công đoạn Đóng gói / Packing",
      "start_row": 162,
      "end_row": 179,
      "summary_row": 180,
      "sum_row_in_summary": 21
    },
    "items": [
      {
        "excelRow": 162,
        "no": "7.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?",
        "titleEn": "Are the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?",
        "rawText": "*7.1.1. Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ Hướng dẫn vận hành tiêu chuẩn (SOP) và hướng dẫn công việc (WI) có sẵn tại công đoạn không?\nAre the production order, confirmed sample, Standard Operating Procedure (SOP), and Work Instruction (WI) available at the workstation?"
      },
      {
        "excelRow": 163,
        "no": "7.1.2",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?",
        "titleEn": "",
        "rawText": "7.1.2. Các thông số kỹ thuật trọng yếu (Critical Parameters/CTQ) của quy trình có được nhận diện rõ ràng không? Are the critical process parameters (Critical Parameters/CTQ) clearly identified?"
      },
      {
        "excelRow": 164,
        "no": "7.1.3",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành đóng gói",
        "titleEn": "Are raw materials inspected against standards before the bonding process begins?",
        "rawText": "7.1.3. Nguyên vật liệu được kiểm tra với tiêu chuẩn trước khi tiến hành đóng gói\nAre raw materials inspected against standards before the bonding process begins?"
      },
      {
        "excelRow": 165,
        "no": "7.1.4",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không? Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?",
        "titleEn": "",
        "rawText": "7.1.4. Việc kiểm tra chất lượng trong quá trình (IPQC) theo kế hoạch kiểm tra có được duy trì ổn định không? Is in-process quality control (IPQC) being consistently maintained in accordance with the inspection plan?"
      },
      {
        "excelRow": 166,
        "no": "7.1.5",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?",
        "titleEn": "Are quality risk mitigation measures being effectively implemented in the field?",
        "rawText": "7.1.5. Các biện pháp giảm thiểu rủi ro chất lượng có được triển khai hiệu quả tại hiện trường không?\nAre quality risk mitigation measures being effectively implemented in the field?"
      },
      {
        "excelRow": 167,
        "no": "7.1.6",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?",
        "titleEn": "",
        "rawText": "*7.1.6. Quản lý và công nhân có tuân thủ quy định về việc dụng cụ kim loại không được phép dùng tại công đoạn sản xuất không? Do production leaders and workers comply with the regulation prohibiting the use of metal tools during the production stage?"
      },
      {
        "excelRow": 168,
        "no": "7.1.7",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?",
        "titleEn": "Are non-conforming goods segregated and clearly labeled for identification?",
        "rawText": "*7.1.7. Hàng không đạt có được cách ly và có tem nhãn nhận dạng rõ ràng không?\nAre non-conforming goods segregated and clearly labeled for identification?"
      },
      {
        "excelRow": 169,
        "no": "7.1.8",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng? Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?",
        "titleEn": "",
        "rawText": "7.1.8. Nguyên liệu có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng? Are raw materials stored in the production area in accordance with regulations and clearly labeled for identification?"
      },
      {
        "excelRow": 170,
        "no": "7.1.9",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?",
        "titleEn": "Is WIP stored in the designated area within the production zone and clearly labeled for identification?",
        "rawText": "7.1.9. WIP có được đặt để đúng quy định trong khu vực sản xuất và có tem nhãn nhận diện rõ ràng?\nIs WIP stored in the designated area within the production zone and clearly labeled for identification?"
      },
      {
        "excelRow": 171,
        "no": "7.1.10",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định kiểm tra máy dò kim bằng mẫu chuẩn, theo dõi số lượng lỗi và phân tích thành phẩm lỗi nhiễm kim loại không? Are there procedures in place to verify the needle detector using standard test pieces, track the number of defects, and analyze finished products rejected due to metal contamination?",
        "titleEn": "",
        "rawText": "*7.1.10. Có tuân thủ quy định kiểm tra máy dò kim bằng mẫu chuẩn, theo dõi số lượng lỗi và phân tích thành phẩm lỗi nhiễm kim loại không? Are there procedures in place to verify the needle detector using standard test pieces, track the number of defects, and analyze finished products rejected due to metal contamination?"
      },
      {
        "excelRow": 172,
        "no": "7.1.11",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định đặt để, vệ sinh và hiệu chuẩn máy dò kim trên chuyền và máy dò kim cầm tay định kỳ không? Are the regulations regarding the placement, cleaning, and periodic calibration of in-line and handheld needle detectors being followed?",
        "titleEn": "",
        "rawText": "*7.1.11. Có tuân thủ quy định đặt để, vệ sinh và hiệu chuẩn máy dò kim trên chuyền và máy dò kim cầm tay định kỳ không? Are the regulations regarding the placement, cleaning, and periodic calibration of in-line and handheld needle detectors being followed?"
      },
      {
        "excelRow": 173,
        "no": "7.1.12",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định 100% thành phầm được dò kim trước khi đóng thùng và nhập kho thành phẩm không? Is the requirement strictly followed to subject 100% of finished goods to metal detection before box packing and input Finished Goods warehouse?",
        "titleEn": "",
        "rawText": "*7.1.12. Có tuân thủ quy định 100% thành phầm được dò kim trước khi đóng thùng và nhập kho thành phẩm không? Is the requirement strictly followed to subject 100% of finished goods to metal detection before box packing and input Finished Goods warehouse?"
      },
      {
        "excelRow": 174,
        "no": "7.1.13",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định về chiều cao tối đa cho phép khi chất thùng thành phẩm trên pallet?",
        "titleEn": "Are the regulations regarding the maximum allowable height for stacking finished product boxes on pallets being followed?",
        "rawText": "7.1.13. Có tuân thủ quy định về chiều cao tối đa cho phép khi chất thùng thành phẩm trên pallet?\nAre the regulations regarding the maximum allowable height for stacking finished product boxes on pallets being followed?"
      },
      {
        "excelRow": 175,
        "no": "7.1.14",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Tem nhãn có đầy đủ mộc QC, dò kim khi nhập kho?",
        "titleEn": "Do the labels bear the full QC stamp and pass the metal detection check upon finished goods warehouse entry?",
        "rawText": "*7.1.14. Tem nhãn có đầy đủ mộc QC, dò kim khi nhập kho?\nDo the labels bear the full QC stamp and pass the metal detection check upon finished goods warehouse entry?"
      },
      {
        "excelRow": 176,
        "no": "7.1.15",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định về kiểm soát chất lượng khi làm bù hàng lỗi hoặc đắp đơn không?",
        "titleEn": "Are quality control regulations followed when producing replacements for defective goods or fulfilling backorders?",
        "rawText": "*7.1.15. Có tuân thủ quy định về kiểm soát chất lượng khi làm bù hàng lỗi hoặc đắp đơn không?\nAre quality control regulations followed when producing replacements for defective goods or fulfilling backorders?"
      },
      {
        "excelRow": 177,
        "no": "7.1.16",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định về kiểm tra và nghi nhận trọng lượng của mỗi thùng hàng thành phẩm trước khi nhập kho không? Are the regulations regarding the verification and recording of the weight of each carton of finished goods prior to warehousing being followed?",
        "titleEn": "",
        "rawText": "*7.1.16. Có tuân thủ quy định về kiểm tra và nghi nhận trọng lượng của mỗi thùng hàng thành phẩm trước khi nhập kho không? Are the regulations regarding the verification and recording of the weight of each carton of finished goods prior to warehousing being followed?"
      },
      {
        "excelRow": 178,
        "no": "7.1.17",
        "isCritical": true,
        "maxScore": "N/A",
        "titleVn": "Có thiết bị kiểm tra kim loại của cả thùng hàng thành phẩm khi nhập kho chờ xuất hàng không?",
        "titleEn": "Is there metal detection equipment for finished goods containers upon entry into the warehouse while awaiting shipment?",
        "rawText": "*7.1.17. Có thiết bị kiểm tra kim loại của cả thùng hàng thành phẩm khi nhập kho chờ xuất hàng không? \nIs there metal detection equipment for finished goods containers upon entry into the warehouse while awaiting shipment?"
      },
      {
        "excelRow": 179,
        "no": "7.1.18",
        "isCritical": true,
        "maxScore": "N/A",
        "titleVn": "Có tuân thủ quy định số lượng loại sản phẩm khác nhau được phép sản xuất trên chuyền tại cùng 1 thời điểm không? Is there compliance with the regulations regarding the number of different product types permitted to be produced on the line simultaneously?",
        "titleEn": "",
        "rawText": "*7.1.18. Có tuân thủ quy định số lượng loại sản phẩm khác nhau được phép sản xuất trên chuyền tại cùng 1 thời điểm không? Is there compliance with the regulations regarding the number of different product types permitted to be produced on the line simultaneously?"
      }
    ]
  },
  "Cutting Die & Board Management": {
    "meta": {
      "id": "Cutting Die & Board Management",
      "name": "8. Quản lý Dao, thớt chặt / Cutting Die and Board Management",
      "start_row": 184,
      "end_row": 189,
      "summary_row": 190,
      "sum_row_in_summary": 22
    },
    "items": [
      {
        "excelRow": 184,
        "no": "8.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có danh sách quản lý dao chặt và sơ đồ đặt để được nhận diện theo từng khách hàng không?",
        "titleEn": "Is there a management list for cutting die and a placement diagram to ensure identification by specific customer?",
        "rawText": "*8.1.1. Có danh sách quản lý dao chặt và sơ đồ đặt để được nhận diện theo từng khách hàng không?\nIs there a management list for cutting die and a placement diagram to ensure identification by specific customer?"
      },
      {
        "excelRow": 185,
        "no": "8.1.2",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tem nhãn nhận diện mã số, tên trên từng chiếc dao chặt không?",
        "titleEn": "Is there an identification label with the code and name on each cutting die?",
        "rawText": "*8.1.2. Có tem nhãn nhận diện mã số, tên trên từng chiếc dao chặt không?\nIs there an identification label with the code and name on each cutting die?"
      },
      {
        "excelRow": 186,
        "no": "8.1.3",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định kiểm tra và xác nhận khi nhận dao mới hoặc mượn trả dao chặt trong quá trình sản xuất giữa công nhân và nhân viên quản lý kho dao không?",
        "titleEn": "Are the inspection and verification procedures followed when workers receive new cutting die or borrow and return them during the production process, involving both the workers and the cutting die warehouse staff?",
        "rawText": "*8.1.3. Có tuân thủ quy định kiểm tra và xác nhận khi nhận dao mới hoặc mượn trả dao chặt trong quá trình sản xuất giữa công nhân và nhân viên quản lý kho dao không?\nAre the inspection and verification procedures followed when workers receive new cutting die or borrow and return them during the production process, involving both the workers and the cutting die warehouse staff?"
      },
      {
        "excelRow": 187,
        "no": "8.1.4",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có kế hoạch kiểm tra và sửa chửa hoặc thay thế dao chặt hư hỏng định kỳ không?",
        "titleEn": "Is there a plan to periodically inspect and repair or replace damaged cutting die?",
        "rawText": "8.1.4. Có kế hoạch kiểm tra và sửa chửa hoặc thay thế dao chặt hư hỏng định kỳ không?\nIs there a plan to periodically inspect and repair or replace damaged cutting die?"
      },
      {
        "excelRow": 188,
        "no": "8.1.5",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định kiểm tra thớt chặt khi nhận thớt mới không?",
        "titleEn": "Are the inspection procedures for cutting board followed upon receipt of new ones?",
        "rawText": "8.1.5. Có tuân thủ quy định kiểm tra thớt chặt khi nhận thớt mới không?\nAre the inspection procedures for cutting board followed upon receipt of new ones?"
      },
      {
        "excelRow": 189,
        "no": "8.1.6",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định hủy dao chặt của những khách hàng đã ngừng đặt hàng hơn 1 năm không?",
        "titleEn": "Are the regulations regarding the disposal of cutting dies for customers who have stopped placing orders for over a year being followed?",
        "rawText": "8.1.6. Có tuân thủ quy định hủy dao chặt của những khách hàng đã ngừng đặt hàng hơn 1 năm không?\nAre the regulations regarding the disposal of cutting dies for customers who have stopped placing orders for over a year being followed?"
      }
    ]
  },
  "Logo WIP Inventory Management": {
    "meta": {
      "id": "Logo WIP Inventory Management",
      "name": "9. Quản lý Logo tồn ở Sản xuất / Logo WIP Inventory Management",
      "start_row": 194,
      "end_row": 197,
      "summary_row": 198,
      "sum_row_in_summary": 23
    },
    "items": [
      {
        "excelRow": 194,
        "no": "9.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có hướng dẫn bảo quản logo tồn ở sản xuất và nhân viên phụ trách quản lý logo tồn trong sản xuất không? Are there guidelines for storing logo inventory in production, and is there a staff member responsible for managing it?",
        "titleEn": "",
        "rawText": "*9.1.1. Có hướng dẫn bảo quản logo tồn ở sản xuất và nhân viên phụ trách quản lý logo tồn trong sản xuất không? Are there guidelines for storing logo inventory in production, and is there a staff member responsible for managing it?"
      },
      {
        "excelRow": 195,
        "no": "9.1.2",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Kiểm tra ngẫu nhiên logo tồn trong sản xuất có còn tem nhãn nhận dạng rõ ràng không?",
        "titleEn": "Conduct random checks on logos in production inventory to verify whether they still bear clear identification labels?",
        "rawText": "*9.1.2. Kiểm tra ngẫu nhiên logo tồn trong sản xuất có còn tem nhãn nhận dạng rõ ràng không?\nConduct random checks on logos in production inventory to verify whether they still bear clear identification labels?"
      },
      {
        "excelRow": 196,
        "no": "9.1.3",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có tuân thủ quy định thời gian tối đa được phép sử dụng logo tồn trong sản xuất không?",
        "titleEn": "Is there compliance with the regulations regarding the maximum allowable period for using existing logo inventory in production?",
        "rawText": "*9.1.3. Có tuân thủ quy định thời gian tối đa được phép sử dụng logo tồn trong sản xuất không?\nIs there compliance with the regulations regarding the maximum allowable period for using existing logo inventory in production?"
      },
      {
        "excelRow": 197,
        "no": "9.1.4",
        "isCritical": false,
        "maxScore": "N/A",
        "titleVn": "Phòng lưu trữ logo tồn trong sản xuất có tuân thủ quy định nhiệt độ phòng: 27 +/- 2°C; RH (%): 50 +/- 10% và tránh ánh nắng mặt trời chiếu trực tiếp vào logo không? Does the production logo storage room comply with the specified conditions—temperature: 27 ± 2°C; relative humidity (RH): 50 ± 10%—and is it protected from direct sunlight?",
        "titleEn": "",
        "rawText": "9.1.4. Phòng lưu trữ logo tồn trong sản xuất có tuân thủ quy định nhiệt độ phòng: 27 +/- 2°C; RH (%): 50 +/- 10% và tránh ánh nắng mặt trời chiếu trực tiếp vào logo không? Does the production logo storage room comply with the specified conditions—temperature: 27 ± 2°C; relative humidity (RH): 50 ± 10%—and is it protected from direct sunlight?"
      }
    ]
  },
  "Laboratory": {
    "meta": {
      "id": "Laboratory",
      "name": "10. Phòng thí nghiệm / Laboratory",
      "start_row": 202,
      "end_row": 223,
      "summary_row": 224,
      "sum_row_in_summary": 24
    },
    "items": [
      {
        "excelRow": 202,
        "no": "10.1.1",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có danh sách thiết bị thí nghiệm với đầy đủ thông tin quan trọng không? Như là ngày tiếp nhận và đưa thiết bị vào vận hành, Model, Nhà sản xuất, yêu cầu về độ chính xác, chủng loại vật liệu phù hợp, phương pháp thí nghiệm đang sử dụng.",
        "titleEn": "Is there a list of testing equipment containing all key information? For example: dates of receipt and operating, model, manufacturer, accuracy requirements, suitable material types, and the testing methods currently in use.",
        "rawText": "*10.1.1. Có danh sách thiết bị thí nghiệm với đầy đủ thông tin quan trọng không? Như là ngày tiếp nhận và đưa thiết bị vào vận hành, Model, Nhà sản xuất, yêu cầu về độ chính xác, chủng loại vật liệu phù hợp, phương pháp thí nghiệm đang sử dụng. \nIs there a list of testing equipment containing all key information? For example: dates of receipt and operating, model, manufacturer, accuracy requirements, suitable material types, and the testing methods currently in use."
      },
      {
        "excelRow": 203,
        "no": "10.1.2",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Phòng thí nghiệm phải có quy trình theo dõi hạn sử dụng/biên lai đặt hàng và nhật ký ghi chép đối với vật tư tiêu hao không? Cần duy trì lượng vật tư tiêu hao dự trữ an toàn đủ dùng trong hai tháng.",
        "titleEn": "Shall Lab have a consumable's expiration date/order receipt and log tracking? Two-month safety stock of consumables.",
        "rawText": "*10.1.2. Phòng thí nghiệm phải có quy trình theo dõi hạn sử dụng/biên lai đặt hàng và nhật ký ghi chép đối với vật tư tiêu hao không? Cần duy trì lượng vật tư tiêu hao dự trữ an toàn đủ dùng trong hai tháng.\nShall Lab have a consumable's expiration date/order receipt and log tracking? Two-month safety stock of consumables."
      },
      {
        "excelRow": 204,
        "no": "10.1.3",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có triển khai kế hoạch bảo trì phòng ngừa và định kỳ cho thiết bị trong phòng thí nghiệm không?",
        "titleEn": "Is a preventive and periodic maintenance plan implemented for laboratory equipment?",
        "rawText": "10.1.3. Có triển khai kế hoạch bảo trì phòng ngừa và định kỳ cho thiết bị trong phòng thí nghiệm không?\nIs a preventive and periodic maintenance plan implemented for laboratory equipment?"
      },
      {
        "excelRow": 205,
        "no": "10.1.4",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Thiết bị phòng thí nghiệm phải được hiệu chuẩn bởi một phòng thí nghiệm hiệu chuẩn bên ngoài được công nhận theo tiêu chuẩn ISO 17025, nhà cung cấp hợp pháp hoặc nhà sản xuất? Lab Equipment must be calibrated by an external ISO 17025 accredited calibration lab/legal vendor/manufacturer.",
        "titleEn": "",
        "rawText": "10.1.4. Thiết bị phòng thí nghiệm phải được hiệu chuẩn bởi một phòng thí nghiệm hiệu chuẩn bên ngoài được công nhận theo tiêu chuẩn ISO 17025, nhà cung cấp hợp pháp hoặc nhà sản xuất? Lab Equipment must be calibrated by an external ISO 17025 accredited calibration lab/legal vendor/manufacturer."
      },
      {
        "excelRow": 206,
        "no": "10.1.5",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có trang bị bảo hộ (PPE) cho kỹ thuật viên phòng thí nghiệm không? bao gồm tủ hút khí độc, khẩu trang, găng tay, hộp sơ cứu, trạm rửa mắt khẩn cấp và bình chữa cháy. Sử dụng đúng loại dao, găng tay chống cắt và kính bảo hộ khi thực hiện công tác chuẩn bị cho thử nghiệm độ bền liên kết",
        "titleEn": "Is Personal Protective Equipment (PPE) provided for laboratory technicians? Such as fume  hood, masker , gloves ,emergency medical box, eye water station & Fire extinguisher. Use proper knives, anti-cut gloves & eyewear for bond test preparation.",
        "rawText": "*10.1.5. Có trang bị bảo hộ (PPE) cho kỹ thuật viên phòng thí nghiệm không? bao gồm tủ hút khí độc, khẩu trang, găng tay, hộp sơ cứu, trạm rửa mắt khẩn cấp và bình chữa cháy. Sử dụng đúng loại dao, găng tay chống cắt và kính bảo hộ khi thực hiện công tác chuẩn bị cho thử nghiệm độ bền liên kết\n Is Personal Protective Equipment (PPE) provided for laboratory technicians? Such as fume  hood, masker , gloves ,emergency medical box, eye water station & Fire extinguisher. Use proper knives, anti-cut gloves & eyewear for bond test preparation."
      },
      {
        "excelRow": 207,
        "no": "10.1.6",
        "isCritical": true,
        "maxScore": "N/A",
        "titleVn": "Phòng thí nghiệm có trạng bị hệ thống hút và xử lý khí thải chứa VOC (Hợp chất hữu cơ dễ bay hơi)?",
        "titleEn": "Is the laboratory equipped with a system to extract and treat exhaust air containing VOCs (Volatile Organic Compounds)?",
        "rawText": "*10.1.6.  Phòng thí nghiệm có trạng bị hệ thống hút và xử lý khí thải chứa VOC (Hợp chất hữu cơ dễ bay hơi)?\nIs the laboratory equipped with a system to extract and treat exhaust air containing VOCs (Volatile Organic Compounds)?"
      },
      {
        "excelRow": 208,
        "no": "10.1.7",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Phòng thí nghiệm có duy trì nhiệt độ phòng ở 23 +/- 2°C, RH (%) 50 +/- 5% không?",
        "titleEn": "Does the laboratory maintain the room temperature at 23 ± 2°C and relative humidity (RH) at 50 ± 5%?",
        "rawText": "*10.1.7. Phòng thí nghiệm có duy trì nhiệt độ phòng ở 23 +/- 2°C, RH (%) 50 +/- 5% không?\nDoes the laboratory maintain the room temperature at 23 ± 2°C and relative humidity (RH) at 50 ± 5%?"
      },
      {
        "excelRow": 209,
        "no": "10.1.8",
        "isCritical": false,
        "maxScore": "N/A",
        "titleVn": "Phòng thí nghiệm có sơ đồ bố trí thiết thị, máy móc phù hợp không? Tách biệt giữa phòng thiết bị, mẫu chờ thí nghiệm và văn phòng, khu vực riêng dành cho buồng thử nhiệt độ cao.",
        "titleEn": "Does the laboratory have a suitable layout for equipment and machinery? Are the equipment room, area for samples awaiting testing, and office space separated, with a dedicated area for the high-temperature test chamber?",
        "rawText": "10.1.8. Phòng thí nghiệm có sơ đồ bố trí thiết thị, máy móc phù hợp không? Tách biệt giữa phòng thiết bị, mẫu chờ thí nghiệm và văn phòng, khu vực riêng dành cho buồng thử nhiệt độ cao.\nDoes the laboratory have a suitable layout for equipment and machinery? Are the equipment room, area for samples awaiting testing, and office space separated, with a dedicated area for the high-temperature test chamber?"
      },
      {
        "excelRow": 210,
        "no": "10.1.9",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có tem nhận dạng cho từng loại máy móc và thiết bị thí nghiệm không? Có hướng dẫn sử dụng ở từng thiết bị, máy móc thí nghiệm không?",
        "titleEn": "Are there identification labels for each type of machinery and laboratory equipment? Are there operating instructions for each piece of laboratory machinery and equipment?",
        "rawText": "10.1.9. Có tem nhận dạng cho từng loại máy móc và thiết bị thí nghiệm không? Có hướng dẫn sử dụng ở từng thiết bị, máy móc thí nghiệm không?\nAre there identification labels for each type of machinery and laboratory equipment? Are there operating instructions for each piece of laboratory machinery and equipment?"
      },
      {
        "excelRow": 211,
        "no": "10.1.10",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Mẫu thí nghiệm có được chuẩn bị theo yêu cầu của từng nhãn hàng hoặc tiêu chuẩn nội bộ không? Như là danh sách kích thước dao chặt mẫu, kế hoạch và danh sách bảo trì dao và máy chặt mẫu.",
        "titleEn": "Are test samples prepared in accordance with specific brand requirements or internal standards—such as specifications for sample-cutting die dimensions, as well as maintenance plans and schedules for the dies and cutting machines?",
        "rawText": "*10.1.10.  Mẫu thí nghiệm có được chuẩn bị theo yêu cầu của từng nhãn hàng hoặc tiêu chuẩn nội bộ không? Như là danh sách kích thước dao chặt mẫu, kế hoạch và danh sách bảo trì dao và máy chặt mẫu.\nAre test samples prepared in accordance with specific brand requirements or internal standards—such as specifications for sample-cutting die dimensions, as well as maintenance plans and schedules for the dies and cutting machines?"
      },
      {
        "excelRow": 212,
        "no": "10.1.11",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có bảng quy định số lượng mẫu cần thí nghiệm và lưu trữ mẫu sau thí nghiệm cho từng hạng mục không? Như là độ bền màu vải với mồ hôi, trọng lượng và độ dày vải.",
        "titleEn": "Is there a plan specifying the required number of samples for testing and post-test storage for each item—such as fabric color fastness to perspiration, weight, and thickness?",
        "rawText": "10.1.11. Có bảng quy định số lượng mẫu cần thí nghiệm và lưu trữ mẫu sau thí nghiệm cho từng hạng mục không? Như là độ bền màu vải với mồ hôi, trọng lượng và độ dày vải.\nIs there a plan specifying the required number of samples for testing and post-test storage for each item—such as fabric color fastness to perspiration, weight, and thickness?"
      },
      {
        "excelRow": 213,
        "no": "10.1.12",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Trình độ học vấn của quản lý phòng thí nghiệm hoặc giám sát viên cần liên quan đến ngành công nghiệp giày dép; đồng thời yêu cầu có trên 3 năm kinh nghiệm làm việc tại phòng thí nghiệm.",
        "titleEn": "Education background  for lab manager, supervisor is related to the footware industry. And 3+ years Lab. experience",
        "rawText": "*10.1.12. Trình độ học vấn của quản lý phòng thí nghiệm hoặc giám sát viên cần liên quan đến ngành công nghiệp giày dép; đồng thời yêu cầu có trên 3 năm kinh nghiệm làm việc tại phòng thí nghiệm.\nEducation background  for lab manager, supervisor is related to the footware industry. And 3+ years Lab. experience"
      },
      {
        "excelRow": 214,
        "no": "10.1.13",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Quản lý phòng thí nghiệm có làm việc với người phụ trách phòng thí nghiệm ở nhãn hàng, nhà giày và những phòng thí nghiệm nội bộ trong cùng tập đoàn không? Có email trao đổi về phương pháp thí nghiệm hoặc biên bản họp không?",
        "titleEn": "Does the laboratory manager interact with the laboratory personnel at the brand, the footwear manufacturer, and internal laboratories within the same group? Are there email exchanges regarding testing methods or meeting minutes?",
        "rawText": "10.1.13. Quản lý phòng thí nghiệm có làm việc với người phụ trách phòng thí nghiệm ở nhãn hàng, nhà giày và những phòng thí nghiệm nội bộ trong cùng tập đoàn không? Có email trao đổi về phương pháp thí nghiệm hoặc biên bản họp không?\nDoes the laboratory manager interact with the laboratory personnel at the brand, the footwear manufacturer, and internal laboratories within the same group? Are there email exchanges regarding testing methods or meeting minutes?"
      },
      {
        "excelRow": 215,
        "no": "10.1.14",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Kỹ thuật viên phòng thí nghiệm có hiểu và thực hiện đúng phương pháp của nhãn hàng không? Có kết quả kiểm tra lý thuyết và đánh giá kỹ năng định kỳ 1 ~ 2 lần mỗi năm không?",
        "titleEn": "Kỹ thuật viên phòng thí nghiệm có hiểu và thực hiện đúng phương pháp của nhãn hàng không? Có kết quả kiểm tra lý thuyết và đánh giá kỹ năng định kỳ 1 ~ 2 lần mỗi năm không?",
        "rawText": "*10.1.14. Kỹ thuật viên phòng thí nghiệm có hiểu và thực hiện đúng phương pháp của nhãn hàng không? Có kết quả kiểm tra lý thuyết và đánh giá kỹ năng định kỳ 1 ~ 2 lần mỗi năm không?\nKỹ thuật viên phòng thí nghiệm có hiểu và thực hiện đúng phương pháp của nhãn hàng không? Có kết quả kiểm tra lý thuyết và đánh giá kỹ năng định kỳ 1 ~ 2 lần mỗi năm không?"
      },
      {
        "excelRow": 216,
        "no": "10.1.15",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có hệ thống đào tạo cho kỹ thuật viên mới và nâng cao kiến thức, kỹ năng cho kỹ thuật viên hiện tại không?",
        "titleEn": "Is there a training system for new technicians and for enhancing the knowledge and skills of current technicians?",
        "rawText": "10.1.15. Có hệ thống đào tạo cho kỹ thuật viên mới và nâng cao kiến thức, kỹ năng cho kỹ thuật viên hiện tại không?\nIs there a training system for new technicians and for enhancing the knowledge and skills of current technicians?"
      },
      {
        "excelRow": 217,
        "no": "10.1.16",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Phòng thí nghiệm có khả năng trình bày phân tích khối lượng công việc để xác định nhu cầu về nhân sự và thiết bị, cũng như nhu cầu bổ sung nếu cần thiết không?",
        "titleEn": "Is the laboratory capable of presenting a workload analysis to determine staffing and equipment requirements, as well as any additional needs if necessary?",
        "rawText": "10.1.16.  Phòng thí nghiệm có khả năng trình bày phân tích khối lượng công việc để xác định nhu cầu về nhân sự và thiết bị, cũng như nhu cầu bổ sung nếu cần thiết không?\nIs the laboratory capable of presenting a workload analysis to determine staffing and equipment requirements, as well as any additional needs if necessary?"
      },
      {
        "excelRow": 218,
        "no": "10.1.17",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có phân công kỹ thuật viên theo kết quả kiểm tra kiến thức và kỹ năng không?",
        "titleEn": "Are technicians assigned based on the results of knowledge and skill assessments?",
        "rawText": "*10.1.17.  Có phân công kỹ thuật viên theo kết quả kiểm tra kiến thức và kỹ năng không?\nAre technicians assigned based on the results of knowledge and skill assessments?"
      },
      {
        "excelRow": 219,
        "no": "10.1.18",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Phương pháp thí nghiệm có được lưu trữ và cập nhật phiên bản mới nhất không?",
        "titleEn": "Are the testing methods stored and updated to the latest version?",
        "rawText": "10.1.18.  Phương pháp thí nghiệm có được lưu trữ và cập nhật phiên bản mới nhất không?\nAre the testing methods stored and updated to the latest version?"
      },
      {
        "excelRow": 220,
        "no": "10.1.19",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có đảm bảo rằng các quy trình thao tác chuẩn (SOP), hướng dẫn công việc và các biểu mẫu phòng thí nghiệm luôn có sẵn và/hoặc dễ dàng tiếp cận đối với các kỹ thuật viên?",
        "titleEn": "Is it ensured that Standard Operating Procedures (SOPs), work instructions, and laboratory forms are always available and/or easily accessible to technicians?",
        "rawText": "10.1.19.  Có đảm bảo rằng các quy trình thao tác chuẩn (SOP), hướng dẫn công việc và các biểu mẫu phòng thí nghiệm luôn có sẵn và/hoặc dễ dàng tiếp cận đối với các kỹ thuật viên?\nIs it ensured that Standard Operating Procedures (SOPs), work instructions, and laboratory forms are always available and/or easily accessible to technicians?"
      },
      {
        "excelRow": 221,
        "no": "10.1.20",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có đảm bảo lưu trữ dữ liệu thử nghiệm thô và có sẵn hệ thống báo cáo để nhập liệu cũng như quản lý dữ liệu thử nghiệm. There are provisions for storing raw test data, and a reporting system is available for data entry and test data management?",
        "titleEn": "",
        "rawText": "*10.1.20. Có đảm bảo lưu trữ dữ liệu thử nghiệm thô và có sẵn hệ thống báo cáo để nhập liệu cũng như quản lý dữ liệu thử nghiệm. There are provisions for storing raw test data, and a reporting system is available for data entry and test data management?"
      },
      {
        "excelRow": 222,
        "no": "10.1.21",
        "isCritical": true,
        "maxScore": 4,
        "titleVn": "Có đảm bảo các mục thí nghiệm không đạt được thông tin đến các bộ phận liên quan? Lô hàng thí nghiệm không đạt được cách ly, phân tích nguyên nhân gốc rễ và có hành động khắc phục rõ ràng cụ thể?",
        "titleEn": "Is there a process to ensure that information regarding failed test items is communicated to the relevant departments? Are failed test batches quarantined, and are root cause analyses and clear, specific corrective actions carried out?",
        "rawText": "*10.1.21. Có đảm bảo các mục thí nghiệm không đạt được thông tin đến các bộ phận liên quan? Lô hàng thí nghiệm không đạt được cách ly, phân tích nguyên nhân gốc rễ và có hành động khắc phục rõ ràng cụ thể?\nIs there a process to ensure that information regarding failed test items is communicated to the relevant departments? Are failed test batches quarantined, and are root cause analyses and clear, specific corrective actions carried out?"
      },
      {
        "excelRow": 223,
        "no": "10.1.22",
        "isCritical": false,
        "maxScore": 4,
        "titleVn": "Có đảm bảo Hồ sơ rõ ràng, dễ hiểu và đầy đủ. Dữ liệu thô và báo cáo gốc được lưu trữ trong ít nhất 1 năm và đảm bảo khả năng truy xuất dễ dàng. Kết quả thử nghiệm phải được tải lên hệ thống trong vòng 24 giờ sau khi hoàn tất thử nghiệm.",
        "titleEn": "Ensure that records are clear, easy to understand, and complete. Raw data and original reports must be retained for at least one year and remain easily retrievable. Test results must be uploaded to the system within 24 hours of test completion.",
        "rawText": "10.1.22. Có đảm bảo Hồ sơ rõ ràng, dễ hiểu và đầy đủ. Dữ liệu thô và báo cáo gốc được lưu trữ trong ít nhất 1 năm và đảm bảo khả năng truy xuất dễ dàng. Kết quả thử nghiệm phải được tải lên hệ thống trong vòng 24 giờ sau khi hoàn tất thử nghiệm.\nEnsure that records are clear, easy to understand, and complete. Raw data and original reports must be retained for at least one year and remain easily retrievable. Test results must be uploaded to the system within 24 hours of test completion."
      }
    ]
  }
};

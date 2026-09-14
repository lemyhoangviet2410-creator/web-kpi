// Danh sách "sản phẩm trọng tâm" (SPTT) hiện tại — khớp với cột products.nhom_trong_tam.
// Danh sách này có thể đổi theo quý (xem đề bài mục 2, 15) — khi đổi, cập nhật ở đây và
// trong dữ liệu cột nhom_trong_tam. Đối chiếu với file chỉ tiêu KPI tháng 9/2026 của công ty và
// skill mo-moi-sptt ngày 14/9/2026 — mở rộng từ 3 lên đủ 7 SP SPTT chính thức.
export const NHOM_SAN_PHAM_TRONG_TAM = [
  "Fosmitic",
  "Progermila",
  "Tranfast",
  "Hepaphagen",
  "Biosoft",
  "Micospray",
  "Kalira",
] as const;

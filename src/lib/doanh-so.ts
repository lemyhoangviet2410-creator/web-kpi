type QuanHeSanPham =
  | { khong_tinh_doanh_so: boolean | null }
  | { khong_tinh_doanh_so: boolean | null }[]
  | null
  | undefined;

// Sản phẩm bị đánh dấu products.khong_tinh_doanh_so (vd nước cất) không được tính vào doanh số.
export function khongTinhDoanhSo(products: QuanHeSanPham): boolean {
  const sp = Array.isArray(products) ? products[0] : products;
  return sp?.khong_tinh_doanh_so === true;
}

/* Telkin-dua: site (dashboard) ve Telegram botu aynı metni gösterir — tek kaynak burası. */
export const DUA_TEXT =
  "Allahım, bize hem bu dünyada hem öbür dünyada iyilik verdiğin, bizi kötülükten koruduğun için Sana şükürler olsun. Göğsümüzü genişlettin, kalbimize ferahlık verdin, işimizi bize kolaylaştırdın. Verdiğin her nimet için Sana hamd olsun. Amin";

export function isTelkinDua(name: string) {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-zçğıöşü]/g, "")
    .replace(/^tellkin/, "telkin") === "telkindua";
}

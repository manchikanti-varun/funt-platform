/** Indian rupee amount in words (supports up to crores). */
export function amountInIndianRupeeWords(paise: number): string {
  const rupees = Math.round(Math.max(0, paise) / 100);
  if (rupees === 0) return "Indian Rupee Zero Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n] ?? "";
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t] ?? ""}${o ? ` ${ones[o]}` : ""}`.trim();
  }

  function threeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const parts: string[] = [];
    if (h) parts.push(`${ones[h]} Hundred`);
    if (rest) parts.push(twoDigits(rest));
    return parts.join(" ").trim();
  }

  function chunkWords(n: number, label: string): string {
    if (!n) return "";
    return `${threeDigits(n)} ${label}`.trim();
  }

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundredRem = rupees % 1000;

  const parts = [
    chunkWords(crore, "Crore"),
    chunkWords(lakh, "Lakh"),
    chunkWords(thousand, "Thousand"),
    hundredRem ? threeDigits(hundredRem) : "",
  ].filter(Boolean);

  return `Indian Rupee ${parts.join(" ")} Only`;
}

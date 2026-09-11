import { parseWon } from "./coupang-price";

/** Read only the selected SKU's purchase-price box, never recommendations,
 * option tables, cashback or the whole document. A advertised WOW discount
 * is not the user's price while a separate normal selling price is shown. */
export function readDetailPrice(container: HTMLElement | undefined): number | null {
  if (!container) return null;
  const labels = [...container.querySelectorAll<HTMLElement>("span,div,strong")]
    .filter(node => /^(?:일반\s*판매가|판매가)$/u.test(node.textContent?.trim() ?? ""));
  for (const label of labels) {
    let section: HTMLElement | null = label;
    while (section && section !== container.parentElement) {
      const prices = visibleSellingPrices(section);
      if (prices.length === 1) return prices[0];
      if (prices.length > 1) break;
      section = section.parentElement;
    }
  }
  // Without an unconditional-price label, don't treat an offer to obtain a
  // coupon / join a membership as an already available selling price.
  if (/할인\s*받기|쿠폰\s*받기|가입\s*(?:하고|후|시)/u.test(container.innerText)) return null;
  // V2 normal layouts put the current sale price in the first row and a
  // separate timed discount amount below it. Never count that saving as price.
  const normalRows = [...container.querySelectorAll<HTMLElement>(".price-layout-normal")]
    .map(section => section.firstElementChild)
    .filter((row): row is HTMLElement => row instanceof HTMLElement);
  if (normalRows.length === 1) {
    const rowPrices = visibleSellingPrices(normalRows[0]);
    if (rowPrices.length === 1) return rowPrices[0];
  }
  const prices = visibleSellingPrices(container);
  return prices.length === 1 ? prices[0] : null;
}

function visibleSellingPrices(container: HTMLElement): number[] {
  const isMoney = (node: Element) => /^\d[\d,]*\s*원$/u.test(node.textContent?.trim() ?? "");
  const prices = [container, ...container.querySelectorAll<HTMLElement>("span,div,strong,b")]
    .filter(node => {
      // A non-struck wrapper can contain only a struck-through original price
      // and an empty tooltip icon. Read the innermost money node so the wrapper
      // cannot turn that crossed-out price back into a selling-price candidate.
      if (!isMoney(node) || [...node.querySelectorAll("span,div,strong,b,del,s")].some(isMoney)) return false;
      if (!node.getClientRects().length || node.closest('del,s,[hidden],[aria-hidden="true"],[class*="line-through"]')) return false;
      // Current seller-delivery pages put shipping and free-delivery thresholds
      // inside the same price-container as the selected SKU's selling price.
      if (node.closest('[class*="shipping-fee"],[data-testid="shipping-fee"]')) return false;
      const style = getComputedStyle(node);
      return style.visibility !== "hidden" && !style.textDecorationLine.includes("line-through")
        && !node.querySelector('del,s,[class*="line-through"]');
    })
    .map(node => parseWon(node.textContent ?? ""))
    .filter((price): price is number => price !== null);
  return [...new Set(prices)];
}

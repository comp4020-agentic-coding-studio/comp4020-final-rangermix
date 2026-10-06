/** Says a line through the page's polite live region, for screen readers. */
export function announce(text: string): void {
  const region = document.getElementById("announcer");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = text;
  }, 30);
}

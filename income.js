/**
 * income.js
 * Gelir takibi: her iş için teklif/anlaşılan ücret, tahsil edilen, kalan.
 */

const Income = (() => {
  const { el, formatMoney } = Utils;

  async function render(container) {
    container.innerHTML = "";
    container.appendChild(el("div", { class: "page-head" }, [el("h1", { text: "Gelir Takibi" })]));
    container.appendChild(el("p", { class: "empty", text: "Gelir takibi için randevulara ücret bilgisi eklenmelidir." }));
  }

  return { render };
})();

window.Income = Income;

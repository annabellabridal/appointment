/**
 * todos.js
 * Basit yapılacaklar listesi: Bekliyor / Devam ediyor / Tamamlandı.
 */

const Todos = (() => {
  const { el, toast, confirmDialog } = Utils;

  const COLUMNS = [
    { value: "bekliyor", label: "Bekliyor", color: "#8a8a8a" },
    { value: "devam", label: "Devam Ediyor", color: "#b5b5b5" },
    { value: "tamamlandi", label: "Tamamlandı", color: "#f0f0f0" },
  ];

  let containerRef = null;

  async function render(container) {
    containerRef = container;
    draw();
  }

  async function draw() {
    const container = containerRef;
    const todos = await DB.todos.all();
    container.innerHTML = "";

    const input = el("input", { type: "text", placeholder: "Yeni görev ekle...", class: "todo-input" });
    const addBtn = el("button", { class: "btn btn-primary", text: "Ekle", onClick: () => add(input) });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(input); });

    container.appendChild(el("div", { class: "page-head" }, [
      el("h1", { text: "Yapılacaklar" }),
    ]));
    container.appendChild(el("div", { class: "todo-add" }, [input, addBtn]));

    const board = el("div", { class: "todo-board" });
    COLUMNS.forEach((col) => {
      const colEl = el("div", { class: "todo-col", "data-status": col.value });
      colEl.appendChild(el("div", { class: "todo-col-head", style: `--card-color:${col.color}` }, [
        el("span", { text: col.label }),
        el("span", { class: "todo-count", text: String(todos.filter((t) => t.status === col.value).length) }),
      ]));
      const list = el("div", { class: "todo-list" });
      todos.filter((t) => t.status === col.value).forEach((t) => list.appendChild(item(t)));
      colEl.appendChild(list);

      // sürükle-bırak ile durum değiştir
      colEl.addEventListener("dragover", (e) => { e.preventDefault(); colEl.classList.add("drop-target"); });
      colEl.addEventListener("dragleave", () => colEl.classList.remove("drop-target"));
      colEl.addEventListener("drop", async (e) => {
        e.preventDefault();
        colEl.classList.remove("drop-target");
        const id = Number(e.dataTransfer.getData("text/plain"));
        const t = todos.find((x) => x.id === id);
        if (t && t.status !== col.value) { t.status = col.value; await DB.todos.put(t); draw(); }
      });
      board.appendChild(colEl);
    });
    container.appendChild(board);
  }

  function item(t) {
    const node = el("div", { class: `todo-item ${t.status === "tamamlandi" ? "done" : ""}`, draggable: "true", "data-id": t.id }, [
      el("span", { class: "todo-text", text: t.text }),
      el("div", { class: "todo-actions" }, [
        el("button", { class: "chip-x", html: "&times;", title: "Sil", onClick: async (e) => {
          e.stopPropagation();
          if (await confirmDialog("Görev silinsin mi?", { title: "Görev Sil", danger: true })) {
            await DB.todos.remove(t.id); draw();
          }
        } }),
      ]),
    ]);
    node.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", String(t.id)); node.classList.add("dragging"); });
    node.addEventListener("dragend", () => node.classList.remove("dragging"));
    return node;
  }

  async function add(input) {
    const text = input.value.trim();
    if (!text) return;
    await DB.todos.add({ text, status: "bekliyor", createdAt: new Date().toISOString() });
    input.value = "";
    toast("Görev eklendi", "success");
    draw();
  }

  return { render };
})();

window.Todos = Todos;

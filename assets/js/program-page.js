/**
 * Рендерит страницу программы (чек-апа) из assets/data/programs.json по id в
 * [data-program-id] — состав, включённые услуги, цена. Шаблон страницы программы
 * по ТЗ §3: назначение → полный состав → включённые услуги → итог и доплаты →
 * подготовка и сроки → врач → запись.
 */
(function () {
  "use strict";

  function renderList(container, items) {
    if (!items || !items.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var ul = container.querySelector("ul") || document.createElement("ul");
    ul.innerHTML = "";
    ul.className = "checklist";
    items.forEach(function (text) {
      var li = document.createElement("li");
      var svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
      li.innerHTML = svg + text;
      ul.appendChild(li);
    });
    if (!container.contains(ul)) container.appendChild(ul);
  }

  function init() {
    var root = document.querySelector("[data-program-id]");
    if (!root) return;
    var programId = root.getAttribute("data-program-id");

    var titleEl = document.querySelector("[data-program-title]");
    var audienceEl = document.querySelector("[data-program-audience]");
    var compositionEl = document.querySelector("[data-program-composition]");
    var servicesEl = document.querySelector("[data-program-services]");
    var noteEl = document.querySelector("[data-program-note]");
    var priceEl = document.querySelector("[data-program-price]");
    var statusEl = document.querySelector("[data-program-status]");

    Promise.all([
      window.SaulemaiData.programs(),
      window.SaulemaiData.analyses(),
      window.SaulemaiData.services(),
      window.SaulemaiData.prices(),
    ]).then(function (res) {
      var programs = res[0], analyses = res[1], services = res[2], prices = res[3];
      var program = programs.find(function (p) { return p.id === programId; });
      if (!program) return;

      var analysesById = {};
      analyses.forEach(function (a) { analysesById[a.id] = a; });
      var servicesById = {};
      services.forEach(function (s) { servicesById[s.id] = s; });

      if (titleEl) titleEl.textContent = program.name;
      if (audienceEl) {
        audienceEl.textContent = program.audience_note || "Назначение программы определяет врач на консультации.";
      }

      var compositionNames = (program.composition_analysis_ids || [])
        .map(function (id) { return analysesById[id] ? analysesById[id].name : id; })
        .concat(program.composition_text || []);
      renderList(compositionEl, compositionNames);

      var serviceNames = (program.composition_service_ids || [])
        .map(function (id) { return servicesById[id] ? servicesById[id].name : id; });
      renderList(servicesEl, serviceNames);

      if (noteEl) {
        if (program.composition_note) {
          noteEl.hidden = false;
          noteEl.textContent = program.composition_note;
        } else {
          noteEl.hidden = true;
        }
      }

      if (priceEl) {
        var info = window.SaulemaiData.formatPrice(prices[program.price_id]);
        priceEl.textContent = info.text;
        priceEl.className = info.known ? "price" : "price badge-pending";
      }

      if (statusEl) {
        statusEl.textContent = program.status === "needs_review"
          ? "Состав ожидает проверки врачом перед окончательной публикацией."
          : "";
      }

      document.dispatchEvent(new CustomEvent("saulemai:program-ready", { detail: program }));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

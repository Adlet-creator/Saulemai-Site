/**
 * Поиск и фильтры по каталогу анализов (ТЗ v1.0, §4.1–4.2).
 * Работает на статическом assets/data/analyses.json через SaulemaiData — без сервера.
 *
 * Правила из ТЗ, важные для реализации:
 * - точное совпадение показываем выше похожих;
 * - по коду искать можно, но код НИКОГДА не выводится в результатах (внутренних
 *   кодов в данных нет вообще — см. analyses.json, это намеренно);
 * - сам текст поиска никогда не попадает в URL/аналитику — только нейтральная
 *   категория (?category=...);
 * - normalize() сворачивает ё→е и регистр для сопоставления, но НЕ меняет
 *   отображаемый текст.
 */
(function () {
  "use strict";

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .trim();
  }

  // Простая проверка "расстояние Левенштейна <= 1" — покрывает частые опечатки
  // без библиотек, корпус маленький (74 записи), так что это дёшево.
  function isCloseTypo(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a === b) return true;
    var longer = a.length >= b.length ? a : b;
    var shorter = a.length >= b.length ? b : a;
    var i = 0, j = 0, edits = 0;
    while (i < longer.length && j < shorter.length) {
      if (longer[i] === shorter[j]) {
        i++; j++;
        continue;
      }
      edits++;
      if (edits > 1) return false;
      if (longer.length === shorter.length) { i++; j++; } else { i++; }
    }
    return true;
  }

  function scoreMatch(query, record) {
    var q = normalize(query);
    if (!q) return 0;
    var name = normalize(record.name);
    var haystacks = [name].concat((record.synonyms || []).map(normalize));

    for (var i = 0; i < haystacks.length; i++) {
      if (haystacks[i] === q) return 100; // точное совпадение
    }
    for (var j = 0; j < haystacks.length; j++) {
      if (haystacks[j].indexOf(q) !== -1) return 70; // содержит запрос
    }
    // опечатка в одном из слов названия
    var words = name.split(/\s+/);
    for (var k = 0; k < words.length; k++) {
      if (isCloseTypo(words[k].replace(/[.,()]/g, ""), q)) return 40;
    }
    return 0;
  }

  function renderPriceCell(priceRecord) {
    var info = window.SaulemaiData.formatPrice(priceRecord);
    var span = document.createElement("span");
    span.className = "analysis-row__price" + (info.known ? "" : " is-pending");
    span.textContent = info.text;
    return span;
  }

  function renderRow(record, priceRecord) {
    var row = document.createElement("div");
    row.className = "analysis-row";
    row.setAttribute("data-analysis-id", record.id);

    var main = document.createElement("div");
    main.className = "analysis-row__main";

    var name = document.createElement("div");
    name.className = "analysis-row__name";
    name.textContent = record.name;
    main.appendChild(name);

    var meta = document.createElement("div");
    meta.className = "analysis-row__meta";
    var metaBits = [];
    if (record.method) metaBits.push(record.method);
    if (record.material) metaBits.push(record.material);
    if (!record.standalone_sale_confirmed) metaBits.push("отдельная сдача уточняется");
    meta.textContent = metaBits.join(" · ");
    main.appendChild(meta);

    row.appendChild(main);
    row.appendChild(renderPriceCell(priceRecord));

    var actions = document.createElement("div");
    actions.className = "analysis-row__actions";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary btn-sm";

    if (record.standalone_sale_confirmed) {
      btn.textContent = "Добавить в список";
      btn.addEventListener("click", function () {
        window.SaulemaiSelectedList.add(record.id, "analysis");
        btn.textContent = "В списке ✓";
        btn.setAttribute("data-added", "true");
      });
      if (window.SaulemaiSelectedList.has(record.id)) {
        btn.textContent = "В списке ✓";
        btn.setAttribute("data-added", "true");
      }
    } else {
      btn.textContent = "Уточнить возможность сдачи";
      btn.addEventListener("click", function () {
        window.SaulemaiSelectedList.openWhatsAppWithNote(
          "Здравствуйте. Уточните, пожалуйста, можно ли сдать «" + record.name + "» отдельно."
        );
      });
    }

    actions.appendChild(btn);
    row.appendChild(actions);
    return row;
  }

  function initCatalogPage() {
    var root = document.querySelector("[data-catalog-root]");
    if (!root) return;

    var input = root.querySelector("[data-catalog-search-input]");
    var clearBtn = root.querySelector("[data-catalog-clear]");
    var resultsEl = root.querySelector("[data-catalog-results]");
    var filtersEl = root.querySelector("[data-catalog-filters]");
    var stateLoading = root.querySelector("[data-catalog-state='loading']");
    var stateEmpty = root.querySelector("[data-catalog-state='empty']");
    var stateError = root.querySelector("[data-catalog-state='error']");

    var allRecords = [];
    var pricesById = {};
    var activeCategory = new URLSearchParams(window.location.search).get("category") || null;

    function setState(name) {
      [stateLoading, stateEmpty, stateError].forEach(function (el) {
        if (el) el.hidden = true;
      });
      if (name === "loading" && stateLoading) stateLoading.hidden = false;
      if (name === "empty" && stateEmpty) stateEmpty.hidden = false;
      if (name === "error" && stateError) stateError.hidden = false;
    }

    function render() {
      var query = input ? input.value : "";
      var filtered = allRecords;

      if (activeCategory) {
        filtered = filtered.filter(function (r) { return r.category === activeCategory; });
      }

      if (query.trim()) {
        filtered = filtered
          .map(function (r) { return { record: r, score: scoreMatch(query, r) }; })
          .filter(function (x) { return x.score > 0; })
          .sort(function (a, b) { return b.score - a.score; })
          .map(function (x) { return x.record; });
      }

      resultsEl.innerHTML = "";
      if (!filtered.length) {
        setState("empty");
        return;
      }
      setState(null);
      filtered.forEach(function (record) {
        resultsEl.appendChild(renderRow(record, pricesById[record.price_id || record.id]));
      });
    }

    function updateCategoryInUrl() {
      var url = new URL(window.location.href);
      if (activeCategory) {
        url.searchParams.set("category", activeCategory);
      } else {
        url.searchParams.delete("category");
      }
      // Нейтральный параметр категории можно отражать в URL; текст поиска — никогда.
      window.history.replaceState({}, "", url.toString());
    }

    if (filtersEl) {
      filtersEl.querySelectorAll("[data-catalog-filter]").forEach(function (chip) {
        chip.addEventListener("click", function () {
          var value = chip.getAttribute("data-catalog-filter");
          activeCategory = activeCategory === value ? null : value;
          filtersEl.querySelectorAll("[data-catalog-filter]").forEach(function (c) {
            c.setAttribute("aria-pressed", String(c === chip && activeCategory === value));
          });
          updateCategoryInUrl();
          render();
        });
        if (chip.getAttribute("data-catalog-filter") === activeCategory) {
          chip.setAttribute("aria-pressed", "true");
        }
      });
    }

    if (input) {
      input.addEventListener("input", render);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") render();
        if (e.key === "Escape") {
          input.value = "";
          render();
          input.blur();
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (input) input.value = "";
        activeCategory = null;
        if (filtersEl) {
          filtersEl.querySelectorAll("[data-catalog-filter]").forEach(function (c) {
            c.setAttribute("aria-pressed", "false");
          });
        }
        updateCategoryInUrl();
        render();
      });
    }

    // Запрос, переданный из поиска в шапке (sessionStorage, не URL — см. include.js).
    try {
      var pending = window.sessionStorage.getItem("saulemai_pending_search");
      if (pending && input) {
        input.value = pending;
        window.sessionStorage.removeItem("saulemai_pending_search");
      }
    } catch (e) {
      // sessionStorage недоступен — продолжаем без предзаполнения.
    }

    setState("loading");
    Promise.all([window.SaulemaiData.analyses(), window.SaulemaiData.prices()])
      .then(function (results) {
        allRecords = results[0];
        pricesById = results[1];
        render();
      })
      .catch(function () {
        setState("error");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCatalogPage);
  } else {
    initCatalogPage();
  }
})();

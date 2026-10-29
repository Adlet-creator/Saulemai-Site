/**
 * «Список выбранного» (ТЗ v1.0, §4.4) — не корзина с оплатой, а интерфейс выбора
 * позиций перед обращением к администратору. Хранится в sessionStorage (не в
 * localStorage, не в URL/UTM/аналитике) до конца сессии вкладки.
 */
window.SaulemaiSelectedList = (function () {
  "use strict";

  var STORAGE_KEY = "saulemai_selected_v1";

  function read() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function write(items) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      // sessionStorage недоступен (приватный режим и т.п.) — список просто не сохранится
      // между переходами; это деградация, а не ошибка, которую нужно показывать пациентке.
    }
    updateBadges();
  }

  function add(id, type) {
    var items = read();
    if (items.some(function (i) { return i.id === id; })) return;
    items.push({ id: id, type: type, qty: 1 });
    write(items);
  }

  function remove(id) {
    write(read().filter(function (i) { return i.id !== id; }));
  }

  function has(id) {
    return read().some(function (i) { return i.id === id; });
  }

  function clear() {
    write([]);
  }

  function getAll() {
    return read();
  }

  function count() {
    return read().length;
  }

  function updateBadges() {
    var n = count();
    document.querySelectorAll("[data-selected-badge]").forEach(function (el) {
      el.textContent = String(n);
      el.hidden = n === 0;
    });
    document.querySelectorAll("[data-sticky-selected-link]").forEach(function (el) {
      el.hidden = n === 0;
    });
    document.querySelectorAll("[data-selected-badge-sticky]").forEach(function (el) {
      el.textContent = String(n);
    });
  }

  /**
   * Открывает WhatsApp с нейтральным текстом по умолчанию. Список конкретных
   * выбранных анализов добавляется в текст только при явном выборе пациентки
   * (параметр includeItems) — чувствительные названия не передаются по умолчанию.
   */
  function openWhatsAppWithNote(text) {
    var href = window.SaulemaiCTA ? window.SaulemaiCTA.buildWhatsAppHref(text) : null;
    if (href) {
      window.open(href, "_blank", "noopener");
    }
  }

  document.addEventListener("DOMContentLoaded", updateBadges);
  document.addEventListener("saulemai:partials-ready", updateBadges);

  return {
    add: add,
    remove: remove,
    has: has,
    clear: clear,
    getAll: getAll,
    count: count,
    updateBadges: updateBadges,
    openWhatsAppWithNote: openWhatsAppWithNote,
  };
})();

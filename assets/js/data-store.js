/**
 * Тонкая обёртка fetch+кэш для assets/data/*.json. Все страницы каталога, прайса,
 * программ и списка выбранного читают данные через этот модуль — единая версия
 * данных, как требует ТЗ §4.5 ("карточки, прайс, результаты поиска, программы и бот
 * используют общую версию данных").
 *
 * ЖЁСТКОЕ ПРАВИЛО (ТЗ, раздел «Цены»): публичная цена доступна только при
 * status === 'approved' И amount_kzt заполнен. SaulemaiData.formatPrice() — единственное
 * место, где решается, показывать число или "Уточняется": не обходить эту функцию
 * точечными проверками в разных файлах.
 */
window.SaulemaiData = (function () {
  "use strict";

  var cache = {};

  function load(name) {
    if (cache[name]) return cache[name];
    var promise = fetch("/assets/data/" + name + ".json")
      .then(function (res) {
        if (!res.ok) throw new Error("Не удалось загрузить /assets/data/" + name + ".json: " + res.status);
        return res.json();
      })
      .catch(function (err) {
        console.error(err);
        return null;
      });
    cache[name] = promise;
    return promise;
  }

  function withDefaults(record, defaults) {
    if (!record || !defaults) return record;
    var merged = {};
    Object.keys(defaults).forEach(function (key) {
      merged[key] = defaults[key];
    });
    Object.keys(record).forEach(function (key) {
      merged[key] = record[key];
    });
    return merged;
  }

  function analyses() {
    return load("analyses").then(function (data) {
      if (!data) return [];
      return data.analyses.map(function (a) {
        return withDefaults(a, data.defaults);
      });
    });
  }

  function programs() {
    return load("programs").then(function (data) {
      return data ? data.programs : [];
    });
  }

  function services() {
    return load("services").then(function (data) {
      return data ? data.services : [];
    });
  }

  function prices() {
    return load("prices").then(function (data) {
      if (!data) return {};
      var byId = {};
      data.prices.forEach(function (p) {
        byId[p.entity_id] = withDefaults(p, data.defaults);
      });
      return byId;
    });
  }

  function clinic() {
    return load("clinic");
  }

  function doctor() {
    return load("doctor");
  }

  function sources() {
    return load("sources").then(function (data) {
      return data ? data.sources : [];
    });
  }

  /**
   * Единственное место, формирующее то, что видит пациентка: число, только если
   * status === 'approved' и amount_kzt заполнен и (если задано) дата в пределах
   * valid_from/valid_to. Во всех остальных случаях — честный текст, никогда 0.
   */
  function formatPrice(priceRecord) {
    if (!priceRecord) {
      return { known: false, text: "Уточняется" };
    }
    var today = new Date().toISOString().slice(0, 10);
    var withinWindow =
      (!priceRecord.valid_from || priceRecord.valid_from <= today) &&
      (!priceRecord.valid_to || priceRecord.valid_to >= today);

    if (priceRecord.status === "approved" && priceRecord.amount_kzt != null && withinWindow) {
      return {
        known: true,
        text: Number(priceRecord.amount_kzt).toLocaleString("ru-RU") + " ₸",
        amount: priceRecord.amount_kzt,
      };
    }
    if (priceRecord.status === "withdrawn") {
      return { known: false, text: "Уточняется" };
    }
    return { known: false, text: "Уточняется" };
  }

  return {
    analyses: analyses,
    programs: programs,
    services: services,
    prices: prices,
    clinic: clinic,
    doctor: doctor,
    sources: sources,
    formatPrice: formatPrice,
  };
})();

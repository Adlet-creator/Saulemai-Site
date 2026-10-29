/**
 * Подключение общих partial-блоков (header/footer) без сборщика.
 * Также отрисовывает кнопки записи (WhatsApp/Instagram) и фото врача
 * на основе window.SAULEMAI_CONFIG — чтобы ни одна страница не хранила
 * номер/фото "зашитыми" вручную.
 */
(function () {
  "use strict";

  function absolutePartialUrl(relativePath) {
    // partials подключаются от корня сайта, независимо от глубины страницы.
    return relativePath;
  }

  function loadIncludes() {
    var nodes = document.querySelectorAll("[data-include]");
    var pending = [];

    nodes.forEach(function (node) {
      var url = absolutePartialUrl(node.getAttribute("data-include"));
      var request = fetch(url)
        .then(function (res) {
          if (!res.ok) {
            throw new Error("Не удалось загрузить " + url + ": " + res.status);
          }
          return res.text();
        })
        .then(function (html) {
          node.innerHTML = html;
        })
        .catch(function (err) {
          console.error(err);
        });
      pending.push(request);
    });

    Promise.all(pending).then(function () {
      markActiveNavLink();
      initWhatsAppCtas();
      initInstagramLinks();
      initPhoneLinks();
      initHoursDisplay();
      initFooterYear();
      initBreadcrumbSchema();
      initHeaderSearch();
      document.dispatchEvent(new CustomEvent("saulemai:partials-ready"));
    });
  }

  /**
   * Поле поиска в шапке (ТЗ §2.1: "поиск по услугам и анализам"). Открывается без
   * регистрации, закрывается Escape с возвратом фокуса на кнопку. Текст поиска
   * передаётся на /analyses/ через sessionStorage, а не через query-параметр URL —
   * поисковые запросы пациентки не должны попадать в адресную строку/историю.
   */
  function initHeaderSearch() {
    var toggle = document.querySelector("[data-header-search-toggle]");
    var panel = document.getElementById("header-search-form");
    var input = document.querySelector("[data-header-search-input]");
    var form = document.querySelector("[data-header-search-form]");
    if (!toggle || !panel || !form) return;

    toggle.addEventListener("click", function () {
      var isOpen = !panel.hidden;
      panel.hidden = isOpen;
      toggle.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen && input) input.focus();
    });

    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var term = input ? input.value.trim() : "";
      if (!term) return;
      try {
        window.sessionStorage.setItem("saulemai_pending_search", term);
      } catch (err) {
        // sessionStorage недоступен — просто откроем каталог без предзаполнения.
      }
      window.location.href = "/analyses/";
    });
  }

  /**
   * Рендерит config.hours.schedule в любой узел [data-hours-display] — так удаление
   * субботы или актуализация времени будней правится один раз в config.js, а не
   * в каждом HTML-файле, где упоминаются часы работы.
   */
  function initHoursDisplay() {
    var config = window.SAULEMAI_CONFIG || {};
    var schedule = (config.hours && config.hours.schedule) || [];
    var nodes = document.querySelectorAll("[data-hours-display]");
    if (!nodes.length || !schedule.length) return;

    var parts = schedule.map(function (entry) {
      if (entry.status === "closed") {
        return entry.label + " — выходной";
      }
      if (entry.status === "pending" || !entry.open || !entry.close) {
        return entry.label + ": уточняется";
      }
      return entry.label + " " + entry.open + "–" + entry.close;
    });

    nodes.forEach(function (node) {
      node.textContent = parts.join(" · ");
      node.classList.remove("is-pending");
      if (schedule.some(function (e) { return e.status === "pending"; })) {
        node.classList.add("has-pending-hours");
      }
    });
  }

  function initFooterYear() {
    var yearEl = document.getElementById("footer-year");
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  function markActiveNavLink() {
    var path = window.location.pathname.replace(/\/index\.html$/, "/");
    document.querySelectorAll("[data-nav-link]").forEach(function (link) {
      var linkPath = link.getAttribute("href");
      if (!linkPath) return;
      if (linkPath === path || (linkPath !== "/" && path.indexOf(linkPath) === 0)) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function buildWhatsAppHref(config, overrideText) {
    var number = config.contact.whatsappNumber;
    var text = encodeURIComponent(overrideText != null ? overrideText : (config.contact.whatsappPrefillText || ""));
    if (number) {
      return "https://wa.me/" + number + (text ? "?text=" + text : "");
    }
    return null;
  }

  // Доступно другим модулям (catalog.js, selected-list.js) — чтобы не дублировать
  // логику сборки ссылки wa.me с собственным текстом (предпросмотр списка выбранного).
  window.SaulemaiCTA = {
    buildWhatsAppHref: function (overrideText) {
      return buildWhatsAppHref(window.SAULEMAI_CONFIG || {}, overrideText);
    },
  };

  function initWhatsAppCtas() {
    var config = window.SAULEMAI_CONFIG || {};
    var href = buildWhatsAppHref(config);
    var elements = document.querySelectorAll("[data-whatsapp-cta]");

    elements.forEach(function (el) {
      var fallbackLabel = el.getAttribute("data-label-fallback");
      var readyLabel = el.getAttribute("data-label-ready") || el.textContent;

      if (href) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
        el.textContent = readyLabel;
        el.setAttribute("data-cta-target", "whatsapp");
      } else if (config.contact && config.contact.instagramUrl) {
        el.setAttribute("href", config.contact.instagramUrl);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
        if (fallbackLabel) {
          el.textContent = fallbackLabel;
        }
        el.setAttribute("data-cta-target", "instagram");
      } else {
        el.setAttribute("href", "#contacts");
        el.setAttribute("data-cta-target", "none");
      }

      el.addEventListener("click", function () {
        var target = el.getAttribute("data-cta-target");
        if (window.dataLayer) {
          window.dataLayer.push({
            event: "whatsapp_click",
            cta_target: target,
            cta_location: el.getAttribute("data-cta-location") || "unknown",
          });
        }
      });
    });
  }

  function initInstagramLinks() {
    var config = window.SAULEMAI_CONFIG || {};
    document.querySelectorAll("[data-instagram-link]").forEach(function (el) {
      if (config.contact && config.contact.instagramUrl) {
        el.setAttribute("href", config.contact.instagramUrl);
      }
    });
  }

  function initPhoneLinks() {
    var config = window.SAULEMAI_CONFIG || {};
    var phone = config.contact && config.contact.phoneNumber;
    document.querySelectorAll("[data-phone-link]").forEach(function (el) {
      if (phone) {
        var readyLabel = el.getAttribute("data-label-ready");
        el.setAttribute("href", "tel:" + phone.replace(/[^+\d]/g, ""));
        el.textContent = readyLabel || phone;
        el.classList.remove("is-pending");
        el.addEventListener("click", function () {
          if (window.dataLayer) {
            window.dataLayer.push({
              event: "phone_click",
              cta_location: el.getAttribute("data-cta-location") || "unknown",
            });
          }
        });
      } else {
        el.setAttribute("href", "#contacts");
        el.textContent = "Телефон уточняется";
        el.classList.add("is-pending");
      }
    });
  }

  /**
   * Генерирует BreadcrumbList JSON-LD из уже существующей визуальной разметки
   * `.breadcrumbs` (ссылки + финальный span[aria-current]) — чтобы не дублировать
   * хлебные крошки вручную в JSON-LD на каждой странице.
   */
  function initBreadcrumbSchema() {
    var nav = document.querySelector(".breadcrumbs");
    if (!nav) return;

    var items = [];
    var position = 1;
    nav.querySelectorAll("a, span[aria-current]").forEach(function (el) {
      var isLink = el.tagName === "A";
      var name = el.textContent.trim();
      if (!name) return;
      items.push({
        "@type": "ListItem",
        position: position++,
        name: name,
        item: isLink ? el.href : window.location.href,
      });
    });

    if (!items.length) return;

    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    });
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadIncludes);
  } else {
    loadIncludes();
  }
})();

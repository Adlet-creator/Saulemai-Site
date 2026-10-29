/**
 * Условная загрузка GA4/GTM/Meta Pixel/TikTok Pixel: ни один скрипт не подключается,
 * пока соответствующий ID не задан в assets/js/config.js — чтобы не слать события
 * на несуществующий контейнер/пиксель с плейсхолдер-домена.
 * События whatsapp_click/phone_click пишутся в dataLayer всегда (см. include.js),
 * поэтому когда ID появятся, трекинг кликов уже будет работать задним числом.
 */
(function () {
  "use strict";

  window.dataLayer = window.dataLayer || [];

  var config = window.SAULEMAI_CONFIG || {};
  var analytics = config.analytics || {};

  function loadScript(src, attrs) {
    var script = document.createElement("script");
    script.async = true;
    script.src = src;
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        script.setAttribute(key, attrs[key]);
      });
    }
    document.head.appendChild(script);
  }

  if (analytics.gtmContainerId) {
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    loadScript("https://www.googletagmanager.com/gtm.js?id=" + analytics.gtmContainerId);
  }

  if (analytics.ga4MeasurementId) {
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + analytics.ga4MeasurementId);
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", analytics.ga4MeasurementId);
  }

  if (analytics.metaPixelId) {
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", analytics.metaPixelId);
    window.fbq("track", "PageView");
  }

  if (analytics.tiktokPixelId) {
    (function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      var ttq = (w[t] = w[t] || []);
      ttq.methods = [
        "page", "track", "identify", "instances", "debug", "on", "off", "once",
        "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent",
        "revokeConsent", "grantConsent",
      ];
      ttq.setAndDefer = function (t, e) {
        t[e] = function () {
          t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.load = function (e, n) {
        var i = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[e] = [];
        ttq._i[e]._u = i;
        ttq._t = ttq._t || {};
        ttq._t[e] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[e] = n || {};
        var o = d.createElement("script");
        o.type = "text/javascript";
        o.async = true;
        o.src = i + "?sdkid=" + e + "&lib=" + t;
        var a = d.getElementsByTagName("script")[0];
        a.parentNode.insertBefore(o, a);
      };
      ttq.load(analytics.tiktokPixelId);
      ttq.page();
    })(window, document, "ttq");
  }
})();

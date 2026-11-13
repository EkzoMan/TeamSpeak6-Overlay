/* ============================================================
   TS6 Overlay website — main logic
   ============================================================ */
(function () {
  "use strict";

  var REPO = "https://github.com/EkzoMan/TeamSpeak6-Overlay";
  var API_REPO = "https://api.github.com/repos/EkzoMan/TeamSpeak6-Overlay";

  /* ---------- Language switcher ---------- */
  var langBtn = document.getElementById("langBtn");
  var langMenu = document.getElementById("langMenu");
  var langLabel = document.getElementById("langLabel");
  var langRoot = document.getElementById("lang");

  function detectLang() {
    var saved = null;
    try { saved = localStorage.getItem("ts6site-lang"); } catch (e) { /* ignore */ }
    if (saved && window.I18N[saved]) return saved;
    var nav = (navigator.language || "en").toLowerCase();
    if (nav.indexOf("ru") === 0) return "ru";
    if (nav.indexOf("de") === 0) return "de";
    if (nav.indexOf("zh") === 0) return "zh";
    return "en";
  }

  function applyLang(code) {
    var dict = window.I18N[code];
    if (!dict) return;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.innerHTML = dict[key];
    });

    document.documentElement.setAttribute("lang", code);
    if (langLabel) langLabel.textContent = code.toUpperCase();

    langMenu.querySelectorAll("li").forEach(function (li) {
      li.setAttribute("aria-selected", li.getAttribute("data-lang") === code ? "true" : "false");
    });

    try { localStorage.setItem("ts6site-lang", code); } catch (e) { /* ignore */ }
  }

  if (langBtn && langMenu) {
    langBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = langRoot.classList.toggle("is-open");
      langBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function () {
      langRoot.classList.remove("is-open");
      langBtn.setAttribute("aria-expanded", "false");
    });

    langMenu.querySelectorAll("li").forEach(function (li) {
      li.addEventListener("click", function () {
        applyLang(li.getAttribute("data-lang"));
        langRoot.classList.remove("is-open");
        langBtn.setAttribute("aria-expanded", "false");
      });
    });

    applyLang(detectLang());
  }

  /* ---------- Header scroll state ---------- */
  var header = document.getElementById("header");
  function onScroll() {
    if (header) header.classList.toggle("header--scrolled", window.scrollY > 10);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Burger (mobile nav) ---------- */
  var burger = document.getElementById("burger");
  var nav = document.getElementById("nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll(".nav__link").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Version chip (live from GitHub) ---------- */
  function setVersion(v) {
    var chip = document.getElementById("versionChip");
    var cta = document.getElementById("ctaVersion");
    if (chip) chip.textContent = v;
    if (cta) cta.textContent = v;
  }
  setVersion("v0.3.10-beta"); // fallback, обновляется ниже из GitHub API

  /* ---------- GitHub releases: версия, ссылки, счётчик скачиваний ---------- */
  // Один запрос списка релизов закрывает три задачи: версию последнего релиза,
  // прямые ссылки на файлы для кнопок и суммарный счётчик скачиваний.
  fetch(API_REPO + "/releases?per_page=100")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (releases) {
      if (!releases || !releases.length) return;

      setVersion(releases[0].tag_name);
      applySmartLinks(releases[0]);
      setDownloads(sumDownloads(releases));
    })
    .catch(function () { /* остаются fallback-значения и ссылки на страницу релизов */ });

  function sumDownloads(releases) {
    return releases.reduce(function (total, release) {
      return total + (release.assets || []).reduce(function (sum, asset) {
        return sum + (asset.download_count || 0);
      }, 0);
    }, 0);
  }

  function setDownloads(count) {
    if (!count) return; // API недоступен или счётчики пусты — чипы остаются скрытыми

    var text = formatCount(count);
    var chip = document.getElementById("downloadsChip");
    var cta = document.getElementById("ctaDownloads");
    if (chip) chip.hidden = false;
    if (cta) cta.hidden = false;
    var chipVal = document.getElementById("downloadsValue");
    var ctaVal = document.getElementById("ctaDownloadsValue");
    if (chipVal) chipVal.textContent = text;
    if (ctaVal) ctaVal.textContent = text;
  }

  function formatCount(n) {
    if (n >= 1000000) return trimZeros((n / 1000000).toFixed(1)) + "M";
    if (n >= 1000) return trimZeros((n / 1000).toFixed(1)) + "K";
    return String(n);
  }

  function trimZeros(s) {
    return s.replace(/\.0$/, "");
  }

  /* ---------- Smart download links ---------- */
  var ASSET_HINTS = {
    msi: { ext: ".msi", platform: "win" },
    dmg: { ext: ".dmg", platform: "mac" },
    pkg: { ext: ".pkg", platform: "mac" },
    deb: { ext: ".deb", platform: "linux" }
  };

  function detectPlatform() {
    var ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return "win";
    if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
    if (/Linux|X11/i.test(ua)) return "linux";
    return null;
  }

  function applySmartLinks(latest) {
    if (!latest) return;
    var assets = latest.assets || [];

    document.querySelectorAll("[data-asset]").forEach(function (a) {
      var want = a.getAttribute("data-asset");

      if (want === "auto") {
        var plat = detectPlatform();
        var pick = null;
        if (plat === "win") pick = assets.find(function (x) { return /\.msi$/i.test(x.name); });
        if (plat === "mac") pick = assets.find(function (x) { return /\.dmg$/i.test(x.name); }) || assets.find(function (x) { return /\.pkg$/i.test(x.name); });
        if (plat === "linux") pick = assets.find(function (x) { return /\.deb$/i.test(x.name); });
        if (pick) {
          a.href = pick.browser_download_url;
          return;
        }
        a.href = REPO + "/releases/latest";
        return;
      }

      var hint = ASSET_HINTS[want];
      if (!hint) return;
      var match = assets.find(function (x) {
        return new RegExp(hint.ext.replace(".", "\\.") + "$", "i").test(x.name);
      });
      if (match) a.href = match.browser_download_url;
    });
  }

  /* ---------- Badge demo in hero ---------- */
  var PEOPLE = [
    { name: "KolyaTort",  color: "#e649a6", initial: "K" },
    { name: "Mihej Breau", color: "#2f81f7", initial: "M" },
    { name: "Серый Кардинал", color: "#3fd68f", initial: "С" },
    { name: "Arbre_Kale", color: "#f5a623", initial: "A" },
    { name: "Intos87",    color: "#8b5cf6", initial: "I" },
    { name: "Kapitan",    color: "#22d3ee", initial: "К" }
  ];

  var badgesBox = document.getElementById("badges");
  var notifsBox = document.getElementById("notifs");

  function currentLang() {
    var m = document.documentElement.getAttribute("lang");
    return window.I18N[m] ? m : "en";
  }

  function notifText(type, name) {
    var lang = currentLang();
    var dict = {
      en: { join: "joined the server", leave: "left the server" },
      ru: { join: "зашёл на сервер", leave: "покинул сервер" },
      de: { join: "ist dem Server beigetreten", leave: "hat den Server verlassen" },
      zh: { join: "进入了服务器", leave: "离开了服务器" }
    };
    return name + " " + dict[lang][type];
  }

  function spawnBadge(person) {
    var el = document.createElement("div");
    el.className = "badge";
    el.innerHTML =
      '<span class="badge__ava" style="background:' + person.color + '">' + person.initial + "</span>" +
      '<span class="badge__name">' + person.name + "</span>" +
      '<span class="badge__mic"></span>';
    badgesBox.appendChild(el);
    return el;
  }

  function spawnNotif(type, name) {
    var el = document.createElement("div");
    el.className = "notif notif--" + type;
    el.innerHTML =
      '<span class="notif__icon">' + (type === "join" ? "↳" : "↲") + "</span>" +
      "<span>" + notifText(type, name) + "</span>";
    notifsBox.appendChild(el);
    return el;
  }

  function cycle() {
    if (document.hidden) return; // не тикаем в фоновой вкладке
    if (!badgesBox || !notifsBox) return;

    // 1. Кто-то заходит на сервер -> уведомление
    var joiner = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
    var n = spawnNotif("join", joiner.name);
    setTimeout(function () {
      n.classList.add("is-leaving");
      setTimeout(function () { n.remove(); }, 420);
    }, 2600);

    // 2. Через паузу начинают говорить 1-2 человека
    var talkers = [];
    var count = 1 + Math.floor(Math.random() * 2); // 1..2
    var pool = PEOPLE.slice();
    for (var i = 0; count > 0 && i < pool.length; i++) {
      if (Math.random() < 0.55) { talkers.push(pool[i]); count--; }
    }
    if (talkers.length === 0) talkers.push(pool[0]);

    talkers.forEach(function (person, idx) {
      setTimeout(function () {
        if (document.hidden) return;
        var el = spawnBadge(person);
        talkTimers.push({
          el: el,
          hide: setTimeout(function () {
            el.classList.add("is-leaving");
            setTimeout(function () { el.remove(); }, 420);
          }, 1800 + Math.random() * 2200)
        });
      }, idx * 420);
    });

    // 3. Иногда кто-то уходит -> уведомление выхода
    if (Math.random() < 0.45) {
      var leaver = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
      setTimeout(function () {
        var n2 = spawnNotif("leave", leaver.name);
        setTimeout(function () {
          n2.classList.add("is-leaving");
          setTimeout(function () { n2.remove(); }, 420);
        }, 2600);
      }, 3800);
    }
  }

  var talkTimers = [];
  // Очистка при уходе со страницы не критична: элементы сами удаляются по таймерам.

  setTimeout(function firstTick() {
    cycle();
    setInterval(cycle, 5200);
  }, 900);

  /* ---------- Feature cards hover glow ---------- */
  document.querySelectorAll(".feature").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width) * 100 + "%");
      card.style.setProperty("--my", ((e.clientY - rect.top) / rect.height) * 100 + "%");
    });
  });

  /* ---------- Copy button ---------- */
  document.querySelectorAll(".copybtn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy") || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.classList.add("is-copied");
          setTimeout(function () { btn.classList.remove("is-copied"); }, 1500);
        });
      } else {
        // fallback для старых браузеров
        var ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) { /* ignore */ }
        ta.remove();
        btn.classList.add("is-copied");
        setTimeout(function () { btn.classList.remove("is-copied"); }, 1500);
      }
    });
  });

  /* ---------- Lightbox gallery ---------- */
  var lightbox = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbCap = document.getElementById("lbCap");
  var shots = Array.prototype.slice.call(document.querySelectorAll(".shot"));
  var lbIndex = 0;

  function captionText(shot) {
    var key = shot.getAttribute("data-caption");
    var code = document.documentElement.getAttribute("lang") || "en";
    var dict = window.I18N[code] || window.I18N.en;
    return dict["shots." + key] || key;
  }

  function openLb(index) {
    lbIndex = (index + shots.length) % shots.length;
    var shot = shots[lbIndex];
    lbImg.src = shot.getAttribute("data-full");
    lbImg.alt = shot.querySelector("img").alt;
    lbCap.textContent = captionText(shot);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLb() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  shots.forEach(function (shot, i) {
    shot.addEventListener("click", function () { openLb(i); });
  });

  if (lightbox) {
    document.getElementById("lbClose").addEventListener("click", closeLb);
    document.getElementById("lbPrev").addEventListener("click", function () { openLb(lbIndex - 1); });
    document.getElementById("lbNext").addEventListener("click", function () { openLb(lbIndex + 1); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLb();
    });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") openLb(lbIndex - 1);
      if (e.key === "ArrowRight") openLb(lbIndex + 1);
    });
  }

  /* ---------- Year in footer ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();

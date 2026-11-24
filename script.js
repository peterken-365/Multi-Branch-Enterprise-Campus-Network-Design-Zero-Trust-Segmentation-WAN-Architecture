/* Savannah Logistics site — shared UI behaviour (sidebar, copy buttons, footer year). */
(function () {
  "use strict";

  /* Sidebar drawer (mobile) */
  var toggle = document.querySelector(".nav-toggle");
  var sidebar = document.querySelector(".sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", function () {
      var open = sidebar.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* Active nav link */
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".side-nav a").forEach(function (a) {
    var href = (a.getAttribute("href") || "").toLowerCase();
    if (href && href === page) a.classList.add("active");
  });

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* Copy buttons: <button class="copy-btn" data-copy-target="#id"> or data-copy-text="..." */
  function copyText(text, btn) {
    var done = function () {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* noop */ }
      document.body.removeChild(ta);
      done();
    }
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy-btn");
    if (!btn) return;
    var targetId = btn.getAttribute("data-copy-target");
    var text = btn.getAttribute("data-copy-text");
    if (targetId) {
      var el = document.getElementById(targetId);
      if (el) text = el.getAttribute("data-raw") || el.textContent;
    }
    if (text != null) copyText(text, btn);
  });

  /* Device configs page: tab + fetch raw .txt */
  var cfgView = document.getElementById("cfgView");
  if (cfgView) {
    var CFG_FILES = [
      "R1-HQ-EDGE",
      "R2-MOMBASA-EDGE",
      "MLS-HQ-CORE",
      "SW1-HQ-ACCESS-1",
      "SW2-HQ-ACCESS-2",
      "SW3-MOMBASA-ACCESS"
    ];
    var cache = {};
    var RAW_BASE = "https://raw.githubusercontent.com/peterken-365/Multi-Branch-Enterprise-Campus-Network-Design-Zero-Trust-Segmentation-WAN-Architecture/main/device-configs/";

    function render(name, text) {
      var lines = text.replace(/\r/g, "").split("\n");
      var html = "";
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        var isComment = /^\s*!/.test(ln);
        var no = String(i + 1);
        no = "&nbsp;".repeat(Math.max(0, 3 - no.length)) + no;
        html +=
          '<span class="ln-no">' + no + '</span>' +
          (isComment ? '<span class="ln-c">' + escapeHtml(ln) + '</span>' : escapeHtml(ln)) +
          "\n";
      }
      cfgView.innerHTML = html;
      cfgView.setAttribute("data-raw", text);
    }

    function escapeHtml(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function load(name, btn) {
      document.querySelectorAll(".cfg-tab").forEach(function (b) { b.classList.remove("active"); });
      if (btn) btn.classList.add("active");
      cfgView.textContent = "Loading " + name + ".txt ...";
      var rawLink = document.getElementById("cfgRawLink");
      if (rawLink) rawLink.href = RAW_BASE + name + ".txt";
      if (cache[name]) { render(name, cache[name]); return; }
      fetch("device-configs/" + name + ".txt", { cache: "force-cache" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(function (t) {
          cache[name] = t;
          render(name, t);
        })
        .catch(function () {
          cfgView.textContent = "Could not load " + name + ".txt - open the raw file link above.";
        });
    }

    document.querySelectorAll(".cfg-tab").forEach(function (b) {
      b.addEventListener("click", function () { load(b.getAttribute("data-dev"), b); });
    });

    load(CFG_FILES[0], document.querySelector(".cfg-tab"));
  }
})();

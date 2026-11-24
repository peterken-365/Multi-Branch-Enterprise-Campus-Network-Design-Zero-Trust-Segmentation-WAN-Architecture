// Savannah Logistics — Network Blueprint site interactions
(function () {
  'use strict';

  // --- Mobile navigation toggle -------------------------------------------------
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // --- Active nav link -------------------------------------------------------------
  var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.site-nav a[href]').forEach(function (a) {
    var target = (a.getAttribute('href') || '').toLowerCase();
    if (target === here) a.classList.add('active');
  });

  // --- Footer year --------------------------------------------------------------------
  var y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());

  // --- IOS config syntax highlighter -----------------------------------------------------
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  var KW = /^(hostname|interface|router|vlan|line|ip access-list|access-list|ip nat|ip route|spanning-tree|switchport|crypto|banner|ntp|logging|service|enable|username|no ip domain|login|clock|ip default-gateway|ip dhcp|ip arp|ip source|ip helper|end|exit)\b/;
  var PERMIT = /^\s*permit\b/;
  var DENY = /^\s*deny\b/;
  function highlightIOS(text) {
    return text.split('\n').map(function (line) {
      var t = esc(line);
      if (/^\s*!/.test(line)) return '<span class="tok-c">' + t + '</span>';
      if (KW.test(line)) {
        var m = line.match(KW);
        return '<span class="tok-kw">' + esc(m[1]) + '</span>' + t.slice(m[1].length);
      }
      if (PERMIT.test(line)) return '<span class="tok-permit">' + t + '</span>';
      if (DENY.test(line)) return '<span class="tok-deny">' + t + '</span>';
      return t;
    }).join('\n');
  }

  // --- Device configuration viewer (switching-routing.html) ----------------------------------
  var tabs = document.querySelectorAll('.cfg-tab[data-file]');
  var view = document.getElementById('cfg-body');
  if (tabs.length && view) {
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        var file = tab.getAttribute('data-file');
        var label = tab.getAttribute('data-label') || file;
        view.textContent = 'Loading ' + file + ' …';
        fetch(file, { cache: 'no-cache' })
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
          })
          .then(function (txt) {
            view.innerHTML = highlightIOS(txt);
            var bar = document.getElementById('cfg-title');
            if (bar) bar.textContent = label + ' — golden configuration (source of truth)';
          })
          .catch(function (e) {
            view.textContent = 'Could not load ' + file + ' (' + e.message + ').\n' +
              'Open it directly on GitHub: /blob/main/' + file;
          });
      });
    });
    // Load the first device on page open
    if (tabs[0]) tabs[0].click();
  }
})();

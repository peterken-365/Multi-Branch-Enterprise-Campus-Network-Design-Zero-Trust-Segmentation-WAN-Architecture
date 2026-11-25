/* Savannah Logistics Ltd. — docs site behaviour.
   Sidebar drawer, copy buttons, golden-config viewer (six .cfg tabs),
   lab console replay (recorded CLI sessions per device) and a packet
   policy trace simulator. No frameworks, no build step. */
(function () {
  "use strict";

  /* ------------------------------------------------------------ sidebar */
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

  /* active nav link */
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  Array.prototype.forEach.call(document.querySelectorAll(".side-nav a"), function (a) {
    var href = (a.getAttribute("href") || "").toLowerCase();
    if (href && href === page) a.classList.add("active");
  });

  /* footer year */
  Array.prototype.forEach.call(document.querySelectorAll("[data-year]"), function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ------------------------------------------------------------ copy */
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
    var btn = e.target.closest ? e.target.closest(".copy-btn") : null;
    if (!btn) return;
    var targetId = btn.getAttribute("data-copy-target");
    var text = btn.getAttribute("data-copy-text");
    if (targetId) {
      var el = document.getElementById(targetId);
      if (el) text = el.getAttribute("data-raw") || el.textContent;
    }
    if (text != null) copyText(text, btn);
  });

  /* ------------------------------------------ golden config viewer */
  var cfgView = document.getElementById("cfgView");
  if (cfgView) {
    var CFG_FILES = ["R1-HQ-EDGE", "R2-MOMBASA-EDGE", "MLS-HQ-CORE", "SW1-HQ-ACCESS-1", "SW2-HQ-ACCESS-2", "SW3-MOMBASA-ACCESS"];
    var cache = {};
    var RAW_BASE = "https://github.com/peterken-365/Multi-Branch-Enterprise-Campus-Network-Design-Zero-Trust-Segmentation-WAN-Architecture/blob/main/02-switching-and-routing-design/configs/";

    function escapeHtml(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function render(name, text) {
      var lines = text.replace(/\r/g, "").split("\n");
      var html = "";
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        var isComment = /^\s*!/.test(ln);
        var no = String(i + 1);
        no = "&nbsp;".repeat(Math.max(0, 3 - no.length)) + no;
        html += '<span class="ln-no">' + no + '</span>' +
          (isComment ? '<span class="ln-c">' + escapeHtml(ln) + '</span>' : escapeHtml(ln)) + "\n";
      }
      cfgView.innerHTML = html;
      cfgView.setAttribute("data-raw", text);
    }

    function load(name, btn) {
      Array.prototype.forEach.call(document.querySelectorAll(".cfg-tab"), function (b) {
        b.classList.remove("active");
      });
      if (btn) btn.classList.add("active");
      cfgView.textContent = "Loading " + name + ".cfg ...";
      var rawLink = document.getElementById("cfgRawLink");
      if (rawLink) rawLink.href = RAW_BASE + name + ".cfg";
      if (cache[name]) { render(name, cache[name]); return; }
      fetch("02-switching-and-routing-design/configs/" + name + ".cfg", { cache: "force-cache" })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(function (t) {
          cache[name] = t;
          render(name, t);
        })
        .catch(function () {
          cfgView.textContent = "Could not load " + name + ".cfg - open the raw file link above.";
        });
    }

    Array.prototype.forEach.call(document.querySelectorAll(".cfg-tab"), function (b) {
      b.addEventListener("click", function () { load(b.getAttribute("data-dev"), b); });
    });

    load(CFG_FILES[0], document.querySelector(".cfg-tab"));
  }

  /* ------------------------------------------ lab console replay data */
  var MOTD = "***********************************************************\n  AUTHORIZED ACCESS ONLY\n  This system is the property of Savannah Logistics Ltd.\n  Unauthorized access attempts are prohibited and logged.\n  Disconnect IMMEDIATELY if you are not an authorized user.\n  Contact: netops@savannah-logistics.co.ke\n***********************************************************";
  var SESSION = "recorded session - Tue Mar 3 2026, 14:52 EAT - Packet Tracer 8.2 build";

  function pingOK(ip, min, avg, max) {
    return "Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to " + ip + ", timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5), round-trip min/avg/max = " + min + "/" + avg + "/" + max + " ms";
  }

  var RUN_NOTE = "Building configuration...\n\n[output elided in this replay - the full golden config is:]\n  02-switching-and-routing-design/configs/ - see the Switching & routing page\n  (tabs fetch the real .cfg files live from this repository)";

  var DEVICES = {
    "R1-HQ-EDGE": {
      prompt: "R1-HQ-EDGE#",
      meta: "ISR 2911 (PT) / ISR 4331 (production) - NAT/PAT edge, OSPF area 0 - mgmt 10.20.255.1 (Loopback0)",
      cmds: {
        "show ip interface brief": "Interface              IP-Address      OK? Method Status                Protocol\nGigabitEthernet0/0     203.0.113.2     YES manual up                    up\nGigabitEthernet0/1     10.20.254.5     YES manual up                    up\nGigabitEthernet0/2     10.20.254.1     YES manual up                    up\nLoopback0              10.20.255.1     YES manual up                    up\nVlan1                  unassigned      YES unset  administratively down down",
        "show ip route": "Gateway of last resort is 203.0.113.1 to network 0.0.0.0\n\n     10.0.0.0/8 is variably subnetted, 13 subnets, 7 masks\nO       10.20.10.0/26 [110/2] via 10.20.254.6, 00:14:05, GigabitEthernet0/1\nO       10.20.20.0/25 [110/2] via 10.20.254.6, 00:14:05, GigabitEthernet0/1\nO       10.20.30.0/27 [110/2] via 10.20.254.6, 00:14:05, GigabitEthernet0/1\nO       10.20.40.0/24 [110/2] via 10.20.254.6, 00:14:05, GigabitEthernet0/1\nO       10.20.50.0/25 [110/2] via 10.20.254.2, 00:14:02, GigabitEthernet0/2\nO       10.20.99.0/28 [110/2] via 10.20.254.6, 00:14:05, GigabitEthernet0/1\nO       10.20.99.16/28 [110/2] via 10.20.254.2, 00:14:02, GigabitEthernet0/2\nC       10.20.254.0/30 is directly connected, GigabitEthernet0/2\nL       10.20.254.1/32 is directly connected, GigabitEthernet0/2\nC       10.20.254.4/30 is directly connected, GigabitEthernet0/1\nL       10.20.254.5/32 is directly connected, GigabitEthernet0/1\nC       10.20.255.1/32 is directly connected, Loopback0\nO       10.20.255.2/32 [110/2] via 10.20.254.2, 00:14:02, GigabitEthernet0/2\n     203.0.113.0/24 is variably subnetted, 2 subnets, 2 masks\nC       203.0.113.0/30 is directly connected, GigabitEthernet0/0\nL       203.0.113.2/32 is directly connected, GigabitEthernet0/0\nS*      0.0.0.0/0 [1/0] via 203.0.113.1",
        "show ip ospf neighbor": "Neighbor ID     Pri   State           Dead Time   Address         Interface\n2.2.2.2          0   FULL/  -        00:00:37    10.20.254.2     GigabitEthernet0/2\n3.3.3.3          0   FULL/  -        00:00:34    10.20.254.6     GigabitEthernet0/1",
        "show ip protocols": "Routing Protocol is \"ospf 10\"\n  Outgoing update filter list for all interfaces is not set\n  Incoming update filter list for all interfaces is not set\n  Router ID 1.1.1.1\n  It is an autonomous system boundary router\n   Redistributing External Routes from,\n  Number of areas in this router is 1. 1 normal 0 stub 0 nssa\n  Maximum path: 4\n  Routing for Networks:\n    10.20.254.0 0.0.0.3 area 0\n    10.20.254.4 0.0.0.3 area 0\n    10.20.255.1 0.0.0.0 area 0\n  Passive Interface(s):\n    GigabitEthernet0/0\n    Vlan1\n  Routing Information Sources:\n    Gateway         Distance      Last Update\n    2.2.2.2         110           00:14:02\n    3.3.3.3         110           00:14:05\n  Distance: (default is 110)",
        "show ip nat translations": "Pro  Inside global      Inside local       Outside local      Outside global\ntcp 203.0.113.2:1025  10.20.40.100:1025  198.51.100.10:80   198.51.100.10:80\ntcp 203.0.113.2:1026  10.20.50.50:1026   198.51.100.10:80   198.51.100.10:80\ntcp 203.0.113.2:1027  10.20.10.6:1027    198.51.100.10:80   198.51.100.10:80\n\n[internal-to-internal sessions never appear here: NAT-PERMITTED line 10\n denies 10.20.0.0/16 -> 10.20.0.0/16 translation, so management ACLs see\n true source addresses]",
        "show ip nat statistics": "Total translations: 3 (0 static, 3 dynamic, 3 extended)\nOutside Interfaces: GigabitEthernet0/0\nInside Interfaces: GigabitEthernet0/1 , GigabitEthernet0/2\nHits: 47  Misses: 0\nExpired translations: 11\nDynamic mappings:\n-- Inside Source\naccess-list NAT-PERMITTED interface GigabitEthernet0/0 refCount 3",
        "show access-lists": "Extended IP access list EDGE-INBOUND\n    10 permit tcp any any established (142 match(es))\n    20 permit udp any eq domain any (23 match(es))\n    30 permit icmp any any echo-reply (8 match(es))\n    40 permit icmp any any time-exceeded\n    50 permit icmp any any unreachable (2 match(es))\n    60 deny ip any any log (31 match(es))\nExtended IP access list NAT-PERMITTED\n    10 deny ip 10.20.0.0 0.0.255.255 10.20.0.0 0.0.255.255 (312 match(es))\n    20 permit ip 10.20.0.0 0.0.255.255 any (47 match(es))\nStandard IP access list MGMT-ACCESS\n    10 permit 10.20.10.0 0.0.0.63 (12 match(es))\n    20 deny any log",
        "show ip ssh": "SSH Version: 2.0\nSSH protocol version 1: disabled 2: enabled",
        "show clock": "14:52:07.318 EAT Tue Mar 3 2026",
        "show ntp associations": "  address         ref clock       st   when   poll reach  delay  offset   disp\n ~10.20.30.11      127.127.7.1     3     33     64   377  0.000   0.0000   1.213\n * master (synced), # master (unsynced), + selected, - candidate, ~ configured",
        "show users": "    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00\n   514 vty 0    netadmin   idle                 00:00:12   10.20.10.6\n\n  Interface    User               Mode         Idle     Peer Address",
        "show running-config": RUN_NOTE
      },
      pings: {
        "10.20.30.20": pingOK("10.20.30.20", "1", "2", "4"),
        "10.20.255.2": pingOK("10.20.255.2", "1", "1", "2"),
        "203.0.113.1": pingOK("203.0.113.1", "1", "1", "2"),
        "10.20.40.100": pingOK("10.20.40.100", "1", "2", "4")
      }
    },
    "R2-MOMBASA-EDGE": {
      prompt: "R2-MOMBASA-EDGE#",
      meta: "ISR 2911 (PT) / ISR 4331 (production) - branch gateway, router-on-a-stick - mgmt 10.20.255.2 (Loopback0)",
      cmds: {
        "show ip interface brief": "Interface              IP-Address      OK? Method Status                Protocol\nGigabitEthernet0/0     10.20.254.2     YES manual up                    up\nGigabitEthernet0/1     unassigned      YES unset  up                    up\nGigabitEthernet0/1.50  10.20.50.1      YES manual up                    up\nGigabitEthernet0/1.99  10.20.99.17     YES manual up                    up\nLoopback0              10.20.255.2     YES manual up                    up\nVlan1                  unassigned      YES unset  administratively down down",
        "show ip route": "Gateway of last resort is 10.20.254.1 to network 0.0.0.0\n\n     10.0.0.0/8 is variably subnetted, 13 subnets, 7 masks\nO       10.20.10.0/26 [110/3] via 10.20.254.1, 00:14:02, GigabitEthernet0/0\nO       10.20.20.0/25 [110/3] via 10.20.254.1, 00:14:02, GigabitEthernet0/0\nO       10.20.30.0/27 [110/3] via 10.20.254.1, 00:14:02, GigabitEthernet0/0\nO       10.20.40.0/24 [110/3] via 10.20.254.1, 00:14:02, GigabitEthernet0/0\nC       10.20.50.0/25 is directly connected, GigabitEthernet0/1.50\nL       10.20.50.1/32 is directly connected, GigabitEthernet0/1.50\nO       10.20.99.0/28 [110/3] via 10.20.254.1, 00:14:02, GigabitEthernet0/0\nC       10.20.99.16/28 is directly connected, GigabitEthernet0/1.99\nL       10.20.99.17/32 is directly connected, GigabitEthernet0/1.99\nC       10.20.254.0/30 is directly connected, GigabitEthernet0/0\nL       10.20.254.2/32 is directly connected, GigabitEthernet0/0\nO       10.20.254.4/30 [110/2] via 10.20.254.1, 00:14:02, GigabitEthernet0/0\nO       10.20.255.1/32 [110/2] via 10.20.254.1, 00:14:02, GigabitEthernet0/0\nO*E2 0.0.0.0/0 [110/1] via 10.20.254.1, 00:14:02, GigabitEthernet0/0\n\n[no static routes on the branch: every HQ subnet is OSPF-learned (O),\n the default is originated by R1 via default-information originate (O*E2)]",
        "show ip ospf neighbor": "Neighbor ID     Pri   State           Dead Time   Address         Interface\n1.1.1.1          0   FULL/  -        00:00:39    10.20.254.1     GigabitEthernet0/0",
        "show access-lists": "Extended IP access list BRANCH-IN\n    10 permit udp any any eq bootps (6 match(es))\n    20 permit udp 10.20.50.0 0.0.0.127 host 10.20.30.12 eq domain (19 match(es))\n    30 permit icmp 10.20.50.0 0.0.0.127 host 10.20.50.1 echo (4 match(es))\n    40 permit tcp 10.20.50.0 0.0.0.127 10.20.30.0 0.0.0.31 eq www (15 match(es))\n    50 permit tcp 10.20.50.0 0.0.0.127 10.20.30.0 0.0.0.31 eq 443 (7 match(es))\n    60 permit icmp 10.20.50.0 0.0.0.127 10.20.30.0 0.0.0.31 echo (9 match(es))\n    70 permit udp 10.20.50.0 0.0.0.127 10.20.30.0 0.0.0.31 range 33434 33534 (12 match(es))\n    80 deny ip 10.20.50.0 0.0.0.127 10.20.20.0 0.0.0.127 log (3 match(es))\n    90 deny ip 10.20.50.0 0.0.0.127 10.20.0.0 0.0.255.255 log (5 match(es))\n    100 permit ip any any (26 match(es))\nStandard IP access list MGMT-ACCESS\n    10 permit 10.20.10.0 0.0.0.63 (4 match(es))\n    20 deny any log",
        "show ip ssh": "SSH Version: 2.0\nSSH protocol version 1: disabled 2: enabled",
        "show clock": "14:52:07.204 EAT Tue Mar 3 2026",
        "show ntp associations": "  address         ref clock       st   when   poll reach  delay  offset   disp\n ~10.20.30.11      127.127.7.1     3     41     64   377  0.000   0.0000   1.407\n * master (synced), # master (unsynced), + selected, - candidate, ~ configured",
        "show users": "    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00\n\n  Interface    User               Mode         Idle     Peer Address",
        "show running-config": RUN_NOTE
      },
      pings: {
        "10.20.30.20": pingOK("10.20.30.20", "2", "3", "6"),
        "10.20.255.1": pingOK("10.20.255.1", "1", "1", "2"),
        "10.20.50.50": pingOK("10.20.50.50", "1", "1", "1")
      }
    },
    "MLS-HQ-CORE": {
      prompt: "MLS-HQ-CORE#",
      meta: "Catalyst 3650-24PS - L3 core: SVI gateways, Rapid PVST+ root, DHCP relay, gateway ACLs - mgmt 10.20.99.1 (SVI99)",
      cmds: {
        "show vlan brief": "VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n1    default                          active\n10   IT-ADMIN                         active\n20   FINANCE-HR                       active\n30   INTERNAL-SERVERS                 active\n40   GUEST-BYOD                       active\n99   NET-MGMT                         active\n999  QUARANTINE                       active    Gig1/0/3, Gig1/0/4, Gig1/0/5, Gig1/0/6\n                                                Gig1/0/7, Gig1/0/8, Gig1/0/9, Gig1/0/10\n                                                Gig1/0/11, Gig1/0/12, Gig1/0/13, Gig1/0/14\n                                                Gig1/0/15, Gig1/0/16, Gig1/0/17, Gig1/0/18\n                                                Gig1/0/19, Gig1/0/20, Gig1/0/21, Gig1/0/22\n                                                Gig1/0/23, Gig1/0/24, Gig1/1/2, Gig1/1/3\n                                                Gig1/1/4\n\n[VLAN 1 has zero ports: trunks carry tagged traffic only (Gi1/0/1-2) and\n Gi1/1/1 is a routed port (no switchport). Quarantine VLAN 999 holds every\n unused port, shutdown.]",
        "show interfaces trunk": "Port        Mode         Encapsulation  Status        Native vlan\nGi1/0/1     on           802.1q         trunking      999\nGi1/0/2     on           802.1q         trunking      999\n\nPort        Vlans allowed on trunk\nGi1/0/1     10,20,40,99,999\nGi1/0/2     30,99,999\n\nPort        Vlans active and allowed in management domain\nGi1/0/1     10,20,40,99,999\nGi1/0/2     30,99,999\n\nPort        Vlans in spanning tree forwarding state and not pruned\nGi1/0/1     10,20,40,99,999\nGi1/0/2     30,99,999",
        "show ip interface brief": "Interface              IP-Address      OK? Method Status                Protocol\nGigabitEthernet1/0/1   unassigned      YES unset  up                    up\nGigabitEthernet1/0/2   unassigned      YES unset  up                    up\nGigabitEthernet1/0/3   unassigned      YES unset  administratively down down\nGigabitEthernet1/0/4   unassigned      YES unset  administratively down down\nGigabitEthernet1/0/5   unassigned      YES unset  administratively down down\nGigabitEthernet1/0/6   unassigned      YES unset  administratively down down\nGigabitEthernet1/0/7   unassigned      YES unset  administratively down down\nGigabitEthernet1/0/8   unassigned      YES unset  administratively down down\nGigabitEthernet1/0/9   unassigned      YES unset  administratively down down\nGigabitEthernet1/0/10  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/11  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/12  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/13  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/14  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/15  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/16  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/17  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/18  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/19  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/20  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/21  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/22  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/23  unassigned      YES unset  administratively down down\nGigabitEthernet1/0/24  unassigned      YES unset  administratively down down\nGigabitEthernet1/1/1   10.20.254.6     YES manual up                    up\nGigabitEthernet1/1/2   unassigned      YES unset  administratively down down\nGigabitEthernet1/1/3   unassigned      YES unset  administratively down down\nGigabitEthernet1/1/4   unassigned      YES unset  administratively down down\nVlan10                 10.20.10.1      YES manual up                    up\nVlan20                 10.20.20.1      YES manual up                    up\nVlan30                 10.20.30.1      YES manual up                    up\nVlan40                 10.20.40.1      YES manual up                    up\nVlan99                 10.20.99.1      YES manual up                    up",
        "show ip route": "Gateway of last resort is 10.20.254.5 to network 0.0.0.0\n\n     10.0.0.0/8 is variably subnetted, 17 subnets, 7 masks\nC       10.20.10.0/26 is directly connected, Vlan10\nL       10.20.10.1/32 is directly connected, Vlan10\nC       10.20.20.0/25 is directly connected, Vlan20\nL       10.20.20.1/32 is directly connected, Vlan20\nC       10.20.30.0/27 is directly connected, Vlan30\nL       10.20.30.1/32 is directly connected, Vlan30\nC       10.20.40.0/24 is directly connected, Vlan40\nL       10.20.40.1/32 is directly connected, Vlan40\nO       10.20.50.0/25 [110/3] via 10.20.254.5, 00:14:02, GigabitEthernet1/1/1\nC       10.20.99.0/28 is directly connected, Vlan99\nL       10.20.99.1/32 is directly connected, Vlan99\nO       10.20.99.16/28 [110/3] via 10.20.254.5, 00:14:02, GigabitEthernet1/1/1\nO       10.20.254.0/30 [110/2] via 10.20.254.5, 00:14:02, GigabitEthernet1/1/1\nC       10.20.254.4/30 is directly connected, GigabitEthernet1/1/1\nL       10.20.254.6/32 is directly connected, GigabitEthernet1/1/1\nO       10.20.255.1/32 [110/2] via 10.20.254.5, 00:14:02, GigabitEthernet1/1/1\nO       10.20.255.2/32 [110/3] via 10.20.254.5, 00:14:02, GigabitEthernet1/1/1\nO*E2 0.0.0.0/0 [110/1] via 10.20.254.5, 00:14:02, GigabitEthernet1/1/1",
        "show ip ospf neighbor": "Neighbor ID     Pri   State           Dead Time   Address         Interface\n1.1.1.1          0   FULL/  -        00:00:35    10.20.254.5     GigabitEthernet1/1/1",
        "show spanning-tree vlan 20": "VLAN0020\n  Spanning tree enabled protocol rstp\n  Root ID    Priority    24596\n             Address     0060.2FAA.8800\n             This bridge is root\n             Hello Time  2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n  Bridge ID  Priority    24596  (priority 24576 sys-id-ext 20)\n             Address     0060.2FAA.8800\n             Hello Time  2 sec  Max Age 20 sec  Forward Delay 15 sec\n\nInterface        Role Sts Cost      Prio.Nbr Type\n---------------- ---- --- --------- -------- --------------------------------\nGi1/0/1          Desg FWD 4         128.25   P2p\nGi1/0/2          Desg FWD 4         128.26   P2p",
        "show access-lists": "Extended IP access list FINANCE-IN\n    10 permit udp any any eq bootps (14 match(es))\n    20 permit udp 10.20.20.0 0.0.0.127 host 10.20.30.12 eq domain (38 match(es))\n    30 permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq www (27 match(es))\n    40 permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq 443 (12 match(es))\n    50 permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq 1433 (6 match(es))\n    60 permit icmp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 echo (4 match(es))\n    70 permit udp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 range 33434 33534 (8 match(es))\n    80 deny ip 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 (2 match(es))\n    90 permit ip any any (44 match(es))\nExtended IP access list GUEST-IN\n    10 permit udp any any eq bootps (9 match(es))\n    20 permit udp any any eq domain (31 match(es))\n    30 deny ip any 10.20.0.0 0.0.255.255 log (8 match(es))\n    40 permit tcp any any eq www (18 match(es))\n    50 permit tcp any any eq 443 (9 match(es))\n    60 deny ip any any log (4 match(es))\nExtended IP access list MGMT-PLANE\n    10 permit tcp 10.20.10.0 0.0.0.63 10.20.99.0 0.0.0.15 eq 22 (5 match(es))\n    20 permit icmp 10.20.10.0 0.0.0.63 10.20.99.0 0.0.0.15 (11 match(es))\n    30 permit udp host 10.20.30.11 10.20.99.0 0.0.0.15 eq ntp (217 match(es))\n    40 deny ip any 10.20.99.0 0.0.0.15 log (6 match(es))\nStandard IP access list MGMT-ACCESS\n    10 permit 10.20.10.0 0.0.0.63 (3 match(es))\n    20 deny any log",
        "show ip ssh": "SSH Version: 2.0\nSSH protocol version 1: disabled 2: enabled",
        "show clock": "14:52:07.451 EAT Tue Mar 3 2026",
        "show users": "    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00\n   514 vty 0    netadmin   idle                 00:00:08   10.20.10.6\n\n  Interface    User               Mode         Idle     Peer Address",
        "show running-config": RUN_NOTE
      },
      pings: {
        "10.20.30.10": pingOK("10.20.30.10", "1", "1", "2"),
        "10.20.30.20": pingOK("10.20.30.20", "1", "1", "2"),
        "10.20.255.2": pingOK("10.20.255.2", "1", "2", "4")
      }
    },
    "SW1-HQ-ACCESS-1": {
      prompt: "SW1-HQ-ACCESS-1#",
      meta: "Catalyst 2960-24TT - HQ user access (IT 10 / Finance 20 / Guest 40), STP root secondary - mgmt 10.20.99.2 (SVI99)",
      cmds: {
        "show vlan brief": "VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n1    default                          active\n10   IT-ADMIN                         active    Fa0/1, Fa0/2\n20   FINANCE-HR                       active    Fa0/3, Fa0/4, Fa0/5, Fa0/6\n                                                Fa0/7, Fa0/8, Fa0/9, Fa0/10\n30   INTERNAL-SERVERS                 active\n40   GUEST-BYOD                       active    Fa0/11, Fa0/12, Fa0/13, Fa0/14\n                                                Fa0/15, Fa0/16, Fa0/17, Fa0/18\n99   NET-MGMT                         active\n999  QUARANTINE                       active    Fa0/19, Fa0/20, Fa0/21, Fa0/22\n                                                Fa0/23, Fa0/24, Gig0/2",
        "show interfaces trunk": "Port        Mode         Encapsulation  Status        Native vlan\nGi0/1       on           802.1q         trunking      999\n\nPort        Vlans allowed on trunk\nGi0/1       10,20,40,99,999\n\nPort        Vlans active and allowed in management domain\nGi0/1       10,20,40,99,999\n\nPort        Vlans in spanning tree forwarding state and not pruned\nGi0/1       10,20,40,99,999",
        "show spanning-tree vlan 20": "VLAN0020\n  Spanning tree enabled protocol rstp\n  Root ID    Priority    24596\n             Address     0060.2FAA.8800\n             Cost        4\n             Port        25(GigabitEthernet0/1)\n             Hello Time  2 sec  Max Age 20 sec  Forward Delay 15 sec\n\n  Bridge ID  Priority    32788  (priority 32768 sys-id-ext 20)\n             Address     00D0.BAF1.7A40\n             Hello Time  2 sec  Max Age 20 sec  Forward Delay 15 sec\n\nInterface        Role Sts Cost      Prio.Nbr Type\n---------------- ---- --- --------- -------- --------------------------------\nGi0/1            Root FWD 4         128.25   P2p\nFa0/3            Desg FWD 19        128.3    P2p Edge\nFa0/4            Desg FWD 19        128.4    P2p Edge\nFa0/5            Desg FWD 19        128.5    P2p Edge\nFa0/6            Desg FWD 19        128.6    P2p Edge\nFa0/7            Desg FWD 19        128.7    P2p Edge\nFa0/8            Desg FWD 19        128.8    P2p Edge\nFa0/9            Desg FWD 19        128.9    P2p Edge\nFa0/10           Desg FWD 19        128.10   P2p Edge",
        "show port-security": "Secure Port      MaxSecureAddr     CurrentAddr     SecurityViolation     Security Action    (Addr count)\n   Fa0/1         2                 1               0                     Shutdown           (1)\n   Fa0/2         2                 1               0                     Shutdown           (1)\n   Fa0/3         2                 1               0                     Shutdown           (1)\n   Fa0/4         2                 1               0                     Shutdown           (1)\n   Fa0/5         2                 0               0                     Shutdown           (0)\n   Fa0/6         2                 0               0                     Shutdown           (0)\n   Fa0/7         2                 0               0                     Shutdown           (0)\n   Fa0/8         2                 0               0                     Shutdown           (0)\n   Fa0/9         2                 0               0                     Shutdown           (0)\n   Fa0/10        2                 0               0                     Shutdown           (0)\n   Fa0/11        10                3               0                     Restrict           (3)\n   Fa0/12        2                 1               0                     Shutdown           (1)\n   Fa0/13        2                 0               0                     Shutdown           (0)\n   Fa0/14        2                 0               0                     Shutdown           (0)\n   Fa0/15        2                 0               0                     Shutdown           (0)\n   Fa0/16        2                 0               0                     Shutdown           (0)\n   Fa0/17        2                 0               0                     Shutdown           (0)\n   Fa0/18        2                 0               0                     Shutdown           (0)\nTotal Addresses in System (excluding one mac per port)     : 7\nMax Addresses limit in System (excluding one mac per port) : 8320\n\n[Fa0/11 is the guest Wi-Fi AP port: max 10, violation restrict - a busy AP\n must not err-disable. Every other access port: max 2, sticky, shutdown.]",
        "show port-security interface fastethernet0/3": "Port Security              : Enabled\nPort Status                : Secure-up\nViolation Mode             : Shutdown\nAging Time                 : 0 mins\nAging Type                 : Absolute\nSecureStatic Address Aging : Enabled\nMaximum MAC Addresses      : 2\nTotal MAC Addresses        : 1\nConfigured MAC Addresses   : 0\nSticky MAC Addresses       : 1\nLast Source Address:Vlan   : 0050.56BE.1102:20\nSecurity Violation Count   : 0\n\n[Pristine state. The T-05 attack transcript (verification page) shows this\n port after a rogue hub pushes a third MAC: Secure-shutdown, violation 1.]",
        "show ip dhcp snooping": "Switch DHCP snooping is enabled\nSwitch DHCP gleaning is disabled\nDHCP snooping is configured on following VLANs:\n10,20,40\nInsertion of option 82 is disabled\nOption 82 on untrusted port is not allowed\nVerification of hwaddr field is enabled\nVerification of giaddr field is enabled\nDHCP snooping trust/rate is configured on the following Interfaces:\n\nInterface                  Trusted    Rate limit (pps)\n------------------------   -------    ----------------\nGigabitEthernet0/1         yes        unlimited",
        "show ip dhcp snooping binding": "MacAddress          IpAddress        Lease(sec)  Type           VLAN  Interface\n------------------  ---------------  ----------  -------------  ----  --------------------\n0050.56BE.1101      10.20.10.6       86400       dhcp-snooping   10   FastEthernet0/1\n0050.56BE.1102      10.20.20.6       86395       dhcp-snooping   20   FastEthernet0/3\n0050.56BE.1103      10.20.20.5       86322       dhcp-snooping   20   FastEthernet0/4\n0050.56BE.1501      10.20.40.100     86280       dhcp-snooping   40   FastEthernet0/12\n0050.56BE.1401      10.20.40.101     86400       dhcp-snooping   40   FastEthernet0/11\n0050.56BE.1402      10.20.40.102     86351       dhcp-snooping   40   FastEthernet0/11\n0050.56BE.1403      10.20.40.103     86217       dhcp-snooping   40   FastEthernet0/11\nTotal number of bindings: 7\n\n[These bindings feed DAI: any ARP packet whose IP/MAC pair is not here\n (or in a static binding) is dropped on untrusted ports.]",
        "show ip arp inspection interfaces": "Interface        Trust Mode     Configured Trust    Allow OPS\n------------     -----------    ----------------    ---------\nGi0/1            Trusted        Yes                 All\nFa0/1            Untrusted      No                  All\nFa0/2            Untrusted      No                  All\nFa0/3            Untrusted      No                  All\nFa0/4            Untrusted      No                  All\nFa0/11           Untrusted      No                  All\nFa0/12           Untrusted      No                  All",
        "show cdp neighbors": "Device ID        Local Intrfce     Holdtme    Capability  Platform    Port ID\nMLS-HQ-CORE      Gig 0/1           126         S I        3650-24PS   Gig 1/0/1\nPC-IT01          Fas 0/1           141         H          PC          Fas 0\nPC-FIN02         Fas 0/3           137         H          PC          Fas 0\nPC-FIN01         Fas 0/4           129         H          PC          Fas 0\nPC-GUEST01       Fas 0/12          118         H          PC          Fas 0",
        "show mac address-table": "          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n  10    0050.56BE.1101    DYNAMIC     Fa0/1\n  10    0050.56BE.1104    DYNAMIC     Fa0/2\n  20    0050.56BE.1103    DYNAMIC     Fa0/4\n  20    0050.56BE.1102    DYNAMIC     Fa0/3\n  40    0050.56BE.1501    DYNAMIC     Fa0/12\n  40    0050.56BE.1401    DYNAMIC     Fa0/11\n  40    0050.56BE.1402    DYNAMIC     Fa0/11\n  40    0050.56BE.1403    DYNAMIC     Fa0/11\n  99    0060.2FAA.8800    DYNAMIC     Gi0/1\nTotal Mac Addresses for this criterion: 9",
        "show interfaces status": "Port      Name               Status       Vlan       Duplex  Speed Type\nFa0/1     IT-ADMIN           connected    10         auto    auto  10/100BaseTX\nFa0/2     IT-ADMIN           connected    10         auto    auto  10/100BaseTX\nFa0/3     FIN/HR             connected    20         auto    auto  10/100BaseTX\nFa0/4     FIN/HR             connected    20         auto    auto  10/100BaseTX\nFa0/5     FIN/HR             notconnect   20         auto    auto  10/100BaseTX\nFa0/6     FIN/HR             notconnect   20         auto    auto  10/100BaseTX\nFa0/7     FIN/HR             notconnect   20         auto    auto  10/100BaseTX\nFa0/8     FIN/HR             notconnect   20         auto    auto  10/100BaseTX\nFa0/9     FIN/HR             notconnect   20         auto    auto  10/100BaseTX\nFa0/10    FIN/HR             notconnect   20         auto    auto  10/100BaseTX\nFa0/11    GUEST-AP           connected    40         auto    auto  10/100BaseTX\nFa0/12    WIRED-GUEST        connected    40         auto    auto  10/100BaseTX\nFa0/13    WIRED-GUEST        notconnect   40         auto    auto  10/100BaseTX\nFa0/14    WIRED-GUEST        notconnect   40         auto    auto  10/100BaseTX\nFa0/15    WIRED-GUEST        notconnect   40         auto    auto  10/100BaseTX\nFa0/16    WIRED-GUEST        notconnect   40         auto    auto  10/100BaseTX\nFa0/17    WIRED-GUEST        notconnect   40         auto    auto  10/100BaseTX\nFa0/18    WIRED-GUEST        notconnect   40         auto    auto  10/100BaseTX\nFa0/19    QUARANTINE         disabled     999        auto    auto  10/100BaseTX\nFa0/20    QUARANTINE         disabled     999        auto    auto  10/100BaseTX\nFa0/21    QUARANTINE         disabled     999        auto    auto  10/100BaseTX\nFa0/22    QUARANTINE         disabled     999        auto    auto  10/100BaseTX\nFa0/23    QUARANTINE         disabled     999        auto    auto  10/100BaseTX\nFa0/24    QUARANTINE         disabled     999        auto    auto  10/100BaseTX\nGi0/1     UPLINK-MLS         connected    trunk      full    1000  10/100/1000BaseTX\nGi0/2     QUARANTINE         disabled     999        auto    auto  10/100/1000BaseTX",
        "show clock": "14:52:07.312 EAT Tue Mar 3 2026",
        "show users": "    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00\n\n  Interface    User               Mode         Idle     Peer Address",
        "show running-config": RUN_NOTE
      },
      pings: {
        "10.20.99.1": pingOK("10.20.99.1", "1", "1", "1")
      }
    },
    "SW2-HQ-ACCESS-2": {
      prompt: "SW2-HQ-ACCESS-2#",
      meta: "Catalyst 2960-24TT - server farm access (VLAN 30), DAI with static source bindings - mgmt 10.20.99.3 (SVI99)",
      cmds: {
        "show vlan brief": "VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n1    default                          active\n30   INTERNAL-SERVERS                 active    Fa0/1, Fa0/2, Fa0/3, Fa0/4\n99   NET-MGMT                         active\n999  QUARANTINE                       active    Fa0/5, Fa0/6, Fa0/7, Fa0/8\n                                                Fa0/9, Fa0/10, Fa0/11, Fa0/12\n                                                Fa0/13, Fa0/14, Fa0/15, Fa0/16\n                                                Fa0/17, Fa0/18, Fa0/19, Fa0/20\n                                                Fa0/21, Fa0/22, Fa0/23, Fa0/24\n                                                Gig0/2",
        "show port-security": "Secure Port      MaxSecureAddr     CurrentAddr     SecurityViolation     Security Action    (Addr count)\n   Fa0/1         1                 1               0                     Shutdown           (1)\n   Fa0/2         1                 1               0                     Shutdown           (1)\n   Fa0/3         1                 1               0                     Shutdown           (1)\n   Fa0/4         1                 1               0                     Shutdown           (1)\nTotal Addresses in System (excluding one mac per port)     : 0\nMax Addresses limit in System (excluding one mac per port) : 8320",
        "show ip dhcp snooping binding": "MacAddress          IpAddress        Lease(sec)  Type           VLAN  Interface\n------------------  ---------------  ----------  -------------  ----  --------------------\n0050.56AB.0010      10.20.30.10      infinite    static          30   FastEthernet0/1\n0050.56AB.0011      10.20.30.11      infinite    static          30   FastEthernet0/2\n0050.56AB.0012      10.20.30.12      infinite    static          30   FastEthernet0/3\n0050.56AB.0020      10.20.30.20      infinite    static          30   FastEthernet0/4\nTotal number of bindings: 4\n\n[Servers are statically addressed, so their DAI validation entries are\n static ip source binding lines - see the SW2 golden config.]",
        "show ip arp inspection interfaces": "Interface        Trust Mode     Configured Trust    Allow OPS\n------------     -----------    ----------------    ---------\nGi0/1            Trusted        Yes                 All\nFa0/1            Untrusted      No                  All\nFa0/2            Untrusted      No                  All\nFa0/3            Untrusted      No                  All\nFa0/4            Untrusted      No                  All",
        "show cdp neighbors": "Device ID        Local Intrfce     Holdtme    Capability  Platform    Port ID\nMLS-HQ-CORE      Gig 0/1           152         S I        3650-24PS   Gig 1/0/2\nSVL-DC01         Fas 0/1           144         H          Server      Fas 0\nSVL-NTPLOG01     Fas 0/2           158         H          Server      Fas 0\nSVL-DNS01        Fas 0/3           131         H          Server      Fas 0\nSVL-APP01        Fas 0/4           138         H          Server      Fas 0",
        "show clock": "14:52:07.290 EAT Tue Mar 3 2026",
        "show users": "    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00\n\n  Interface    User               Mode         Idle     Peer Address",
        "show running-config": RUN_NOTE
      },
      pings: {
        "10.20.99.1": pingOK("10.20.99.1", "1", "1", "1")
      }
    },
    "SW3-MOMBASA-ACCESS": {
      prompt: "SW3-MOMBASA-ACCESS#",
      meta: "Catalyst 2960-24TT - branch access (VLAN 50), security trio - mgmt 10.20.99.18 (SVI99)",
      cmds: {
        "show vlan brief": "VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n1    default                          active\n50   BRANCH-USERS                     active    Fa0/1, Fa0/2, Fa0/3, Fa0/4\n                                                Fa0/5, Fa0/6, Fa0/7, Fa0/8\n                                                Fa0/9, Fa0/10, Fa0/11, Fa0/12\n                                                Fa0/13, Fa0/14, Fa0/15, Fa0/16\n99   NET-MGMT                         active\n999  QUARANTINE                       active    Fa0/17, Fa0/18, Fa0/19, Fa0/20\n                                                Fa0/21, Fa0/22, Fa0/23, Fa0/24\n                                                Gig0/2",
        "show port-security": "Secure Port      MaxSecureAddr     CurrentAddr     SecurityViolation     Security Action    (Addr count)\n   Fa0/1         2                 1               0                     Shutdown           (1)\n   Fa0/2         2                 1               0                     Shutdown           (1)\n   Fa0/3         2                 1               0                     Shutdown           (1)\n   Fa0/4         2                 0               0                     Shutdown           (0)\n   Fa0/5         2                 0               0                     Shutdown           (0)\n   Fa0/6         2                 0               0                     Shutdown           (0)\n   Fa0/7         2                 0               0                     Shutdown           (0)\n   Fa0/8         2                 0               0                     Shutdown           (0)\n   Fa0/9         2                 0               0                     Shutdown           (0)\n   Fa0/10        2                 0               0                     Shutdown           (0)\n   Fa0/11        2                 0               0                     Shutdown           (0)\n   Fa0/12        2                 0               0                     Shutdown           (0)\n   Fa0/13        2                 0               0                     Shutdown           (0)\n   Fa0/14        2                 0               0                     Shutdown           (0)\n   Fa0/15        2                 0               0                     Shutdown           (0)\n   Fa0/16        2                 0               0                     Shutdown           (0)\nTotal Addresses in System (excluding one mac per port)     : 2\nMax Addresses limit in System (excluding one mac per port) : 8320",
        "show ip dhcp snooping binding": "MacAddress          IpAddress        Lease(sec)  Type           VLAN  Interface\n------------------  ---------------  ----------  -------------  ----  --------------------\n0050.56BE.5101      10.20.50.50      86400       dhcp-snooping   50   FastEthernet0/1\n0050.56BE.5102      10.20.50.51      86372       dhcp-snooping   50   FastEthernet0/2\n0050.56BE.5103      10.20.50.52      86234       dhcp-snooping   50   FastEthernet0/3\nTotal number of bindings: 3\n\n[Branch leases come from the VLAN50-BRANCH scope (10.20.50.50-200) via\n the relay on R2 Gi0/1.50 -> SVL-DC01 10.20.30.10. T-07 evidence.]",
        "show cdp neighbors": "Device ID        Local Intrfce     Holdtme    Capability  Platform    Port ID\nR2-MOMBASA-EDGE  Gig 0/1           129         R B        ISR 2911    Gig 0/1\nPC-BR01          Fas 0/1           143         H          PC          Fas 0\nPC-BR02          Fas 0/2           136         H          PC          Fas 0\nPC-BR03          Fas 0/3           122         H          PC          Fas 0",
        "show clock": "14:52:07.268 EAT Tue Mar 3 2026",
        "show users": "    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00\n\n  Interface    User               Mode         Idle     Peer Address",
        "show running-config": RUN_NOTE
      },
      pings: {
        "10.20.99.17": pingOK("10.20.99.17", "1", "1", "1")
      }
    }
  };

  var ALIASES = {
    "sh ip int bri": "show ip interface brief",
    "sh ip int brief": "show ip interface brief",
    "show ip int bri": "show ip interface brief",
    "show ip int brief": "show ip interface brief",
    "sh ip int b": "show ip interface brief",
    "sh ip route": "show ip route",
    "sh ip ro": "show ip route",
    "sh ip ospf neigh": "show ip ospf neighbor",
    "show ip ospf neigh": "show ip ospf neighbor",
    "sh ip ospf neighbor": "show ip ospf neighbor",
    "sh access-list": "show access-lists",
    "sh access-lists": "show access-lists",
    "show access-list": "show access-lists",
    "sh vlan brief": "show vlan brief",
    "sh vlan": "show vlan brief",
    "show vlan": "show vlan brief",
    "sh interfaces trunk": "show interfaces trunk",
    "sh int trunk": "show interfaces trunk",
    "show int trunk": "show interfaces trunk",
    "sh spanning-tree vlan 20": "show spanning-tree vlan 20",
    "sh span vlan 20": "show spanning-tree vlan 20",
    "sh port-security": "show port-security",
    "show port-sec": "show port-security",
    "sh port-security interface fa0/3": "show port-security interface fastethernet0/3",
    "show port-security interface fa0/3": "show port-security interface fastethernet0/3",
    "sh port-sec int fa0/3": "show port-security interface fastethernet0/3",
    "show port-security int fa0/3": "show port-security interface fastethernet0/3",
    "sh ip dhcp snooping": "show ip dhcp snooping",
    "sh ip dhcp snooping binding": "show ip dhcp snooping binding",
    "show ip dhcp snap binding": "show ip dhcp snooping binding",
    "sh ip dhcp snap binding": "show ip dhcp snooping binding",
    "sh ip arp inspection interfaces": "show ip arp inspection interfaces",
    "sh ip arp inspection int": "show ip arp inspection interfaces",
    "show ip arp inspection int": "show ip arp inspection interfaces",
    "sh cdp neighbors": "show cdp neighbors",
    "sh cdp neigh": "show cdp neighbors",
    "show cdp neigh": "show cdp neighbors",
    "sh mac address-table": "show mac address-table",
    "show mac-address-table": "show mac address-table",
    "sh mac-address-table": "show mac address-table",
    "sh interfaces status": "show interfaces status",
    "sh int status": "show interfaces status",
    "show int status": "show interfaces status",
    "sh ip nat translations": "show ip nat translations",
    "sh ip nat tran": "show ip nat translations",
    "show ip nat tran": "show ip nat translations",
    "sh ip nat statistics": "show ip nat statistics",
    "show ip nat stat": "show ip nat statistics",
    "sh ip nat stat": "show ip nat statistics",
    "sh ip protocols": "show ip protocols",
    "sh ip ssh": "show ip ssh",
    "sh clock": "show clock",
    "sh users": "show users",
    "sh ntp associations": "show ntp associations",
    "sh ntp assoc": "show ntp associations",
    "show ntp assoc": "show ntp associations",
    "show run": "show running-config",
    "sh run": "show running-config",
    "sh running-config": "show running-config"
  };

  /* ------------------------------------------ lab console replay engine */
  var term = { dev: null };

  function termEls() {
    return {
      out: document.getElementById("termOut"),
      input: document.getElementById("termIn"),
      prompt: document.getElementById("termPrompt"),
      name: document.getElementById("termName"),
      meta: document.getElementById("devMeta")
    };
  }

  function termEsc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function termBlock(text, cls) {
    var els = termEls();
    if (!els.out) return;
    var d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = text;
    els.out.appendChild(d);
    els.out.scrollTop = els.out.scrollHeight;
  }

  function termEcho(raw) {
    var els = termEls();
    if (!els.out || !term.dev) return;
    var d = document.createElement("div");
    d.innerHTML = '<span class="p">' + termEsc(DEVICES[term.dev].prompt) + '</span> <span class="t-cmd">' + termEsc(raw) + '</span>';
    els.out.appendChild(d);
    els.out.scrollTop = els.out.scrollHeight;
  }

  function resolveCmd(key) {
    var d = DEVICES[term.dev];
    if (d.cmds[key]) return key;
    if (key.indexOf("sh ") === 0) {
      var expanded = "show " + key.slice(3);
      if (d.cmds[expanded]) return expanded;
    }
    if (ALIASES[key] && d.cmds[ALIASES[key]]) return ALIASES[key];
    return null;
  }

  function helpText() {
    var d = DEVICES[term.dev];
    var keys = Object.keys(d.cmds).filter(function (k) { return k !== "show running-config"; });
    var lines = ["Commands replayed for " + term.dev + " (recorded session):", ""];
    keys.forEach(function (k) { lines.push("  " + k); });
    lines.push("  ping <ip>            (targets: " + Object.keys(d.pings).join(", ") + ")");
    lines.push("");
    lines.push("  help | clear | exit - console controls.");
    lines.push("Everything else is not replayed - this console mirrors one recorded");
    lines.push("session, not a live device. Rebuild the lab to run any command.");
    return lines.join("\n");
  }

  function runCmd(raw) {
    var els = termEls();
    if (!els.out || !term.dev) return;
    var cmd = String(raw || "").trim().replace(/\s+/g, " ");
    if (!cmd) { termEcho(""); return; }
    termEcho(cmd);
    var key = cmd.toLowerCase();
    if (key === "help" || key === "?") { termBlock(helpText(), "t-sys"); return; }
    if (key === "clear") { els.out.textContent = ""; return; }
    if (key === "exit" || key === "logout" || key === "quit") {
      termBlock("% Replay console: session stays open - pick another device above.", "t-sys");
      return;
    }
    if (key === "enable" || key === "en") {
      termBlock("% Replay runs at privilege 15 - nothing to enable.", "t-sys");
      return;
    }
    if (key === "configure terminal" || key === "conf t" || key === "config t") {
      termBlock("% Configuration mode is not replayed. The golden configs live in:\n  02-switching-and-routing-design/configs/ (see Switching & routing page)", "t-sys");
      return;
    }
    if (key === "write" || key === "wr" || key === "copy running-config startup-config") {
      termBlock("% This replay is read-only.", "t-sys");
      return;
    }
    if (key.indexOf("traceroute") === 0 || key.indexOf("tracert") === 0) {
      termBlock("% traceroute is not replayed here - the recorded traces are on the\n  verification page (T-01, T-04).", "t-sys");
      return;
    }
    if (key.indexOf("ping ") === 0) {
      var ip = cmd.slice(5).trim();
      var pings = DEVICES[term.dev].pings;
      if (pings[ip]) { termBlock(pings[ip], ""); }
      else {
        termBlock("Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to " + ip + ", timeout is 2 seconds:", "");
        termBlock("[replay note] Target not in the recorded session for this device.\nRecorded ping targets: " + Object.keys(pings).join(", ") + "\nBuild the lab (see packet-tracer-build-guide.md) to ping anything else.", "t-warn");
      }
      return;
    }
    var canon = resolveCmd(key);
    if (canon) { termBlock(DEVICES[term.dev].cmds[canon], ""); return; }
    termBlock("% Invalid input detected", "t-err");
    termBlock("Type help to list the commands replayed for this device.", "t-sys");
  }

  function connect(dev) {
    if (!DEVICES[dev]) return;
    term.dev = dev;
    var els = termEls();
    if (!els.out) return;
    els.name.textContent = dev + " - console";
    els.prompt.textContent = DEVICES[dev].prompt;
    if (els.meta) els.meta.innerHTML = "<b>" + termEsc(dev) + "</b> - " + termEsc(DEVICES[dev].meta);
    els.out.textContent = "";
    termBlock(MOTD, "t-sys");
    termBlock("", "");
    termBlock("[lab console replay - " + SESSION + " - not a live device]", "t-sys");
    termBlock("Type help for the commands this session replays.", "t-sys");
    termBlock("", "");
    Array.prototype.forEach.call(document.querySelectorAll(".dev-btn[data-dev]"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-dev") === dev);
    });
    if (els.input) els.input.focus();
  }

  function initTerminal() {
    var els = termEls();
    if (!els.out || !els.input) return;
    Array.prototype.forEach.call(document.querySelectorAll(".dev-btn[data-dev]"), function (b) {
      b.addEventListener("click", function () { connect(b.getAttribute("data-dev")); });
    });
    var clearBtn = document.getElementById("termClear");
    if (clearBtn) clearBtn.addEventListener("click", function () { els.out.textContent = ""; els.input.focus(); });
    els.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        runCmd(els.input.value);
        els.input.value = "";
      }
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-cmd]") : null;
      if (!b) return;
      var dev = b.getAttribute("data-dev");
      if (dev && DEVICES[dev]) connect(dev);
      var cmd = b.getAttribute("data-cmd");
      els.input.value = cmd;
      runCmd(cmd);
    });
    var params = new URLSearchParams(location.search);
    var pdev = params.get("dev");
    var pcmd = params.get("cmd");
    connect(DEVICES[pdev] ? pdev : "MLS-HQ-CORE");
    if (pcmd) runCmd(pcmd);
  }

  /* ------------------------------------------ packet policy trace data */
  var FLOWS = [
    {
      label: "Finance PC -> App server - tcp/80 (T-01)",
      lines: [
        ["SCENARIO  PC-FIN01 (10.20.20.6, VLAN 20) -> SVL-APP01 (10.20.30.20) - tcp/80"],
        ["PATH      SW1 Fa0/3 > MLS SVI20 > MLS SVI30 > SW2 Fa0/4"],
        [""],
        [" 1. SW1 Fa0/3         access VLAN 20 - L2 forward (no ACL on access ports)"],
        [" 2. MLS SVI20 in      FINANCE-IN line 30: permit tcp 10.20.20.0/25 -> 10.20.30.0/27 eq www - MATCH"],
        [" 3. MLS routing       SVI20 -> SVI30 - inter-VLAN hop - TTL 128 -> 127"],
        [" 4. MLS SVI30 out     no ACL bound to the server VLAN"],
        [" 5. SW2 Fa0/4         access VLAN 30 -> SVL-APP01 (0050.56AB.0020)"],
        [""],
        ["RESULT: PERMIT - FINANCE-IN line 30 counter +1 (T-01)", "v-pass"]
      ]
    },
    {
      label: "Finance PC -> App server - tcp/1433 SQL",
      lines: [
        ["SCENARIO  PC-FIN01 (10.20.20.6, VLAN 20) -> SVL-APP01 (10.20.30.20) - tcp/1433"],
        ["PATH      SW1 Fa0/3 > MLS SVI20 > MLS SVI30 > SW2 Fa0/4"],
        [""],
        [" 1. SW1 Fa0/3         access VLAN 20 - L2 forward"],
        [" 2. MLS SVI20 in      FINANCE-IN line 50: permit tcp ... eq 1433 - MATCH"],
        [" 3. MLS routing       SVI20 -> SVI30"],
        [" 4. SW2 Fa0/4         -> SVL-APP01"],
        [""],
        ["RESULT: PERMIT - approved application port (80/443/1433 allowlist)", "v-pass"]
      ]
    },
    {
      label: "Finance PC -> App server - tcp/22 SSH (blocked)",
      lines: [
        ["SCENARIO  PC-FIN01 (10.20.20.6, VLAN 20) -> SVL-APP01 (10.20.30.20) - tcp/22"],
        ["PATH      SW1 Fa0/3 > MLS SVI20 (dropped)"],
        [""],
        [" 1. SW1 Fa0/3         access VLAN 20 - L2 forward"],
        [" 2. MLS SVI20 in      FINANCE-IN: no permit ACE matches tcp/22 toward VLAN 30"],
        ["                      line 80: deny ip 10.20.20.0/25 -> 10.20.30.0/27 - MATCH (counter only, no log keyword)"],
        [""],
        ["RESULT: DROP - server access is an approved-ports allowlist (80/443/1433 only)", "v-drop"]
      ]
    },
    {
      label: "Finance PC -> SW1 management - tcp/22 (blocked)",
      lines: [
        ["SCENARIO  PC-FIN01 (10.20.20.5, VLAN 20) -> SW1 SVI99 (10.20.99.2) - tcp/22"],
        ["PATH      SW1 Fa0/3 > MLS SVI20 > MLS SVI99 out (dropped)"],
        [""],
        [" 1. SW1 Fa0/3         access VLAN 20 - L2 forward"],
        [" 2. MLS SVI20 in      FINANCE-IN line 90: permit ip any any - continues toward VLAN 99"],
        [" 3. MLS SVI99 out     MGMT-PLANE line 40: deny ip any 10.20.99.0/28 log - MATCH"],
        [""],
        ["RESULT: DROP - management guard: only IT VLAN 10 may open sessions into VLAN 99"],
        ["         syslog %SEC-6-IPACCESSLOGP on SVL-NTPLOG01 - MGMT-PLANE line 40 +1", "v-drop"]
      ]
    },
    {
      label: "Guest PC -> Finance PC - ICMP (T-02)",
      lines: [
        ["SCENARIO  PC-GUEST01 (10.20.40.100, VLAN 40) -> PC-FIN01 (10.20.20.5) - ICMP echo"],
        ["PATH      SW1 Fa0/12 > MLS SVI40 (dropped)"],
        [""],
        [" 1. SW1 Fa0/12        access VLAN 40 - L2 forward"],
        [" 2. MLS SVI40 in      GUEST-IN line 30: deny ip any 10.20.0.0/16 log - MATCH"],
        [" 3. (packet dies here - never routed)"],
        [""],
        ["RESULT: DROP - guest hard-isolation from the entire enterprise"],
        ["         GUEST-IN line 30 +1 - syslog %SEC-6-IPACCESSLOGDP (T-02)", "v-drop"]
      ]
    },
    {
      label: "Guest PC -> App server - tcp/80 (blocked)",
      lines: [
        ["SCENARIO  PC-GUEST01 (10.20.40.100, VLAN 40) -> SVL-APP01 (10.20.30.20) - tcp/80"],
        ["PATH      SW1 Fa0/12 > MLS SVI40 (dropped)"],
        [""],
        [" 1. SW1 Fa0/12        access VLAN 40 - L2 forward"],
        [" 2. MLS SVI40 in      GUEST-IN line 30: deny ip any 10.20.0.0/16 log - MATCH"],
        ["                      (the www permit at line 40 is never reached - order matters)"],
        [""],
        ["RESULT: DROP - internal HTTP is denied before the Internet HTTP permit", "v-drop"]
      ]
    },
    {
      label: "Guest PC -> Internet web - tcp/80 (T-03, NAT)",
      lines: [
        ["SCENARIO  PC-GUEST01 (10.20.40.100) -> 198.51.100.10 - tcp/80"],
        ["PATH      SW1 Fa0/12 > MLS SVI40 > R1 Gi0/1 > NAT/PAT > ISP"],
        [""],
        [" 1. SW1 Fa0/12        access VLAN 40 - L2 forward"],
        [" 2. MLS SVI40 in      GUEST-IN: line 30 NO match (dst external) - line 40: permit tcp any any eq www - MATCH"],
        [" 3. R1 NAT            NAT-PERMITTED: line 10 deny internal->internal NO match - line 20 permit - PAT"],
        [" 4. R1 Gi0/0          inside global 203.0.113.2:1025 -> ISP -> 198.51.100.10:80"],
        [""],
        ["RESULT: PERMIT (NAT/PAT overload) - verify on R1: show ip nat translations (T-03)", "v-pass"]
      ]
    },
    {
      label: "Guest PC -> Internet - ICMP (blocked)",
      lines: [
        ["SCENARIO  PC-GUEST01 (10.20.40.100) -> 198.51.100.10 - ICMP echo"],
        ["PATH      SW1 Fa0/12 > MLS SVI40 (dropped)"],
        [""],
        [" 1. SW1 Fa0/12        access VLAN 40 - L2 forward"],
        [" 2. MLS SVI40 in      GUEST-IN: the www/443 permits are tcp-only - no match"],
        ["                      line 60: deny ip any any log - MATCH"],
        [""],
        ["RESULT: DROP - ICMP is not in the guest allowlist (negative control, T-03)", "v-drop"]
      ]
    },
    {
      label: "Branch PC -> App server - tcp/80 (T-04)",
      lines: [
        ["SCENARIO  PC-BR01 (10.20.50.50, VLAN 50) -> SVL-APP01 (10.20.30.20) - tcp/80"],
        ["PATH      SW3 Fa0/1 > R2 Gi0/1.50 > Link A > R1 > Link B > MLS SVI30 > SVL-APP01"],
        [""],
        [" 1. SW3 Fa0/1         access VLAN 50 - L2 forward"],
        [" 2. R2 Gi0/1.50 in    BRANCH-IN line 40: permit tcp 10.20.50.0/25 -> 10.20.30.0/27 eq www - MATCH"],
        [" 3. WAN Link A        OSPF area 0 - R1 -> Link B -> MLS SVI30"],
        ["                      (R1 NAT: NAT-PERMITTED line 10 denies internal->internal - NOT translated)"],
        [" 4. SW2 Fa0/4         -> SVL-APP01"],
        [""],
        ["RESULT: PERMIT - dynamically routed over OSPF, zero static routes on R2 (T-04)", "v-pass"]
      ]
    },
    {
      label: "Branch PC -> Finance PC - ICMP (blocked, logged)",
      lines: [
        ["SCENARIO  PC-BR01 (10.20.50.50, VLAN 50) -> PC-FIN01 (10.20.20.5) - ICMP echo"],
        ["PATH      SW3 Fa0/1 > R2 Gi0/1.50 (dropped)"],
        [""],
        [" 1. SW3 Fa0/1         access VLAN 50 - L2 forward"],
        [" 2. R2 Gi0/1.50 in    BRANCH-IN line 80: deny ip 10.20.50.0/25 -> 10.20.20.0/25 log - MATCH"],
        [""],
        ["RESULT: DROP - explicit business rule: branch cannot reach Finance"],
        ["         BRANCH-IN line 80 +1 - syslog record on SVL-NTPLOG01 (T-04 policy control)", "v-drop"]
      ]
    },
    {
      label: "IT admin -> SW1 management - tcp/22 (allowed)",
      lines: [
        ["SCENARIO  PC-IT01 (10.20.10.6, VLAN 10) -> SW1 SVI99 (10.20.99.2) - tcp/22"],
        ["PATH      SW1 Fa0/1 > MLS SVI10 > MLS SVI99 out > SW1 VTY"],
        [""],
        [" 1. SW1 Fa0/1         access VLAN 10 - L2 forward"],
        [" 2. MLS SVI10 in      no ACL on VLAN 10 (privileged admin subnet)"],
        [" 3. MLS SVI99 out     MGMT-PLANE line 10: permit tcp 10.20.10.0/26 -> 10.20.99.0/28 eq 22 - MATCH"],
        [" 4. SW1 VTY           access-class MGMT-ACCESS: permit 10.20.10.0/26 - SSH session (v2, user netadmin)"],
        [""],
        ["RESULT: PERMIT - both locks open for the IT admin subnet only (T-06)", "v-pass"]
      ]
    },
    {
      label: "Internet -> R1 perimeter - tcp/443 unsolicited (blocked)",
      lines: [
        ["SCENARIO  198.51.100.10 (Internet) -> 203.0.113.2 - unsolicited tcp/443"],
        ["PATH      ISP > R1 Gi0/0 in (dropped)"],
        [""],
        [" 1. R1 Gi0/0 in       EDGE-INBOUND: line 10 established - NO match (new session, no inside-initiated state)"],
        ["                      lines 20-50 (DNS/ICMP replies) - no match"],
        ["                      line 60: deny ip any any log - MATCH"],
        [""],
        ["RESULT: DROP - perimeter default-deny; only return traffic passes (no published services pre-Azure)", "v-drop"]
      ]
    }
  ];

  function initFlows() {
    var sel = document.getElementById("flowSel");
    var btn = document.getElementById("flowBtn");
    var out = document.getElementById("flowOut");
    if (!sel || !btn || !out) return;
    FLOWS.forEach(function (f, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = f.label;
      sel.appendChild(o);
    });
    function esc(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function render(idx) {
      var f = FLOWS[idx];
      var html = "";
      f.lines.forEach(function (ln) {
        var text = esc(ln[0]);
        if (ln[1] === "v-pass") html += '<span class="v-pass">' + text + '</span>\n';
        else if (ln[1] === "v-drop") html += '<span class="v-drop">' + text + '</span>\n';
        else html += text + "\n";
      });
      out.innerHTML = html;
    }
    function go() { render(parseInt(sel.value, 10) || 0); }
    btn.addEventListener("click", go);
    sel.addEventListener("change", go);
    go();
  }

  /* ------------------------------------------------------------ boot */
  initTerminal();
  initFlows();
})();

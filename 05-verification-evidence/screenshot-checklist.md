# Screenshot Evidence Checklist (T-01 … T-07)

**Naming convention:** `captures/T-0X-NN-short-description.png` (e.g. `captures/T-02-01-ping-blocked.png`).

**Capture discipline:**
- Include the device prompt AND the command in frame (crop cleanly).
- Run `show clock` (or keep the PT timestamp visible) so evidence is time-aligned with Syslog.
- One concept per screenshot — the evidence index maps 1 capture → 1 claim.
- PNG format, full-color, no annotations over the output text.

---

## Per-Test Capture List

### T-01 — Inter-VLAN routing Finance → Server

| ID | Capture | Where | Proves |
|---|---|---|---|
| T-01-01 | Ping 10.20.30.20 success (0% loss) | PC-FIN01 | VLAN 20 → VLAN 30 routed reachability |
| T-01-02 | Browser showing intranet page | PC-FIN01 → http://10.20.30.20 | App ports permitted by FINANCE-IN |
| T-01-03 | `show access-lists FINANCE-IN` with echo/www permit counters | MLS-HQ-CORE | Policy matched, denies flat |
| T-01-04 | Simulation-mode packet path SVI20 → SVI30 | MLS-HQ-CORE | Inter-VLAN routing happens at the core |

### T-02 — Guest isolation

| ID | Capture | Where | Proves |
|---|---|---|---|
| T-02-01 | Ping 10.20.20.5 → 100% loss | PC-GUEST01 | Guest cannot reach Finance |
| T-02-02 | Ping 10.20.30.20 → 100% loss | PC-GUEST01 | Guest cannot reach Servers |
| T-02-03 | `show access-lists GUEST-IN` deny counter incremented | MLS-HQ-CORE | Isolation ACE counting |
| T-02-04 | Simulation-mode drop (red X) at gateway | MLS-HQ-CORE | Drop location = zero-trust gateway |
| T-02-05 | Syslog deny record (timestamped) | SVL-NTPLOG01 | Central audit trail working |

### T-03 — NAT/PAT to Internet

| ID | Capture | Where | Proves |
|---|---|---|---|
| T-03-01 | Browser showing external page via `internet.test` | PC-GUEST01 | DNS + HTTP path works |
| T-03-02 | `show ip nat translations` with PAT entry | R1-HQ-EDGE | Overload translation active |
| T-03-03 | `show ip nat statistics` (hits, outside iface) | R1-HQ-EDGE | NAT operating on the edge |
| T-03-04 | Ping 198.51.100.10 → 100% loss | PC-GUEST01 | ICMP default-deny for guests |

### T-04 — OSPF WAN routing + branch policy

| ID | Capture | Where | Proves |
|---|---|---|---|
| T-04-01 | `show ip ospf neighbor` — 2 neighbors FULL | R1-HQ-EDGE | OSPF domain converged |
| T-04-02 | `show ip route` with O + O*E2 routes | R2-MOMBASA-EDGE | Branch learns routes dynamically |
| T-04-03 | `tracert 10.20.30.20` — 4 hops listed | PC-BR01 | Full routed path across WAN |
| T-04-04 | Browser intranet page from branch | PC-BR01 → http://10.20.30.20 | Branch app access permitted |
| T-04-05 | Ping 10.20.20.5 → 100% loss + BRANCH-IN deny counter | PC-BR01 + R2 | Branch → Finance hard deny |

### T-05 — L2 attack response

| ID | Capture | Where | Proves |
|---|---|---|---|
| T-05-01 | PSECURE_VIOLATION console message | SW1 console | Port Security fired |
| T-05-02 | `show port-security interface Fa0/3` (Secure-shutdown) | SW1 | Violation state + counts |
| T-05-03 | `show interfaces status` — err-disabled | SW1 | Port auto-disabled |
| T-05-04 | BLOCK_BPDUGUARD console message | SW1 console | BPDU Guard fired on rogue switch |
| T-05-05 | Recovery: shutdown/no-shutdown returning port to service | SW1 | Operational runbook |

### T-06 — Management plane

| ID | Capture | Where | Proves |
|---|---|---|---|
| T-06-01 | Guest SSH attempt — timeout | PC-GUEST01 | Layer 1: gateway isolation |
| T-06-02 | `show access-lists GUEST-IN` + `MGMT-PLANE` counters | MLS-HQ-CORE | Both drops counted |
| T-06-03 | Finance SSH attempt — timeout | PC-FIN01 | MGMT-PLANE guard blocks non-IT sources |
| T-06-04 | IT admin SSH session opened (banner + prompt) | PC-IT01 → SW1 | Authorized path works |
| T-06-05 | `show ip ssh` — version 2 | any device | Telnet dead, SSHv2 only |
| T-06-06 | Telnet attempt refused | any PC | transport input ssh enforced |

### T-07 — Central DHCP

| ID | Capture | Where | Proves |
|---|---|---|---|
| T-07-01 | `ipconfig` — planned lease + gateway + DNS | PC-FIN02 | Scope matches VLSM plan |
| T-07-02 | DHCP pool allocated statistics | SVL-DC01 | Central server leasing |
| T-07-03 | `show ip dhcp snooping binding` (VLAN 20 row) | SW1 | Binding table populates |
| T-07-04 | Branch lease `10.20.50.x` via R2 relay | PC-BR02 + SW3 | Relay path across WAN works |
| T-07-05 | Rogue DHCP offers dropped (snooping statistics) | SW1 | Rogue DHCP impossible |

---

## General Evidence (G-series)

| ID | Capture | Where | Proves |
|---|---|---|---|
| G-01 | Golden config pasted + `copy run start` on all 6 devices | each device | Config baseline |
| G-02 | `show vlan brief` — no port in VLAN 1, quarantine in 999 | each switch | VLAN hygiene |
| G-03 | `show interfaces trunk` — allowed lists + native 999 | switches/MLS | Trunk hardening |
| G-04 | `show spanning-tree summary` — rapid-pvst, root = MLS | MLS + SW1 | Deterministic STP |
| G-05 | SSH login banner + prompt from IT admin PC | PC-IT01 | Hardened access UX |
| G-06 | `show clock` synchronized across devices | all | NTP working (evidence integrity) |

---

## Evidence Index (update after the lab run)

| Test | Captures filed | Result | Date | Notes |
|---|---|---|---|---|
| T-01 | — | Pending | — | — |
| T-02 | — | Pending | — | — |
| T-03 | — | Pending | — | — |
| T-04 | — | Pending | — | — |
| T-05 | — | Pending | — | — |
| T-06 | — | Pending | — | — |
| T-07 | — | Pending | — | — |
| G-series | — | Pending | — | — |

# VLSM IP Addressing Architecture (10.20.0.0/16)

Variable Length Subnet Masking applied from the enterprise block **10.20.0.0/16**. Every segment
is sized to real demand, not to a single convenient mask. Convention: each VLAN owns the
`10.20.<VLAN-ID>.0` block and carves the required prefix out of it, so future growth is a
re-masking exercise (no renumbering).

---

## 1. Master Allocation Table

| Segment | VLAN | Subnet | Usable | Gateway | Used by |
|---|---|---|---|---|---|
| IT Admin & Helpdesk | 10 | 10.20.10.0/26 | 62 | 10.20.10.1 (MLS SVI10) | IT staff, helpdesk, admin workstations |
| Finance & HR | 20 | 10.20.20.0/25 | 126 | 10.20.20.1 (MLS SVI20) | Finance/HR staff (payroll systems) |
| Internal Servers / DMZ | 30 | 10.20.30.0/27 | 30 | 10.20.30.1 (MLS SVI30) | Central service farm (static IPs) |
| Guest & BYOD Wi-Fi | 40 | 10.20.40.0/24 | 254 | 10.20.40.1 (MLS SVI40) | Guest Wi-Fi + wired guest ports |
| Mombasa Operations | 50 | 10.20.50.0/25 | 126 | 10.20.50.1 (R2 Gi0/1.50) | Branch staff |
| Net Mgmt - HQ | 99 | 10.20.99.0/28 | 14 | 10.20.99.1 (MLS SVI99) | MLS .1, SW1 .2, SW2 .3 |
| Net Mgmt - Branch | 99 | 10.20.99.16/28 | 14 | 10.20.99.17 (R2 Gi0/1.99) | SW3 .18 |
| Quarantine | 999 | unrouted | 0 | none | Unused ports on all switches + native VLAN |
| HQ-Branch WAN | Link A | 10.20.254.0/30 | 2 | R1 .1 / R2 .2 | OSPF transit |
| Core-Edge transit | Link B | 10.20.254.4/30 | 2 | R1 .5 / MLS .6 | OSPF transit |
| Router loopbacks | infra | 10.20.255.0/24 | /32s | - | R1 = 10.20.255.1, R2 = 10.20.255.2 |
| **Azure S2S VPN** (reserved) | - | 10.20.200.0/24 | 254 | Project 5 | Ring-fenced for Azure VNet address space mapping |
| **VPN tunnel transit** (reserved) | - | 10.20.254.8/30 | 2 | 10.20.254.9 (R1 Tunnel0) | IPsec S2S tunnel interface |
| ISP public edge | - | 203.0.113.0/30 | 2 | R1 .2 | Documentation range (RFC 5737); swap for real ISP assignment |
| Simulated Internet web | - | 198.51.100.10/32 | - | - | External target for NAT test T-03 |

**Why VLAN 99 is split per site:** a Layer-2 VLAN cannot span the routed WAN. Keeping one /27
stretched across HQ and branch would create a discontiguous subnet advertised from two OSPF
routers (broken longest-match). The /28 site-split preserves the documented /27 super-block
while every routed boundary stays clean.

---

## 2. Server Static Assignments (VLAN 30)

| Server | IP | Service | Notes |
|---|---|---|---|
| SVL-DC01 | 10.20.30.10 | Central DHCP | One server scopes ALL user VLANs; relays point here |
| SVL-NTPLOG01 | 10.20.30.11 | NTP + Syslog | Single time/audit source for every device (Projects 4-5 prep) |
| SVL-DNS01 | 10.20.30.12 | DNS | Internal records; forwards upstream for Internet names |
| SVL-APP01 | 10.20.30.20 | HTTP/HTTPS app | Finance + branch target for T-01 / T-04 |

---

## 3. Central DHCP Scope Plan (server 10.20.30.10)

| Scope | Network | Default Gateway | DNS | Dynamic Range | Excluded |
|---|---|---|---|---|---|
| VLAN10-IT | 10.20.10.0/26 | 10.20.10.1 | 10.20.30.12 | .6 - .62 | .1-.5 reserved (gateway + statics) |
| VLAN20-FIN | 10.20.20.0/25 | 10.20.20.1 | 10.20.30.12 | .6 - .126 | .1-.5 reserved |
| VLAN40-GUEST | 10.20.40.0/24 | 10.20.40.1 | 10.20.30.12 | .100 - .249 | .1-.99 reserved (expansion) |
| VLAN50-BRANCH | 10.20.50.0/25 | 10.20.50.1 | 10.20.30.12 | .50 - .200 | .1-.49 reserved |

Relay agents (`ip helper-address 10.20.30.10`): MLS SVI 10/20/40 and R2 Gi0/1.50.
Switch management SVIs and all server IPs are **static by policy** - DHCP is never used on the
management plane.

---

## 4. Growth Headroom (deliberate, structured)

- **VLAN 20 (Finance):** currently /25 (126 hosts). The full 10.20.20.0/24 block is unused
  outside this /25, so growth = re-mask the SVI + widen the DHCP scope. No renumbering.
- **VLAN 10 (IT):** /26 today, /25 or /24 available in the same block.
- **VLAN 40 (Guest):** dynamic pool starts at .100 so the lower half absorbs admin/appliance
  statics without disturbing leases.
- **Branch:** VLAN 50 can grow to /24 within 10.20.50.0/24.
- **Site replication:** the `10.20.<VLAN>.0` convention leaves room for a future second branch
  (e.g., Kisumu) to reuse VLAN IDs with new site octets instead of redesigning the plan.
- **Cloud:** 10.20.200.0/24 and 10.20.254.8/30 are ring-fenced NOW so Project 5 (Azure S2S VPN)
  needs zero re-IP effort. See [`04-automation-and-cloud-readiness/azure-vpn-reservation.md`](../04-automation-and-cloud-readiness/azure-vpn-reservation.md).

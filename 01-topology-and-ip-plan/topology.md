# Network Topology & Device Inventory

**Client:** Savannah Logistics Ltd. | **Sites:** Nairobi HQ + Mombasa Branch | **Routing domain:** OSPFv2 single Area 0

Reference diagram: [`assets/topology.svg`](../assets/topology.svg) (also embedded in the README and the website).

---

## 1. Device Inventory

| Device | Platform | Role | Location | Key Interfaces |
|---|---|---|---|---|
| **R1-HQ-EDGE** | Cisco ISR (Packet Tracer: 2911; production: ISR 4331) | Perimeter router: NAT/PAT boundary, OSPF Area 0 edge, north-south edge ACL, default route to ISP | Nairobi HQ | Gi0/0 (ISP), Gi0/1 (Link-B to MLS), Gi0/2 (Link-A to R2), Lo0 |
| **R2-MOMBASA-EDGE** | Cisco ISR (PT: 2911) | Branch gateway: router-on-a-stick 802.1Q for VLAN 50/99, branch zero-trust ACL, DHCP relay | Mombasa Branch | Gi0/0 (Link-A to R1), Gi0/1 (trunk to SW3 with .50/.99 sub-interfaces), Lo0 |
| **MLS-HQ-CORE** | Catalyst 3650-24PS | Inter-VLAN routing (SVIs), Rapid PVST+ Root Bridge, OSPF Area 0, DHCP relay agent, gateway ACLs (GUEST-IN / FINANCE-IN / MGMT-PLANE) | Nairobi HQ (Core) | Gi1/1/1 (routed p2p to R1), Gi1/0/1-2 (trunks), SVI 10/20/30/40/99 |
| **SW1-HQ-ACCESS-1** | Catalyst 2960-24TT | HQ user access: IT (10), Finance (20), Guest Wi-Fi (40) | Nairobi HQ | Gi0/1 uplink trunk, Fa0/1-18 access, Fa0/19-24 quarantine |
| **SW2-HQ-ACCESS-2** | Catalyst 2960-24TT | HQ server access: Servers/DMZ (30) | Nairobi HQ | Gi0/1 uplink trunk, Fa0/1-4 servers, Fa0/5-24 quarantine |
| **SW3-MOMBASA-ACCESS** | Catalyst 2960-24TT | Branch user access: Operations (50) | Mombasa | Gi0/1 trunk to R2, Fa0/1-16 access, Fa0/17-24 quarantine |

Management-plane endpoints (SSH targets):

| Device | Management IP | Gateway | Source interface for NTP/Syslog |
|---|---|---|---|
| R1-HQ-EDGE | 10.20.255.1 (Loopback0 /32) | OSPF-learned | Loopback0 |
| R2-MOMBASA-EDGE | 10.20.255.2 (Loopback0 /32) | OSPF-learned | Loopback0 |
| MLS-HQ-CORE | 10.20.99.1 (SVI 99) | n/a (L3 switch) | Vlan99 |
| SW1-HQ-ACCESS-1 | 10.20.99.2 (SVI 99) | 10.20.99.1 | Vlan99 |
| SW2-HQ-ACCESS-2 | 10.20.99.3 (SVI 99) | 10.20.99.1 | Vlan99 |
| SW3-MOMBASA-ACCESS | 10.20.99.18 (SVI 99) | 10.20.99.17 | Vlan99 |

---

## 2. Link Inventory

| Link | Endpoint A | Endpoint B | Type | Subnet / VLANs | Notes |
|---|---|---|---|---|---|
| Public uplink | R1 Gi0/0 | ISP | Routed L3 | 203.0.113.0/30 (R1 = .2, ISP = .1) | NAT outside, EDGE-INBOUND ACL inbound. Documentation range; replace with real ISP assignment in production |
| **Link A** | R1 Gi0/2 | R2 Gi0/0 | Routed L3 p2p | 10.20.254.0/30 (R1 = .1, R2 = .2) | OSPF transit, `ip nat inside` on R1 side |
| **Link B** | R1 Gi0/1 | MLS Gi1/1/1 | Routed L3 p2p | 10.20.254.4/30 (R1 = .5, MLS = .6) | OSPF transit, routed port on MLS (`no switchport`) |
| R2 - SW3 | R2 Gi0/1 | SW3 Gi0/1 | 802.1Q trunk | VLANs 50, 99, native 999 | Router-on-a-stick sub-interfaces Gi0/1.50 (10.20.50.1/25) and Gi0/1.99 (10.20.99.17/28) |
| MLS - SW1 | MLS Gi1/0/1 | SW1 Gi0/1 | 802.1Q trunk | VLANs 10, 20, 40, 99, native 999 | `nonegotiate`, snooping/DAI trusted on SW1 side |
| MLS - SW2 | MLS Gi1/0/2 | SW2 Gi0/1 | 802.1Q trunk | VLANs 30, 99, native 999 | `nonegotiate`, snooping/DAI trusted on SW2 side |
| SW1 access | Fa0/1-2 (IT), Fa0/3-10 (Finance), Fa0/11 (Guest AP), Fa0/12-18 (Guest wired) | endpoints | Access | VLAN 10 / 20 / 40 | PortFast + BPDU Guard + Port Security (max 2; AP port max 10, violation restrict) |
| SW2 access | Fa0/1-4 | Servers | Access | VLAN 30 | Fa0/1 = DHCP server (snooping **trusted**), static `ip source binding` entries for DAI |
| SW3 access | Fa0/1-16 | Branch PCs | Access | VLAN 50 | PortFast + BPDU Guard + Port Security |
| Unused ports | All switches | - | Access | VLAN 999 | Administratively shutdown (quarantine) |

---

## 3. Architectural Design Decisions

1. **Routed point-to-point WAN/transit links (not trunks).** Link A and Link B are clean /30s in
   OSPF Area 0. No user traffic ever rides a transit subnet, and no trunks cross the WAN -
   VLANs are strictly site-local, which is the only real-world-correct model.
2. **Layer-3 boundary at the core.** HQ user VLAN gateways terminate as SVIs on MLS-HQ-CORE
   (wire-speed inter-VLAN routing). R1 exists for NAT/PAT, the perimeter ACL and the WAN - the
   classic collapsed-core pattern, exactly how mid-size enterprises build.
3. **Explicit STP Root.** MLS-HQ-CORE is `spanning-tree vlan 10,20,30,40,99,999 root primary`.
   Root election is never left to chance; SW1 is Root Secondary for HQ user VLANs.
4. **Hardened native VLAN.** Every trunk uses native VLAN 999 (the unrouted quarantine VLAN)
   with DTP disabled (`switchport nonegotiate`). A VLAN-hopping double-tag attempt lands in a
   VLAN with no hosts and no gateway.
5. **Management block site-split.** VLAN 99 cannot span the routed WAN, so the documented
   10.20.99.0/27 block is sub-allocated: 10.20.99.0/28 (HQ: MLS .1, SW1 .2, SW2 .3) and
   10.20.99.16/28 (Branch: R2 subif .17, SW3 .18). Every device stays inside the /27 super-block
   while OSPF boundaries stay clean (no discontiguous /27).
6. **Router loopbacks /32** (10.20.255.1/2) serve as stable SSH endpoints, NTP sources and OSPF
   router-ID anchors. They sit outside the user/mgmt subnets so longest-match routing is unambiguous.
7. **Passive OSPF everywhere by default.** `passive-interface default` on every router/MLS, with
   only the three transit interfaces non-passive. Routing updates are never leaked onto user or
   guest LANs (CCNA Pillar 2 requirement).
8. **Quarantine discipline.** No port remains in VLAN 1 anywhere. Unused ports are `access vlan
   999` + `shutdown`. VLAN 1 carries zero user, server or management traffic.

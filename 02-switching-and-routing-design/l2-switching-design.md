# Layer-2 Switching Architecture: VLANs, Trunking, STP & Port Security

**Pillar 2 (CCNA Course 2) deliverable.** Deterministic Layer 2 - no default VLAN 1 traffic,
explicit root bridge, hardened native VLAN, quarantine discipline, and the switch-security
trio at every user-facing port.

---

## 1. VLAN Plan

| VLAN | Name | Purpose | Sites | IP Subnet |
|---|---|---|---|---|
| 10 | IT-ADMIN | IT staff + helpdesk | HQ | 10.20.10.0/26 |
| 20 | FINANCE-HR | Finance & HR staff | HQ | 10.20.20.0/25 |
| 30 | INTERNAL-SERVERS | Server/DMZ farm | HQ | 10.20.30.0/27 |
| 40 | GUEST-BYOD | Guest Wi-Fi + wired guests | HQ | 10.20.40.0/24 |
| 50 | BRANCH-USERS | Mombasa staff | Branch | 10.20.50.0/25 |
| 99 | NET-MGMT | Switch/router management SVIs | HQ + Branch (site-split /28s) | 10.20.99.0/27 super-block |
| 999 | QUARANTINE | Unused ports (shutdown) + native VLAN on all trunks | All switches | unrouted |

**Rule enforced everywhere:** VLAN 1 carries zero user, server or management traffic. No access
port is left in VLAN 1; no trunk uses VLAN 1 as native.

## 2. Trunk Matrix

| Trunk | Endpoints | Allowed VLANs | Native | Hardening |
|---|---|---|---|---|
| MLS - SW1 | Gi1/0/1 <-> Gi0/1 | 10,20,40,99,999 | 999 | `nonegotiate`, `link-type point-to-point`, snooping+DAI **trust** (SW1 side) |
| MLS - SW2 | Gi1/0/2 <-> Gi0/1 | 30,99,999 | 999 | `nonegotiate`, `link-type point-to-point`, snooping+DAI **trust** (SW2 side) |
| R2 - SW3 | Gi0/1 <-> Gi0/1 | 50,99,999 | 999 | 802.1Q router-on-a-stick sub-interfaces .50 / .99; snooping+DAI **trust** (SW3 side) |

Why native VLAN 999: a double-tagging (VLAN hopping) attempt lands the frame in the unrouted
quarantine VLAN, where there are no hosts and no gateway. DTP is disabled (`nonegotiate`) so an
attacker-controlled device cannot negotiate trunking with an access port.

## 3. Spanning Tree Architecture (Rapid PVST+)

| Role | Device | Configuration |
|---|---|---|
| Root Bridge (explicit, all VLANs) | MLS-HQ-CORE | `spanning-tree vlan 10/20/30/40/99/999 root primary` |
| Root Secondary (HQ user VLANs) | SW1-HQ-ACCESS-1 | `spanning-tree vlan 10/20/40/99 root secondary` |
| Root Secondary (server VLAN) | SW2-HQ-ACCESS-2 | `spanning-tree vlan 30 root secondary` |
| Edge ports | All access ports | `spanning-tree portfast` + `spanning-tree bpduguard enable` |
| Inter-switch links | All trunks | `spanning-tree link-type point-to-point` |

Root election is **never left to chance** - the 3650 core is pinned as Root so the deterministic
forwarding topology converges through the core. BPDU Guard means any rogue switch plugged into a
wall jack is instantly err-disabled (verification test T-05).

## 4. Switch-Security Trio (access layer)

| Control | Scope | Configuration summary |
|---|---|---|
| **Port Security** | Every user access port | `port-security maximum 2` (guest AP port: 10), `mac-address sticky`, `violation shutdown` (AP port: `restrict`), sticky-learning |
| **DHCP Snooping** | SW1 (10/20/40), SW2 (30), SW3 (50) | Only uplink trunks + DHCP server port (SW2 Fa0/1) are `ip dhcp snooping trust`; rogue DHCP servers on access ports are dropped. Option 82 insertion disabled (`no ip dhcp snooping information option`) because the central DHCP server is not Option-82 aware and relays are used |
| **Dynamic ARP Inspection** | SW1 (10/20/40), SW2 (30), SW3 (50) | ARP validated against the snooping + static binding tables; ARP poisoning / MITM inside the LAN is blocked. Static `ip source binding` entries cover the statically-IPed server farm |

## 5. Quarantine Policy (VLAN 999)

Every switch moves all unused ports into VLAN 999 and shuts them down:

```
interface range FastEthernet0/19 - 24
 description QUARANTINE - UNUSED PORTS (VLAN 999, SHUTDOWN)
 switchport mode access
 switchport access vlan 999
 shutdown
```

An attacker who finds a live wall jack finds a port that is administratively down AND belongs to
an unrouted VLAN with no gateway.

## 6. Verification Commands

| Command | Proves |
|---|---|
| `show vlan brief` | No port in VLAN 1; quarantine ports in VLAN 999 (down) |
| `show interfaces trunk` | Correct allowed lists, native 999 on every trunk |
| `show spanning-tree summary` | Rapid PVST+ mode, root = MLS |
| `show spanning-tree vlan 20` | Root bridge ID = MLS priority 24576 |
| `show port-security interface fa0/3` | Sticky MACs learned, violation mode, status |
| `show port-security address` | Sticky table populated |
| `show ip dhcp snooping binding` | Legit client bindings with trusted/untrusted ports |
| `show ip dhcp snooping` | Snooping active per VLAN, trusted interfaces marked |
| `show ip arp inspection interfaces` | Trust state per port |
| `show ip arp inspection statistics` | DAI drops counted (attack attempts blocked) |
| `show interfaces status` | err-disabled flag on a BPDU/port-security violation (T-05) |

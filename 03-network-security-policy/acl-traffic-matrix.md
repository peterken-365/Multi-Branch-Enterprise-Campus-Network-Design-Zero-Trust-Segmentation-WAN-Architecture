# East-West & North-South ACL Traffic Matrix (Zero-Trust Policy)

**Pillar 3 (CCNA Course 3) deliverable.** Every gateway in the design enforces an explicit
policy. Denies are logged so ACL hit counters and the central Syslog server provide both
verification evidence (T-02/T-06) and audit trails.

---

## 1. Master Traffic Matrix

| # | Source | Destination | Verdict | Enforced at | Notes |
|---|---|---|---|---|---|
| 1 | Guest VLAN 40 | Internet | **PERMIT** DNS/UDP53, HTTP/80, HTTPS/443 only | MLS SVI40 `GUEST-IN` | NAT/PAT at R1 |
| 2 | Guest VLAN 40 | VLAN 10/20/30/50/99 + transit /30s | **DENY ALL (logged)** | MLS SVI40 `GUEST-IN` | T-02 evidence: deny counter + sim-mode drop |
| 3 | Finance VLAN 20 | Servers VLAN 30 | **PERMIT** 80/443/1433 + DNS + ICMP echo + traceroute probes | MLS SVI20 `FINANCE-IN` | App-port-only; everything else to 30 denied |
| 4 | Finance VLAN 20 | Internet / other VLANs | PERMIT | MLS SVI20 `FINANCE-IN` (final `permit ip any any`) | Business as usual outside VLAN 30 |
| 5 | Branch VLAN 50 | Finance VLAN 20 | **DENY (logged)** | R2 Gi0/1.50 `BRANCH-IN` | Explicit business rule |
| 6 | Branch VLAN 50 | Other internal VLANs (10/40/99/transits) | **DENY (logged)** | R2 Gi0/1.50 `BRANCH-IN` | Branch reaches VLAN 30 servers + Internet only |
| 7 | Branch VLAN 50 | Servers VLAN 30 | **PERMIT** 80/443 + DNS + ICMP echo + traceroute probes | R2 Gi0/1.50 `BRANCH-IN` | T-04 evidence |
| 8 | IT Admin VLAN 10 | Management VLAN 99 | **PERMIT SSH/22 + ICMP only** | MLS SVI99 `MGMT-PLANE` (out) + VTY `MGMT-ACCESS` on every device | Double enforcement |
| 9 | Any other source | Management VLAN 99 | **DENY (logged)** | MLS SVI99 `MGMT-PLANE` | NTP replies from 10.20.30.11 excepted |
| 10 | Internet (R1 Gi0/0 inbound) | Enterprise | **PERMIT established TCP + DNS/ICMP replies only; deny+log rest** | R1 `EDGE-INBOUND` | No published inbound services pre-Azure |
| 11 | Internal -> Internal (any) | (NAT plane) | NEVER translated | R1 `NAT-PERMITTED` | Preserves true source IPs so VTY/MGMT ACLs are meaningful |
| 12 | Any internal | Internet | PERMIT via NAT/PAT overload (R1 Gi0/0) | R1 `NAT-PERMITTED` | T-03 evidence: NAT table |

## 2. ACL-to-Interface Bindings

| ACL | Type | Bound to | Direction |
|---|---|---|---|
| `GUEST-IN` | extended | MLS `interface Vlan40` | in |
| `FINANCE-IN` | extended | MLS `interface Vlan20` | in |
| `MGMT-PLANE` | extended | MLS `interface Vlan99` | out |
| `BRANCH-IN` | extended | R2 `interface GigabitEthernet0/1.50` | in |
| `EDGE-INBOUND` | extended | R1 `interface GigabitEthernet0/0` | in |
| `NAT-PERMITTED` | extended | NAT criteria only (`ip nat inside source list`) | n/a |
| `MGMT-ACCESS` | standard | `line vty 0 4 access-class in` on ALL six devices | in |

## 3. Deployed ACL Content (authoritative source: `02-switching-and-routing-design/configs/`)

### GUEST-IN (MLS Vlan40, in)

```
permit udp any any eq bootps          ! DHCP discover/renew reach the relay
permit udp any any eq domain          ! DNS (internal 10.20.30.12 or external)
deny   ip any 10.20.0.0 0.0.255.255   ! HARD ISOLATION from the entire enterprise
permit tcp any any eq www             ! Internet HTTP
permit tcp any any eq 443             ! Internet HTTPS
deny   ip any any log                 ! everything else, logged
```

### FINANCE-IN (MLS Vlan20, in)

```
permit udp any any eq bootps
permit udp 10.20.20.0 0.0.0.127 host 10.20.30.12 eq domain
permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq www
permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq 443
permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq 1433
permit icmp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 echo
permit udp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 range 33434 33534   ! traceroute probes
deny   ip 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31                       ! rest of VLAN 30 closed
permit ip any any
```

### BRANCH-IN (R2 Gi0/1.50, in)

```
permit udp any any eq bootps
permit udp 10.20.50.0 0.0.0.127 host 10.20.30.12 eq domain
permit icmp 10.20.50.0 0.0.0.127 host 10.20.50.1 echo
permit tcp 10.20.50.0 0.0.0.127 10.20.30.0 0.0.0.31 eq www
permit tcp 10.20.50.0 0.0.0.127 10.20.30.0 0.0.0.31 eq 443
permit icmp 10.20.50.0 0.0.0.127 10.20.30.0 0.0.0.31 echo
permit udp 10.20.50.0 0.0.0.127 10.20.30.0 0.0.0.31 range 33434 33534
deny   ip 10.20.50.0 0.0.0.127 10.20.20.0 0.0.0.127 log   ! Branch -> Finance: HARD DENY
deny   ip 10.20.50.0 0.0.0.127 10.20.0.0 0.0.255.255 log   ! every other internal dest
permit ip any any                                          ! Internet
```

### MGMT-PLANE (MLS Vlan99, out) + MGMT-ACCESS (VTY, all devices)

```
! MGMT-PLANE - what is allowed INTO the management VLAN:
permit tcp 10.20.10.0 0.0.0.63 10.20.99.0 0.0.0.15 eq 22    ! IT Admin SSH only
permit icmp 10.20.10.0 0.0.0.63 10.20.99.0 0.0.0.15         ! IT Admin reachability tests
permit udp host 10.20.30.11 10.20.99.0 0.0.0.15 eq ntp      ! NTP replies to switches
deny   ip any 10.20.99.0 0.0.0.15 log

! MGMT-ACCESS - second lock on the door itself (every router/switch):
permit 10.20.10.0 0.0.0.63    ! IT Admin subnet
deny   any log
```

## 4. T-06 Double Enforcement (management plane)

An unprivileged user in Guest VLAN 40 attempting SSH to any device fails **twice over**:

1. `GUEST-IN` drops the packet at the guest gateway (packet never even routes).
2. Even if a host somehow reached the device, `MGMT-ACCESS` on the VTY lines only accepts
   10.20.10.0/26 sources, and the attempt appears in Syslog via `deny any log`.

Only the IT Admin VLAN (10.20.10.0/26) can open a management session to any gear - and only
over SSHv2 (Telnet is not enabled anywhere: `transport input ssh` exclusively).

## 5. Verification Hooks

| Command | Evidence |
|---|---|
| `show access-lists` (per device) | Hit counters per ACE (permit AND deny) |
| `show ip nat translations` (R1) | Private-to-public mappings (T-03) |
| `show ip nat statistics` (R1) | Translation totals, inside/outside interfaces |
| Packet Tracer Simulation Mode | Visual "X" drop of guest packets at the MLS gateway (T-02) |
| Syslog server (10.20.30.11) | `%SEC-6-IPACCESSLOGP`-style deny records with matched timestamps |

# Verification Report — Packet-Flow Testing Runbook (T-01 … T-07)

**Project:** Savannah Logistics Ltd. — Multi-Branch Enterprise Campus Network
**Environment:** Cisco Packet Tracer 8.2+ for the lab build; the same tests are the acceptance
suite for the production Catalyst/ISR deployment.
**Source of truth:** [`02-switching-and-routing-design/configs/`](../02-switching-and-routing-design/configs/)
**Evidence protocol:** [`screenshot-checklist.md`](screenshot-checklist.md) — captures filed under
`captures/` using the naming convention defined there.

---

## How to Use This Runbook

1. Complete the build ([`01-topology-and-ip-plan/packet-tracer-build-guide.md`](../01-topology-and-ip-plan/packet-tracer-build-guide.md))
   and the **pre-flight checklist** below.
2. Execute tests **in order T-01 → T-07**. Each test lists the exact commands to run and the
   expected result (acceptance criteria).
3. CLI outputs vary slightly between Packet Tracer and IOS-XE; the **pass criteria are
   behavioral** (traffic succeeds / is dropped / counters increment), not textual.
4. Capture every screenshot listed in the checklist while the state is live, and record the
   result in the evidence index at the bottom of the checklist.

## Pre-Flight Checklist (all must pass before T-01)

| # | Check | Command / Where | Expected |
|---|---|---|---|
| P-1 | All planned interfaces up | `show ip interface brief` (R1, R2, MLS) | Every interface in the topology table is up/up |
| P-2 | OSPF converged | `show ip ospf neighbor` (R1) | **Two** neighbors FULL (2.2.2.2, 3.3.3.3) |
| P-3 | Default route present | `show ip route` (R2, MLS) | `O*E2 0.0.0.0/0 [110/1] via 10.20.254.1` |
| P-4 | DHCP server online | SVL-DC01 → Services → DHCP | **On**, four scopes configured (VLAN10/20/40/50) |
| P-5 | Time + logging online | SVL-NTPLOG01 → Services | NTP **On**, Syslog **On**, events arriving |
| P-6 | DNS + app server up | SVL-DNS01 / SVL-APP01 | Records present; HTTP service **On** |
| P-7 | SSH keys generated | `show ip ssh` (every device) | SSH version 2 enabled |
| P-8 | Clocks synchronized | `show clock` (every device) | Consistent EAT time across all six devices |

---

## T-01 — Inter-VLAN Routing: Finance → HQ Application Server

**Objective:** prove routed east-west reachability between VLAN 20 and VLAN 30 with the
`FINANCE-IN` gateway ACL enforcing the application-port policy.

**Path:** `PC-FIN01 (10.20.20.x) → SW1 → MLS SVI20 → MLS SVI30 → SW2 → SVL-APP01 (10.20.30.20)`

**Procedure:**

1. From `PC-FIN01` (DHCP lease in VLAN 20):

```
C:\> ping 10.20.30.20

Pinging 10.20.30.20 with 32 bytes of data:
Reply from 10.20.30.20: bytes=32 time=1ms TTL=127
Reply from 10.20.30.20: bytes=32 time<1ms TTL=127
Reply from 10.20.30.20: bytes=32 time<1ms TTL=127
Reply from 10.20.30.20: bytes=32 time<1ms TTL=127

Ping statistics for 10.20.30.20:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)
```

2. Open a browser on `PC-FIN01` → `http://10.20.30.20` → the Savannah intranet page renders.
3. On **MLS-HQ-CORE** confirm the policy counters (echo permitted, not denied):

```
MLS-HQ-CORE# show access-lists FINANCE-IN
Extended IP access list FINANCE-IN
    10 permit udp any any eq bootps
    20 permit udp 10.20.20.0 0.0.0.127 host 10.20.30.12 eq domain
    30 permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq www
    40 permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq 443
    50 permit tcp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 eq 1433
    60 permit icmp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 echo (4 match(es))
    70 permit udp 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31 range 33434 33534
    80 deny ip 10.20.20.0 0.0.0.127 10.20.30.0 0.0.0.31
    90 permit ip any any
```

4. In **Simulation Mode**, filter ICMP and follow the packet: SW1 → MLS (inter-VLAN routing at
   SVI20/SVI30) → SW2 → server. One L3 hop (TTL 128→127) confirms the collapsed core does the
   routing.

**Pass criteria:** 0% loss; HTTP page loads; `FINANCE-IN` echo/www permits increment while the
`deny ip` ACE stays flat.

---

## T-02 — Zero-Trust Isolation: Guest → Internal VLANs

**Objective:** prove the guest VLAN cannot reach ANY internal destination — the core business
requirement of the design.

**Path (attack):** `PC-GUEST01 (10.20.40.x) → MLS SVI40 ingress → DROPPED by GUEST-IN`

**Procedure:**

1. From `PC-GUEST01`:

```
C:\> ping 10.20.20.5

Pinging 10.20.20.5 with 32 bytes of data:
Request timed out.
Request timed out.
Request timed out.
Request timed out.

Ping statistics for 10.20.20.5:
    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)
```

2. Repeat against the server farm: `ping 10.20.30.20` → 100% loss. Try the browser against
   `http://10.20.30.20` → page does not load (HTTP to internal is also denied).
3. On **MLS-HQ-CORE**, the isolation ACE counts every attempt:

```
MLS-HQ-CORE# show access-lists GUEST-IN
Extended IP access list GUEST-IN
    10 permit udp any any eq bootps
    20 permit udp any any eq domain
    30 deny ip any 10.20.0.0 0.0.255.255 (8 match(es))
    40 permit tcp any any eq www
    50 permit tcp any any eq 443
    60 deny ip any any log
```

4. In **Simulation Mode** the ICMP packet visibly dies at the MLS gateway (red X at SVI40).
5. On **SVL-NTPLOG01 → Syslog**, matching deny records arrive, NTP-aligned, e.g.:

```
%SEC-6-IPACCESSLOGDP: list GUEST-IN denied icmp 10.20.40.100 (Vlan40) -> 10.20.20.5, 1 packet
```

**Pass criteria:** 100% loss to every internal target; deny counter increments per attempt;
log records appear on the central Syslog server. NOTE: guest DNS still works (it is permitted
before the isolation deny) — that is by design, and proves the ACL is surgical, not blunt.

---

## T-03 — Edge NAT/PAT: Guest → External Internet Web Server

**Objective:** prove guests get exactly the Internet access the policy allows (DNS + HTTP/HTTPS)
through R1's NAT/PAT overload — and nothing more.

**Path:** `PC-GUEST01 → MLS SVI40 → R1 Gi0/1 → NAT/PAT (203.0.113.2) → ISP → 198.51.100.10`

**Procedure:**

1. From `PC-GUEST01`, resolve and browse:

```
C:\> nslookup internet.test
DNS request timed out... retrying? -> then:
Non-authoritative answer:
Name:    internet.test
Address: 198.51.100.10
```

   (DNS goes to internal SVL-DNS01 10.20.30.12 — permitted before the isolation deny.)

2. Browser → `http://internet.test` (or `http://198.51.100.10`) → the external web page loads.
3. **Negative control:** `ping 198.51.100.10` from the guest → 100% loss. ICMP to the Internet
   is NOT in the guest allowlist — the default-deny is intentional zero-trust posture.
4. On **R1-HQ-EDGE**, inspect the live translation table:

```
R1-HQ-EDGE# show ip nat translations
Pro  Inside global      Inside local       Outside local      Outside global
tcp 203.0.113.2:1025   10.20.40.100:1025  198.51.100.10:80   198.51.100.10:80
tcp 203.0.113.2:1025   10.20.40.100:1025  198.51.100.10:80   198.51.100.10:80
udp 203.0.113.2:1026   10.20.40.100:1026  10.20.30.12:53     10.20.30.12:53
```

   Wait — the UDP 53 entry to an internal destination is the *control* case: internal-to-internal
   traffic must NOT appear here. If it does, `NAT-PERMITTED` was mis-ordered. Only entries whose
   **outside** is non-enterprise (198.51.100.10) are valid.

5. `show ip nat statistics` on R1 → outside interface `GigabitEthernet0/0`, active translations
   and hit counters increasing.

**Pass criteria:** external page loads from the guest; NAT table shows the PAT entry with the
public inside-global address; no internal→internal NAT entries; ICMP from guest stays denied.

---

## T-04 — WAN Dynamic Routing: Branch → HQ App Server over OSPF

**Objective:** prove the Mombasa branch reaches HQ services purely via dynamically learned OSPF
routes — no static routes on the branch — while `BRANCH-IN` enforces the branch policy.

**Path:** `PC-BR01 (10.20.50.x) → R2 Gi0/1.50 → WAN (Link A) → R1 → Link B → MLS SVI30 → SVL-APP01`

**Procedure:**

1. Confirm the OSPF domain on **R1**:

```
R1-HQ-EDGE# show ip ospf neighbor

Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           0   FULL/  -        00:00:37    10.20.254.2     GigabitEthernet0/2
3.3.3.3           0   FULL/  -        00:00:34    10.20.254.6     GigabitEthernet0/1
```

2. Confirm the branch learned HQ subnets dynamically on **R2**:

```
R2-MOMBASA-EDGE# show ip route
     10.0.0.0/8 is variably subnetted, 11 subnets, 3 masks
C       10.20.254.0/30 is directly connected, GigabitEthernet0/0
C       10.20.50.0/25 is directly connected, GigabitEthernet0/1.50
C       10.20.99.16/28 is directly connected, GigabitEthernet0/1.99
L       10.20.50.1/32 is directly connected, GigabitEthernet0/1.50
O       10.20.10.0/26 [110/2] via 10.20.254.1, 00:14:02, GigabitEthernet0/0
O       10.20.30.0/27 [110/2] via 10.20.254.1, 00:14:02, GigabitEthernet0/0
O       10.20.99.0/28 [110/2] via 10.20.254.1, 00:14:02, GigabitEthernet0/0
O       10.20.40.0/24 [110/2] via 10.20.254.1, 00:14:02, GigabitEthernet0/0
O       10.20.254.4/30 [110/2] via 10.20.254.1, 00:14:02, GigabitEthernet0/0
O*E2 0.0.0.0/0 [110/1] via 10.20.254.1, 00:14:02, GigabitEthernet0/0
```

3. From `PC-BR01`, trace the full path:

```
C:\> tracert 10.20.30.20

Tracing route to 10.20.30.20 over a maximum of 30 hops:

  1   1 ms    1 ms    1 ms     10.20.50.1        <- R2 Gi0/1.50 (branch gateway)
  2   2 ms    1 ms    1 ms     10.20.254.1       <- R1 Gi0/2 (WAN edge)
  3   2 ms    2 ms    2 ms     10.20.254.6       <- MLS-HQ-CORE
  4   2 ms    1 ms    1 ms     10.20.30.20       <- SVL-APP01

Trace complete.
```

4. Browser on `PC-BR01` → `http://10.20.30.20` → intranet page loads (www is in the branch
   allowlist). `show access-lists BRANCH-IN` on R2 shows the www/echo permits counting up.
5. **Policy control:** `ping 10.20.20.5` (Finance) from the branch → 100% loss; R2's
   `BRANCH-IN` line `deny ip 10.20.50.0 0.0.0.127 10.20.20.0 0.0.0.127 log` counts and the
   Syslog server records the deny.

**Pass criteria:** both R1 adjacencies FULL; branch holds only dynamic OSPF + default routes;
traceroute shows exactly the three routed hops; branch→HQ-server traffic succeeds while
branch→Finance stays denied and logged.

---

## T-05 — Layer-2 Attack Response: Port Security & BPDU Guard

**Objective:** prove rogue devices are stopped at the wall jack, exactly as the security policy
promises.

**Procedure A — Port Security (MAC flood):**

1. Connect a rogue hub with two PCs (different MACs) to `SW1 Fa0/3` (a Finance port that already
   learned its sticky MAC). The port now sees 3 MACs against `maximum 2`.
2. Watch the console:

```
%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address 00D0.9711.2201, on port FastEthernet0/3.
```

   (Message text varies slightly by IOS version — the behavioral signal is the err-disable.)

3. Verify on **SW1**:

```
SW1-HQ-ACCESS-1# show port-security interface FastEthernet0/3
Port Security              : Enabled
Port Status                : Secure-shutdown
Violation Mode             : Shutdown
Aging Time                 : 0 mins
Aging Type                 : Absolute
SecureStatic Address Aging : Enabled
Maximum MAC Addresses      : 2
Total MAC Addresses        : 2
Configured MAC Addresses   : 0
Sticky MAC Addresses       : 1
Last Source Address:Vlan   : 00D0.9711.2201:20
Security Violation Count   : 1

SW1-HQ-ACCESS-1# show interfaces status
Port      Name               Status       Vlan       Duplex  Speed Type
Fa0/3     FIN/HR ACCESS      err-disabled 20         auto    auto  10/100BaseTX
```

4. Remove the rogue device and recover the port:

```
SW1-HQ-ACCESS-1(config)# interface FastEthernet0/3
SW1-HQ-ACCESS-1(config-if)# shutdown
SW1-HQ-ACCESS-1(config-if)# no shutdown
```

**Procedure B — BPDU Guard (rogue switch):**

1. Connect a rogue switch to `SW1 Fa0/5` (BPDU Guard + PortFast enabled).
2. Watch the console:

```
%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port FastEthernet0/5 with BPDU Guard enabled. Disabling port.
```

3. `show interfaces status` → `Fa0/5 err-disabled`. The rogue switch never participates in STP
   topology computation.

**Pass criteria:** both ports go err-disabled automatically on first attack signature; logs and
counters captured; recovery procedure documented and demonstrated.

---

## T-06 — Management-Plane Protection: SSH/Telnet Access Control

**Objective:** prove only the IT Admin VLAN can manage devices, enforced at TWO independent
layers (gateway ACLs + VTY access-class).

**Procedure:**

1. **Guest attempt (layer 1 — gateway):** from `PC-GUEST01`:

```
C:\> ssh -l netadmin 10.20.99.2
```

   → no response / timeout. The packet dies at MLS SVI40 (`GUEST-IN` isolation deny) — it never
   routes. Evidence: `show access-lists GUEST-IN` deny counter increments on MLS.

2. **Finance attempt (layer 1 — management-plane guard):** from `PC-FIN01`:

```
C:\> ssh -l netadmin 10.20.99.2
```

   → no response / timeout. `FINANCE-IN` allows the packet onward, but the **MGMT-PLANE** ACL on
   MLS `Vlan99` (out) drops it: only `10.20.10.0/26` may open SSH into the management VLAN.
   Evidence: `show access-lists MGMT-PLANE` on MLS — deny counter increments, Syslog records it.

3. **Authorized attempt:** from `PC-IT01` (VLAN 10):

```
C:\> ssh -l netadmin 10.20.99.2
Password: ************

SW1-HQ-ACCESS-1>
```

   → session opens (MGMT-PLANE permits `10.20.10.0/26 → 10.20.99.0/28 eq 22`, and SW1's VTY
   `MGMT-ACCESS` standard ACL permits the same source — the second lock).

4. **Telnet is dead everywhere:** `telnet 10.20.99.2` from any PC → connection refused/blocked
   (`transport input ssh` on every VTY; Telnet never enabled).
5. Confirm SSH hardening on the target: `show ip ssh` → `SSH version 2 enabled`.

**Pass criteria:** guest and finance attempts fail with matching ACL deny counters + Syslog
records; IT admin SSH succeeds; Telnet refused; SSHv2 confirmed.

---

## T-07 — Central DHCP with Relay Agents

**Objective:** prove one central DHCP server (VLAN 30) serves all user VLANs through the relay
agents, handing out exactly the planned scopes — with no rogue DHCP possible.

**Procedure:**

1. Set `PC-FIN02` (VLAN 20) to DHCP, then:

```
C:\> ipconfig

IP Address......................: 10.20.20.6
Subnet Mask.....................: 255.255.255.128
Default Gateway.................: 10.20.20.1
DNS Server......................: 10.20.30.12
```

2. Confirm the lease inside the planned scope on **SVL-DC01 → Services → DHCP** (pool
   `VLAN20-FIN`, allocated count ≥ 1) — and on **SW1**:

```
SW1-HQ-ACCESS-1# show ip dhcp snooping binding
MacAddress          IpAddress        Lease(sec)  Type           VLAN  Interface
------------------  ---------------  ----------  -------------  ----  --------------------
0050.56BE.1102      10.20.20.6       86395       dhcp-snooping   20   FastEthernet0/3
Total number of bindings: 1
```

3. Repeat for the branch: `PC-BR02` (VLAN 50) leases `10.20.50.x / 255.255.255.128 / gw
   10.20.50.1 / DNS 10.20.30.12` via the relay on **R2 Gi0/1.50** (`ip helper-address
   10.20.30.10`; `BRANCH-IN` permits bootps). Evidence: SW3 snooping binding table.
4. Repeat for the guest: guest laptop leases from `10.20.40.100–.249` (relay on MLS SVI40).
5. **Rogue DHCP control (optional but recommended):** connect a PC configured as a DHCP server
   to a guest access port — its offers are silently dropped by DHCP Snooping (untrusted port).
   Evidence: `show ip dhcp snooping statistics` drop counters on SW1.

**Pass criteria:** all three user scopes hand out planned addresses/gateways/DNS via the relays;
snooping bindings populate on the access switches; rogue offers are dropped.

---

## Result Summary (fill after the lab run)

| Test | Scenario | Result | Evidence |
|---|---|---|---|
| T-01 | Finance → Server routed + ACL policy | Pending | `captures/T-01-*.png` |
| T-02 | Guest isolation enforced + logged | Pending | `captures/T-02-*.png` |
| T-03 | Guest Internet via NAT/PAT, ICMP denied | Pending | `captures/T-03-*.png` |
| T-04 | Branch → HQ over OSPF + branch policy | Pending | `captures/T-04-*.png` |
| T-05 | Port Security + BPDU Guard err-disable | Pending | `captures/T-05-*.png` |
| T-06 | Management plane double-enforced | Pending | `captures/T-06-*.png` |
| T-07 | Central DHCP + relays + snooping bindings | Pending | `captures/T-07-*.png` |

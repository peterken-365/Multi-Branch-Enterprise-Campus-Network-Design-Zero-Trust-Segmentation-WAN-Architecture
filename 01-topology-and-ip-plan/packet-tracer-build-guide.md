# Packet Tracer / Lab Build Guide (click-by-click)

Build the design exactly, in this order. Estimated build time: 60-90 minutes. Every config paste
is available in [`02-switching-and-routing-design/configs/`](../02-switching-and-routing-design/configs/).

> **Real hardware note:** the same configs apply to Catalyst 2960-X/9200 + 3650/9300 + ISR 4331.
> Lines that are Packet Tracer-incompatible are pre-commented in each file under
> `PRODUCTION-ONLY`.

---

## 1. Place Devices

| Qty | Device (PT model) | Purpose |
|---|---|---|
| 2 | Router 2911 | R1-HQ-EDGE, R2-MOMBASA-EDGE |
| 1 | Switch 3650-24PS | MLS-HQ-CORE |
| 3 | Switch 2960-24TT | SW1, SW2, SW3 |
| 1 | Router 2911 (or Cloud-PT + server) | ISP edge + simulated Internet |
| 4 | Server | SVL-DC01 (DHCP), SVL-NTPLOG01 (NTP+Syslog), SVL-DNS01, SVL-APP01 (HTTP) |
| ~8 | PC / Laptop | IT x2, Finance x2, Guest laptop + AP, Branch x2 |
| 1 | AccessPoint-PT + Laptop | Guest Wi-Fi on SW1 Fa0/11 |

## 2. Cable (copper straight-through)

| From | To | Notes |
|---|---|---|
| R1 Gi0/0 | ISP Gi0/0 | Public /30 |
| R1 Gi0/1 | MLS Gi1/1/1 | Link B |
| R1 Gi0/2 | R2 Gi0/0 | Link A |
| R2 Gi0/1 | SW3 Gi0/1 | Trunk |
| MLS Gi1/0/1 | SW1 Gi0/1 | Trunk |
| MLS Gi1/0/2 | SW2 Gi0/1 | Trunk |
| SW2 Fa0/1-4 | DHCP / NTP-Log / DNS / APP servers | VLAN 30 access |
| SW1 Fa0/1-2, 3-10, 11-18 | IT PCs, Finance PCs, AP + guest laptop | VLAN 10/20/40 access |
| SW3 Fa0/1-2 | Branch PCs | VLAN 50 access |
| ISP Gi0/1 | Internet web server | 198.51.100.0/24 |

## 3. Configure Devices (this exact order)

For each device: `enable` -> `configure terminal` -> paste the matching `.cfg` file -> `end` ->
`copy running-config startup-config`.

Then, **in EXEC mode on every device**, generate SSH keys:

```
crypto key generate rsa modulus 2048
```

Order: **MLS-HQ-CORE -> SW1 -> SW2 -> SW3 -> R1 -> R2** (core outward, then routers).

## 4. Server Services

1. **SVL-DC01 (10.20.30.10, static):** Static IP 10.20.30.10/27, gateway 10.20.30.1.
   Services -> DHCP -> **On**, create the four scopes from the VLSM plan
   (`01-topology-and-ip-plan/vlsm-ip-plan.md`, section 3). DNS = 10.20.30.12 in every scope.
2. **SVL-NTPLOG01 (10.20.30.11):** Services -> NTP -> **On**. Services -> Syslog -> **On**.
3. **SVL-DNS01 (10.20.30.12):** A records: `www.savannah.local -> 10.20.30.20`,
   `app.savannah.local -> 10.20.30.20`, `internet.test -> 198.51.100.10`. DNS -> **On**.
4. **SVL-APP01 (10.20.30.20):** HTTP -> **On**, edit index.html content to a Savannah intranet page.
5. **Internet web server (198.51.100.10/24, gw 198.51.100.1):** HTTP -> **On**.
6. **ISP router:** Gi0/0 = 203.0.113.1/30; Gi0/1 = 198.51.100.1/24; a loopback for testing if desired.

## 5. Bring-Up Checkpoints (fix before continuing)

1. `show ip interface brief` on R1/R2/MLS - all planned interfaces up/up.
2. Ping across Link A and Link B (R1 <-> R2, R1 <-> MLS).
3. `show ip ospf neighbor` on R1: **two** neighbors FULL (2.2.2.2, 3.3.3.3). On R2: one (1.1.1.1). On MLS: one (1.1.1.1).
4. `show ip route` on R2: OSPF routes to 10.20.30.0/27 etc. + O*E2 default from R1.
5. `show vlan brief` on switches - no port in VLAN 1; quarantine ports down in VLAN 999.
6. PC (VLAN 20) set to DHCP -> receives 10.20.20.x (this is test T-07).

## 6. Run the 7 Tests

Execute [`05-verification-evidence/verification_report.md`](../05-verification-evidence/verification_report.md)
end-to-end and capture evidence per [`05-verification-evidence/screenshot-checklist.md`](../05-verification-evidence/screenshot-checklist.md).

## 7. Save the .pkt

Save as `savannah-enterprise-network.pkt` and place it in this folder (`01-topology-and-ip-plan/`)
so the repository ships the full simulation alongside the design package.

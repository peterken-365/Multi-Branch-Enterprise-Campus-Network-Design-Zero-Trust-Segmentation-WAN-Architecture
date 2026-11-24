# Layer-2 & Device Security Policy

**Pillar 1 + Pillar 3 (CCNA Courses 1 & 3) deliverable.** The Device Hardening Standard applied
to every router and switch BEFORE it is connected to the network, plus the Layer-2 attack
mitigation suite at the access layer.

---

## 1. Device Hardening Standard v1.0 (applies to ALL six devices)

| Control | Standard | Config evidence |
|---|---|---|
| Encrypted remote management | SSHv2 ONLY; Telnet disabled (`transport input ssh`); RSA 2048-bit keys | all devices `line vty 0 4` |
| Management source restriction | VTY `access-class MGMT-ACCESS in` permits 10.20.10.0/26 only | all devices |
| Encrypted secret storage | `enable secret`, `username netadmin secret`, `service password-encryption`; scrypt (`algorithm-type`) flagged as the production upgrade in comments | all devices |
| Brute-force protection | `login block-for 120 attempts 3 within 60` | all devices |
| Session hygiene | `exec-timeout 10 0` on console + VTY, `logging synchronous` | all devices |
| Legal warning banner | MOTD banner (unauthorized access prohibited) | all devices |
| Web servers disabled | `no ip http server`, `no ip http secure-server` | all devices |
| Console protection | `login local` on con 0; physically secured comms rooms (process control) | all devices |
| DNS hygiene | `no ip domain-lookup` on devices; `ip domain-name` only for SSH key identity | all devices |
| Central time | NTP to 10.20.30.11 (EAT +3 timezone set); timestamps msec | all devices |
| Central logging | Syslog to 10.20.30.11, trap informational (captures ACL denies), buffered 16384 | all devices |
| PRODUCTION-ONLY extras | scrypt secrets, `ip options drop`, `login on-failure log`, `errdisable recovery`, storm-control, UDLD | commented in configs (PT lacks support) |

## 2. Layer-2 Attack Mitigation (per switch)

| Control | SW1 (users) | SW2 (servers) | SW3 (branch) |
|---|---|---|---|
| Port Security | Fa0/1-10, 12-18: max 2, sticky, violation shutdown; Fa0/11 (AP): max 10, violation restrict | Fa0/1-4: max 1, sticky, violation shutdown | Fa0/1-16: max 2, sticky, violation shutdown |
| DHCP Snooping | VLANs 10,20,40; trust Gi0/1 only | VLAN 30; trust Gi0/1 + Fa0/1 (DHCP server) | VLAN 50; trust Gi0/1 only |
| Dynamic ARP Inspection | VLANs 10,20,40; trust Gi0/1 | VLAN 30 + 4 static `ip source binding` entries for the static server IPs | VLAN 50; trust Gi0/1 |
| BPDU Guard + PortFast | all access ports | all server ports (no PortFast risk: no hubs) | all access ports |
| Quarantine | Fa0/19-24 in VLAN 999, shutdown | Fa0/5-24 in VLAN 999, shutdown | Fa0/17-24 in VLAN 999, shutdown |

**Why `no ip dhcp snooping information option`:** the design uses IOS DHCP relays (MLS SVIs /
R2 sub-interface) and a standard (non-Option-82-aware) DHCP server. Disabling Option-82
insertion at the access layer removes the classic "untrusted relay option" failure mode while
keeping rogue-DHCP blocking fully intact. On production servers that DO parse Option 82, re-enable
insertion and mark relay-facing ports trusted.

**Why static source bindings on SW2:** DAI validates ARP against DHCP snooping bindings, but the
server farm uses static IPs and never completes a DHCP exchange. `ip source binding` entries
give DAI its validation anchors for those hosts (replace sample MACs with real NIC MACs at
deployment).

## 3. Expected Attack Responses (verification hooks)

| Attack | Expected Behavior | Evidence (Test) |
|---|---|---|
| Rogue switch plugged into a wall jack | BPDU Guard err-disables the port instantly | T-05 |
| MAC-spoofing hub / extra device on one port | Port Security Secure-Shutdown puts port in err-disable | T-05 |
| Rogue DHCP server on an access port | Snooping drops OFFER/ACK from untrusted port; counter increases | `show ip dhcp snooping statistics` |
| ARP poisoning (gratuitous ARP MITM) | DAI drops invalid ARP; `show ip arp inspection statistics` shows drops | Syslog record |
| SSH from Guest VLAN 40 | Denied at gateway ACL + VTY ACL; logged | T-06 |
| Telnet attempt anywhere | Connection refused (Telnet server disabled on all lines) | T-06 |

## 4. Residual Risks & Roadmap (honest engineering)

| Risk | Status | Planned Mitigation |
|---|---|---|
| Single HQ edge router (R1) | Accepted for scope | HSRP pair + dual ISP in production phase |
| Local device accounts | Accepted for scope | Central AAA (TACACS+/ISE) with per-command authorization |
| Guest Wi-Fi is open SSID | Accepted for lab scope | WPA2/3-Enterprise or portal + client isolation in production |
| Syslog is UDP | Accepted for scope | Transport TLS (syslog over TLS) or SNMPv3 traps in production |
| SNMP not deployed | Accepted for scope | SNMPv3 authPriv or NETCONF/RESTCONF telemetry (see Pillar 4 docs) |

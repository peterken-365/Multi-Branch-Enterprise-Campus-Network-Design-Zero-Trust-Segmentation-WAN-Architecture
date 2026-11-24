# SDN Conceptual Model & API-Ready Management Plane

**Pillar 4 (CCNA Course 4) deliverable.** How this CLI-managed topology maps onto Software-
Defined Networking, and how the same data becomes consumable via REST APIs (JSON) instead of
screen-scraping CLI output.

---

## 1. Plane Separation Mapped to This Topology

| Plane | Traditional (this design) | SDN end-state |
|---|---|---|
| **Data plane** | ASIC forwarding: SW1/SW2/SW3 MAC tables; MLS CEF/TCAM inter-VLAN CEF entries | Same ASICs, flow rules pushed by controller (e.g., OpenFlow) |
| **Control plane** | OSPF LSDB on R1/R2/MLS; Rapid PVST+ BPDUs; ARP | Centralized controller computes topology/paths (SDN controller or SD-WAN orchestrator) |
| **Management plane** | SSH CLI, Syslog, NTP, SNMP | RESTCONF/NETCONF/gNMI northbound API + telemetry streams |

## 2. CLI Screen-Scraping vs Structured APIs

| Task | CLI era (fragile) | API era (structured) |
|---|---|---|
| Read interface state | `show ip interface brief` + regex parse | `GET /restconf/data/ietf-interfaces:interfaces` -> JSON |
| Read OSPF neighbors | `show ip ospf neighbor` text | `GET /restconf/data/Cisco-IOS-XE-ospf-oper:ospf-oper-data` -> JSON |
| Push a VLAN | `conf t; vlan 10; name IT-ADMIN` | `PUT /restconf/data/Cisco-IOS-XE-native:native/vlan` (idempotent) |
| Detect change | diff CLI captures | YANG config checksums + `NETCONF <get-config>` deltas |

## 3. Example: the Same Fact in Both Worlds

CLI:

```
MLS-HQ-CORE# show ip interface vlan 20 | include address
   IP address: 10.20.20.1
```

RESTCONF (conceptual JSON response):

```json
{
  "ietf-interfaces:interface": [
    {
      "name": "Vlan20",
      "type": "iana-if-type:l3ipvlan",
      "ietf-ip:ipv4": {
        "address": [
          { "ip": "10.20.20.1", "netmask": "255.255.255.128" }
        ]
      },
      "description": "GATEWAY VLAN 20 - FINANCE (10.20.20.0/25)",
      "enabled": true
    }
  ]
}
```

Same data, machine-readable, schema-validated against the YANG model - this is what the
management tooling (and a controller) consumes.

## 4. Telemetry Path

| Today (lab) | Production roadmap |
|---|---|
| Syslog pushes to 10.20.30.11 (UDP 514), NTP-aligned timestamps | Streaming telemetry (gNMI subscribe) for counters/flows; Syslog over TLS |
| ACL hit counters checked manually (`show access-lists`) | Counter deltas streamed + threshold alerts (e.g., Guest deny spike) |
| Nightly SSH config pull | Periodic NETCONF `get-config` or model-driven sync with Git diff |

## 5. Controller View of This Network (conceptual)

- **Inventory:** 6 devices, 3 L3 adjacencies, 7 VLANs, 2 sites - exactly the tables in this repo.
- **Intent examples:** "Guest VLAN must never reach 10.20.0.0/16" -> the controller compiles the
  `GUEST-IN` ACL lineage across gateways and verifies it with generated traffic tests (same
  checks as our manual T-01..T-07 runbook).
- **Why it matters for the business:** policy as data + API-driven deployment = auditable,
  repeatable, and compatible with Azure hybrid networking (next document).

# OSPFv2 Dynamic Routing Architecture (Single Area 0)

**Pillar 2 (CCNA Course 2) + Pillar 3 (Course 3) deliverable.** All three L3 devices run
OSPFv2 process 10 in one area, with a hard rule: **user-facing interfaces are passive** -
routing updates are never leaked onto employee or guest LANs.

---

## 1. Router / Process Matrix

| Device | OSPF RID | Passive policy | Non-passive (adjacency) interfaces |
|---|---|---|---|
| R1-HQ-EDGE | 1.1.1.1 | `passive-interface default` | Gi0/1 (Link-B to MLS), Gi0/2 (Link-A to R2). ISP link stays passive |
| R2-MOMBASA-EDGE | 2.2.2.2 | `passive-interface default` | Gi0/0 (Link-A to R1). Branch VLANs stay passive |
| MLS-HQ-CORE | 3.3.3.3 | `passive-interface default` | Gi1/1/1 (Link-B to R1). All SVIs stay passive |

Loopbacks (10.20.255.1/2) are advertised as stable infrastructure anchors and double as the SSH
management endpoints for the routers.

## 2. Advertised Prefixes

| Device | Prefix(es) into Area 0 |
|---|---|
| R1 | 10.20.254.0/30 (Link A), 10.20.254.4/30 (Link B), 10.20.255.1/32 |
| R2 | 10.20.254.0/30, 10.20.50.0/25 (branch users), 10.20.99.16/28 (branch mgmt), 10.20.255.2/32 |
| MLS | 10.20.254.4/30, 10.20.10.0/26, 10.20.20.0/25, 10.20.30.0/27, 10.20.40.0/24, 10.20.99.0/28 |
| R1 (special) | `default-information originate` - the only default route in the domain, pointing at the ISP |

## 3. Adjacency Matrix (expected FULL states)

| Adjacency | Between | Over |
|---|---|---|
| 1 | R1 (1.1.1.1) <-> R2 (2.2.2.2) | Link A, 10.20.254.0/30 |
| 2 | R1 (1.1.1.1) <-> MLS (3.3.3.3) | Link B, 10.20.254.4/30 |
| 3 | R2 <-> MLS | no direct adjacency - both peer with R1, routes flow via Area 0 (single-area design has no ABR filtering) |

## 4. Expected Verification Output

`show ip ospf neighbor` on **R1**:

```
Neighbor ID     Pri   State           Dead Time   Address         Interface
2.2.2.2           0   FULL/  -        00:00:37    10.20.254.2     GigabitEthernet0/2
3.3.3.3           0   FULL/  -        00:00:34    10.20.254.6     GigabitEthernet0/1
```

`show ip route` on **R2** (branch learns the world through Area 0):

```
O*E2 0.0.0.0/0 [110/1] via 10.20.254.1, 00:05:12, GigabitEthernet0/0
O    10.20.30.0/27 [110/3] via 10.20.254.1, 00:05:12, GigabitEthernet0/0
O    10.20.99.0/28 [110/3] via 10.20.254.1, 00:05:12, GigabitEthernet0/0
C    10.20.50.0/25 is directly connected, GigabitEthernet0/1.50
```

End-to-end branch path (verification test T-04):

```
Branch-PC> tracert 10.20.30.20
  1   10.20.50.1     (R2 Gi0/1.50 - branch gateway)
  2   10.20.254.1    (R1 - WAN edge)
  3   10.20.254.6    (MLS-HQ-CORE)
  4   10.20.30.20    (SVL-APP01 reply)
```

## 5. Why Passive-Interface Default Matters

An OSPF hello on a guest or finance LAN would let any laptop run `area 0` tooling, become a
rogue neighbor, and inject routes (traffic blackholing / interception). With
`passive-interface default`, hellos exist **only** on the two transit /30s - and the guest VLAN
is additionally ACL-blocked from speaking to any internal destination at all.

## 6. Design Trade-off Note

Single-area OSPF is the correct CCNA-scope choice for a two-site enterprise (every router holds
the full LSDB; no ABR summarization needed at this scale). The design scales: if a third site is
added, Link-A/B style transit /30s continue the pattern, and the branch becomes a normal area
(e.g., Area 1) with `area 1 range 10.20.50.0 255.255.255.0` summarization on the new ABR.

# Cloud Extension Readiness: Azure Site-to-Site VPN Reservation

**Pillar 4 (CCNA Course 4) deliverable + Project 5 (Master Capstone) prerequisite.** The IP plan
and the R1 edge design already ring-fence everything the Azure hybrid extension needs, so the
capstone requires **zero re-addressing**.

---

## 1. Reserved Resources (already in the VLSM plan)

| Resource | Block / Value | Purpose |
|---|---|---|
| Azure-mapped address space | **10.20.200.0/24** | Reserved for Azure VNet subnets peering into Savannah HQ (never allocated on-prem) |
| Tunnel transit | **10.20.254.8/30** (R1 Tunnel0 = 10.20.254.9) | Point-to-point transit inside the IPsec tunnel |
| BGP peering | eBGP: R1 (ASN 65001) <-> Azure VPN Gateway (default ASN 65515), APIPA 169.254.21.0/30 inside tunnel | Dynamic prefix exchange |
| R1 edge readiness | Gi0/0 already NAT outside + EDGE-INBOUND ACL; IKEv2 profile binds to the public IP | Template: [`azure-vpn-tunnel-template.cfg`](azure-vpn-tunnel-template.cfg) |

## 2. Design Overview (to be applied in Project 5)

```
Nairobi HQ (R1-HQ-EDGE) ================= IPsec/IKEv2 S2S ============ Azure VPN Gateway
  Tunnel0: 10.20.254.9/30                                  10.20.254.10/30 (Azure side)
  eBGP: 169.254.21.2 (ASN 65001)                            169.254.21.1 (ASN 65515)
  Advertises: 10.20.0.0/16 (summary)                        Advertises: 10.20.200.0/24
```

- **IKEv2 + AES-GCM/SHA-384/DH-19** proposal (template in this folder, commented, NOT applied).
- **BGP over IPsec** (Azure requirement) rather than static routes - the branch also learns Azure
  prefixes automatically through the existing OSPF/BGP boundary at R1.
- **OSPFBGP boundary:** R1 redistributes nothing by default; a controlled `network 10.20.0.0`
  aggregate is advertised so Area 0 stays stable if the tunnel flaps.
- **Azure side:** VNet uses 10.20.200.0/24 subnets; Local Network Gateway = 203.0.113.2 (R1 public)
  with 10.20.0.0/16 space; GatewaySubnet per Azure requirements.

## 3. Why This Belongs in the Design NOW

1. **Address-space discipline:** reserving 10.20.200.0/24 today prevents an accidental DHCP
   expansion from colliding with Azure tomorrow (the #1 rework cause in hybrid migrations).
2. **Edge discipline:** EDGE-INBOUND and NAT-PERMITTED were written so that adding one tunnel
   interface + ikev2 profile does not require touching the zero-trust ACL matrix.
3. **Skills path:** demonstrates understanding that cloud integration is a routing + identity +
   IPsec problem, not a UI wizard.

# Automation Brief: Golden Configs, Backup & Drift Control

**Pillar 4 (CCNA Course 4) deliverable.** Manual CLI typing does not scale and does not detect
unauthorized change. This design treats device configuration as code.

---

## 1. Configuration as Source-of-Truth

The six files in [`02-switching-and-routing-design/configs/`](../02-switching-and-routing-design/configs/)
are the **golden configurations** - the authoritative definition of the network:

- standardized header/comments, naming, VLANs, ACLs, NTP/Syslog per the Hardening Standard;
- version-controlled in Git (every change is a reviewed commit, not a undocumented `conf t`);
- any emergency console change is reconciled back into the golden file within one business day.

## 2. Device Naming Standard

| Pattern | Example | Meaning |
|---|---|---|
| `R<SITE>-<ROLE>` | R1-HQ-EDGE | Site edge router |
| `MLS-<SITE>-CORE` | MLS-HQ-CORE | Multilayer core switch |
| `SW<NUM>-<SITE>-ACCESS[<n>]` | SW1-HQ-ACCESS-1 | Access switch |
| Interface descriptions | `LINK-A: P2P WAN TO R2...` | Every link self-documents its peer and subnet |

## 3. Scheduled Backup Workflow

| Step | Mechanism | Frequency |
|---|---|---|
| 1. Pull running-config over SSH | `scripts/backup-and-drift-check.sh` (cron/Task Scheduler) or the Ansible playbook | Nightly 23:30 |
| 2. Store timestamped copy | `backups/<device>-<date>.cfg` on the backup host (10.20.30.0/27 server farm in production) | Nightly |
| 3. Diff vs golden config | Script exits non-zero on drift; output emailed/posted to the ops channel | Nightly |
| 4. Review & reconcile | Drift = unauthorized change until proven otherwise; update golden file via Git PR | Next business day |

## 4. Drift Detection Logic

```
golden config (Git)  <--  expected state
        | diff
running-config (device, pulled via SSH/Ansible)  <--  actual state
        |
        +--> [OK] no drift            -> retain backup, no action
        +--> [DRIFT] differences      -> page netops; unauthorized change process
```

The shipped bash script does this with plain `ssh` + `diff` (no external dependencies beyond SSH
key auth to each device's management IP as `netadmin`). The Ansible playbook is the production
upgrade path (cisco.ios collection, network_cli) - see
[`ansible/`](ansible/) in this folder.

## 5. What Automation Buys This Design

- **Fast recovery:** any device can be rebuilt from its golden file + `crypto key` step in minutes.
- **Auditability:** every config change is a Git commit with author + reason.
- **Compliance evidence:** nightly diffs prove no unauthorized manual changes (pairs with the
  NTP/Syslog architecture for time-consistent security investigation).
- **Scale-out ready:** adding the third site = copy a golden file, change site octets, PR review.

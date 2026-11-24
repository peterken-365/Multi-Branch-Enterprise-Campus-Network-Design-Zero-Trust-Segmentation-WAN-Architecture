#!/usr/bin/env bash
# =============================================================================
# Savannah Logistics - golden-config backup + drift check (Pillar 4)
# Pulls running-config from every device over SSH, stores a timestamped copy,
# and diffs it against the golden source-of-truth files committed in this repo.
#
# Requirements:
#   - SSH key auth to each device's management IP as user "netadmin"
#   - run from a host inside the management plane (VLAN 10 admin workstation
#     or the 10.20.30.0/27 server farm in production)
#
# Schedule nightly (cron):  30 23 * * *  /path/to/backup-and-drift-check.sh
#
# NOTE: running-config output contains order/metadata noise vs the golden file;
# in production prefer the Ansible playbook (cisco.ios) or normalize both files
# before diffing. This script is intentionally dependency-free.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GOLDEN_DIR="${REPO_ROOT}/02-switching-and-routing-design/configs"
BACKUP_DIR="${REPO_ROOT}/backups/$(date +%F)"
USER="netadmin"

# device-name:management-ip pairs (see 01-topology-and-ip-plan/topology.md)
HOSTS="R1-HQ-EDGE:10.20.255.1 R2-MOMBASA-EDGE:10.20.255.2 MLS-HQ-CORE:10.20.99.1 SW1-HQ-ACCESS-1:10.20.99.2 SW2-HQ-ACCESS-2:10.20.99.3 SW3-MOMBASA-ACCESS:10.20.99.18"

mkdir -p "${BACKUP_DIR}"
drift=0

for entry in ${HOSTS}; do
  name="${entry%%:*}"
  ip="${entry##*:}"
  outfile="${BACKUP_DIR}/${name}.cfg"

  if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "${USER}@${ip}" \
        "show running-config" > "${outfile}" 2>/dev/null; then
    echo "[FAIL]  ${name} (${ip}) - unreachable or auth problem"
    drift=1
    continue
  fi

  if diff -q "${GOLDEN_DIR}/${name}.cfg" "${outfile}" >/dev/null 2>&1; then
    echo "[OK]    ${name} - no drift"
  else
    echo "[DRIFT] ${name} - running-config differs from golden file:"
    diff "${GOLDEN_DIR}/${name}.cfg" "${outfile}" | head -40 || true
    drift=1
  fi
done

if [ "${drift}" -eq 0 ]; then
  echo "SUMMARY: all devices match the golden source-of-truth."
  exit 0
else
  echo "SUMMARY: drift or failures detected - review before next change window."
  exit 1
fi

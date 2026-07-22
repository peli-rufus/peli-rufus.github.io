---
id: evtx-tampering-recovery
title: "Windows Event Log Tampering: Detection & Recovery"
date: 2025-02-10
tag: Forensics
readTime: 10
views: 489
private: false
excerpt: "How attackers clear and tamper with Windows event logs, and the forensic artifacts that remain — from prefetch to shadow copies."
related:
  - vql-triage-recipes
---

## Why Attackers Clear Logs

Log clearing is standard anti-forensics in nearly every ransomware and APT playbook. The goal: destroy evidence of initial access, lateral movement, and privilege escalation. The good news — clearing logs leaves its own evidence.

## Event ID 1102 & 104

Security log clears generate **Event ID 1102**. System log clears generate **Event ID 104**.

```powershell
# Detect log clear events
Get-WinEvent -LogName Security | Where-Object {$_.Id -eq 1102} |
  Select-Object TimeCreated, Message
```

## Artifacts That Survive a Wipe

- **Prefetch files** — wevtutil.exe execution recorded in C:\Windows\Prefetch\
- **Shimcache / Amcache** — records program execution regardless of log state
- **SRUM database** — 30–60 days of network and process activity
- **VSS Shadow Copies** — prior logs fully recoverable if not deleted

## Recovering Logs from Shadow Copies

```batch
vssadmin list shadows
mklink /d C:\ShadowMount \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\
copy "C:\ShadowMount\Windows\System32\winevt\Logs\Security.evtx" C:\Evidence\
```

## Sigma Detection Rule

```yaml
title: Bulk Windows Event Log Clearing
status: stable
logsource:
  product: windows
  service: system
detection:
  selection:
    EventID: 104
  selection2:
    EventID: 1102
  condition: selection or selection2
```

Even when an attacker clears the logs, the act of clearing is itself an artifact. Combine these survivors with a good timeline and the gaps tell the story.

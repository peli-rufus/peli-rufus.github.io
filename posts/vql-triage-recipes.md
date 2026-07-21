---
id: vql-triage-recipes
title: "Velociraptor VQL Recipes for Rapid Triage"
date: 2025-02-28
tag: Threat Hunting
readTime: 8
views: 612
private: false
excerpt: "Battle-tested VQL queries for rapid endpoint triage during live IR engagements. Process trees, LOLBins, persistence, and more."
related:
  - blackbasta-memory-forensics
  - evtx-tampering-recovery
---

## Why Velociraptor?

Velociraptor's VQL lets you interrogate live endpoints at scale in seconds. During an active incident, these queries are your first line of triage — answering "how many endpoints are affected?" before you touch a memory image.

## Suspicious Process Tree

Surface unusual parent-child relationships — office apps spawning cmd.exe, browsers spawning PowerShell.

```vql
SELECT Pid, Ppid, Name, CommandLine,
       {SELECT Name FROM pslist(pid=Ppid)} AS ParentName
FROM pslist()
WHERE Name =~ "cmd.exe|powershell.exe|wscript.exe"
  AND ParentName =~ "winword.exe|excel.exe|outlook.exe"
```

## LOLBin Detection

```vql
SELECT Pid, Name, CommandLine, Username
FROM pslist()
WHERE CommandLine =~ "certutil.*-decode|mshta.*http|rundll32.*javascript"
```

## Active External Connections

```vql
SELECT Pid, Name, Status, RemoteAddress, RemotePort
FROM netstat()
WHERE Status = "ESTABLISHED"
  AND NOT RemoteAddress =~ "^(10\\.|192\\.168\\.)"
```

## Persistence via Run Keys

```vql
SELECT Key, Name, Data
FROM read_reg_key(
  globs=["HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\\*"]
)
WHERE Data =~ "AppData|Temp|ProgramData"
```

These recipes cover the majority of first-hour triage questions. Chain them into a Velociraptor hunt and you can sweep an entire fleet in minutes.

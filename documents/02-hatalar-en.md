# 2. Managing Errors

The **Errors** page is the main screen where you manage the error groups belonging to the
selected project.

## How error groups (clusters) are formed
When an error comes in, LogLens works in two layers:
1. **Fingerprint** — if the same error has been seen before, no new group is opened; the
   counter is incremented instead.
2. **Vector similarity (embedding)** — even if the fingerprint doesn't match, if there's
   an error that's *semantically* similar, it falls into the same group (errors that are
   worded differently but share the same root cause are merged).
3. If neither applies, a **new group** is opened; the source code is fetched (if
   available), and the LLM generates a **title/summary/severity**. This step only runs
   for new groups (keeping costs low).

> Deduplication is **per-project**: the same error in different projects becomes separate
> groups.

## Listing, filtering, search
From the top bar:
- **Search** — text search within the title/summary.
- **Severity** — critical / high / medium / low.
- **Source** — mobile / web / service.
- **Status** — open / investigating / resolved / ignored.
- **Sort** — last seen / most frequent / first seen.
- **Pagination** — at the bottom: "N results · page X/Y" + Previous/Next.

## Error details
Clicking a group opens the details on the right:

### Status management (important business rule)
- When you change the status, a **"Is this your final decision?"** confirmation appears.
- **Resolved** and **Ignored** are *final* statuses. Once a record reaches a final status,
  its status is **locked** — only an **admin** can revert it (other roles see it locked 🔒).
- The forward flow (Open → Investigating → Resolved) is open to everyone.

### Assignment
- The **Assignee** dropdown shows that project's **team members**. You assign an error to
  a team member; the assignee receives a **notification**.

### LLM commentary
- The **root-cause summary** generated in your configured language when a new group is
  created.

### Source code
- If a repository (GitHub/Azure) is connected to the project, the file/line from the
  stack trace is fetched from the repo and the **source code snippet** is shown here; use
  "Open source ↗" to go to the repository.

### Notes (comment thread)
- Each note records **who wrote it + the timestamp**.
- You can **add notes** at any time.
- You edit **your own notes** with ✎ and delete them with 🗑. An admin can delete any
  note.

### Recent events & versions
- The first/last seen version and the most recent raw events (platform, version,
  message).

## Sending a test log
Use **+ Test log** in the top right to manually send a sample error and try out the flow.

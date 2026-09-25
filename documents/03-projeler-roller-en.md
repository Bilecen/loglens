# 3. Projects & Roles

## Multi-project logic
LogLens hosts multiple projects within a **single installation**. Each project has its own
**errors, webhooks, and repositories**. Use the **project selector** at the top to switch the
active project — every screen then reflects that project.

- **Dedup is per-project** — the same error is grouped separately in different projects.
- **Visibility is global** — everyone can see all projects. Project membership isn't an access
  wall, it's **staffing/assignment** information (who works on which project).
- A single embedding model serves all projects → no separate setup is needed per project.

## Creating a project (admin)
**Projects** page → **New project**:
- **Name** — a human-readable name (e.g. "Mobile App").
- **Key (slug)** — a URL-safe short identifier (lowercase letters/digits/hyphens). It's
  derived automatically from the name, but can also be edited manually.

## Team assignment
Open a project with **Edit**:
- **Team** — add or remove users from the project. This is the list used as the assignee
  options when assigning an error.
- **Repositories** — link a GitHub/Azure DevOps repository to the project (for source code
  mapping, see [Chapter 4](04-entegrasyonlar-en.md)).

## Roles
There are four roles: **Admin**, **Developer**, **PO/PM**, **Tester**.

| Role | Permissions |
|-----|-------|
| **Admin** | Everything: user/project/repo/settings management, reverting final status |
| **Developer / PO / Tester** | View errors, move status forward, add notes, view own/assigned items |

- Management screens (Projects, Users, Webhooks, Integrations, Settings) are only accessible to **admin**.
- Reverting a final status (resolved/ignored) requires **admin** privileges.

## User management (admin)
**Users** page:
- Create new users (email, name, temporary password, role).
- Change roles, delete users.
- Search by name/email + role filter + pagination.

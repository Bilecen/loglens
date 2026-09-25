# 1. Getting Started

## Logging in
Open the interface (default: `http://localhost:5173`, or your own address if
self-hosted). Sign in with your email and password.

- If there are no users yet on first setup, the screen guides you through creating the
  **first administrator (admin)**.
- Subsequent users are created by the admin from the **Users** page (there is no open
  sign-up).

## Overview of the interface

**Top bar (topbar):**
- **☰** — show/hide the left menu (sidebar).
- **Project selector** — choose the project you're working on. All pages (Errors,
  Overview, Webhooks…) are filtered by the selected project.
- **💬 Team & chat** — presence (available/away/busy) + live chat panel.
- **🔔 Notifications** — notifications for new critical errors / assignments to you.
- **User pill** — your name + avatar. Clicking it opens: **profile editing**, **theme**,
  **design style**, **log out**.

**Left menu (sidebar):**
- **Overview** — counts, event trend chart, source/severity/status distributions.
- **Errors** — the main screen where you manage error groups.
- **Projects** *(admin)* — project, team, and repository management.
- **Users** *(admin)* — accounts and roles.
- **Webhooks** *(admin)* — tokenized URLs that services use to send errors.
- **Integrations** *(admin)* — Coolify/Vector + framework code samples.
- **Settings** *(admin)* — AI provider and keys.

## First steps
1. **Select/create a project** — a "Default Project" is ready on first setup; you can add
   a new one from the Projects page.
2. **Assign your team** — Projects → open the project → add a member.
3. **Connect your services** — Webhooks + Integrations (see [Chapter 4](04-entegrasyonlar-en.md)).
4. **Monitor errors** — the Errors page.

> Visibility is global: everyone can see all projects. Roles and project membership are
> for **assignment/authorization** purposes (see [Chapter 3](03-projeler-roller-en.md)).

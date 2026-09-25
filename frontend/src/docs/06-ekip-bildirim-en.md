# 6. Team, Chat & Notifications

## Team panel (💬)
The **💬** icon in the top bar opens a panel from the right: presence status + live chat.

### Presence (status)
Set your own status with a single click:
- 🟢 **Available**
- 🟡 **Away**
- 🔴 **Busy**

In the **Team** tab, everyone is listed with a colored status dot on their avatar.

**Online / offline:** The status color only shows when the person is **connected (has the app
open)**. Someone who isn't connected is shown **grayed out as "Offline"**. This way you can
tell who is genuinely online at that moment.

### Live chat (real-time)
- The team chats in the **Chat** tab. Messages appear for everyone instantly via **WebSocket**
  (not polling).
- Each message group shows **who wrote it** at the top (not repeated for consecutive messages).
- If the connection drops, it reconnects automatically; a fallback path kicks in briefly while
  disconnected.
- Press Enter to send, Shift+Enter for a new line.

## Notifications (🔔)
The **🔔** icon in the top bar shows the unread count as a badge. Clicking it opens the
notification list.

When notifications are triggered:
- When a new **critical/high** error occurs in a project → sent to **all members** of that project.
- When an error is **assigned to you**.

- Notifications arrive **in real time** (they appear on the badge instantly).
- Clicking a notification marks it **read**; use **"Mark all as read"** to mark them all.
- Your notification history is retained — even if you miss it live, you can find it in the list.

> Note: The mobile app uses the same notification and chat infrastructure (see [Chapter 9](09-api-en.md)).

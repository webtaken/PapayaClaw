# Communication Channels

PapayaClaw connects deployed OpenClaw instances to messaging platforms. Users choose a channel during the deploy wizard — the platform configures the OpenClaw instance automatically via cloud-init.

> Source of truth: [`src/lib/ai-config.ts`](../src/lib/ai-config.ts) (definitions), [`src/lib/cloud-init.ts`](../src/lib/cloud-init.ts) (provisioning)

---

## Supported Channels

| Channel | ID | Status | Configuration |
|---------|-----|--------|--------------|
| **Telegram** | `telegram` | Supported | Bot token + pairing workflow |
| **WhatsApp** | `whatsapp` | Supported | Phone number allowlist |
| **Discord** | `discord` | Planned | — |
| **Slack** | `slack` | Planned | — |

---

## Telegram

### Setup
Users provide a **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather)) during deployment.

### How It Works
The cloud-init script patches the OpenClaw config with:
```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "<token>",
      "dmPolicy": "pairing",
      "groups": { "*": { "requireMention": true } }
    }
  }
}
```

### Pairing Workflow
- DM policy is set to `pairing` — new users must be approved
- The dashboard provides a **Pairing Dialog** (`src/components/dashboard/pairing-dialog.tsx`) that:
  1. Fetches pending pairing requests via SSH (`GET /api/instances/[id]/pairing`)
  2. Lets the instance owner approve requests (`POST /api/instances/[id]/pairing`)
  3. Executes `openclaw telegram approve-pairing <id>` on the VPS

### Group Behavior
- `requireMention: true` — the bot only responds when @mentioned in group chats

---

## WhatsApp

### Setup
Users provide:
- A **Telegram Bot Token** (WhatsApp gateway still uses Telegram bot infrastructure in OpenClaw)
- A **Phone Number** to allowlist

### How It Works
The cloud-init script:
1. Patches the OpenClaw config with a WhatsApp channel:
   ```json
   {
     "channels": {
       "whatsapp": {
         "dmPolicy": "allowlist",
         "allowFrom": ["+1234567890"]
       }
     }
   }
   ```
2. Installs the WhatsApp plugin: `openclaw plugins install @openclaw/whatsapp`

### Managing Phone Numbers
The dashboard allows adding/removing allowlisted numbers after deployment:
- `POST /api/instances/[id]/whatsapp-numbers` — adds a number
- `DELETE /api/instances/[id]/whatsapp-numbers` — removes a number

These execute SSH commands on the VPS to update the OpenClaw config live.

---

## Adding a New Channel

1. Add the channel ID to the `ChannelId` union type in `src/lib/ai-config.ts`
2. Add a `ChannelDef` entry to the `CHANNELS` array
3. Add an icon in `src/lib/ai-config-ui.tsx`
4. Update `generateCloudInit()` in `src/lib/cloud-init.ts` to handle the new channel's config patching
5. Update the deploy wizard in `src/components/dashboard/deploy-dialog.tsx` to collect channel-specific inputs
6. If the channel requires post-deploy management (like WhatsApp's allowlist), add the corresponding API routes and dashboard UI

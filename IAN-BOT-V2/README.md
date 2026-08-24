# IAN BOT V2 🤖

A WhatsApp automation bot built with Node.js and `whatsapp-web.js`.

## Features

- Main command menu
- Ping, status, about and Uganda time
- Group information
- Member and admin lists
- Admin-only `tagall`
- Welcome messages for new group members
- Per-group mute/unmute
- Per-group welcome on/off
- Group rules
- Custom keyword replies
- Persistent JSON settings

## Important

GitHub stores the source code; it does not keep a WhatsApp bot continuously running by itself. The bot needs a compatible Node.js host/server to stay online.

Never commit `.env`, WhatsApp session data, QR codes, verification codes, or other secrets.

## Configuration

Use `.env.example` as a template for your hosting provider's environment variables.

- `BOT_NAME` — bot display name
- `PREFIX` — command prefix, default `!`
- `OWNER_NUMBER` — owner WhatsApp number with country code and no `+`

## Commands

### General

`!menu` `!help` `!ping` `!about` `!time` `!status`

### Group

`!groupinfo` `!members` `!admins` `!tagall [message]` `!rules`

### Admin

`!welcome on/off`

`!mute` / `!unmute`

`!setrules <text>`

`!setreply <keyword> | <reply>`

`!delreply <keyword>`

`!replies`

## Start locally

```bash
npm install
npm start
```

Then scan the displayed WhatsApp QR code from WhatsApp's Linked Devices screen.

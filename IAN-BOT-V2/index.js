require('dotenv').config();
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const PREFIX = process.env.PREFIX || '!';
const BOT_NAME = process.env.BOT_NAME || 'IAN BOT';
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  globalWelcome: true,
  groups: {},
  customReplies: {
    'good morning': '🌅 Good morning! Have a great day!',
    'good night': '🌙 Good night! Sleep well.',
    'who are you': `🤖 I am ${BOT_NAME} V2.`
  }
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return structuredClone(DEFAULT_DATA);
  try {
    return { ...structuredClone(DEFAULT_DATA), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

let data = loadData();
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getGroupSettings(chatId) {
  if (!data.groups[chatId]) {
    data.groups[chatId] = { welcome: data.globalWelcome, muted: false, rules: '' };
    saveData();
  }
  return data.groups[chatId];
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'ian-bot-v2' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

function menu() {
  return `╔════════════════════════════╗
        🤖 *${BOT_NAME} V2*
╚════════════════════════════╝

👋 *GENERAL*
• ${PREFIX}menu
• ${PREFIX}ping
• ${PREFIX}about
• ${PREFIX}time
• ${PREFIX}status

👥 *GROUP*
• ${PREFIX}groupinfo
• ${PREFIX}members
• ${PREFIX}admins
• ${PREFIX}tagall [message]
• ${PREFIX}rules

👑 *ADMIN*
• ${PREFIX}welcome on/off
• ${PREFIX}mute / ${PREFIX}unmute
• ${PREFIX}setrules <text>
• ${PREFIX}setreply <keyword> | <reply>
• ${PREFIX}delreply <keyword>
• ${PREFIX}replies

⚙️ Prefix: *${PREFIX}*`;
}

async function isGroupAdmin(message) {
  const chat = await message.getChat();
  if (!chat.isGroup || !message.author) return false;
  const participant = chat.participants.find(p => p.id._serialized === message.author);
  return Boolean(participant?.isAdmin || participant?.isSuperAdmin);
}

function isOwner(message) {
  if (!OWNER_NUMBER) return false;
  const ids = [message.author, message.from].filter(Boolean);
  return ids.some(id => id === `${OWNER_NUMBER}@c.us`);
}

async function isAdmin(message) {
  return isOwner(message) || await isGroupAdmin(message);
}

function adminOnly() {
  return '⛔ This command is for the group admin/owner only.';
}

client.on('qr', qr => {
  console.log('\n📱 Scan this QR code with WhatsApp → Linked Devices:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => console.log('🔐 WhatsApp authentication successful.'));
client.on('ready', () => console.log(`\n✅ ${BOT_NAME} V2 is ONLINE.`));
client.on('auth_failure', msg => console.error('❌ Authentication failed:', msg));
client.on('disconnected', reason => console.log('⚠️ Disconnected:', reason));

client.on('group_join', async notification => {
  try {
    const chat = await notification.getChat();
    const settings = getGroupSettings(chat.id._serialized);
    if (!settings.welcome) return;

    const contacts = [];
    for (const id of notification.recipientIds || []) {
      try { contacts.push(await client.getContactById(id)); } catch {}
    }
    if (!contacts.length) return;

    const mentions = contacts.map(c => `@${c.number}`).join(' ');
    await chat.sendMessage(
      `👋 Welcome to *${chat.name}*, ${mentions}!\n\n🤖 I am *${BOT_NAME} V2*. Type *${PREFIX}menu* to see my commands.`,
      { mentions: contacts }
    );
  } catch (err) {
    console.error('Welcome error:', err.message);
  }
});

client.on('message', async message => {
  try {
    if (message.fromMe) return;

    const chat = await message.getChat();
    const lower = message.body.trim().toLowerCase();
    const isGroup = chat.isGroup;
    const settings = isGroup ? getGroupSettings(chat.id._serialized) : null;

    if (!message.body.startsWith(PREFIX)) {
      if (!isGroup || !settings.muted) {
        const reply = data.customReplies[lower];
        if (reply) await message.reply(reply);
      }
      return;
    }

    if (isGroup && settings.muted && !(await isAdmin(message))) return;

    const parts = message.body.slice(PREFIX.length).trim().split(/\s+/);
    const command = (parts.shift() || '').toLowerCase();
    const args = parts;

    if (command === 'menu' || command === 'help') return message.reply(menu());

    if (command === 'ping') return message.reply('🏓 *PONG!* IAN BOT V2 is working.');

    if (command === 'about') return message.reply(`🤖 *${BOT_NAME} V2*\n\nWhatsApp group/personal assistant bot.\nStatus: 🟢 Online`);

    if (command === 'time') {
      const time = new Date().toLocaleString('en-UG', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'medium' });
      return message.reply(`🕐 *Uganda time:* ${time}`);
    }

    if (command === 'status') {
      return message.reply(`📊 *STATUS*\n🟢 Online\n👋 Welcome: ${isGroup ? (settings.welcome ? 'ON' : 'OFF') : 'N/A'}\n🔇 Muted: ${isGroup ? (settings.muted ? 'ON' : 'OFF') : 'N/A'}\n💬 Custom replies: ${Object.keys(data.customReplies).length}`);
    }

    if (!isGroup && ['groupinfo', 'members', 'admins', 'tagall', 'rules', 'welcome', 'mute', 'unmute', 'setrules'].includes(command)) {
      return message.reply('❌ That command only works inside a WhatsApp group.');
    }

    if (command === 'groupinfo') {
      return message.reply(`👥 *GROUP INFO*\n\n📛 Name: ${chat.name}\n👤 Members: ${chat.participants.length}\n👑 Admins: ${chat.participants.filter(p => p.isAdmin || p.isSuperAdmin).length}`);
    }

    if (command === 'members') {
      const contacts = [];
      for (const p of chat.participants) {
        try { contacts.push(await client.getContactById(p.id._serialized)); } catch {}
      }
      const text = contacts.map((c, i) => `${i + 1}. @${c.number}`).join('\n');
      return chat.sendMessage(`👥 *GROUP MEMBERS*\n\n${text}`, { mentions: contacts });
    }

    if (command === 'admins') {
      const admins = chat.participants.filter(p => p.isAdmin || p.isSuperAdmin);
      const contacts = [];
      for (const p of admins) {
        try { contacts.push(await client.getContactById(p.id._serialized)); } catch {}
      }
      const text = contacts.map((c, i) => `${i + 1}. @${c.number}`).join('\n');
      return chat.sendMessage(`👑 *GROUP ADMINS*\n\n${text}`, { mentions: contacts });
    }

    if (command === 'rules') {
      return message.reply(settings.rules ? `📜 *GROUP RULES*\n\n${settings.rules}` : '📜 No group rules have been set yet.');
    }

    if (command === 'tagall') {
      if (!(await isAdmin(message))) return message.reply(adminOnly());
      const contacts = [];
      for (const p of chat.participants) {
        try { contacts.push(await client.getContactById(p.id._serialized)); } catch {}
      }
      const intro = args.join(' ') || '📢 Attention everyone!';
      const mentions = contacts.map(c => `@${c.number}`).join(' ');
      return chat.sendMessage(`${intro}\n\n${mentions}`, { mentions: contacts });
    }

    if (['welcome', 'mute', 'unmute', 'setrules', 'setreply', 'delreply'].includes(command)) {
      if (!(await isAdmin(message))) return message.reply(adminOnly());
    }

    if (command === 'welcome') {
      const option = (args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(option)) return message.reply(`Usage: ${PREFIX}welcome on\n${PREFIX}welcome off`);
      settings.welcome = option === 'on';
      saveData();
      return message.reply(`👋 Welcome messages are now *${option.toUpperCase()}*.`);
    }

    if (command === 'mute') {
      settings.muted = true;
      saveData();
      return message.reply('🔇 Bot replies are now muted in this group. Admin commands still work.');
    }

    if (command === 'unmute') {
      settings.muted = false;
      saveData();
      return message.reply('🔊 Bot replies are active again.');
    }

    if (command === 'setrules') {
      const rules = args.join(' ').trim();
      if (!rules) return message.reply(`Usage: ${PREFIX}setrules Be respectful. No spam.`);
      settings.rules = rules;
      saveData();
      return message.reply('✅ Group rules updated.');
    }

    if (command === 'setreply') {
      const raw = args.join(' ');
      const split = raw.split('|');
      if (split.length < 2) return message.reply(`Usage: ${PREFIX}setreply keyword | reply text`);
      const keyword = split.shift().trim().toLowerCase();
      const reply = split.join('|').trim();
      if (!keyword || !reply) return message.reply(`Usage: ${PREFIX}setreply keyword | reply text`);
      data.customReplies[keyword] = reply;
      saveData();
      return message.reply(`✅ Custom reply saved for: *${keyword}*`);
    }

    if (command === 'delreply') {
      const keyword = args.join(' ').trim().toLowerCase();
      if (!keyword) return message.reply(`Usage: ${PREFIX}delreply keyword`);
      if (!data.customReplies[keyword]) return message.reply('❌ That custom reply does not exist.');
      delete data.customReplies[keyword];
      saveData();
      return message.reply(`🗑️ Deleted custom reply: *${keyword}*`);
    }

    if (command === 'replies') {
      const keys = Object.keys(data.customReplies);
      return message.reply(`💬 *CUSTOM REPLIES*\n\n${keys.length ? keys.map((k, i) => `${i + 1}. ${k}`).join('\n') : 'None'}`);
    }

    return message.reply(`❓ Unknown command: *${command}*\nType *${PREFIX}menu* for help.`);
  } catch (err) {
    console.error('BOT ERROR:', err);
  }
});

process.on('SIGINT', async () => {
  console.log('\nStopping IAN BOT V2...');
  await client.destroy();
  process.exit(0);
});

client.initialize();

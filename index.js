
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");

// ================= CONFIG =================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error("Isi DISCORD_TOKEN, CLIENT_ID, dan GUILD_ID di Environment Variables!");
}

const DB_FILE = "./data.json";

let db = {
  adminRole: null,
  employeeRole: null,
  attendanceChannel: null,
  employees: {},
  attendance: [],
  requests: [],
  warnings: []
};

if (fs.existsSync(DB_FILE)) {
  try {
    db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
  } catch (error) {
    console.error("Gagal membaca data.json:", error);
  }
}

function save() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta"
  }).format(new Date());
}

function now() {
  return new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "short",
    timeStyle: "medium"
  });
}

function isAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    (db.adminRole && interaction.member.roles.cache.has(db.adminRole))
  );
}

function isEmployee(interaction) {
  return !db.employeeRole ||
    interaction.member.roles.cache.has(db.employeeRole);
}

function getRecords(userId) {
  return db.attendance.filter(x => x.userId === userId);
}

function embed(title, description, color = 0x3498db) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Sistem Absensi Bengkel" })
    .setTimestamp();
}

// ================= COMMANDS =================

const commands = [

  new SlashCommandBuilder()
    .setName("absen")
    .setDescription("Absen masuk kerja"),

  new SlashCommandBuilder()
    .setName("pulang")
    .setDescription("Absen pulang kerja"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Cek status absensi"),

  new SlashCommandBuilder()
    .setName("izin")
    .setDescription("Mengajukan izin")
    .addStringOption(o =>
      o.setName("alasan").setDescription("Alasan izin").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("sakit")
    .setDescription("Mengajukan izin sakit")
    .addStringOption(o =>
      o.setName("alasan").setDescription("Keterangan sakit").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("riwayat")
    .setDescription("Melihat riwayat absensi")
    .addUserOption(o =>
      o.setName("anggota").setDescription("Pilih karyawan")
    ),

  new SlashCommandBuilder()
    .setName("rekap")
    .setDescription("Rekap absensi karyawan"),

  new SlashCommandBuilder()
    .setName("hadir")
    .setDescription("Daftar karyawan yang hadir"),

  new SlashCommandBuilder()
    .setName("belum-absen")
    .setDescription("Daftar karyawan belum absen"),

  new SlashCommandBuilder()
    .setName("set-admin")
    .setDescription("Mengatur role admin")
    .addRoleOption(o =>
      o.setName("role").setDescription("Role admin").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("set-role")
    .setDescription("Mengatur role karyawan")
    .addRoleOption(o =>
      o.setName("role").setDescription("Role karyawan").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("set-channel")
    .setDescription("Mengatur channel laporan absensi")
    .addChannelOption(o =>
      o.setName("channel").setDescription("Channel laporan").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("approve")
    .setDescription("Menyetujui permohonan izin")
    .addIntegerOption(o =>
      o.setName("id").setDescription("ID permohonan").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("reject")
    .setDescription("Menolak permohonan izin")
    .addIntegerOption(o =>
      o.setName("id").setDescription("ID permohonan").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("alasan").setDescription("Alasan penolakan").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warning")
    .setDescription("Memberikan warning karyawan")
    .addUserOption(o =>
      o.setName("anggota").setDescription("Karyawan").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("alasan").setDescription("Alasan warning").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("hapus-warning")
    .setDescription("Menghapus warning")
    .addIntegerOption(o =>
      o.setName("id").setDescription("ID warning").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("profil")
    .setDescription("Melihat profil karyawan")
    .addUserOption(o =>
      o.setName("anggota").setDescription("Karyawan")
    ),

  new SlashCommandBuilder()
    .setName("daftar-karyawan")
    .setDescription("Melihat daftar karyawan"),

  new SlashCommandBuilder()
    .setName("bantuan")
    .setDescription("Daftar perintah bot")
].map(c => c.toJSON());

// ================= CLIENT =================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= REGISTER =================

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("Slash commands berhasil didaftarkan!");
}

// ================= READY =================

client.once("ready", () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

// ================= INTERACTION =================

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = interaction.commandName;
  const user = interaction.user;
  const userId = user.id;

  try {

    // BANTUAN
    if (cmd === "bantuan") {
      return interaction.reply({
        embeds: [embed("DAFTAR COMMAND", `
**ABSENSI**
/absen
/pulang
/status
/riwayat
/hadir
/belum-absen

**IZIN**
/izin
/sakit
/approve
/reject

**ADMIN**
/set-admin
/set-role
/set-channel
/rekap
/warning
/hapus-warning
/profil
/daftar-karyawan

**LAINNYA**
/bantuan
        `)],
        ephemeral: true
      });
    }

    // ADMIN COMMAND PROTECTION
    const adminCommands = [
      "set-admin", "set-role", "set-channel",
      "rekap", "hadir", "belum-absen",
      "approve", "reject", "warning",
      "hapus-warning", "daftar-karyawan"
    ];

    if (adminCommands.includes(cmd) && !isAdmin(interaction)) {
      return interaction.reply({
        content: "Kamu tidak memiliki izin admin!",
        ephemeral: true
      });
    }

    // ABSEN MASUK
    if (cmd === "absen") {
      if (!isEmployee(interaction)) {
        return interaction.reply({
          content: "Kamu bukan anggota role karyawan!",
          ephemeral: true
        });
      }

      const exists = db.attendance.find(x =>
        x.userId === userId &&
        x.date === today() &&
        x.type === "masuk"
      );

      if (exists) {
        return interaction.reply({
          content: "Kamu sudah melakukan absen masuk hari ini!",
          ephemeral: true
        });
      }

      db.attendance.push({
        userId,
        date: today(),
        time: now(),
        type: "masuk"
      });

      save();

      const e = embed(
        "ABSENSI MASUK",
        `Karyawan: ${user}\nTanggal: ${today()}\nWaktu: ${now()}\nStatus: HADIR`,
        0x2ecc71
      );

      await interaction.reply({ embeds: [e] });

      if (db.attendanceChannel) {
        const channel = interaction.guild.channels.cache.get(db.attendanceChannel);
        if (channel) await channel.send({ embeds: [e] });
      }
    }

    // ABSEN PULANG
    else if (cmd === "pulang") {
      const record = db.attendance.find(x =>
        x.userId === userId &&
        x.date === today() &&
        x.type === "masuk"
      );

      if (!record) {
        return interaction.reply({
          content: "Kamu belum melakukan absen masuk!",
          ephemeral: true
        });
      }

      if (db.attendance.some(x =>
        x.userId === userId &&
        x.date === today() &&
        x.type === "pulang"
      )) {
        return interaction.reply({
          content: "Kamu sudah absen pulang!",
          ephemeral: true
        });
      }

      db.attendance.push({
        userId,
        date: today(),
        time: now(),
        type: "pulang"
      });

      save();

      return interaction.reply({
        embeds: [embed(
          "ABSENSI PULANG",
          `Karyawan: ${user}\nTanggal: ${today()}\nWaktu: ${now()}\nStatus: SELESAI`,
          0x2ecc71
        )]
      });
    }

    // STATUS
    else if (cmd === "status") {
      const records = getRecords(userId).filter(x => x.date === today());

      const masuk = records.find(x => x.type === "masuk");
      const pulang = records.find(x => x.type === "pulang");

      return interaction.reply({
        embeds: [embed("STATUS ABSENSI",
          `Karyawan: ${user}\nTanggal: ${today()}\nMasuk: ${masuk?.time || "Belum absen"}\nPulang: ${pulang?.time || "Belum pulang"}`
        )],
        ephemeral: true
      });
    }

    // IZIN DAN SAKIT
    else if (cmd === "izin" || cmd === "sakit") {
      const reason = interaction.options.getString("alasan");

      const id = db.requests.length
        ? Math.max(...db.requests.map(x => x.id)) + 1
        : 1;

      db.requests.push({
        id,
        userId,
        type: cmd,
        reason,
        date: today(),
        status: "pending"
      });

      save();

      return interaction.reply({
        embeds: [embed(
          "PERMOHONAN DITERIMA",
          `ID: #${id}\nJenis: ${cmd.toUpperCase()}\nAlasan: ${reason}\nStatus: MENUNGGU PERSETUJUAN`,
          0xf1c40f
        )],
        ephemeral: true
      });
    }

    // APPROVE
    else if (cmd === "approve" || cmd === "reject") {
      const id = interaction.options.getInteger("id");
      const request = db.requests.find(x => x.id === id);

      if (!request || request.status !== "pending") {
        return interaction.reply({
          content: "Permohonan tidak ditemukan atau sudah diproses.",
          ephemeral: true
        });
      }

      request.status = cmd === "approve" ? "approved" : "rejected";
      request.processedBy = userId;

      if (cmd === "reject") {
        request.rejectReason = interaction.options.getString("alasan");
      }

      save();

      return interaction.reply({
        embeds: [embed(
          "HASIL PERMOHONAN",
          `ID: #${id}\nKaryawan: <@${request.userId}>\nStatus: ${request.status.toUpperCase()}\n${request.rejectReason ? "Alasan: " + request.rejectReason : ""}`,
          cmd === "approve" ? 0x2ecc71 : 0xe74c3c
        )]
      });
    }

    // RIWAYAT
    else if (cmd === "riwayat") {
      const target = interaction.options.getUser("anggota") || user;

      if (target.id !== userId && !isAdmin(interaction)) {
        return interaction.reply({
          content: "Kamu hanya bisa melihat riwayat sendiri.",
          ephemeral: true
        });
      }

      const records = getRecords(target.id).slice(-15);

      const description = records.length
        ? records.map(x =>
          `**${x.date}** | ${x.type.toUpperCase()} | ${x.time}`
        ).join("\n")
        : "Belum ada riwayat.";

      return interaction.reply({
        embeds: [embed(`RIWAYAT ${target.username}`, description)],
        ephemeral: true
      });
    }

    // REKAP
    else if (cmd === "rekap") {
      const date = today();
      const records = db.attendance.filter(x => x.date === date);

      const masuk = records.filter(x => x.type === "masuk");
      const pulang = records.filter(x => x.type === "pulang");

      return interaction.reply({
        embeds: [embed(
          "REKAP ABSENSI HARI INI",
          `Tanggal: ${date}\nJumlah absen masuk: ${masuk.length}\nJumlah absen pulang: ${pulang.length}\nBelum pulang: ${masuk.filter(x => !pulang.some(p => p.userId === x.userId)).length}`
        )]
      });
    }

    // DAFTAR HADIR
    else if (cmd === "hadir") {
      const records = db.attendance.filter(x =>
        x.date === today() && x.type === "masuk"
      );

      const list = [...new Set(records.map(x => x.userId))];

      return interaction.reply({
        embeds: [embed(
          "KARYAWAN HADIR",
          list.length
            ? list.map((id, i) => `${i + 1}. <@${id}>`).join("\n")
            : "Belum ada karyawan hadir."
        )]
      });
    }

    // BELUM ABSEN
    else if (cmd === "belum-absen") {
      await interaction.guild.members.fetch();

      const employees = interaction.guild.members.cache.filter(m =>
        !m.user.bot &&
        (!db.employeeRole || m.roles.cache.has(db.employeeRole))
      );

      const absent = employees.filter(m =>
        !db.attendance.some(x =>
          x.userId === m.id &&
          x.date === today() &&
          x.type === "masuk"
        )
      );

      return interaction.reply({
        embeds: [embed(
          "BELUM ABSEN",
          absent.size
            ? absent.map((m, i) => `${i + 1}. ${m.user.tag}`).join("\n")
            : "Semua karyawan sudah absen."
        )]
      });
    }

    // SET ADMIN
    else if (cmd === "set-admin") {
      db.adminRole = interaction.options.getRole("role").id;
      save();

      return interaction.reply({
        content: "Role admin berhasil diatur!"
      });
    }

    // SET ROLE KARYAWAN
    else if (cmd === "set-role") {
      db.employeeRole = interaction.options.getRole("role").id;
      save();

      return interaction.reply({
        content: "Role karyawan berhasil diatur!"
      });
    }

    // SET CHANNEL
    else if (cmd === "set-channel") {
      db.attendanceChannel = interaction.options.getChannel("channel").id;
      save();

      return interaction.reply({
        content: "Channel laporan berhasil diatur!"
      });
    }

    // WARNING
    else if (cmd === "warning") {
      const target = interaction.options.getUser("anggota");
      const reason = interaction.options.getString("alasan");

      const id = db.warnings.length
        ? Math.max(...db.warnings.map(x => x.id)) + 1
        : 1;

      db.warnings.push({
        id,
        userId: target.id,
        reason,
        date: today(),
        givenBy: userId
      });

      save();

      return interaction.reply({
        embeds: [embed(
          "WARNING KARYAWAN",
          `ID Warning: #${id}\nKaryawan: ${target}\nAlasan: ${reason}\nDiberikan oleh: ${user}`,
          0xe74c3c
        )]
      });
    }

    // HAPUS WARNING
    else if (cmd === "hapus-warning") {
      const id = interaction.options.getInteger("id");
      const index = db.warnings.findIndex(x => x.id === id);

      if (index === -1) {
        return interaction.reply({
          content: "Warning tidak ditemukan.",
          ephemeral: true
        });
      }

      db.warnings.splice(index, 1);
      save();

      return interaction.reply({
        content: `Warning #${id} berhasil dihapus.`
      });
    }

    // PROFIL
    else if (cmd === "profil") {
      const target = interaction.options.getUser("anggota") || user;

      if (target.id !== userId && !isAdmin(interaction)) {
        return interaction.reply({
          content: "Kamu tidak memiliki izin melihat profil karyawan lain.",
          ephemeral: true
        });
      }

      const records = getRecords(target.id);
      const warnings = db.warnings.filter(x => x.userId === target.id);

      return interaction.reply({
        embeds: [embed(
          `PROFIL ${target.username}`,
          `Nama: ${target}\nTotal absensi masuk: ${records.filter(x => x.type === "masuk").length}\nTotal absensi pulang: ${records.filter(x => x.type === "pulang").length}\nTotal warning: ${warnings.length}\nTanggal bergabung server: ${interaction.guild.members.cache.get(target.id)?.joinedAt?.toLocaleDateString("id-ID") || "-"}`
        )]
      });
    }

    // DAFTAR KARYAWAN
    else if (cmd === "daftar-karyawan") {
      await interaction.guild.members.fetch();

      const employees = interaction.guild.members.cache.filter(m =>
        !m.user.bot &&
        (!db.employeeRole || m.roles.cache.has(db.employeeRole))
      );

      return interaction.reply({
        embeds: [embed(
          "DAFTAR KARYAWAN",
          employees.size
            ? employees.map((m, i) => `${i + 1}. ${m.user.tag}`).join("\n")
            : "Belum ada karyawan terdaftar."
        )]
      });
    }

  } catch (error) {
    console.error(error);

    const message = {
      content: "Terjadi kesalahan saat menjalankan perintah.",
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(message).catch(() => {});
    } else {
      await interaction.reply(message).catch(() => {});
    }
  }
});

// ================= START BOT =================

async function start() {
  await registerCommands();
  await client.login(TOKEN);
}

start().catch(console.error);
  

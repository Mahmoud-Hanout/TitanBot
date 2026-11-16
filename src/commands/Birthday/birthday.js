import { SlashCommandBuilder, MessageFlags, ChannelType, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import {
  getGuildBirthdays,
  setBirthday as dbSetBirthday,
  deleteBirthday as dbDeleteBirthday,
  getMonthName,
  getBirthdayTrackingKey
} from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// ==========================================
// 1. دوال الخدمة والتحقق (Service Functions)
// ==========================================

export function validateBirthday(year, month, day) {
  if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') {
    return { isValid: false, error: '.لازم تدخل أرقام' };
  }
  if (year < 1900 || year > 2024) {
    return { isValid: false, error: '.لازم السنة تبقى مبين 1900 ل 2024' };
  }
  if (month < 1 || month > 12) {
    return { isValid: false, error: '.لازم الشهر يبقى مبين 1 ل 12' };
  }
  if (day < 1 || day > 31) {
    return { isValid: false, error: '.لازم اليوم يبقى مبين 1 ل 31' };
  }

  const currentYear = new Date().getFullYear();
  const date = new Date(currentYear, month - 1, day);
  if (isNaN(date.getTime()) || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return {
      isValid: false,
      error: 'Invalid date. Please check the month and day combination (e.g., February 29th only exists in leap years)'
    };
  }

  return { isValid: true };
}

export async function setBirthday(client, guildId, userId, year, month, day) {
  const validation = validateBirthday(year, month, day);
  if (!validation.isValid) {
    throw new TitanBotError(validation.error, ErrorTypes.VALIDATION, validation.error, { year, month, day, userId, guildId });
  }

  const success = await dbSetBirthday(client, guildId, userId, year, month, day);
  if (!success) {
    throw new TitanBotError(
      'Failed to save birthday to database',
      ErrorTypes.DATABASE,
      'Failed to set your birthday. Please try again later.',
      { userId, guildId, year, month, day }
    );
  }

  return {
    data: { year, month, day, monthName: getMonthName(month) }
  };
}

export async function getUserBirthday(client, guildId, userId) {
  const birthdays = await getGuildBirthdays(client, guildId);
  const birthdayData = birthdays[userId];
  if (!birthdayData) return null;

  return {
    year: birthdayData.year,
    month: birthdayData.month,
    day: birthdayData.day,
    monthName: getMonthName(birthdayData.month)
  };
}

export async function getAllBirthdays(client, guildId) {
  const birthdays = await getGuildBirthdays(client, guildId);
  if (!birthdays || Object.keys(birthdays).length === 0) return [];

  return Object.entries(birthdays)
    .map(([userId, data]) => ({
      userId,
      year: data.year,
      month: data.month,
      day: data.day,
      monthName: getMonthName(data.month)
    }))
    .sort((a, b) => (a.month !== b.month ? a.month - b.month : a.day - b.day));
}

export async function deleteBirthday(client, guildId, userId) {
  const birthday = await getUserBirthday(client, guildId, userId);
  if (!birthday) return { status: 'not_found' };

  const success = await dbDeleteBirthday(client, guildId, userId);
  if (!success) {
    throw new TitanBotError(
      'Failed to delete birthday from database',
      ErrorTypes.DATABASE,
      'Failed to remove your birthday. Please try again.',
      { userId, guildId }
    );
  }

  return { status: 'removed' };
}

export async function getUpcomingBirthdays(client, guildId, limit = 5) {
  const birthdays = await getGuildBirthdays(client, guildId);
  if (!birthdays || Object.keys(birthdays).length === 0) return [];

  const today = new Date();
  const currentYear = today.getFullYear();
  const upcomingBirthdays = [];

  for (const [userId, userData] of Object.entries(birthdays)) {
    let nextBirthday = new Date(currentYear, userData.month - 1, userData.day);
    if (nextBirthday < today) {
      nextBirthday = new Date(currentYear + 1, userData.month - 1, userData.day);
    }
    const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));

    upcomingBirthdays.push({
      userId,
      year: userData.year,
      month: userData.month,
      day: userData.day,
      monthName: getMonthName(userData.month),
      date: nextBirthday,
      daysUntil
    });
  }

  upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);
  return upcomingBirthdays.slice(0, limit);
}

// ==========================================
// 2. دالة الفحص التلقائي اليومي (Cron Job)
// ==========================================

export async function checkBirthdays(client) {
  const BIRTHDAY_CHANNEL_ID = "1568707434464415794";
  const BIRTHDAY_ROLE_ID = "1571810735267254274";

  const today = new Date();
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();

  // حساب تاريخ بعد 10 أيام للعد التنازلي
  const tenDaysFromNow = new Date(today);
  tenDaysFromNow.setUTCDate(today.getUTCDate() + 10);
  const countdownMonth = tenDaysFromNow.getUTCMonth() + 1;
  const countdownDay = tenDaysFromNow.getUTCDate();

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const config = await getGuildConfig(client, guildId);
      const birthdayChannelId = BIRTHDAY_CHANNEL_ID || config.birthdayChannelId;
      const birthdayRoleId = BIRTHDAY_ROLE_ID || config.birthdayRoleId;

      if (!birthdayChannelId) continue;

      const channel = await guild.channels.fetch(birthdayChannelId).catch(() => null);
      if (!channel) continue;

      const trackingKey = getBirthdayTrackingKey(guildId);
      const trackingData = (await client.db.get(trackingKey)) || {};
      const updatedTrackingData = { ...trackingData };

      for (const userId of Object.keys(trackingData)) {
        try {
          if (birthdayRoleId) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.has(birthdayRoleId)) {
              await member.roles.remove(birthdayRoleId, 'Birthday role expired');
            }
          }
          delete updatedTrackingData[userId];
        } catch (error) {
          logger.error(`Error removing birthday role from ${userId}:`, error);
        }
      }

      if (Object.keys(updatedTrackingData).length !== Object.keys(trackingData).length) {
        await client.db.set(trackingKey, updatedTrackingData);
      }

      const birthdays = (await getGuildBirthdays(client, guildId)) || {};
      const birthdayMembers = [];
      const countdownMembers = [];

      for (const [userId, userData] of Object.entries(birthdays)) {
        // 1. فحص أعياد ميلاد اليوم
        if (userData.month === currentMonth && userData.day === currentDay) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            birthdayMembers.push(member);
            if (birthdayRoleId) {
              try {
                await member.roles.add(birthdayRoleId, 'Happy Birthday! 🎉');
                updatedTrackingData[userId] = true;
              } catch (error) {
                logger.error(`Error adding birthday role to ${member.user.tag}:`, error);
              }
            }
          }
        }

        // 2. فحص أعياد الميلاد اللي فاضل عليها 10 أيام
        if (userData.month === countdownMonth && userData.day === countdownDay) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            countdownMembers.push(member);
          }
        }
      }

      // إرسال رسالة العد التنازلي (قبل عيد الميلاد بـ 10 أيام)
      if (countdownMembers.length > 0) {
        const countdownMentions = countdownMembers.map(m => m.toString()).join(' و ');

        await channel.send({
          embeds: [{
            title: 'فاضــل 10 أيــام',
            description: `أنهارده بدأ العد التنازلي لعيد ميلاد الفحل ${countdownMentions}. \n كل حبايبه يجهزولو من دلوقتي، فاضل 10 أيام على الذكرى السنوية للحظة اللي انولد فيها.`,
            color: 0xffa500,
            thumbnail: { url: countdownMembers[0].user.displayAvatarURL({ extension: 'png', size: 512 }) },
            image: { url: 'https://cdn.discordapp.com/attachments/882077635902079076/1571820973227909140/image_c55ec6f2.jpg?ex=6afc1fdb&is=6aface5b&hm=0233a33da6b2204255413f329eb216798209d734111f3500548716417f7ddb22&' },
            footer: { text: 'Birthday Bot' },
            timestamp: new Date()
          }]
        });
      }

      // إرسال رسالة التهنئة الأساسية (يوم عيد الميلاد)
      if (birthdayMembers.length > 0) {
        await client.db.set(trackingKey, updatedTrackingData);
        const mentionList = birthdayMembers.map(m => m.toString()).join(' و ');

        await channel.send({
          embeds: [{
            title: 'كـــل سنــــة وأنت طـــيب',
            description: `أنهارده عيد ميلاد الفحل ${mentionList}. \n عايزين كلنا نقوله كل سنة و أنت بخير و طيب يا فحل و يارب تحقق كل اللي نفسك فيه.`,
            color: 0xff69b4,
            thumbnail: { url: birthdayMembers[0].user.displayAvatarURL({ extension: 'png', size: 512 }) },
            image: { url: 'https://media.discordapp.net/attachments/882077635902079076/1571824534171025508/image_6bf600c7.jpg?ex=6afc232c&is=6afad1ac&hm=498cbe557f277bd2c3aa69f1e770edb8aba35c773512effc94b15b08219ae980&format=webp' },
            footer: { text: 'Birthday Bot' },
            timestamp: new Date()
          }]
        });
      }
    } catch (error) {
      logger.error(`Error processing birthdays for guild ${guildId}:`, error);
    }
  }
}

// ==========================================
// 3. أوامر السلاش الموحدة (Slash Commands)
// ==========================================
export default {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Birthday system commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('.لتجربة شكل رسالة الأحتفال بعيد ميلاد  الشخص أو العد التنازلي قبل ما تتبعت في السيرفر')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('.اختار الرسالة اللي عايز تعملها معاينة')
            .setRequired(true)
            .addChoices(
              { name: '.رسالة يوم عيد الميلاد', value: 'birthday' },
              { name: '.رسالة العد التنازلي (قبل 10 أيام)', value: 'countdown' },
              { name: '.الاتنين مع بعض', value: 'both' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('.لتسجيل تاريخ ميلادك في السيرفر')
        .addIntegerOption(option =>
          option
            .setName('year')
            .setDescription('.أكتب سنة ميلادك: ما بين سنة 1900 و سنة 2024')
            .setRequired(true)
            .setMinValue(1900)
            .setMaxValue(2024)
        )
        .addIntegerOption(option =>
          option
            .setName('month')
            .setDescription('.أكتب شهر ميلادك: ما بين شهر 1 و شهر 12')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(12)
        )
        .addIntegerOption(option =>
          option
            .setName('day')
            .setDescription('.أكتب يوم ميلادك: ما بين يوم 1 و يوم 31')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('.علشان تعرف تاريخ ميلادك الشخصي المتسجل في السيرفر او تاريخ ميلاد شخص تاني')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('.اختار الشخص اللي عايز تعرف تاريخ ميلاده المتسجل في السيرفر')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('.علشان تشوف قايمة فيها كل تواريخ الميلاد المسجله في السيرفر مع أسماء أصحابها')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('.علشان تمسح تاريخ ميلادك الشخصي المتسجل في السيرفر او تاريخ ميلاد شخص تاني')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('.اختار الشخص اللي عايز تمسح تاريخ ميلاده المسجل في السيرفر')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('next')
        .setDescription('.علشان تعرف ايه أعياد الميلاد اللي عليهم الدور')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setchannel')
        .setDescription('.علشان تقفل أو تشغل احتفالات أعياد الميلاد في السيرفر (لازم تكون مسؤل في السيرفر)')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('.أختار المكان اللي هيتم فيه كتابة بوست احتفال الأعياد الميلادية (سيبها فاضية لو عايز تقفلها)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  async execute(interaction, config, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (subcommand === 'set') {
      await InteractionHelper.safeDefer(interaction);
      const year = interaction.options.getInteger('year');
      const month = interaction.options.getInteger('month');
      const day = interaction.options.getInteger('day');

      const result = await setBirthday(client, guildId, interaction.user.id, year, month, day);
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('تم التسجيل')
        .setDescription(`تم تسجيل تاريخ ميلادك بالبيانات الآتيه: **${result.data.year} ${result.data.monthName} ${result.data.day}**!`);

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    if (subcommand === 'info') {
      await InteractionHelper.safeDefer(interaction);
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const birthdayData = await getUserBirthday(client, guildId, targetUser.id);

      if (!birthdayData) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`مفيش تاريخ ميلاد بأسم ${targetUser.displayName}`)
          .setDescription(targetUser.id === interaction.user.id
            ? 'أنت لسه مدخلتش تاريخ ميلادك، استخدم الأمر `birthday set/` و بعدها دخل تاريخ الميلاد.'
            : `مفيش تاريخ ميلاد للفحل **${targetUser.username}** عشان لسه مسجلش تاريخ ميلاده.`);
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('بيانات تاريخ الميلاد:')
        .setDescription(`**تاريخ ميلاد المستخدم:** X ${birthdayData.year} ${birthdayData.monthName} ${birthdayData.day}\n**أسم المستخدم:** ${targetUser.toString()}`);

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    if (subcommand === 'list') {
      await InteractionHelper.safeDefer(interaction);
      const sortedBirthdays = await getAllBirthdays(client, guildId);

      if (sortedBirthdays.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('غير موجود')
          .setDescription(`مفيش تواريخ ميلاد مسجلة في ${interaction.guild.name} في الوقت الحالي.`);
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const userIds = sortedBirthdays.map(b => b.userId);
      const fetchedMembers = await interaction.guild.members.fetch({ user: userIds }).catch(() => null);

      let birthdayList = '';
      let displayIndex = 0;
      const staleUserIds = [];

      for (const birthday of sortedBirthdays) {
        if (fetchedMembers && !fetchedMembers.has(birthday.userId)) {
          staleUserIds.push(birthday.userId);
          continue;
        }
        displayIndex++;
        birthdayList += `${displayIndex}. <@${birthday.userId}> - ${birthday.year} ${birthday.monthName} ${birthday.day}\n`;
      }

      if (fetchedMembers && staleUserIds.length > 0) {
        for (const userId of staleUserIds) {
          dbDeleteBirthday(client, guildId, userId).catch(() => null);
        }
      }

      if (displayIndex === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('غير موجود')
          .setDescription(`مفيش تواريخ ميلاد لان مفيش حد لسه سجل تاريخ ميلادة في ${interaction.guild.name}`);
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      birthdayList = `**ترتيب الأسماء والتواريخ بيتحدد حسب اللي سجل تاريخ ميلاده الأول**\n\n` + birthdayList;
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(`قايمة تواريخ الميلاد في ${interaction.guild.name}:`)
        .setDescription(`${birthdayList}\n\n إجمالي عدد تواريخ الميلاد في ${interaction.guild.name} هو: ${displayIndex}`);

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    if (subcommand === 'remove') {
      await InteractionHelper.safeDefer(interaction);
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const isSelf = targetUser.id === interaction.user.id;

      if (!isSelf && interaction.user.id !== interaction.guild.ownerId) {
        const noPermEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('غير مسموح')
          .setDescription('مينفعش تمسح تاريخ ميلاد شخص تاني غيرك علشان مش معاك الصلاحية اللي تخليك تعمل كدا.');
        return await InteractionHelper.safeEditReply(interaction, { embeds: [noPermEmbed] });
      }

      const result = await deleteBirthday(client, guildId, targetUser.id);
      if (result.status === 'not_found') {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('غير موجود')
          .setDescription(isSelf
            ? 'مش موجود ليك تاريخ ميلاد مسجل اصلا علشان تمسحه.'
            : `مفيش تاريخ ميلاد مسجل بأسم ${targetUser.toString()} اصلا علشان يتمسح.`);
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('تم المسح')
        .setDescription(isSelf
          ? `تم مسح تاريخ ميلادك المسجل في ${interaction.guild.name} بنجاح.`
          : `تم مسح تاريخ ميلاد ${targetUser.toString()} من ${interaction.guild.name} بنجاح.`);

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    if (subcommand === 'next') {
      await InteractionHelper.safeDefer(interaction);
      const next5 = await getUpcomingBirthdays(client, guildId, 5);

      if (next5.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('مفيش أعياد ميلاد جايه')
          .setDescription(`مفيش أعياد ميلاد جايه لأن مفيش تواريخ متسجله في ${interaction.guild.name}`);
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      let birthdayList = `\n\nربنا يديكو و يدينا الصحه و طوله العمر مع حبايبكم\n\n`;
      let displayIndex = 0;

      for (const birthday of next5) {
        const member = await interaction.guild.members.fetch(birthday.userId).catch(() => null);
        if (!member) {
          dbDeleteBirthday(client, guildId, birthday.userId).catch(() => null);
          continue;
        }
        displayIndex++;

        let timeUntil = '';
        if (birthday.daysUntil === 0) {
          timeUntil = '**أنهارده**';
        } else if (birthday.daysUntil === 1) {
          timeUntil = '**بكرا**';
        } else {
          timeUntil = `${birthday.daysUntil} يوم`;
        }

        birthdayList += `رقم ${displayIndex}- ** ${member.user.username} **\n **أسم المستخدم:** <@${birthday.userId}>\n📅 **تاريخ الميلاد:** X ${birthday.year} ${birthday.monthName} ${birthday.day}\n⏰ **فاضل علي عيد ميلاده:** ${timeUntil}\n\n`;
      }

      if (displayIndex === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('No Upcoming Birthdays')
          .setDescription('No upcoming birthdays found for current server members.');
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      birthdayList += `**كل سنة و انتو طيبين و بخير.**`;
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('الخمس أعياد ميلاد الجايين إن شاء الله')
        .setDescription(birthdayList);

      return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }

    if (subcommand === 'setchannel') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('مش معاك صلاحية')
          .setDescription('علشان تقدر تستخدم الأمر دا لازم يكون معاك صلاحية تخليك واحد من المسؤلين.');
        return InteractionHelper.safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      try {
        const channel = interaction.options.getChannel('channel');
        const guildConfig = await getGuildConfig(client, guildId);

        if (channel) {
          guildConfig.birthdayChannelId = channel.id;
          await setGuildConfig(client, guildId, guildConfig);
          const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('احتفال أعياد الميلاد اشتغلت')
            .setDescription(`دلوقتي وقت تاريخ ميلاد أي حد هينرل بوست كأحتفال بعيد ميلاده معانا في الأوضه دي ${channel}.`);
          return InteractionHelper.safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
          guildConfig.birthdayChannelId = null;
          await setGuildConfig(client, guildId, guildConfig);
          const embed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('احتفال أعياد الميلاد اتقفلت')
            .setDescription('مبقاش في مكان لبوست الأحتفال بأعياد الميلاد، شويه و هتتفتح تاني');
          return InteractionHelper.safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
        }
      } catch (error) {
        logger.error('birthday_setchannel error:', error);
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⚠️ Configuration Error')
          .setDescription('Could not save the birthday channel configuration.');
        return InteractionHelper.safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }
        if (subcommand === 'test') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('مش معاك صلاحية')
          .setDescription('الأمر ده للإدارة بس علشان يجربوا شكل الرسالة.');
        return InteractionHelper.safeReply(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      const type = interaction.options.getString('type');
      const previewEmbeds = [];

      if (type === 'countdown' || type === 'both') {
        previewEmbeds.push({
          title: 'فاضــل 10 أيــام',
          description: `أنهارده بدأ العد التنازلي لعيد ميلاد الفحل ${interaction.user}. \n كل حبايبه يجهزولو من دلوقتي، فاضل 10 أيام على الذكرى السنوية للحظة اللي انولد فيها.`,
          color: 0xffa500,
          thumbnail: { url: interaction.user.displayAvatarURL({ extension: 'png', size: 512 }) },
          image: { url: 'https://cdn.discordapp.com/attachments/882077635902079076/1571820973227909140/image_c55ec6f2.jpg?ex=6afc1fdb&is=6aface5b&hm=0233a33da6b2204255413f329eb216798209d734111f3500548716417f7ddb22&' },
          footer: { text: 'Birthday Bot • معاينة تجريبية' },
          timestamp: new Date()
        });
      }

      if (type === 'birthday' || type === 'both') {
        previewEmbeds.push({
          title: 'كـــل سنــــة وأنت طـــيب',
          description: `أنهارده عيد ميلاد الفحل ${interaction.user}. \n عايزين كلنا نقوله كل سنة و أنت طيب يا فحل و يارب تحقق كل اللي بتتمناه.`,
          color: 0xff69b4,
          thumbnail: { url: interaction.user.displayAvatarURL({ extension: 'png', size: 512 }) },
          image: { url: 'https://media.discordapp.net/attachments/882077635902079076/1571824534171025508/image_6bf600c7.jpg?ex=6afc232c&is=6afad1ac&hm=498cbe557f277bd2c3aa69f1e770edb8aba35c773512effc94b15b08219ae980&format=webp' },
          footer: { text: 'Birthday Bot • معاينة تجريبية' },
          timestamp: new Date()
        });
      }

      return await InteractionHelper.safeReply(interaction, {
        content: '**معاينة تجريبية لشكل الرسالة:**',
        embeds: previewEmbeds
      });
    }
    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Unknown subcommand' });
  }
};

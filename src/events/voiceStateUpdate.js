import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { VOICE_LOG_CONFIG } from '../utils/voiceLogConfig.js'; // استيراد ملف الإعدادات الخاص بالفويس
import { logger } from '../utils/logger.js';

export default {
  name: Events.VoiceStateUpdate,
  once: false,

  async execute(oldState, newState) {
    try {
        // تجاهل البوتات تماماً
        if (oldState.member?.user.bot || newState.member?.user.bot) return;

        const guild = newState.guild || oldState.guild;
        const member = newState.member || oldState.member;
        const user = member.user;
        const me = guild.members.me;

        // 🟢 أولاً: حالة دخول روم صوتي جديد تماماً (ترسل إلى روم الدخول)
        if (!oldState.channelId && newState.channelId) {
            const logChannelId = VOICE_LOG_CONFIG.joinLogChannelId;
            if (!logChannelId || logChannelId === "" || logChannelId.includes("ضع_هنا")) return;

            const channel = guild.channels.cache.get(logChannelId);
            if (!channel) return;

            const voiceChannel = newState.channel;
            const embed = new EmbedBuilder()
                .setColor(0x00FF00) // لون أخضر للدخول
                .setTitle('حد دخل يرغي')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `**العضو:** ${user.toString()} \n` +
                    `**اسم المستخدم:** ${user.displayName}\n` +
                    `**الروم الصوتية:** ${voiceChannel ? voiceChannel.toString() : 'روم صوتي'}\n\n` +
                    `⏰ **الوقت:** <t:${Math.floor(Date.now() / 1000)}:F>`
                );

            if (channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                await channel.send({ embeds: [embed] });
            }
        }

        // 🔴 ثانياً: حالة خروج من روم صوتي بالكامل (ترسل إلى روم الخروج)
        else if (oldState.channelId && !newState.channelId) {
            const logChannelId = VOICE_LOG_CONFIG.leaveLogChannelId;
            if (!logChannelId || logChannelId === "" || logChannelId.includes("ضع_هنا")) return;

            const channel = guild.channels.cache.get(logChannelId);
            if (!channel) return;

            const voiceChannel = oldState.channel;
            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // لون أحمر للخروج
                .setTitle('حد اتخنق من الرغي')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `**العضو:** ${user.toString()} \n` +
                    `**اسم المستخدم:** ${user.displayName}\n` +
                    `**الروم التي غادرها:** ${voiceChannel ? voiceChannel.toString() : 'روم صوتي'}\n\n` +
                    `⏰ **الوقت:** <t:${Math.floor(Date.now() / 1000)}:F>`
                );

            if (channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                await channel.send({ embeds: [embed] });
            }
        }

        // 🔀 ثالثاً: حالة الانتقال من روم إلى روم أخرى (ترسل إلى روم الدخول لأنها تعتبر انضمام لروم جديدة)
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const logChannelId = VOICE_LOG_CONFIG.joinLogChannelId;
            if (!logChannelId || logChannelId === "" || logChannelId.includes("ضع_هنا")) return;

            const channel = guild.channels.cache.get(logChannelId);
            if (!channel) return;

            const oldVoiceChannel = oldState.channel;
            const newVoiceChannel = newState.channel;
            const embed = new EmbedBuilder()
                .setColor(0xFFFF00) // لون أصفر للانتقال
                .setTitle('🔀 انتقال بين الرومات الصوتية')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription(
                    `**العضو:** ${user.toString()} \n` +
                    `**اسم المستخدم:** ${user.displayName}\n` +
                    `**من روم:** ${oldVoiceChannel ? oldVoiceChannel.toString() : 'روم قديم'}\n` +
                    `**إلى روم:** ${newVoiceChannel ? newVoiceChannel.toString() : 'روم جديد'}\n\n` +
                    `⏰ **الوقت:** <t:${Math.floor(Date.now() / 1000)}:F>`
                );

            if (channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
                await channel.send({ embeds: [embed] });
            }
        }

    } catch (error) {
        logger.error('Error in voiceStateUpdate event:', error);
    }
  }
};

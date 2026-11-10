import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getColor } from '../config/bot.js';
import { formatWelcomeMessage } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { getServerCounters, updateCounter } from '../services/serverstatsService.js';
import { setBirthday as dbSetBirthday } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { GREET_CONFIG } from '../utils/greetConfig.js'; // <-- استيراد ملف الإعدادات الثابتة

export default {
  name: Events.GuildMemberAdd,
  once: false,
  
  async execute(member) {
    try {
        const { guild, user } = member;
        
        // 🟢 تفعيل الترحيب الثابت من الكود
        const welcomeChannelId = GREET_CONFIG.welcome?.channelId;

        if (welcomeChannelId) {
            const channel = guild.channels.cache.get(welcomeChannelId);
            const me = guild.members.me;
            const permissions = channel?.isTextBased?.() && me ? channel.permissionsFor(me) : null;
            
            if (permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                const formatData = { user, guild, member };
                const welcomeMessage = formatWelcomeMessage(GREET_CONFIG.welcome.message, formatData);
                const messageContent = GREET_CONFIG.welcome.ping ? user.toString() : null;

                const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);

                if (!canEmbed) {
                    await channel.send({
                        content: messageContent ? `${messageContent}\n${welcomeMessage}` : welcomeMessage
                    });
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(getColor('success'))
                        .setTitle('🎉 منور السيرفر!')
                        .setDescription(welcomeMessage)
                        .setThumbnail(user.displayAvatarURL())
                        .addFields(
                            { name: 'العضو', value: `${user.tag} (${user.id})`, inline: true },
                            { name: 'عددنا الآن', value: guild.memberCount.toString(), inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: `Welcome to ${guild.name}!` });
                    
                    if (GREET_CONFIG.welcome.image) {
                        embed.setImage(GREET_CONFIG.welcome.image);
                    }
                    
                    await channel.send({ 
                        content: messageContent,
                        embeds: [embed] 
                    });
                }
            }
        }
        
        // ⚡ تفعيل الأوتو رول الثابت من الكود
        const singleRoleId = GREET_CONFIG.autorole?.roleId;
        if (singleRoleId && singleRoleId !== "" && singleRoleId !== "ضع_هنا_آيدي_الرتبة_بين_العلامتين") {
            const role = guild.roles.cache.get(singleRoleId);
            if (role) {
                try {
                    await member.roles.add(role);
                } catch (roleError) {
                    logger.warn(`Failed to assign auto-role ${singleRoleId}:`, roleError);
                }
            }
        }
        
        // بقية العمليات التلقائية للبوت (اللوق، العدادات، إلخ) تظل تعمل كالمعتاد
        try {
            await logEvent({
                client: member.client,
                guildId: guild.id,
                eventType: EVENT_TYPES.MEMBER_JOIN,
                data: {
                    title: 'User joined',
                    lines: [
                        `**User:** ${user.toString()} (${user.displayName !== user.username ? `@${user.displayName}` : user.tag})`,
                        `**ID:** \`${user.id}\``,
                        `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                        `**Members:** ${guild.memberCount}`,
                    ],
                    quoted: false,
                    thumbnail: user.displayAvatarURL({ dynamic: true }),
                    userId: user.id,
                }
            });
        } catch (error) {
            logger.debug('Error logging member join:', error);
        }

        try {
            const counters = await getServerCounters(member.client, guild.id);
            for (const counter of counters) {
                if (counter && counter.type && counter.channelId && counter.enabled !== false) {
                    await updateCounter(member.client, guild, counter);
                }
            }
        } catch (error) {
            logger.debug('Error updating counters on member join:', error);
        }

        try {
            const backupKey = `guild:${guild.id}:birthdays:left`;
            const backup = (await member.client.db.get(backupKey)) || {};
            if (backup[user.id]) {
                const { month, day } = backup[user.id];
                await dbSetBirthday(member.client, guild.id, user.id, month, day);
                delete backup[user.id];
                await member.client.db.set(backupKey, backup);
            }
        } catch (error) {
            logger.debug('Error restoring birthday on member join:', error);
        }
        
    } catch (error) {
        logger.error('Error in guildMemberAdd event:', error);
    }
  }
};

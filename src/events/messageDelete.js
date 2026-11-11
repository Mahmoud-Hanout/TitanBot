import { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } from 'discord.js';
import { LOG_CONFIG } from '../utils/messageDeleteLog.js'; // <-- تحديث مسار الاستيراد للملف الجديد
import { logger } from '../utils/logger.js';

export default {
  name: Events.MessageDelete,
  once: false,

  async execute(message) {
    try {
        // تجاهل البوتات والرسائل خارج السيرفرات
        if (message.partial || message.author?.bot || !message.guild) return;

        const logChannelId = LOG_CONFIG.deleteLogChannelId;
        if (!logChannelId || logChannelId === "" || logChannelId.includes("ضع_هنا")) return;

        const channel = message.guild.channels.cache.get(logChannelId);
        if (!channel) return;

        const deleteTime = new Date(); // وقت الحذف الحالي

        // انتظار ثانية للتأكد من تسجيل ديسكورد للـ Audit Log
        await new Promise(resolve => setTimeout(resolve, 1000));

        // جلب الـ Audit Logs لمعرفة من حذف الرسالة
        const fetchedLogs = await message.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MessageDelete,
        }).catch(() => null);

        const deletionLog = fetchedLogs?.entries.first();
        let executor = "غير معروف (مسحها بنفسه أو انتهت صلاحية اللوق)";

        if (deletionLog) {
            const { target, executor: userWhoDeleted } = deletionLog;
            if (target.id === message.author.id && (Date.now() - deletionLog.createdTimestamp) < 5000) {
                executor = userWhoDeleted.toString();
            } else {
                executor = message.author.toString();
            }
        } else {
            executor = message.author.toString();
        }

        // تحويل أوقات الإرسال والحذف لتنسيق ديسكورد الزمني بالثواني
        const sendTimestamp = Math.floor(message.createdTimestamp / 1000);
        const deleteTimestamp = Math.floor(deleteTime.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('في رسالة أتمسحت و دي البيانات بتاعتها:)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `**اللي بعت الرسالة:** ${message.author.toString()} \n **المكان اللي اتبعتت فيه الرسالة:** ${message.channel.toString()}\n **اللي مسح الرسالة:** ${executor}\n\n **الوقت اللي اتبعتت فيه الرسالة:** <t:${sendTimestamp}:F> \n (<t:${sendTimestamp}:R>)\n **الوقت اللي اتمسحت فيه الرسالة:** <t:${deleteTimestamp}:F> \n (<t:${deleteTimestamp}:R>)\n\n` +
                `**محتوى الرسالة:**\n\`\`\`${message.content || "(رسالة فارغة أو ميديا فقط)"}\`\`\``
            )
            .setTimestamp();

        // عرض روابط المرفقات أو الصور إذا وجدت
        if (message.attachments.size > 0) {
            const attachmentUrls = message.attachments.map(a => a.url).join('\n');
            embed.addFields({ name: 'المرفقات الممسوحة:', value: attachmentUrls });
        }

        const me = message.guild.members.me;
        if (channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
            await channel.send({ embeds: [embed] });
        }

    } catch (error) {
        logger.error('Error in messageDelete event:', error);
    }
  }
};

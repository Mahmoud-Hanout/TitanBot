import { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } from 'discord.js';
import { LOG_CONFIG } from '../utils/messageDeleteLog.js';
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

        // الانتظار لضمان تسجيل ديسكورد للاسم في الـ Audit Logs
        await new Promise(resolve => setTimeout(resolve, 2500));

        // جلب الـ Audit Logs لمعرفة من حذف الرسالة
        const fetchedLogs = await message.guild.fetchAuditLogs({
            limit: 5,
            type: AuditLogEvent.MessageDelete,
        }).catch(() => null);

        // القيمة الافتراضية: صاحب الرسالة هو من حذفها بنفسه
        let executor = message.author.toString(); 

        if (fetchedLogs && fetchedLogs.entries.size > 0) {
            // ترتيب السجلات من الأحدث للأقدم والبحث عن العملية الصحيحة
            const sortedEntries = [...fetchedLogs.entries.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
            
            const deletionLog = sortedEntries.find(entry => 
                entry.target.id === message.author.id && 
                Math.abs(Date.now() - entry.createdTimestamp) < 8000 // فحص صارم للفارق الزمني (أقل من 8 ثوانٍ)
            );

            if (deletionLog) {
                // إذا وجدنا سجل حذف حقيقي قام به إداري آخر، نأخذ اسمه
                executor = deletionLog.executor.toString();
            }
        }

        // تحويل أوقات الإرسال والحذف لتنسيق ديسكورد الزمني بالثواني
        const sendTimestamp = Math.floor(message.createdTimestamp / 1000);
        const deleteTimestamp = Math.floor(deleteTime.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('في رسالة أتمسحت و دي البيانات بتاعتها:')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `**اللي مسح الرسالة:** ${executor}\n` +
                `**اللي بعت الرسالة:** ${message.author.toString()}\n` +
                `**المكان اللي اتبعتت فيه الرسالة:** ${message.channel.toString()}\n\n` +
                `**الوقت اللي اتبعتت فيه الرسالة:** (<t:${sendTimestamp}:R>)\n<t:${sendTimestamp}:F>\n` +
                `**الوقت اللي اتمسحت فيه الرسالة:** (<t:${deleteTimestamp}:R>)\n<t:${deleteTimestamp}:F>\n\n` +
                `**محتوى الرسالة نفسها:**\n\`\`\`${message.content || "(رسالة فارغة أو ميديا فقط)"}\`\`\``
            )
            .setTimestamp();

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

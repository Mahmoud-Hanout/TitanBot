import { Events } from "discord.js";
import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";
import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";
import { reconcileTicketPanels, reconcileVerificationPanels, reconcileReactionRolePanelHealth } from "../services/panelHealthService.js";
import { initRiffyAfterReady } from "../services/music/riffySetup.js";
import { LEVEL_CONFIG, addXp } from '../commands/Leveling/levelConfig.js';

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      client.user.setPresence(config.bot.presence);

      startupLog(`Ready! Logged in as ${client.user.tag}`);
      startupLog(`Serving ${client.guilds.cache.size} guild(s)`);
      startupLog(`Loaded ${client.commands.size} commands`);

      if (client.config?.features?.music) {
        initRiffyAfterReady(client);
      }

      const reconciliationSummary = await reconcileReactionRoleMessages(client);
      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );

      const ticketPanelSummary = await reconcileTicketPanels(client);
      startupLog(
        `Ticket panel health: scanned ${ticketPanelSummary.scannedGuilds} guilds, healthy ${ticketPanelSummary.healthyPanels}, deleted ${ticketPanelSummary.deletedPanels}, missing channel ${ticketPanelSummary.missingChannels}, recovered ${ticketPanelSummary.recoveredIds}, errors ${ticketPanelSummary.errors}`
      );

      const verificationPanelSummary = await reconcileVerificationPanels(client);
      startupLog(
        `Verification panel health: scanned ${verificationPanelSummary.scannedGuilds} guilds, healthy ${verificationPanelSummary.healthyPanels}, deleted ${verificationPanelSummary.deletedPanels}, missing channel ${verificationPanelSummary.missingChannels}, recovered ${verificationPanelSummary.recoveredIds}, errors ${verificationPanelSummary.errors}`
      );

      const reactionRolePanelSummary = await reconcileReactionRolePanelHealth(client);
      startupLog(
        `Reaction role panel health: scanned ${reactionRolePanelSummary.scannedPanels} panels, healthy ${reactionRolePanelSummary.healthyPanels}, deleted ${reactionRolePanelSummary.deletedPanels}, missing channel ${reactionRolePanelSummary.missingChannels}, recovered ${reactionRolePanelSummary.recoveredIds}, errors ${reactionRolePanelSummary.errors}`
      );

      // 🎙️ نظام منح نقاط الخبرة التلقائي في الرومات الصوتية
      if (LEVEL_CONFIG.enabled && LEVEL_CONFIG.voiceXp?.enabled) {
        const intervalMs = (LEVEL_CONFIG.voiceXp.intervalMinutes || 5) * 60 * 1000;
        const xpToGive = LEVEL_CONFIG.voiceXp.xpAmount || 200;

        setInterval(async () => {
          for (const guild of client.guilds.cache.values()) {
            const voiceChannels = guild.channels.cache.filter(
              (ch) => ch.isVoiceBased() && ch.id !== guild.afkChannelId
            );

            for (const channel of voiceChannels.values()) {
              for (const member of channel.members.values()) {
                if (member.user.bot || member.voice.deaf || member.voice.selfDeaf) continue;
                await addXp(client, guild, member, xpToGive).catch(() => null);
              }
            }
          }
        }, intervalMs);

        startupLog(`🎙️ Voice XP system started: +${xpToGive} XP every ${LEVEL_CONFIG.voiceXp.intervalMinutes} mins`);
      }
    } catch (error) {
      logger.error("Error in ready event:", error);
    }
  },
};

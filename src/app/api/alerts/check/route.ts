import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectAnomalies } from '@/lib/alerts/anomaly-detector';
import { deliverAlert, type AlertChannel } from '@/lib/alerts/delivery';
import { withTiming } from '@/lib/api-timing';

/**
 * POST /api/alerts/check
 *
 * Cron-protected endpoint: runs anomaly detection for all users with active
 * alerts, delivers notifications, and updates alert records.
 */
async function handlePOST(req: NextRequest) {
  // Cron secret protection
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all distinct user IDs that have at least one active alert
  const activeAlerts = await prisma.alert.findMany({
    where: { isActive: true },
    select: {
      id: true,
      userId: true,
      type: true,
      channel: true,
      message: true,
      provider: true,
      user: { select: { email: true } },
    },
  });

  const userIds = [...new Set(activeAlerts.map((a) => a.userId))];

  // Pre-fetch notification preferences for all users with active alerts
  const notifPrefs = await prisma.notificationPreferences.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, alertEmails: true },
  });
  const notifPrefsMap = new Map(notifPrefs.map((p) => [p.userId, p]));

  let anomaliesFound = 0;
  let deliveriesAttempted = 0;
  let deliveriesSucceeded = 0;
  let deliveriesSkipped = 0;

  for (const userId of userIds) {
    try {
      const anomalies = await detectAnomalies(userId);
      anomaliesFound += anomalies.length;

      if (anomalies.length === 0) continue;

      // Match anomalies to user's active alerts by type
      const userAlerts = activeAlerts.filter((a) => a.userId === userId);

      for (const anomaly of anomalies) {
        // Find matching alert configs (SPEND_SPIKE or COST_ANOMALY)
        const matchingAlerts = userAlerts.filter(
          (a) => a.type === anomaly.type || a.type === 'COST_ANOMALY',
        );

        for (const alertConfig of matchingAlerts) {
          // Skip EMAIL delivery if user has opted out of alert emails
          // No prefs record = opted in (backwards compatible)
          if (alertConfig.channel === 'EMAIL') {
            const prefs = notifPrefsMap.get(userId);
            if (prefs && prefs.alertEmails === false) {
              deliveriesSkipped++;
              continue;
            }
          }

          deliveriesAttempted++;

          // Parse webhook/slack URLs from the alert message field
          // Convention: message field may contain JSON metadata at the end
          let webhookUrl: string | undefined;
          let slackWebhookUrl: string | undefined;
          try {
            if (alertConfig.message) {
              const metaMatch = alertConfig.message.match(/\|META:({.*})$/);
              if (metaMatch) {
                const meta = JSON.parse(metaMatch[1]);
                webhookUrl = meta.webhookUrl;
                slackWebhookUrl = meta.slackWebhookUrl;
              }
            }
          } catch {
            // Not JSON metadata — that's fine
          }

          const success = await deliverAlert(
            {
              type: anomaly.type,
              provider: anomaly.provider,
              message: anomaly.message,
              severity: anomaly.severity,
              recipientEmail: alertConfig.user.email,
              webhookUrl,
              slackWebhookUrl,
            },
            alertConfig.channel as AlertChannel,
          );

          if (success) deliveriesSucceeded++;

          // Update the alert record with trigger time and current value
          await prisma.alert.update({
            where: { id: alertConfig.id },
            data: {
              triggeredAt: new Date(),
              currentValue: anomaly.currentValue,
            },
          });
        }
      }
    } catch (err) {
      console.error(`[AlertCheck] Error processing user ${userId}:`, err);
    }
  }

  return NextResponse.json({
    usersChecked: userIds.length,
    anomaliesFound,
    deliveriesAttempted,
    deliveriesSucceeded,
    deliveriesSkipped,
  });
}

export const POST = withTiming(handlePOST);

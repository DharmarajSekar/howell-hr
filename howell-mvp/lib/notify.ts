/**
 * createSystemNotification
 * Fire-and-forget helper to write an internal HR alert to system_notifications.
 * Always non-blocking — never throws.
 */
import { createClient } from '@supabase/supabase-js'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type NotifSeverity = 'info' | 'warning' | 'critical'

export interface SystemNotifPayload {
  type:         string
  title:        string
  message:      string
  severity?:    NotifSeverity
  link?:        string
  entity_id?:   string
  entity_type?: string
}

export async function createSystemNotification(payload: SystemNotifPayload): Promise<void> {
  try {
    await svc().from('system_notifications').insert({
      type:        payload.type,
      title:       payload.title,
      message:     payload.message,
      severity:    payload.severity ?? 'info',
      link:        payload.link        ?? null,
      entity_id:   payload.entity_id   ?? null,
      entity_type: payload.entity_type ?? null,
      is_read:     false,
    })
  } catch (e: any) {
    // Non-fatal — log and continue
    console.error('[notify] system_notification insert failed:', e?.message ?? e)
  }
}

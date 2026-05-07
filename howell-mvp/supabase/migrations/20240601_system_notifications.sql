-- ═══════════════════════════════════════════════════════════════
-- System Notifications table
-- Internal HR-team alerts fired automatically by the platform
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT        NOT NULL,        -- 'new_application' | 'pre_screen_complete' | 'shortlisted'
                                            -- 'offer_extended' | 'offer_accepted' | 'offer_rejected'
                                            -- 'bgv_fraud_alert' | 'hired' | 'interview_overdue' | 'rejected'
  title        TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  severity     TEXT        NOT NULL DEFAULT 'info',  -- 'info' | 'warning' | 'critical'
  link         TEXT,                        -- URL to jump to on click
  entity_id    TEXT,                        -- related record id (application, bgv, offer…)
  entity_type  TEXT,                        -- 'application' | 'bgv_record' | 'offer'
  is_read      BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast unread-count queries
CREATE INDEX IF NOT EXISTS idx_sysnotif_unread ON system_notifications (is_read, created_at DESC);

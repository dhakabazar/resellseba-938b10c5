export type CleanupTarget = {
  key: string;
  label: string;
  hint: string;
};

/** Browser-safe list of the data buckets the cleanup tool can wipe. */
export const CLEANUP_TARGETS: CleanupTarget[] = [
  { key: "audit_log", label: "Audit / action log", hint: "Every stored audit event — not used anywhere in the app." },
  { key: "store_visits", label: "Old store visits", hint: "Visit rows older than 30 days (report only keeps 30 days)." },
  { key: "courier_events", label: "Old courier webhook events", hint: "Courier callback payloads older than 60 days." },
  { key: "notification_logs", label: "Old notification logs", hint: "SMS / email / WhatsApp send logs older than 60 days." },
];

import { useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";

export type ChatBubbleConfig = {
  enabled?: boolean;
  phone?: string;
  whatsapp?: string;
  messenger?: string;
  label?: string;
};

const digits = (v: string) => v.replace(/[^\d+]/g, "");

export function FloatingChat({ config }: { config?: ChatBubbleConfig | null }) {
  const [open, setOpen] = useState(false);
  if (!config || config.enabled === false) return null;

  const phone = config.phone?.trim();
  const whatsapp = config.whatsapp?.trim();
  const messenger = config.messenger?.trim();
  if (!phone && !whatsapp && !messenger) return null;

  const messengerHref = messenger
    ? messenger.startsWith("http")
      ? messenger
      : `https://m.me/${messenger.replace(/^\/+/, "")}`
    : null;

  const items: { key: string; href: string; label: string; className: string; icon: JSX.Element }[] = [];
  if (whatsapp)
    items.push({
      key: "wa",
      href: `https://wa.me/${digits(whatsapp).replace("+", "")}`,
      label: "WhatsApp",
      className: "bg-[#25D366] text-white",
      icon: <WhatsAppIcon />,
    });
  if (messengerHref)
    items.push({
      key: "me",
      href: messengerHref,
      label: "Messenger",
      className: "bg-[#0084FF] text-white",
      icon: <MessengerIcon />,
    });
  if (phone)
    items.push({
      key: "call",
      href: `tel:${digits(phone)}`,
      label: "Call",
      className: "btn-brand",
      icon: <Phone className="h-5 w-5" />,
    });

  return (
    <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-2.5 sm:bottom-6 sm:right-6">
      {open &&
        items.map((it) => (
          <a
            key={it.key}
            href={it.href}
            target={it.href.startsWith("tel:") ? undefined : "_blank"}
            rel="noreferrer"
            className="group flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
          >
            <span className="rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold shadow-md ring-1 ring-border">
              {it.label}
            </span>
            <span className={`grid h-12 w-12 place-items-center rounded-full shadow-lg transition group-hover:scale-105 ${it.className}`}>
              {it.icon}
            </span>
          </a>
        ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={config.label || "Chat with us"}
        className="btn-brand grid h-14 w-14 place-items-center rounded-full shadow-xl transition hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.4.5-.6.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.5-.4-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4 0 1.4 1 2.7 1.2 2.9.1.2 1.9 3 4.7 4.1 2.3 1 2.8.8 3.3.7.5 0 1.6-.6 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.2-.2-.2-.4-.3zM12 21.5c-1.6 0-3.2-.4-4.6-1.2l-3.3.9.9-3.2A9.4 9.4 0 012.6 12C2.6 6.8 6.8 2.6 12 2.6S21.4 6.8 21.4 12 17.2 21.5 12 21.5z" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M12 2C6.3 2 2 6.2 2 11.6c0 2.8 1.2 5.3 3.1 7 .2.1.3.4.3.6l.1 2c0 .5.5.8.9.6l2.2-1c.2-.1.4-.1.6-.1 1 .3 2 .4 3 .4 5.7 0 10-4.2 10-9.5S17.7 2 12 2zm6 7.6l-2.9 4.6c-.5.7-1.4.9-2.1.4l-2.3-1.7c-.2-.2-.5-.2-.7 0l-3.1 2.4c-.4.3-.9-.2-.7-.6l2.9-4.6c.5-.7 1.4-.9 2.1-.4l2.3 1.7c.2.2.5.2.7 0l3.1-2.4c.4-.3.9.2.7.6z" />
    </svg>
  );
}

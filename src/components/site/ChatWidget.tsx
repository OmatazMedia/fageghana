import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, ArrowLeft, Bot } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const WHATSAPP_NUMBER = "233535170780";
const MEMBERSHIP_EMAIL = "membership@fageghana.org";
const EXIT_WORDS = ["exit", "bye", "goodbye", "quit", "close", "done", "thank you", "thanks"];

type Msg = {
  id: string;
  from: "bot" | "user";
  text?: string;
  quickReplies?: { label: string; action: string }[];
  link?: { to: string; label: string };
  ts: number;
};

type Mode = "menu" | "leave-msg" | "whatsapp-input" | "transferring" | "sending";

const QUICK_MENU: { label: string; action: string }[] = [
  { label: "About FAGE", action: "about" },
  { label: "Services", action: "services" },
  { label: "Products", action: "products" },
  { label: "Membership", action: "membership" },
  { label: "Events", action: "activities" },
  { label: "News & Blog", action: "news" },
  { label: "Contact details", action: "contact" },
  { label: "Verify a member", action: "verify" },
  { label: "Chat with a real person", action: "whatsapp" },
  { label: "Leave a message", action: "leave" },
];

function ghanaGreeting() {
  try {
    const h = parseInt(
      new Intl.DateTimeFormat("en-GH", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Africa/Accra",
      }).format(new Date()),
      10,
    );
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    if (h >= 17 && h < 22) return "Good evening";
    return "Hello";
  } catch {
    return "Hello";
  }
}

function isOnline() {
  try {
    const fmt = new Intl.DateTimeFormat("en-GH", {
      weekday: "short",
      hour: "2-digit",
      hour12: false,
      timeZone: "Africa/Accra",
    }).formatToParts(new Date());
    const day = fmt.find((p) => p.type === "weekday")?.value ?? "";
    const hour = parseInt(fmt.find((p) => p.type === "hour")?.value ?? "0", 10);
    return !["Sat", "Sun"].includes(day) && hour >= 8 && hour < 17;
  } catch {
    return true;
  }
}

function playNotificationSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [
      [880, 0],
      [1100, 0.18],
    ].forEach(([freq, delay]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + delay);
      g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.5);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.52);
    });
  } catch {
    /* noop */
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fires once per page load — resets on every refresh
let _notifFired = false;

function delayMs(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function buildTranscript(msgs: Msg[]) {
  const lines = msgs
    .filter((m) => m.text)
    .map((m) => `${m.from === "bot" ? "Ama (bot)" : "Me"}: ${m.text}`)
    .join("\n");
  return `Hello FAGE Team — I was chatting on your website and would like to continue here.\n\n--- Chat Transcript ---\n${lines}\n--- End ---`;
}

export function ChatWidget({ raised }: { raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [notifBubble, setNotifBubble] = useState(false);
  const [badge, setBadge] = useState(false);
  const [dancing, setDancing] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("fage_chat_msgs") ?? "[]");
    } catch {
      return [];
    }
  });
  const [mode, setMode] = useState<Mode>(
    () => (sessionStorage.getItem("fage_chat_mode") as Mode) ?? "menu",
  );
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [leave, setLeave] = useState<{
    step: "name" | "phone" | "email" | "message" | "done";
    name: string;
    phone: string;
    email: string;
    message: string;
  }>({ step: "name", name: "", phone: "", email: "", message: "" });

  const scrollRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const danceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const greetedRef = useRef(false);
  const idleMenuSentRef = useRef(false);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  /* ── Clear any stale keys from previous broken sessions ── */
  useEffect(() => {
    sessionStorage.removeItem("fage_chat_open");
    sessionStorage.removeItem("fage_chat_active");
  }, []);

  /* ── Sync msgs and mode to sessionStorage (not open — always starts closed) ── */
  useEffect(() => {
    sessionStorage.setItem("fage_chat_msgs", JSON.stringify(msgs));
  }, [msgs]);
  useEffect(() => {
    sessionStorage.setItem("fage_chat_mode", mode);
  }, [mode]);

  /* ── Restore greetedRef if msgs already exist ── */
  useEffect(() => {
    if (msgs.length > 0) greetedRef.current = true;
  }, []);

  /* ── Show widget after 10s, fire notification once per page load ── */
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      if (!_notifFired) {
        _notifFired = true;
        playNotificationSound();
        setNotifBubble(true);
        setTimeout(() => {
          setNotifBubble(false);
          setBadge(true);
          danceTimer.current = setInterval(() => {
            setDancing(true);
            setTimeout(() => setDancing(false), 800);
          }, 8000);
        }, 4000);
      }
    }, 10000);
    return () => clearTimeout(t);
  }, []);

  function openChat() {
    setOpen(true);
    setBadge(false);
    setDancing(false);
    if (danceTimer.current) {
      clearInterval(danceTimer.current);
      danceTimer.current = null;
    }
  }

  /* ── Greeting on first open ── */
  useEffect(() => {
    if (!open || greetedRef.current) return;
    greetedRef.current = true;
    const greet = ghanaGreeting();
    const online = isOnline();
    (async () => {
      setTyping(true);
      await delayMs(1200);
      setTyping(false);
      addBot(`Hi! I'm Ama 🤖 — a friendly bot from FAGE. ${greet}!`);
      setTyping(true);
      await delayMs(1000);
      setTyping(false);
      addBot(
        online
          ? "How can I help you today? Pick one of the options below."
          : "We're currently offline (Mon–Fri 08:00–17:00 GMT). I can still help — pick an option below or leave a message.",
        QUICK_MENU,
      );
    })();
  }, [open]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  /* ── Idle timer ── */
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(async () => {
      if (!open || idleMenuSentRef.current) return;
      idleMenuSentRef.current = true;
      setTyping(true);
      await delayMs(800);
      setTyping(false);
      addBot("Anything else I can help you with? 😊", QUICK_MENU);
    }, 30000);
  }, [open]);

  function addBot(
    text: string,
    quickReplies?: { label: string; action: string }[],
    link?: { to: string; label: string },
  ) {
    setMsgs((m) => [
      ...m,
      { id: generateId(), from: "bot", text, quickReplies, link, ts: Date.now() },
    ]);
  }
  function addUser(text: string) {
    setMsgs((m) => [...m, { id: generateId(), from: "user", text, ts: Date.now() }]);
    idleMenuSentRef.current = false;
    resetIdle();
  }
  async function botReply(
    text: string,
    quickReplies?: { label: string; action: string }[],
    link?: { to: string; label: string },
    ms = 800,
  ) {
    setTyping(true);
    await delayMs(ms);
    setTyping(false);
    addBot(text, quickReplies, link);
  }

  function isExitIntent(text: string) {
    const t = text.toLowerCase().trim();
    return EXIT_WORDS.some((w) => t === w || t.startsWith(w + " ") || t.endsWith(" " + w));
  }

  async function handleExit() {
    setTyping(true);
    await delayMs(800);
    setTyping(false);
    addBot(
      "Thank you for chatting with us today! 🙏 We hope we were helpful. Have a wonderful day — goodbye! 👋",
    );
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setTimeout(() => {
      setOpen(false);
      setTimeout(() => {
        setMsgs([]);
        greetedRef.current = false;
        idleMenuSentRef.current = false;
        setMode("menu");
        sessionStorage.removeItem("fage_chat_msgs");
        sessionStorage.removeItem("fage_chat_mode");
        sessionStorage.removeItem("fage_chat_pinged");
      }, 500);
    }, 2500);
  }

  async function handleAction(action: string, label?: string) {
    addUser(label ?? action);
    setTyping(true);
    await delayMs(800);
    setTyping(false);

    switch (action) {
      case "about":
        addBot(
          "FAGE is the Federation of Associations of Ghanaian Exporters — promoting non-traditional exports since 1992.",
          undefined,
          { to: "/about/who-we-are", label: "About us →" },
        );
        break;
      case "services":
        addBot(
          "We provide trade facilitation, training, advocacy and market access support for Ghanaian exporters.",
          undefined,
          { to: "/services", label: "View services →" },
        );
        break;
      case "products":
        addBot(
          "Our members export agro-products, processed foods, handicrafts and more.",
          undefined,
          { to: "/products", label: "Browse products →" },
        );
        break;
      case "activities":
        addBot(
          "Workshops, trade missions, training events and exhibitions throughout the year.",
          undefined,
          { to: "/activities", label: "See events →" },
        );
        break;
      case "news":
        addBot("Read the latest export news and FAGE updates.", undefined, {
          to: "/news",
          label: "Open the blog →",
        });
        break;
      case "verify":
        addBot("You can verify any FAGE member by their certificate code.", undefined, {
          to: "/verify",
          label: "Verify a member →",
        });
        break;
      case "contact":
        addBot(
          `📞 +233 (0) 53 517 0780 / 53 522 4555\n✉️ info@fageghana.com\n📍 Number 22, Nii Tsatse Dzani Street, Adjiringanor, Accra`,
          undefined,
          { to: "/contact", label: "Open contact page →" },
        );
        break;
      case "membership":
        addBot(
          `You can register two ways:\n\n• Online — apply right on our website and pay via the gateways we support.\n• Manually — download the form, fill it, and email it with your proof of payment to ${MEMBERSHIP_EMAIL}.`,
          undefined,
          { to: "/membership", label: "Start application →" },
        );
        break;
      case "whatsapp":
        addBot(
          "Sure! Please type your request in one message — I'll forward our whole chat to a real person on WhatsApp.",
        );
        setMode("whatsapp-input");
        return;
      case "leave":
        addBot("No problem — I'll take a message. What's your name?");
        setMode("leave-msg");
        setLeave({ step: "name", name: "", phone: "", email: "", message: "" });
        return;
    }
    resetIdle();
  }

  async function onSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (isExitIntent(text)) {
      addUser(text);
      await handleExit();
      return;
    }

    if (mode === "whatsapp-input") {
      addUser(text);
      await botReply("Transferring you to WhatsApp now…");
      setMode("transferring");
      setTimeout(() => {
        const transcript = buildTranscript([
          ...msgs,
          { id: "x", from: "user", text, ts: Date.now() },
        ]);
        window.open(
          `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(transcript)}`,
          "_blank",
          "noopener,noreferrer",
        );
        addBot(
          "Done! WhatsApp should have opened in a new tab. Pick another option to keep chatting.",
          QUICK_MENU,
        );
        setMode("menu");
      }, 5000);
      return;
    }

    if (mode === "leave-msg") {
      addUser(text);
      const s = leave.step;
      if (s === "name") {
        setLeave({ ...leave, name: text, step: "phone" });
        await botReply("Thanks! What's the best phone number to reach you?");
        return;
      }
      if (s === "phone") {
        setLeave({ ...leave, phone: text, step: "email" });
        await botReply("Got it. And your email address?");
        return;
      }
      if (s === "email") {
        if (!EMAIL_RE.test(text)) {
          await botReply(
            "That doesn't look like a valid email. Please try again (e.g. you@example.com).",
          );
          return;
        }
        setLeave({ ...leave, email: text, step: "message" });
        await botReply("Perfect. Now, what's your message?");
        return;
      }
      if (s === "message") {
        const payload = { ...leave, message: text };
        setLeave({ ...payload, step: "done" });
        setMode("sending");
        await botReply("Sending your message…");
        setTimeout(async () => {
          await supabase.from("contact_messages").insert({
            name: payload.name,
            email: payload.email,
            subject: `Chat widget message from ${payload.name}`,
            message: `Phone: ${payload.phone}\n\n${payload.message}`,
            source: 'chat_widget',
          });
          addBot("✅ Your message has been sent. Our team will reach out within working hours.");
          setTimeout(() => addBot("Anything else? Pick an option below.", QUICK_MENU), 1500);
          setMode("menu");
        }, 5000);
        return;
      }
    }

    if (text.toLowerCase() === "menu") {
      addUser(text);
      await botReply("Here's the main menu:", QUICK_MENU);
      return;
    }

    addUser(text);
    await botReply(
      "I'm a simple bot 🙂 — please pick one of these options, or type 'menu'.",
      QUICK_MENU,
    );
  }

  function backToMenu() {
    addBot("Main menu — what would you like to do?", QUICK_MENU);
    setMode("menu");
  }

  if (!visible) return null;

  /* ── Positioning: button slides up when BackToTop is visible ── */
  const btnBottom   = raised ? "bottom-20" : "bottom-6";
  // Panel sits directly above the button: button is h-14 (56px) + 8px gap
  const panelBottom = raised ? "bottom-[148px]" : "bottom-[72px]";

  return (
    <>
      {/* Notification speech bubble */}
      {notifBubble && !open && (
        <div
          className={`fixed right-20 z-[100] max-w-[220px] animate-in slide-in-from-right-4 fade-in duration-300 ${btnBottom}`}
        >
          <div className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-medium text-background shadow-lg">
            <p className="font-semibold">👋 Hi there!</p>
            <p className="mt-0.5 opacity-80">We're here to help. Chat with us!</p>
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 border-l-[6px] border-y-[6px] border-y-transparent border-l-foreground" />
          </div>
        </div>
      )}

      {/* Chat bubble button */}
      {!open && (
        <button
          onClick={openChat}
          aria-label="Open chat"
          className={`fixed right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all duration-300 hover:scale-110 ${btnBottom} ${
            dancing ? "animate-bounce" : ""
          }`}
        >
          <MessageCircle className="h-6 w-6" />
          {badge && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
              1
            </span>
          )}
        </button>
      )}

      {/* Chat panel — slides up from above the button */}
      {open && (
        <div
          className={`fixed right-6 z-[100] w-[calc(100vw-24px)] sm:w-[380px] flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200 ${panelBottom}`}
          style={{ height: "min(85vh, 620px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight">Ama · FAGE Bot</div>
                <div className="flex items-center gap-1.5 text-[11px] opacity-90">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isOnline() ? "bg-emerald-300" : "bg-amber-300"}`}
                  />
                  {isOnline() ? "Online" : "Offline · leave a message"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {mode !== "menu" && (
                <button
                  onClick={backToMenu}
                  aria-label="Back to menu"
                  className="rounded-full p-1.5 hover:bg-primary-foreground/15"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1.5 hover:bg-primary-foreground/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sending overlay */}
          {mode === "sending" && <SendingOverlay />}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-accent/30 px-3 py-4">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={m.from === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                    m.from === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border rounded-bl-sm"
                  }`}
                >
                  {m.text}
                  {m.link && (
                    <Link to={m.link.to} className="mt-2 block text-xs font-semibold text-primary">
                      {m.link.label}
                    </Link>
                  )}
                  {m.quickReplies && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.quickReplies.map((q) => (
                        <button
                          key={q.action}
                          onClick={() => handleAction(q.action, q.label)}
                          className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition hover:bg-primary hover:text-primary-foreground cursor-pointer"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-3">
                  <Dot />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
            className="flex flex-col border-t border-border bg-background"
          >
            <p className="px-3 pt-2 text-[10px] text-muted-foreground text-center">
              Type a message, <span className="font-semibold text-primary">'menu'</span> for
              options, or <span className="font-semibold text-primary">'exit'</span> to close the
              chat.
            </p>
            <div className="flex items-center gap-2 p-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  mode === "transferring" || mode === "sending"
                    ? "Please wait…"
                    : "Message, 'menu' or 'exit'…"
                }
                disabled={mode === "transferring" || mode === "sending"}
                className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || mode === "transferring" || mode === "sending"}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function SendingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
      <div className="relative flex h-20 w-full items-center justify-center overflow-hidden">
        {/* Trail dots */}
        <span className="envelope-trail" style={{ animationDelay: "0ms" }} />
        <span className="envelope-trail" style={{ animationDelay: "120ms" }} />
        <span className="envelope-trail" style={{ animationDelay: "240ms" }} />
        {/* Envelope */}
        <span className="envelope-fly" aria-hidden>✉️</span>
      </div>
      <p className="text-sm font-medium text-foreground">Sending your message…</p>
      <p className="text-xs text-muted-foreground">Please wait a moment</p>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <span
      className="h-2 w-2 rounded-full bg-muted-foreground"
      style={{ animation: `typingDot 1.2s ease-in-out ${delay}ms infinite` }}
    />
  );
}

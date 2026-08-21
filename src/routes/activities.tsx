import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Calendar,
  MapPin,
  X,
  Share2,
  Eye,
  Facebook,
  Linkedin,
  Link as LinkIcon,
  MessageCircle,
  Instagram,
  Send,
} from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/api/client";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/activities")({
  head: () => ({
    meta: [
      { title: "Upcoming Events — FAGE Ghana" },
      {
        name: "description",
        content:
          "Discover upcoming events and activities from FAGE including trade shows, expos, and networking opportunities.",
      },
      { property: "og:title", content: "Upcoming Events — FAGE Ghana" },
      {
        property: "og:image",
        content:
          "https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop",
      },
    ],
  }),
  component: ActivitiesPage,
});

type Activity = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  location: string | null;
  event_date: string | null;
  category: string;
  register_button_link: string | null;
  register_button_text: string | null;
  view_count: number | null;
};

function formatDate(dateStr: string | null): { day: string; month: string } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return {
    day: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleDateString(undefined, { month: "short" }),
  };
}

function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function EventModal({ event, onClose }: { event: Activity; onClose: () => void }) {
  const [viewCount, setViewCount] = useState(event.view_count ?? 0);
  const [copied, setCopied] = useState(false);
  const isPastEvent = event.event_date ? new Date(event.event_date) < new Date() : false;

  useEffect(() => {
    const incrementViews = async () => {
      const { data } = await supabase.rpc("increment_activity_views", { activity_id: event.id });
      if (data !== null) {
        setViewCount((prev) => prev + 1);
      } else {
        setViewCount((prev) => prev + 1);
      }
    };
    void incrementViews();
  }, [event.id]);

  const shareUrl = typeof window !== "undefined" ? window.location.origin + "/activities" : "";

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSocialShare = (
    platform: "facebook" | "twitter" | "linkedin" | "whatsapp" | "instagram" | "telegram",
  ) => {
    const text = `Check out this event: ${event.title}`;
    const url = shareUrl;
    let shareLink = "";
    switch (platform) {
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
      case "linkedin":
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case "whatsapp":
        shareLink = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
        break;
      case "instagram":
        shareLink = `https://www.instagram.com/sharingan/?url=${encodeURIComponent(url)}`;
        break;
      case "telegram":
        shareLink = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        break;
    }
    window.open(shareLink, "_blank", "width=600,height=400");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2e0a]/90 p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-background shadow-xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-background/80 p-2 hover:bg-background"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{event.title}</h2>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>
                  {viewCount} {viewCount === 1 ? "view" : "views"}
                </span>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              {event.event_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  {formatDateDisplay(event.event_date)}
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  {event.location}
                </div>
              )}
            </div>

            {event.description && (
              <p className="mb-6 text-muted-foreground leading-relaxed">{event.description}</p>
            )}

            <div className="mb-6 flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground mr-3">Share:</span>
              <button
                onClick={() => handleSocialShare("facebook")}
                className="rounded-full p-2 text-blue-600 hover:bg-blue-50 transition"
                aria-label="Share on Facebook"
              >
                <Facebook className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleSocialShare("twitter")}
                className="rounded-full p-2 text-black hover:bg-gray-100 transition"
                aria-label="Share on X"
              >
                <span className="text-sm font-bold">X</span>
              </button>
              <button
                onClick={() => handleSocialShare("linkedin")}
                className="rounded-full p-2 text-blue-700 hover:bg-blue-50 transition"
                aria-label="Share on LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleSocialShare("whatsapp")}
                className="rounded-full p-2 text-green-600 hover:bg-green-50 transition"
                aria-label="Share on WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleSocialShare("instagram")}
                className="rounded-full p-2 text-pink-600 hover:bg-pink-50 transition"
                aria-label="Share on Instagram"
              >
                <Instagram className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleSocialShare("telegram")}
                className="rounded-full p-2 text-blue-500 hover:bg-blue-50 transition"
                aria-label="Share on Telegram"
              >
                <Send className="h-4 w-4" />
              </button>
              <button
                onClick={handleCopyLink}
                className="rounded-full p-2 text-muted-foreground hover:bg-accent transition"
                aria-label="Copy link"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
              {copied && <span className="text-xs text-green-600">Copied!</span>}
            </div>

            {!isPastEvent && event.register_button_link && (
              <a
                href={event.register_button_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
              >
                {event.register_button_text || "Register"}
              </a>
            )}
          </div>

          {event.image_url && (
            <div className="relative h-64 md:h-auto md:min-h-[400px]">
              <img
                src={event.image_url}
                alt={event.title}
                className="h-full w-full object-cover md:rounded-r-2xl"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, onClick }: { event: Activity; onClick: () => void }) {
  const dateInfo = formatDate(event.event_date);
  const isPastEvent = event.event_date ? new Date(event.event_date) < new Date() : false;

  return (
    <Reveal variant="up" delay={1}>
      <button
        onClick={onClick}
        className="group block w-full cursor-pointer overflow-hidden rounded-2xl bg-card text-left shadow-sm transition-all duration-300 hover:shadow-lg"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {event.image_url && (
            <img
              src={event.image_url}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          {dateInfo && (
            <div className="absolute left-4 top-4 flex flex-col items-center rounded-lg bg-background/90 px-3 py-2 shadow-md">
              <span className="text-2xl font-bold text-primary">{dateInfo.day}</span>
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {dateInfo.month}
              </span>
            </div>
          )}
          {isPastEvent && (
            <div className="absolute right-4 top-4 rounded-full bg-muted px-2 py-1 text-xs font-medium">
              Past
            </div>
          )}
        </div>
        <div className="p-6">
          <h3 className="mb-2 text-lg font-bold group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          <div className="space-y-1">
            {event.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                {event.location}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 text-primary" />
              {formatDateDisplay(event.event_date)}
            </div>
          </div>
        </div>
      </button>
    </Reveal>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-6 py-2 text-sm font-medium transition-colors ${
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {isActive && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
          layoutId="activeTab"
        />
      )}
    </button>
  );
}

function ActivitiesPage() {
  const [events, setEvents] = useState<Activity[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Activity | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    void supabase
      .from("activities")
      .select("*")
      .eq("published", true)
      .order("event_date", { ascending: true })
      .then(({ data }) => {
        if (data) setEvents(data as Activity[]);
      });
  }, []);

  const now = new Date();
  const upcomingEvents = events.filter((e) => e.event_date && new Date(e.event_date) >= now);
  const pastEvents = events.filter((e) => e.event_date && new Date(e.event_date) < now);

  const displayEvents = activeTab === "upcoming" ? upcomingEvents : pastEvents;

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Events & Activities"
        title="Upcoming Events"
        subtitle="Join us at industry events, trade shows, and networking opportunities"
        imageUrl="https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop"
      />

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          {/* Tabs */}
          <div className="mb-8 flex justify-center border-b border-border">
            <TabButton
              label={`Upcoming Events (${upcomingEvents.length})`}
              isActive={activeTab === "upcoming"}
              onClick={() => setActiveTab("upcoming")}
            />
            <TabButton
              label={`Past Events (${pastEvents.length})`}
              isActive={activeTab === "past"}
              onClick={() => setActiveTab("past")}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {displayEvents.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">
                  {activeTab === "upcoming"
                    ? "No upcoming events scheduled yet."
                    : "No past events to display."}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {displayEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => setSelectedEvent(event)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </SiteLayout>
  );
}

import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth/AuthProvider";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FAGE — Federation of Associations of Ghanaian Exporters" },
      {
        name: "description",
        content:
          "FAGE is Ghana's leading enabler of non-traditional exports — advocacy, matchmaking, trade support and research for Ghanaian exporters.",
      },
      { name: "author", content: "FAGE Ghana" },
      { property: "og:title", content: "FAGE — Federation of Associations of Ghanaian Exporters" },
      {
        property: "og:description",
        content:
          "FAGE is Ghana's leading enabler of non-traditional exports — advocacy, matchmaking, trade support and research for Ghanaian exporters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "FAGE — Federation of Associations of Ghanaian Exporters" },
      {
        name: "twitter:description",
        content:
          "FAGE is Ghana's leading enabler of non-traditional exports — advocacy, matchmaking, trade support and research for Ghanaian exporters.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/nrggeoYipJeFyefKpeEtoFOSJSY2/social-images/social-1777249211351-fage-logo-white-11.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/nrggeoYipJeFyefKpeEtoFOSJSY2/social-images/social-1777249211351-fage-logo-white-11.webp",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Merriweather:wght@400;700;900&family=Montserrat:wght@400;500;600;700;800&family=Roboto:wght@400;500;700&family=Inter:wght@400;500;600;700&family=Great+Vibes&family=Dancing+Script:wght@400;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

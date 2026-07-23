import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/robots")({
  server: {
    handlers: {
      GET: () =>
        new Response("User-agent: *\nAllow: /\n", {
          headers: { "content-type": "text/plain", "cache-control": "public, max-age=86400" },
        }),
    },
  },
});

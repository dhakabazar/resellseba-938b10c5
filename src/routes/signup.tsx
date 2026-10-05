import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: "/login",
      search: { mode: "signup", redirect: (location.search as { redirect?: string })?.redirect },
    });
  },
  component: () => null,
});

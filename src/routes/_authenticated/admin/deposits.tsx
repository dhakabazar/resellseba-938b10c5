import { createFileRoute, redirect } from "@tanstack/react-router";

/** Security deposit settings now live inside Advanced settings → Security deposit tab. */
export const Route = createFileRoute("/_authenticated/admin/deposits")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/advanced" });
  },
});

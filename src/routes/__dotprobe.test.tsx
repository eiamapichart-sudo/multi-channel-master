import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/__dotprobe/test")({
  component: () => <div>probe</div>,
});

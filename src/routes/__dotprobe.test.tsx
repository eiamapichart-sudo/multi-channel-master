import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/__dotprobe")({
  component: () => <div>probe</div>,
});

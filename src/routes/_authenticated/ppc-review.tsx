import { createFileRoute } from "@tanstack/react-router";
import { ReviewBoard } from "@/components/review-board";

export const Route = createFileRoute("/_authenticated/ppc-review")({
  component: () => <ReviewBoard level="ppc" />,
});

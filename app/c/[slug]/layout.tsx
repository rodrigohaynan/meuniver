import type { ReactNode } from "react";
import { RsvpFormGuard } from "@/components/rsvp-form-guard";

export default function PublicInvitationLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RsvpFormGuard />
      {children}
    </>
  );
}

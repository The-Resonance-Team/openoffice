import type { Metadata } from "next";
import type { Session } from "@openoffice/schema";

export const metadata: Metadata = {
  title: "OpenOffice Cloud",
  description: "Org management and analytics for OpenOffice (ADR 0005)",
};

// Server-rendered sample: the page compiles against the shared data model,
// so a session payload received from a member daemon types-checks here.
const sample: Pick<Session, "id" | "model" | "createdAt"> = {
  id: "session_placeholder",
  model: "anthropic/claude-sonnet",
  createdAt: Date.now(),
};

export default function Page() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>OpenOffice Cloud</h1>
      <p>Org management and analytics (ADR 0005).</p>
      <pre>{JSON.stringify(sample, null, 2)}</pre>
    </main>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact - Robs Fractals",
};

export default function Contact() {
  return (
    <div>
      <h1>Contact</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        This is the contact page.
      </p>
    </div>
  );
}

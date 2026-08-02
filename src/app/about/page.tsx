import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - Robs Fractals",
};

export default function About() {
  return (
    <div>
      <h1>About</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        This is the about page.
      </p>
    </div>
  );
}

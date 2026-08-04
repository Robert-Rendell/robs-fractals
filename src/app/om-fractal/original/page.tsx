import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Om Fractal: Original Image | Rob's Fractals",
};

export default function OmOriginalPage() {
  return (
    <div>
      <h1>Om Fractal: Original Image</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        This is the source glyph the rest of the Om Fractal is built from.
      </p>
      <div
        style={{
          marginTop: "1.5rem",
          background: "#ffffff",
          borderRadius: "12px",
          padding: "1.5rem",
          maxWidth: "420px",
        }}
      >
        <Image
          src="/om.svg"
          alt="Om symbol, the source image for the Om Fractal"
          width={1100}
          height={1100}
          style={{ width: "100%", height: "auto", display: "block" }}
          priority
        />
      </div>
    </div>
  );
}

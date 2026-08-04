import type { Metadata } from "next";
import OmBasicFractal from "./OmBasicFractal";

export const metadata: Metadata = {
  title: "Om Fractal: Basic | Rob's Fractals",
};

export default function OmBasicPage() {
  return <OmBasicFractal />;
}

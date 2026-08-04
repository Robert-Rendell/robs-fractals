import type { Metadata } from "next";
import OmComplexPlaneFractal from "./OmComplexPlaneFractal";

export const metadata: Metadata = {
  title: "Om Fractal: Mapped to Complex Plane | Rob's Fractals",
};

export default function OmComplexPlanePage() {
  return <OmComplexPlaneFractal />;
}

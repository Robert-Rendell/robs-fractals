import type { Metadata } from "next";
import ComplexPlaneFractal from "./ComplexPlaneFractal";

export const metadata: Metadata = {
  title: "Apex Fractal: Mapped to Complex Plane | Rob's Fractals",
};

export default function ComplexPlanePage() {
  return <ComplexPlaneFractal />;
}

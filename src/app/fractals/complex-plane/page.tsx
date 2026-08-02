import type { Metadata } from "next";
import ComplexPlaneFractal from "./ComplexPlaneFractal";

export const metadata: Metadata = {
  title: "Apex Fractal - Complex Plane | Robs Fractals",
};

export default function ComplexPlanePage() {
  return <ComplexPlaneFractal />;
}

import type { Metadata } from "next";
import NewtonFractal from "./NewtonFractal";

export const metadata: Metadata = {
  title: "Newton Fractal | Rob's Fractals",
};

export default function NewtonFractalPage() {
  return <NewtonFractal />;
}

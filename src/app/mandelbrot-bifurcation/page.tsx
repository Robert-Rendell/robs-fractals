import type { Metadata } from "next";
import MandelbrotBifurcation from "./MandelbrotBifurcation";

export const metadata: Metadata = {
  title: "Mandelbrot & the Logistic Map | Rob's Fractals",
};

export default function MandelbrotBifurcationPage() {
  return <MandelbrotBifurcation />;
}

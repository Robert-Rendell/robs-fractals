import type { Metadata } from "next";
import Mandelbulb from "./Mandelbulb";

export const metadata: Metadata = {
  title: "Mandelbulb | Rob's Fractals",
};

export default function MandelbulbPage() {
  return <Mandelbulb />;
}

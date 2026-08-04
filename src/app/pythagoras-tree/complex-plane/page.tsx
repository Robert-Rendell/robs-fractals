import type { Metadata } from "next";
import Pythagoras3DFractal from "./Pythagoras3DFractal";

export const metadata: Metadata = {
  title: "Pythagoras Tree: 3D, Complex Plane | Rob's Fractals",
};

export default function PythagorasComplexPlanePage() {
  return <Pythagoras3DFractal />;
}

import type { Metadata } from "next";
import Iterated3DFractal from "./Iterated3DFractal";

export const metadata: Metadata = {
  title: "Apex Fractal - 3D Iterated | Robs Fractals",
};

export default function Iterated3DPage() {
  return <Iterated3DFractal />;
}

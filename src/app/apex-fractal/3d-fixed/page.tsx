import type { Metadata } from "next";
import Iterated3DFractalFixed from "./Iterated3DFractalFixed";

export const metadata: Metadata = {
  title: "Apex Fractal: 3D (Fixed Frame) | Rob's Fractals",
};

export default function Iterated3DFixedPage() {
  return <Iterated3DFractalFixed />;
}

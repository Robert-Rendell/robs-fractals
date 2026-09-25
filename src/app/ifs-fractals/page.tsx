import type { Metadata } from "next";
import IfsFractals from "./IfsFractals";

export const metadata: Metadata = {
  title: "IFS Fractal Atlas | Rob's Fractals",
};

export default function IfsFractalsPage() {
  return <IfsFractals />;
}

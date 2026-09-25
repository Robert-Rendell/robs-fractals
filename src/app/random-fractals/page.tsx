import type { Metadata } from "next";
import RandomFractals from "./RandomFractals";

export const metadata: Metadata = {
  title: "Random Fractal Atlas | Rob's Fractals",
};

export default function RandomFractalsPage() {
  return <RandomFractals />;
}

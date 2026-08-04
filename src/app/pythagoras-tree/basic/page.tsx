import type { Metadata } from "next";
import PythagorasBasicFractal from "./PythagorasBasicFractal";

export const metadata: Metadata = {
  title: "Pythagoras Tree: Basic | Rob's Fractals",
};

export default function PythagorasBasicPage() {
  return <PythagorasBasicFractal />;
}

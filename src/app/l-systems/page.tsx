import type { Metadata } from "next";
import LSystems from "./LSystems";

export const metadata: Metadata = {
  title: "L-System Atlas | Rob's Fractals",
};

export default function LSystemsPage() {
  return <LSystems />;
}

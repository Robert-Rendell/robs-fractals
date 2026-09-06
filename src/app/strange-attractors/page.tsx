import type { Metadata } from "next";
import StrangeAttractors from "./StrangeAttractors";

export const metadata: Metadata = {
  title: "Strange Attractor Atlas | Rob's Fractals",
};

export default function StrangeAttractorsPage() {
  return <StrangeAttractors />;
}

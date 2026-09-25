import type { Metadata } from "next";
import EscapeTime from "./EscapeTime";

export const metadata: Metadata = {
  title: "Escape-Time Atlas | Rob's Fractals",
};

export default function EscapeTimePage() {
  return <EscapeTime />;
}

import type { Metadata } from "next";
import Mandelbox from "./Mandelbox";

export const metadata: Metadata = {
  title: "Mandelbox | Rob's Fractals",
};

export default function MandelboxPage() {
  return <Mandelbox />;
}

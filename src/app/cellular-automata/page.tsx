import type { Metadata } from "next";
import CellularAutomata from "./CellularAutomata";

export const metadata: Metadata = {
  title: "Cellular Automaton Atlas | Rob's Fractals",
};

export default function CellularAutomataPage() {
  return <CellularAutomata />;
}

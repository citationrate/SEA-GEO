import { redirect } from "next/navigation";

export const metadata = { title: "Analisi" };

export default function AnalysisPage() {
  redirect("/projects");
}

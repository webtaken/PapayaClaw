import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Configurator } from "@/components/configurator";
import { Comparison } from "@/components/comparison";
import { UseCases } from "@/components/use-cases";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#07080a]">
      <Header />
      <main>
        <Hero />
        <Configurator />
        <Comparison />
        <UseCases />
      </main>
      <Footer />
    </div>
  );
}

import { Badge } from "@/components/ui/badge";

const useCases = [
  "Customer Support",
  "Personal Assistant",
  "Language Learning",
  "Code Review",
  "Content Writing",
  "Data Analysis",
  "Social Media Manager",
  "Email Drafting",
  "Meeting Summarizer",
  "Research Assistant",
  "Recipe Generator",
  "Travel Planner",
  "Study Buddy",
  "Health & Fitness Coach",
  "Financial Advisor",
  "Legal Document Review",
  "Interview Prep",
  "News Summarizer",
  "Therapy Chatbot",
  "Language Translation",
];

export function UseCases() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 border-t-2 border-border relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 bg-linear-to-b from-border to-transparent" />
      <h2 className="mb-6 text-center text-3xl font-extrabold uppercase tracking-tight text-white md:text-4xl">
        What can{" "}
        <span className="text-secondary drop-shadow-[2px_2px_0_rgba(255,87,34,1)]">
          OpenClaw
        </span>{" "}
        do for you?
      </h2>
      <p className="mb-14 text-center text-xl font-medium text-zinc-400">
        One assistant,{" "}
        <span className="text-white underline decoration-wavy decoration-primary decoration-2 underline-offset-4">
          thousands
        </span>{" "}
        of use cases.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {useCases.map((useCase, i) => (
          <Badge
            key={i}
            variant="secondary"
            className="cursor-default rounded-full border-2 border-border bg-[#18191f] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-zinc-300 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:bg-primary hover:text-black neo-shadow-sm hover:neo-shadow"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {useCase}
          </Badge>
        ))}
      </div>
    </section>
  );
}

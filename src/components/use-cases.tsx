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
    <section className="mx-auto max-w-4xl px-6 py-20">
      <h2 className="mb-4 text-center text-3xl font-semibold tracking-tight text-white">
        What can OpenClaw do for you?
      </h2>
      <p className="mb-10 text-center text-lg text-zinc-400">
        One assistant, thousands of use cases
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {useCases.map((useCase, i) => (
          <Badge
            key={i}
            variant="secondary"
            className="cursor-default rounded-xl border border-zinc-700/50 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-300 transition-all duration-300 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
          >
            {useCase}
          </Badge>
        ))}
      </div>
    </section>
  );
}

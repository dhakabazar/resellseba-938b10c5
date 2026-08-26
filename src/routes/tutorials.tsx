import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader } from "@/components/public-header";
import { TutorialLibrary } from "@/components/tutorial-library";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/tutorials")({
  component: TutorialsPage,
  head: () => ({
    meta: [
      { title: "Video Tutorial — শিখুন ধাপে ধাপে" },
      {
        name: "description",
        content: "রিসেলিং শুরু থেকে অর্ডার, কুরিয়ার ও পেমেন্ট — টপিক অনুযায়ী সাজানো ফ্রি ভিডিও টিউটোরিয়াল লাইব্রেরি।",
      },
      { property: "og:title", content: "Video Tutorial — শিখুন ধাপে ধাপে" },
      {
        property: "og:description",
        content: "টপিক অনুযায়ী সাজানো ভিডিও টিউটোরিয়াল — রিসেলিং, অর্ডার, কুরিয়ার ও পেমেন্ট গাইড।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function TutorialsPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <GraduationCap className="h-4 w-4" /> Video Tutorial
          </span>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">ধাপে ধাপে শিখুন</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            টপিক অনুযায়ী সাজানো ভিডিও টিউটোরিয়াল — যেকোনো ভিডিওতে ক্লিক করলেই এখানেই দেখতে পারবেন।
          </p>
        </header>
        <TutorialLibrary />
      </main>
    </div>
  );
}

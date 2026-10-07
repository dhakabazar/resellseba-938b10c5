import { Link } from "@tanstack/react-router";
import { useStore } from "../store-context";
import { ArrowLeft, ShieldCheck, Lock, Truck, Phone, Mail } from "lucide-react";
import { Heading, GhostButton, cx, borderc, muted } from "../ui";

export function PrivacyPageContent() {
  const { name, settings, url } = useStore();
  const phone = settings?.support_phone || settings?.whatsapp;
  const email = (settings as { support_email?: string | null } | null)?.support_email;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      {/* Breadcrumb / Back button */}
      <div className="mb-6">
        <Link to={url("/")}>
          <GhostButton className="inline-flex items-center gap-2 text-xs font-medium">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Store
          </GhostButton>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-10 border-b border-[var(--st-border)] pb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--st-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--st-primary)]">
          <ShieldCheck className="h-4 w-4" /> Privacy & Security Policy
        </div>
        <Heading as="h1" className="text-2xl font-bold tracking-tight text-[var(--st-fg)] sm:text-3xl">
          Privacy Policy — {name}
        </Heading>
        <p className={cx("mt-2 text-sm", muted)}>
          Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Main Policy Content */}
      <div className="space-y-8 text-sm leading-relaxed text-[var(--st-fg)]/90">
        <section className="rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] p-6 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[var(--st-fg)] sm:text-lg">
            ১. ভূমিকা ও প্রতিশ্রুতি (Introduction)
          </h2>
          <p className="text-[var(--st-fg)]/80">
            <strong>{name}</strong> গ্রাহকদের ব্যক্তিগত তথ্যের গোপনীয়তা ও সুরক্ষাকে সর্বোচ্চ অগ্রাধিকার দেয়। আমাদের ওয়েবসাইট থেকে কেনাকাটা করার সময় আপনার তথ্য কীভাবে সংগ্রহ, ব্যবহার ও সুরক্ষিত রাখা হয়, তা এই নীতিমালায় সুস্পষ্টভাবে বর্ণিত হয়েছে।
          </p>
        </section>

        <section className="rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[var(--st-fg)] sm:text-lg">
            <Lock className="h-4 w-4 text-[var(--st-primary)]" /> ২. সংগৃহীত তথ্যাবলী (Information We Collect)
          </h2>
          <p className="mb-3 text-[var(--st-fg)]/80">
            অর্ডার সফলভাবে সম্পন্ন ও ডেলিভারির প্রয়োজনে আমরা গ্রাহকদের কাছ থেকে নিম্নলিখিত তথ্যসমূহ গ্রহণ করে থাকি:
          </p>
          <ul className="list-inside list-disc space-y-1.5 text-[var(--st-fg)]/80 pl-2">
            <li><strong>ব্যক্তিগত তথ্য:</strong> নাম, মোবাইল নম্বর, ডেলিভারি ঠিকানা (জেলা, থানা ও এলাকা)।</li>
            <li><strong>অর্ডার বিবরণ:</strong> অর্ডারকৃত পণ্যের নাম, পরিমাণ, সাইজ/ভ্যারিয়েন্ট এবং মোট মূল্য।</li>
            <li><strong>পেমেন্ট সংক্রান্ত তথ্য:</strong> ক্যাশ অন ডেলিভারি (COD) বা অনলাইন গেটওয়ে ট্রানজেকশন আইডি (আমরা কোনো কার্ড নম্বর বা পিন সংরক্ষণ করি না)।</li>
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[var(--st-fg)] sm:text-lg">
            <Truck className="h-4 w-4 text-[var(--st-primary)]" /> ৩. তথ্যের ব্যবহার ও ডেলিভারি পলিসি (How We Use Your Data)
          </h2>
          <p className="mb-3 text-[var(--st-fg)]/80">
            আপনার সংগৃহীত তথ্য কেবল নিম্নলিখিত উদ্দেশ্যে ব্যবহৃত হয়:
          </p>
          <ul className="list-inside list-disc space-y-1.5 text-[var(--st-fg)]/80 pl-2">
            <li>অর্ডার প্রসেসিং, প্যাকেজিং এবং ক্যাশ অন ডেলিভারিতে দ্রুত পার্সেল ডেলিভারি নিশ্চিত করতে।</li>
            <li>কুরিয়ার পার্টনারদের (যেমন: Steadfast, Pathao, RedX ইত্যাদি) সাথে প্রয়োজনীয় ডেলিভারি তথ্য শেয়ার করতে।</li>
            <li>অর্ডারের আপডেট বা ডেলিভারি কনফার্মেশনের জন্য এসএমএস বা ফোনের মাধ্যমে যোগাযোগ করতে।</li>
            <li>কোনো অনাকাঙ্ক্ষিত বা ভুয়া অর্ডার প্রতিরোধে নিরাপত্তা নিশ্চিতকরণে।</li>
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] p-6 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[var(--st-fg)] sm:text-lg">
            ৪. তথ্যের নিরাপত্তা ও থার্ড-পার্টি ডিসক্লোজার (Data Security)
          </h2>
          <p className="text-[var(--st-fg)]/80">
            আমরা কোনো অবস্থাতেই গ্রাহকদের ব্যক্তিগত তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রয়, ভাড়া বা বাণিজ্যিক উদ্দেশ্যে সরবরাহ করি না। আমাদের সার্ভার এনক্রিপ্টেড ও সুরক্ষিত সংযোগের মাধ্যমে পরিচালিত হয়।
          </p>
        </section>

        <section className="rounded-xl border border-[var(--st-border)] bg-[var(--st-surface)] p-6 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[var(--st-fg)] sm:text-lg">
            ৫. গ্রাহকের অধিকার ও যোগাযোগ (Contact & Inquiries)
          </h2>
          <p className="mb-4 text-[var(--st-fg)]/80">
            আপনার তথ্য আপডেট বা অর্ডার সম্পর্কিত যেকোনো প্রশ্নের জন্য আমাদের সাথে নির্দ্বিধায় যোগাযোগ করুন:
          </p>
          <div className="flex flex-wrap gap-4 text-xs font-semibold">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-alt)] px-3.5 py-2 hover:border-[var(--st-primary)]"
              >
                <Phone className="h-3.5 w-3.5 text-[var(--st-primary)]" /> {phone}
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-alt)] px-3.5 py-2 hover:border-[var(--st-primary)]"
              >
                <Mail className="h-3.5 w-3.5 text-[var(--st-primary)]" /> {email}
              </a>
            )}
          </div>
        </section>
      </div>

      {/* Footer link back */}
      <div className="mt-12 text-center">
        <Link to={url("/")}>
          <GhostButton className="font-semibold">
            Continue Shopping at {name}
          </GhostButton>
        </Link>
      </div>
    </div>
  );
}

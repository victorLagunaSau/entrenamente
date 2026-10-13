import { BigIdea } from "@/features/landing/components/big-idea";
import { ContactForm } from "@/features/landing/components/contact-form";
import { Diagnosis } from "@/features/landing/components/diagnosis";
import { ErrorGuide } from "@/features/landing/components/error-guide";
import { Footer } from "@/features/landing/components/footer";
import { Hero } from "@/features/landing/components/hero";
import { Methods } from "@/features/landing/components/methods";
import { Navbar } from "@/features/landing/components/navbar";
import { Plans } from "@/features/landing/components/plans";
import { Science } from "@/features/landing/components/science";
import { Universities } from "@/features/landing/components/universities";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip">
        <Hero />
        <BigIdea />
        <ErrorGuide />
        <Diagnosis />
        <Science />
        <Methods />
        <Universities />
        <Plans />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}

import { ContactForm } from "@/features/landing/components/contact-form";
import { Diagnosis } from "@/features/landing/components/diagnosis";
import { Footer } from "@/features/landing/components/footer";
import { Hero } from "@/features/landing/components/hero";
import { Methods } from "@/features/landing/components/methods";
import { Navbar } from "@/features/landing/components/navbar";
import { Plans } from "@/features/landing/components/plans";
import { Universities } from "@/features/landing/components/universities";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip">
        <Hero />
        <Diagnosis />
        <Methods />
        <Universities />
        <Plans />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}

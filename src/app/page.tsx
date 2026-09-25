import { ContactForm } from "@/components/landing/contact-form";
import { Diagnosis } from "@/components/landing/diagnosis";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Methods } from "@/components/landing/methods";
import { Navbar } from "@/components/landing/navbar";
import { Plans } from "@/components/landing/plans";
import { Universities } from "@/components/landing/universities";

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

import { BigIdea } from "@/features/landing/components/big-idea";
import { ContactForm } from "@/features/landing/components/contact-form";
import { Diagnosis } from "@/features/landing/components/diagnosis";
import { ErrorGuide } from "@/features/landing/components/error-guide";
import { Footer } from "@/features/landing/components/footer";
import { Hero } from "@/features/landing/components/hero";
import { LandingSessionRedirect } from "@/features/landing/components/landing-session-redirect";
import { Methods } from "@/features/landing/components/methods";
import { Navbar } from "@/features/landing/components/navbar";
import { Pisa } from "@/features/landing/components/pisa";
import { Plans } from "@/features/landing/components/plans";
import { Science } from "@/features/landing/components/science";
import { SmoothAnchors } from "@/features/landing/components/smooth-anchors";
import { Toefl } from "@/features/landing/components/toefl";
import { Universities } from "@/features/landing/components/universities";
import { landingRedirectScript } from "@/features/landing/lib/session-redirect";

export default function LandingPage() {
  return (
    <>
      {/* Primero que todo: con sesión, directo al panel (ver session-redirect). */}
      <script dangerouslySetInnerHTML={{ __html: landingRedirectScript(process.env.CAPACITOR_BUILD === "1") }} />
      <LandingSessionRedirect />
      <SmoothAnchors />
      <Navbar />
      <main className="overflow-x-clip">
        <Hero />
        <BigIdea />
        <ErrorGuide />
        <Diagnosis />
        <Science />
        <Methods />
        <Universities />
        <Toefl />
        <Pisa />
        <Plans />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}

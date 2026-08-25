import { MarketingNav } from "./MarketingNav";
import { HeroSection } from "./HeroSection";
import { LiveSlideShowcase } from "./LiveSlideShowcase";
import { FeaturesSection } from "./FeaturesSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { AboutSection } from "./AboutSection";
import { SupportSection } from "./SupportSection";
import { FaqSection } from "./FaqSection";
import { UsersMapSection } from "./UsersMapSection";
import { MarketingFooter } from "./MarketingFooter";

export function LandingPage() {
  return (
    // data-landing-ready is the signal the first-visit intro waits on before
    // it slides away (see /public/intro.js) -- without it the curtain can lift
    // on the auth spinner or a still-empty root.
    <div className="min-h-svh" data-landing-ready>
      <MarketingNav />
      <main>
        <HeroSection />
        <LiveSlideShowcase />
        <FeaturesSection />
        <HowItWorksSection />
        <AboutSection />
        <SupportSection />
        {/* Light band, then the dark map closing the page against the footer --
            the sections alternate so no two backgrounds run together. */}
        <FaqSection />
        <UsersMapSection />
      </main>
      <MarketingFooter />
    </div>
  );
}

import { SiteNav } from '@/components/site-nav';
import { SearchBand } from '@/components/search-band';
import { HeroPromo } from '@/components/hero-promo';
import { TrustBar } from '@/components/trust-bar';
import { ProductCards } from '@/components/product-cards';
import { PricingPlans } from '@/components/pricing-plans';
import { FeatureTiles } from '@/components/feature-tiles';
import { BrainyBunchBanner } from '@/components/brainy-bunch-banner';
import { SiteFooter } from '@/components/site-footer';
import { SupportChat } from '@/components/support-chat';

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <SearchBand />
      <main>
        <HeroPromo />
        <TrustBar />
        <ProductCards />
        <PricingPlans />
        <FeatureTiles />
        <BrainyBunchBanner />
      </main>
      <SiteFooter />
      <SupportChat />
    </>
  );
}

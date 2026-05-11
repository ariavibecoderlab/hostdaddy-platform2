import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { HeroSearch } from '@/components/hero-search';
import { TrustBar } from '@/components/trust-bar';
import { ProductCards } from '@/components/product-cards';
import { PricingPlans } from '@/components/pricing-plans';
import { FeatureTiles } from '@/components/feature-tiles';
import { BrainyBunchBanner } from '@/components/brainy-bunch-banner';

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main>
        <HeroSearch />
        <TrustBar />
        <ProductCards />
        <PricingPlans />
        <FeatureTiles />
        <BrainyBunchBanner />
      </main>
      <SiteFooter />
    </>
  );
}

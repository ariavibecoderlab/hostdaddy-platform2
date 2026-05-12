/**
 * @deprecated Renamed to HeroPromo as part of the GoDaddy-style homepage refactor.
 * The persistent search bar moved to `<SearchBand />` above the hero.
 * This file remains as a re-export shim to avoid breaking any stray imports —
 * delete it once you've confirmed nothing else references HeroSearch.
 */
export { HeroPromo as HeroSearch } from './hero-promo';

const TILES = [
  {
    title: 'Free SSL on every domain',
    body: 'Cloudflare Universal SSL is auto-provisioned the moment you point a domain at us.',
  },
  {
    title: 'Cloudflare global edge',
    body: 'Sites cached across 300+ cities. Visitors load your pages from the closest one.',
  },
  {
    title: 'AI-built sites',
    body: 'Cowork Claude generates your starter site in minutes — fully editable afterwards.',
  },
  {
    title: 'Halal & values-aligned',
    body: 'Acceptable use policy aligned with Islamic ethics. Built by Muslim founders for the ummah.',
  },
  {
    title: '24/7 support',
    body: 'Live chat, WhatsApp, and email. Our team responds in Bahasa Malaysia and English.',
  },
  {
    title: 'Instant deploys',
    body: 'Push to GitHub or click "Deploy" in the dashboard — live in under 30 seconds.',
  },
];

export function FeatureTiles() {
  return (
    <section className="bg-navy-50/40 py-20">
      <div className="container-page">
        <div className="text-center">
          <h2 className="heading-section">Why HostDaddy.ai</h2>
          <p className="mx-auto mt-3 max-w-2xl text-navy-500">
            Built differently from day one. Speed, fairness, and Cloudflare under the hood.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => (
            <div
              key={t.title}
              className="rounded-xl border border-navy-100 bg-white p-6 shadow-card"
            >
              <h3 className="font-display text-lg font-semibold text-navy-900">{t.title}</h3>
              <p className="mt-2 text-sm text-navy-600">{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

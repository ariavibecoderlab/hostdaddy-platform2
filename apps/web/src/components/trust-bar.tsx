const STATS = [
  { value: '10,000+', label: 'domains registered' },
  { value: '99.99%', label: 'uptime SLA' },
  { value: 'Cloudflare', label: 'global edge network' },
  { value: 'Halal', label: 'values & policies' },
];

export function TrustBar() {
  return (
    <section className="border-b border-navy-100 bg-white py-10">
      <div className="container-page grid grid-cols-2 gap-6 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-display text-2xl font-bold text-navy-900 sm:text-3xl">{s.value}</div>
            <div className="mt-1 text-sm text-navy-500">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

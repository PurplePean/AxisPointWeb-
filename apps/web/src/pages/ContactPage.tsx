function ContactPage() {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-purple-dark via-ink to-purple-dark py-32">
        <div className="max-w-[1160px] mx-auto px-7 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-teal/10 border border-teal/30 text-teal text-eyebrow font-semibold mb-6">
            GET IN TOUCH
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-semibold text-white mb-6">
            Contact
          </h1>
          <p className="text-xl text-sub max-w-2xl mx-auto">
            Let's discuss how we can help with your CRE needs
          </p>
        </div>
      </section>

      <section className="py-24 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          <p className="text-center text-sub">
            6-step contact form will be implemented here
          </p>
        </div>
      </section>
    </div>
  );
}

export default ContactPage;

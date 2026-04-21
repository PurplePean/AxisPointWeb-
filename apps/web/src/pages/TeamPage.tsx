import { team } from '@brand/team';

function TeamPage() {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-purple-dark via-ink to-purple-dark py-32">
        <div className="max-w-[1160px] mx-auto px-7 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-teal/10 border border-teal/30 text-teal text-eyebrow font-semibold mb-6">
            OUR TEAM
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-semibold text-white mb-6">
            Meet the Team
          </h1>
          <p className="text-xl text-sub max-w-2xl mx-auto">
            Experienced partners dedicated to your success
          </p>
        </div>
      </section>

      <section className="py-24 bg-card">
        <div className="max-w-[1160px] mx-auto px-7">
          <div className="grid gap-12">
            {Object.values(team).map((member) => (
              <div key={member.id} className="border border-border rounded-card p-8">
                <div className="flex items-center gap-6 mb-6">
                  {/* Initials Avatar - NO HEADSHOTS */}
                  <div
                    className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold ${
                      member.color === 'teal' ? 'bg-teal' : 'bg-purple'
                    }`}
                  >
                    {member.initials}
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif font-semibold mb-1">{member.fullName}</h3>
                    <p className={`text-lg font-medium ${member.color === 'teal' ? 'text-teal' : 'text-purple'}`}>
                      {member.title}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 mb-6">
                  <a href={`mailto:${member.email}`} className="text-sm text-sub hover:text-teal">
                    {member.email}
                  </a>
                  <a href={`tel:${member.phone}`} className="text-sm text-sub hover:text-teal">
                    {member.phone}
                  </a>
                </div>
                <a
                  href="/contact"
                  className={`inline-block px-6 py-3 rounded-button font-semibold text-white ${
                    member.color === 'teal' ? 'bg-teal' : 'bg-purple'
                  } hover:brightness-110 transition-all`}
                >
                  Let's Talk
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default TeamPage;

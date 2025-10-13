interface HeroProps {
  onOpenWaitlist: () => void;
}

const Hero = ({ onOpenWaitlist }: HeroProps) => {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center bg-white">
      <div className="container px-6 py-20 sm:py-32">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          {/* Hero Headline - Baskerville Serif */}
          <h1 className="text-hero-headline">
            Track What Matters,
            <br />
            <span className="italic">Effortlessly</span>
          </h1>

          {/* Hero Subheadline - Inter Sans-serif */}
          <p className="text-hero-subheadline max-w-2xl mx-auto">
            Intelligent tracking and updates delivered straight to your inbox.
            Stay organized without the overhead.
          </p>

          {/* CTA Button */}
          <div className="pt-4">
            <button
              onClick={onOpenWaitlist}
              className="px-8 py-4 text-white text-lg font-medium rounded-lg bg-gray-900 hover:bg-gray-800 transition-colors shadow-lg"
            >
              Join Waitlist
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

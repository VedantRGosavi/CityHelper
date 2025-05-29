import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="hero-bg min-h-screen relative">
        <div className="absolute inset-0 bg-[#123832]/60 mix-blend-multiply"></div>
        <div className="relative z-10 container mx-auto px-4 py-32">
          <h1 className="text-6xl md:text-8xl font-bold mb-6">
            CityHelper
          </h1>
          <p className="text-xl md:text-2xl max-w-2xl">
            Empowering citizens and city officials to create better, more responsive communities through innovative digital solutions.
          </p>
          <button className="mt-8 bg-[#123832] hover:bg-[#123832]/80 text-white px-8 py-4 rounded-lg text-lg transition-colors">
            Get Started
          </button>
        </div>
      </section>
    </div>
  );
}

export default App;
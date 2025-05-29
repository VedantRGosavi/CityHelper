import React from 'react';
import { motion } from 'framer-motion';
import { FiMapPin, FiUsers, FiDatabase, FiShield } from 'react-icons/fi';

function App() {
  const features = [
    {
      icon: <FiMapPin className="w-6 h-6" />,
      title: "Location Tracking",
      description: "Real-time GPS tracking and mapping for all city issues"
    },
    {
      icon: <FiUsers className="w-6 h-6" />,
      title: "Community Engagement",
      description: "Connect citizens with city officials for faster resolution"
    },
    {
      icon: <FiDatabase className="w-6 h-6" />,
      title: "Data Analytics",
      description: "Powerful insights to improve city services"
    },
    {
      icon: <FiShield className="w-6 h-6" />,
      title: "Secure Platform",
      description: "Enterprise-grade security for all user data"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="hero-bg min-h-screen relative">
        <div className="absolute inset-0 bg-[#123832]/60 mix-blend-multiply"></div>
        <div className="relative z-10 container mx-auto px-4 py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl font-bold mb-6">
              CityHelper
            </h1>
            <p className="text-xl md:text-2xl max-w-2xl">
              Empowering citizens and city officials to create better, more responsive communities through innovative digital solutions.
            </p>
            <button className="mt-8 bg-[#123832] hover:bg-[#123832]/80 text-white px-8 py-4 rounded-lg text-lg transition-colors">
              Get Started
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[#123832]">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
                className="bg-black/20 p-6 rounded-lg backdrop-blur-sm"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-black">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-12">
            {[1, 2, 3].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.3 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-[#123832] rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold">{step}</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">
                  {index === 0 ? "Report Issues" : index === 1 ? "Track Progress" : "Get Results"}
                </h3>
                <p className="text-gray-300">
                  {index === 0
                    ? "Submit city issues with our easy-to-use platform"
                    : index === 1
                    ? "Follow the status of your reported issues in real-time"
                    : "See concrete improvements in your community"}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[#123832]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Ready to Get Started?</h2>
          <p className="text-xl mb-12 max-w-2xl mx-auto">
            Join thousands of citizens making their communities better, one report at a time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-[#123832] px-8 py-4 rounded-lg text-lg font-bold hover:bg-gray-100 transition-colors">
              Sign Up Now
            </button>
            <button className="bg-transparent border-2 border-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-white/10 transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">CityHelper</h3>
              <p className="text-gray-400">Making cities work better for everyone.</p>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Features</li>
                <li>Pricing</li>
                <li>Case Studies</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>About</li>
                <li>Careers</li>
                <li>Contact</li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Privacy</li>
                <li>Terms</li>
                <li>Security</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2025 CityHelper. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
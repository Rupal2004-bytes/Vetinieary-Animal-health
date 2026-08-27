import React, { useState } from 'react';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-2">
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase">
          Support & Clinic Partnerships
        </span>
        <h1 className="text-3xl font-black text-slate-900">Get in Touch with VetMyPet</h1>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Have technical questions, want to partner your veterinary hospital, or need emergency assistance?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Contact Info Cards */}
        <div className="md:col-span-5 space-y-4 text-xs">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">🚨 24/7 Emergency Medical Hotline</h3>
            <p className="text-slate-600">Immediate veterinary triage support for life-threatening cases.</p>
            <a href="tel:1800555911" className="text-red-600 font-bold text-sm block hover:underline">
              📞 +1 (800) 555-VET-911
            </a>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">📧 Email Support & Research</h3>
            <p className="text-slate-600">For academic collaborations, API keys, or feedback.</p>
            <span className="font-bold text-emerald-700 block">support@vetmypet.org</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <h3 className="font-bold text-slate-900 text-sm">🏢 Global Operations Center</h3>
            <p className="text-slate-600">742 Evergreen Veterinary Innovation Center, BioTech Campus</p>
            <span className="text-slate-400">Available Mon-Fri 08:00 - 18:00 EST</span>
          </div>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-7 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          {submitted ? (
            <div className="text-center py-10 space-y-3">
              <div className="text-4xl text-emerald-600">✅</div>
              <h3 className="text-lg font-bold text-slate-900">Message Sent Successfully!</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Thank you for contacting VetMyPet. Our veterinary support team will respond within 24 hours.
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: 'General Inquiry', message: '' }); }}
                className="text-xs font-bold text-emerald-600 hover:underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-base mb-2">Send an Inquiry</h3>
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. / Mr. / Ms."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Inquiry Subject</label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Clinic Integration">Clinic / Hospital Telehealth Integration</option>
                  <option value="Research & Dataset">Veterinary Research & Dataset Contribution</option>
                  <option value="Bug Report">Technical Issue / Bug Report</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Message</label>
                <textarea
                  rows="4"
                  required
                  placeholder="How can our clinical team assist you?..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors text-sm"
              >
                Submit Message
              </button>
            </form>
          )}
        </div>

      </div>

    </div>
  );
}

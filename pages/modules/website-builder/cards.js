import React from "react";

const modules = [
  {
    title: "CRM & Communication Hub",
    desc: "Manage every customer interaction in one place",
    features: [
      "Contacts, pipelines & tags",
      "Email, SMS & phone integration",
      "Call tracking & recording",
      "Tasks & follow-ups",
    ],
  },
  {
    title: "Email Marketing",
    desc: "Create, send and automate email campaigns",
    features: [
      "Broadcasts & campaigns",
      "Autoresponders",
      "Segmentation",
      "Performance tracking",
    ],
  },
  {
    title: "SMS Marketing",
    desc: "Reach customers instantly on mobile",
    features: [
      "Bulk SMS campaigns",
      "Automated messages",
      "CRM integration",
      "Alerts & notifications",
    ],
  },
  {
    title: "Calling System",
    desc: "Make and track calls directly from your dashboard",
    features: [
      "In-dashboard calling",
      "Call logging",
      "Call recording",
      "Contact linking",
    ],
  },
  {
    title: "Automation Engine",
    desc: "Automate workflows across your business",
    features: [
      "Trigger-based workflows",
      "Email & SMS automation",
      "Task automation",
      "Pipeline updates",
    ],
  },
  {
    title: "Funnels & Conversions",
    desc: "Build high-converting funnels with AI",
    features: [
      "Sales funnels",
      "Lead capture pages",
      "Conversion tracking",
      "AI funnel builder",
    ],
  },
  {
    title: "Marketplace & Products",
    desc: "Sell physical, digital products and courses",
    features: [
      "Product listings",
      "Checkout system",
      "Order tracking",
      "Vendor dashboards",
    ],
  },
  {
    title: "Affiliate System",
    desc: "Grow sales with affiliates",
    features: [
      "Affiliate programs",
      "Commission tracking",
      "Referral analytics",
      "Affiliate dashboards",
    ],
  },
  {
    title: "Social Media Platform",
    desc: "Manage and automate your social presence",
    features: [
      "Post scheduling",
      "Multi-platform posting",
      "Engagement tracking",
      "Response bot",
    ],
  },
  {
    title: "Bookings & Calendar",
    desc: "Manage appointments and services",
    features: [
      "Booking pages",
      "Service creation",
      "Availability control",
      "CRM integration",
    ],
  },
  {
    title: "Accounting & Finance",
    desc: "Track finances and integrate with Xero",
    features: [
      "Invoices",
      "Payment tracking",
      "Financial reporting",
      "Xero integration",
    ],
  },
  {
    title: "Community & Networking",
    desc: "Build and engage your audience",
    features: [
      "Personal communities",
      "Global community",
      "Content sharing",
      "User interaction",
    ],
  },
];

export default function ModulesGrid() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-10">
      {/* Banner with Back and Save buttons */}
      <div className="relative flex items-center justify-center mx-auto mb-10" style={{ height: 64, maxWidth: 520 }}>
        <button
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-gray-800 text-white rounded-full px-4 py-2 shadow hover:bg-gray-700 transition"
          style={{ minWidth: 90 }}
          onClick={() => window.history.back()}
        >
          ← Back
        </button>
        <div className="flex-1 text-center">
          <span className="text-lg font-bold">Website Modules</span>
        </div>
        <button
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-green-500 text-white rounded-full px-5 py-2 shadow hover:bg-green-600 transition"
          style={{ minWidth: 90 }}
          onClick={() => alert('Saved!')}
        >
          Save
        </button>
      </div>
      {/* Main content */}
      <div className="max-w-7xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Everything You Need to Run Your Business</h1>
        <p className="text-gray-400">Modular tools that work independently or together</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {modules.map((mod, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-green-500 transition">
            <h2 className="text-xl font-semibold mb-2">{mod.title}</h2>
            <p className="text-sm text-gray-400 mb-4">{mod.desc}</p>

            <ul className="space-y-2 text-sm mb-4">
              {mod.features.map((f, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-400">✔</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button className="text-green-400 text-sm hover:underline">Learn More →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

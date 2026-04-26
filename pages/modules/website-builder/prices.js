import React from "react";

const plans = [
  {
    name: "Starter",
    price: "$0",
    desc: "Start & operate your business",
    features: [
      "Marketplace & Products",
      "Basic Leads Capture",
      "Communities",
      "Basic Email (limited)",
    ],
    highlight: false,
  },
  {
    name: "Growth",
    price: "$79",
    desc: "Automate your workflows",
    features: [
      "Automation Engine",
      "Funnels (AI)",
      "SMS Marketing",
      "Email Campaigns",
    ],
    highlight: true,
  },
  {
    name: "Business",
    price: "$199",
    desc: "Manage & scale your business",
    features: [
      "Full CRM",
      "Automation + Funnels",
      "Social Media + Bot",
      "Calls & Recording",
    ],
    highlight: false,
  },
  {
    name: "Professional",
    price: "$499",
    desc: "Advanced control & performance",
    features: [
      "Advanced Automation",
      "High Email Limits",
      "Full Analytics",
      "All Business Features",
    ],
    highlight: false,
  },
  {
    name: "Expansion",
    price: "$1299",
    desc: "Everything unlocked",
    features: [
      "All Modules",
      "Max Limits",
      "Priority Performance",
      "Enterprise Tools",
    ],
    highlight: false,
  },
  {
    name: "Agency",
    price: "Contact",
    desc: "Multi-client & enterprise",
    features: [
      "Sub Accounts",
      "Agency Dashboard",
      "White Label",
      "Dedicated Support",
    ],
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-10">
      <div className="max-w-7xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple, Scalable Pricing</h1>
        <p className="text-gray-400">
          Start free. Upgrade when you need more power.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl p-6 flex flex-col justify-between border ${
              plan.highlight
                ? "border-green-500 bg-gray-900 scale-105"
                : "border-gray-800 bg-gray-900"
            }`}
          >
            <div>
              <h2 className="text-xl font-semibold mb-2">{plan.name}</h2>
              <p className="text-3xl font-bold mb-2">{plan.price}</p>
              <p className="text-sm text-gray-400 mb-4">{plan.desc}</p>

              <ul className="space-y-2 text-sm">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-green-400">✔</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            <button
              className={`mt-6 py-2 rounded-lg ${
                plan.highlight
                  ? "bg-green-600 hover:bg-green-500"
                  : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              {plan.price === "Contact" ? "Contact Sales" : "Get Started"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


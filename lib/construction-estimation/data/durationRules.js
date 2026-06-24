export const DURATION_RULES = {
  baseContractDays: {
    "Single Storey Home": 180,
    "Double Storey Home": 240,
    "Triple Storey Home": 310,
    Duplex: 260,
    "Renovation / Extension": 140,
  },
  projectTypeAdjustments: {
    Commercial: 60,
    Townhouses: 80,
  },
  conditionAdjustments: {
    "Mild Slope": 7,
    "Moderate Slope": 14,
    "Steep Slope": 25,
    "Heavy Cut & Fill": 30,
    "Restricted": 10,
    "Difficult": 20,
  },
  featureAdjustments: {
    Pool: 25,
    Basement: 45,
    Lift: 30,
    Scaffolding: 10,
    "Structural Steel": 14,
    "Suspended Deck": 14,
    Balconies: 14,
    "Extensive Landscaping": 14,
  },
};

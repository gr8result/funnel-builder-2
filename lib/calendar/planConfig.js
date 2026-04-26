// /lib/calendar/planConfig.js
// Final production-ready Calendar plan configuration

export const CALENDAR_PLANS = {
  "calendar-starter": {
    calendars: 1,
    teamMembers: 0,
    smsReminders: false,
    roundRobin: false,
    customFields: false,
    apiAccess: false,
  },

  "calendar-growth": {
    calendars: 5,
    teamMembers: 3,
    smsReminders: true,
    roundRobin: false,
    customFields: true,
    apiAccess: false,
  },

  "calendar-professional": {
    calendars: Infinity,
    teamMembers: 10,
    smsReminders: true,
    roundRobin: true,
    customFields: true,
    apiAccess: true,
  },

  "calendar-agency": {
    calendars: Infinity,
    teamMembers: Infinity,
    smsReminders: true,
    roundRobin: true,
    customFields: true,
    apiAccess: true,
  },
};
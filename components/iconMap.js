// /components/iconMap.js
// Centralised icon map with default white stroke for dark theme + full-colour official social media icons

import React from "react";

import {
  LayoutDashboard,
  ShoppingCart,
  FolderOpen,
  Users,
  CreditCard,
  Globe,
  Compass,
  Bot,
  Mail,
  Handshake,
  GraduationCap,
  Package,
  Video,
  Calendar,
  GitBranch,
  Users2,
  Megaphone,
  Layers,
  HardDrive,
  BarChart,
  Settings,
  FileText,
  CheckCircle,
  Edit,
  Trash2,
  LineChart,
  HelpCircle,
  MessageSquare,
  Store,
  Briefcase,
  Filter,
  Search,
} from "lucide-react";

import {
  FaFacebookSquare,
  FaInstagram,
  FaLinkedin,
  FaYoutube,
  FaPinterest,
} from "react-icons/fa";

import { FcGoogle } from "react-icons/fc";

const defaultColor = "#fff";

function TikTokIcon({ size = 24, color = "currentColor", style, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      {...props}
    >
      <path
        fill={color}
        d="M16.6 3c.35 2.03 1.5 3.5 3.4 4.25v3.22c-1.37-.04-2.55-.43-3.55-1.16v5.75c0 3.57-2.24 5.94-5.58 5.94-2.9 0-5.05-1.92-5.05-4.64 0-3.06 2.45-5.04 5.7-4.78v3.3c-1.37-.2-2.34.36-2.34 1.42 0 .86.7 1.43 1.67 1.43 1.29 0 2.02-.82 2.02-2.49V3h3.73Z"
      />
    </svg>
  );
}

function XIcon({ size = 24, color = "currentColor", style, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      {...props}
    >
      <path
        fill={color}
        d="M13.9 10.5 21.3 2h-1.75l-6.43 7.36L7.98 2H2.06l7.77 11.12L2.06 22h1.75l6.8-7.78L16.04 22h5.92l-8.06-11.5Zm-2.41 2.76-.79-1.11L4.44 3.3h2.7l5.06 7.16.79 1.11 6.56 9.27h-2.7l-5.36-7.58Z"
      />
    </svg>
  );
}

const ICONS = {
  // ---------- Core ----------
  dashboard: (props) => <LayoutDashboard color={defaultColor} {...props} />,
  affiliates: (props) => <ShoppingCart color={defaultColor} {...props} />,
  assets: (props) => <FolderOpen color={defaultColor} {...props} />,
  leads: (props) => <Users color={defaultColor} {...props} />,
  account: (props) => <Users2 color={defaultColor} {...props} />,
  billing: (props) => <CreditCard color={defaultColor} {...props} />,

  // ---------- Modules ----------
  websiteBuilder: (props) => <Globe color={defaultColor} {...props} />,
  funnels: (props) => <Filter color={defaultColor} {...props} />,
  projectsHub: (props) => <Compass color={defaultColor} {...props} />,
  automation: (props) => <Bot color={defaultColor} {...props} />,
  email: (props) => <Mail color={defaultColor} {...props} />,
  sms: (props) => <MessageSquare color={defaultColor} {...props} />,
  affiliateManagement: (props) => (
    <Handshake color={defaultColor} {...props} />
  ),
  courses: (props) => <GraduationCap color={defaultColor} {...props} />,
  products: (props) => <Package color={defaultColor} {...props} />,
  webinars: (props) => <Video color={defaultColor} {...props} />,
  calendar: (props) => <Calendar color={defaultColor} {...props} />,
  subscription: (props) => <GitBranch color={defaultColor} {...props} />,
  communities: (props) => <Users color={defaultColor} {...props} />,
  social: (props) => <Megaphone color={defaultColor} {...props} />,
  subaccounts: (props) => <Layers color={defaultColor} {...props} />,
  digitalProducts: (props) => <HardDrive color={defaultColor} {...props} />,
  marketplace: (props) => <Store color={defaultColor} {...props} />, // ✅ Properly added here
  hr: (props) => <Briefcase color={defaultColor} {...props} />,

  // ---------- Extras ----------
  reports: (props) => <BarChart color={defaultColor} {...props} />,
  settings: (props) => <Settings color={defaultColor} {...props} />,
  documents: (props) => <FileText color={defaultColor} {...props} />,
  search: (props) => <Search color={defaultColor} {...props} />,

  approvals: (props) => <CheckCircle color={defaultColor} {...props} />,
  edit: (props) => <Edit color={defaultColor} {...props} />,
  trash: (props) => <Trash2 color={defaultColor} {...props} />,
  analytics: (props) => <LineChart color={defaultColor} {...props} />,

  // ---------- Official Social Media Icons (Full-Colour) ----------
  facebook: (props) => <FaFacebookSquare {...props} />,
  instagram: (props) => <FaInstagram {...props} />,
  tiktok: (props) => <TikTokIcon {...props} />,
  linkedin: (props) => <FaLinkedin {...props} />,
  youtube: (props) => <FaYoutube {...props} />,
  pinterest: (props) => <FaPinterest {...props} />,
  twitter: (props) => <XIcon {...props} />,
  google: (props) => <FcGoogle {...props} />,
  emailIcon: (props) => <Mail {...props} />,
  referral: (props) => <Handshake {...props} />,
  other: (props) => <HelpCircle {...props} />,
};

export default ICONS;

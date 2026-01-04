// /components/iconMap.js
// Centralised icon map with default white stroke for dark theme + full-colour official social media icons

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
} from "lucide-react";

import {
  FaFacebookSquare,
  FaInstagram,
  FaLinkedin,
  FaYoutube,
  FaPinterest,
} from "react-icons/fa";

import { SiTiktok, SiX } from "react-icons/si";

import { FcGoogle } from "react-icons/fc";
import { MdEmail } from "react-icons/md";

import { FaSearch } from "react-icons/fa";

const defaultColor = "#fff";

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
  funnels: (props) => <Compass color={defaultColor} {...props} />,
  automation: (props) => <Bot color={defaultColor} {...props} />,
  email: (props) => <Mail color={defaultColor} {...props} />,
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

  // ---------- Extras ----------
  reports: (props) => <BarChart color={defaultColor} {...props} />,
  settings: (props) => <Settings color={defaultColor} {...props} />,
  documents: (props) => <FileText color={defaultColor} {...props} />,
  search: (props) => <FaSearch color={defaultColor} {...props} />,

  approvals: (props) => <CheckCircle color={defaultColor} {...props} />,
  edit: (props) => <Edit color={defaultColor} {...props} />,
  trash: (props) => <Trash2 color={defaultColor} {...props} />,
  analytics: (props) => <LineChart color={defaultColor} {...props} />,

  // ---------- Official Social Media Icons (Full-Colour) ----------
  facebook: (props) => <FaFacebookSquare {...props} />,     // Blue square Facebook logo
  instagram: (props) => <FaInstagram {...props} />,         // Gradient Instagram icon
  tiktok: (props) => <SiTiktok {...props} />,               // Official TikTok colour logo
  linkedin: (props) => <FaLinkedin {...props} />,           // Blue LinkedIn logo
  youtube: (props) => <FaYoutube {...props} />,             // Red YouTube logo
  pinterest: (props) => <FaPinterest {...props} />,         // Red Pinterest logo
  twitter: (props) => <SiX {...props} />,                   // Official X logo
  google: (props) => <FcGoogle {...props} />,               // Full-colour Google "G"
  emailIcon: (props) => <MdEmail {...props} />,             // Email envelope
  referral: (props) => <Handshake {...props} />,            // Referral handshake
  other: (props) => <HelpCircle {...props} />,              // Default "Other"
};

export default ICONS;

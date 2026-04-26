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
  Store, // ✅ Added Marketplace icon from lucide
} from "lucide-react";

import {
  FaFacebookSquare,
  FaInstagram,
  FaLinkedin,
  FaYoutube,
  FaPinterest,
  FaSearch,
} from "react-icons/fa";

import { SiTiktok, SiX } from "react-icons/si";
import { FcGoogle } from "react-icons/fc";
import { MdEmail } from "react-icons/md";

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
  facebook: (props) => <FaFacebookSquare {...props} />,
  instagram: (props) => <FaInstagram {...props} />,
  tiktok: (props) => <SiTiktok {...props} />,
  linkedin: (props) => <FaLinkedin {...props} />,
  youtube: (props) => <FaYoutube {...props} />,
  pinterest: (props) => <FaPinterest {...props} />,
  twitter: (props) => <SiX {...props} />,
  google: (props) => <FcGoogle {...props} />,
  emailIcon: (props) => <MdEmail {...props} />,
  referral: (props) => <Handshake {...props} />,
  other: (props) => <HelpCircle {...props} />,
};

export default ICONS;

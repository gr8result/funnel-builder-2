// /components/iconMap.js
// Centralised icon map with default white stroke for dark theme

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
} from "lucide-react";

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

  // ---------- Manage Products ----------
  approvals: (props) => <CheckCircle color={defaultColor} {...props} />,
  edit: (props) => <Edit color={defaultColor} {...props} />,
  trash: (props) => <Trash2 color={defaultColor} {...props} />,
  analytics: (props) => <LineChart color={defaultColor} {...props} />, // ✅ fixed and confirmed
};

export default ICONS;

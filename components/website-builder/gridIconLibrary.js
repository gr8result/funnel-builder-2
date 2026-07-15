import React from "react";
import {
  FaBullhorn, FaBullseye, FaCalendarAlt, FaCamera, FaChartLine, FaCheckCircle,
  FaCog, FaComments, FaEnvelope, FaGlobe, FaHdd, FaHeart, FaMapMarkerAlt,
  FaPaintBrush, FaPhone, FaSearch, FaShoppingCart, FaStar, FaUser, FaVideo,
  FaRocket, FaLightbulb, FaFire, FaThumbsUp, FaHandshake, FaGraduationCap,
  FaBoxOpen, FaMobileAlt, FaLaptop, FaDesktop, FaWifi, FaLock, FaShieldAlt,
  FaKey, FaDatabase, FaCloud, FaServer, FaCode, FaBug, FaTools, FaWrench,
  FaMicrophone, FaHeadphones, FaBell, FaBookmark, FaTag, FaTags, FaClipboard,
  FaChartBar, FaChartPie, FaTable, FaList, FaThList, FaFilter, FaSort,
  FaHome, FaBuilding, FaStore, FaWarehouse, FaFlag, FaTrophy, FaMedal,
  FaGift, FaMoneyBillWave, FaDollarSign, FaCreditCard, FaReceipt, FaPercent,
  FaUsers, FaUserTie, FaUserFriends, FaUserCheck, FaUserPlus, FaUserCog,
  FaRegClock, FaRegCalendar, FaRegCalendarAlt, FaRegEnvelope, FaRegBell,
  FaArrowRight, FaArrowLeft, FaArrowUp, FaArrowDown, FaExternalLinkAlt,
  FaLink, FaShareAlt, FaPaperPlane, FaReply, FaForward, FaDownload, FaUpload,
  FaFilePdf, FaFileImage, FaFileAlt, FaFile, FaFolder, FaFolderOpen,
  FaTrash, FaTrashAlt, FaEdit, FaPencilAlt, FaSave, FaPlus, FaMinus, FaTimes,
  FaInfoCircle, FaExclamationCircle, FaExclamationTriangle, FaQuestion,
  FaEye, FaEyeSlash, FaThumbsDown, FaHandPointRight, FaHandPointUp,
  FaSun, FaMoon, FaSnowflake, FaBolt, FaLeaf, FaTree, FaMountain, FaWater,
  FaRobot, FaBrain, FaMagic, FaSatelliteDish, FaMicroscope, FaFlask,
  FaGem, FaCrown, FaAward, FaCertificate, FaStamp, FaBadge,
  FaIndustry, FaHospital, FaSchool, FaUniversity, FaChurch,
  FaCar, FaBus, FaTruck, FaPlane, FaShip, FaMotorcycle,
  FaMapMarked, FaMap, FaCompass, FaRoute, FaDirections,
  FaPalette, FaBrush, FaSwatchbook, FaImage, FaImages, FaCrop,
  FaHeartbeat, FaDumbbell, FaRunning, FaSwimmer, FaBicycle,
  FaUtensils, FaCoffee, FaBeer, FaWineGlass, FaPizzaSlice,
  FaMusic, FaGuitar, FaDrum, FaHeadphonesAlt,
  FaGamepad, FaDice, FaPuzzlePiece, FaChess,
  FaMicrosoft,
} from "react-icons/fa";
import {
  Activity, AlertCircle, AlignLeft, Archive, Award,
  BarChart2, BarChart, Battery, Bell, BellRing, Bookmark,
  Box, Briefcase, Building, Building2, Calendar, CalendarCheck,
  Camera, Check, CheckCircle2, ChevronRight, Clock, Cloud,
  CloudLightning, Code2, Cog, Compass, CreditCard, Database,
  Download, Edit2, Edit3, ExternalLink, Eye, File, FileText,
  Filter, Flag, Flame, Folder, FolderOpen, Gauge, Gift, GitBranch, Globe2, Globe,
  Grid, Hammer, Hash, Heart, HelpCircle, Home, Image, Inbox,
  Info, Key, Layers, Layout, LifeBuoy, Link, List, Lock,
  LogIn, LogOut, Mail, Map, MapPin, Maximize, Menu, MessageCircle,
  MessageSquare, Mic, MicOff, Minimize, Minus, Monitor, Moon,
  MoreHorizontal, MoreVertical, Music, Navigation, Package,
  Percent, Phone, PhoneCall, PhoneIncoming, Play, Plus,
  Power, Printer, RefreshCcw, RefreshCw, Rocket, Search, Send, Server,
  Settings, Share2, ShieldCheck, ShieldOff, ShoppingBag, ShoppingCart, Store,
  Sliders, Smartphone, Speaker, Star, Sun, Tag, Target, Terminal,
  ThumbsUp, ToggleLeft, ToggleRight, Trash2, TrendingDown, TrendingUp,
  Trophy, Tv, Umbrella, Upload, User, UserCheck, UserMinus, UserPlus,
  Users, Video, Voicemail, Volume2, Wifi, Wind, Wrench, Zap,
  ZoomIn, ZoomOut, Book, BookOpen, Cpu, DollarSign, Feather,
  Github, Gitlab, Globe2 as Globe2b, Headphones, Layers as Layers2,
  LayoutDashboard, LineChart, Lightbulb, Lock as Lock2, Megaphone,
  PenTool, Rss, Save, Shield, Scissors, Square, Triangle, Circle,
  Hexagon, Octagon, ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  CornerDownRight, Move, Repeat, Shuffle, SkipForward, Wand2,
} from "lucide-react";
import {
  FiBarChart2, FiCalendar, FiCamera, FiCheckCircle, FiCode, FiFeather,
  FiFlag, FiGlobe, FiHeart, FiLayout, FiLifeBuoy, FiMail, FiMapPin,
  FiMessageSquare, FiMonitor, FiPenTool, FiPhone, FiSearch, FiShoppingBag,
  FiStar, FiUser, FiVideo, FiZap,
} from "react-icons/fi";
import {
  BsCalendar2Event, BsCamera, BsCameraVideo, BsCart3, BsChatSquareText,
  BsCheckCircle, BsGear, BsGeoAlt, BsGlobe, BsGraphUpArrow, BsMegaphone,
  BsPalette, BsPerson, BsSearch, BsShieldCheck, BsStars, BsTelephone,
} from "react-icons/bs";

const MdAnalytics = BarChart;
const MdAutoAwesome = Zap;
const MdBusiness = Building2;
const MdCampaign = Megaphone;
const MdContactPage = FileText;
const MdDashboard = LayoutDashboard;
const MdEmail = Mail;
const MdGroups = Users;
const MdInsights = LineChart;
const MdIntegrationInstructions = GitBranch;
const MdNotifications = Bell;
const MdPayment = CreditCard;
const MdPeople = Users;
const MdSchedule = Calendar;
const MdSecurity = ShieldCheck;
const MdSmartphone = Smartphone;
const MdSpeed = Gauge;
const MdSupport = LifeBuoy;
const MdTrendingUp = TrendingUp;
const MdAccountTree = GitBranch;
const MdFormatQuote = MessageSquare;
const MdArticle = FileText;
const MdWeb = Globe;
const MdOutlineStorefront = Store;
const MdOutlineLocalOffer = Tag;
const MdOutlinePrecisionManufacturing = Hammer;
const MdOutlineRocketLaunch = Rocket;
const MdOutlineVerified = CheckCircle2;
const MdOutlineAutoFixHigh = Wand2;

function makeBrandLetterIcon(label, background = "#111827") {
  return function BrandLetterIcon({ size = 24, color = "#ffffff", style, ...props }) {
    const fontSize = String(label || "").length > 1 ? 8 : 12;
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...props}>
        <rect x="2" y="2" width="20" height="20" rx="5" fill={background} />
        <text x="12" y="16" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize={fontSize} fontWeight="700" fill={color}>
          {label}
        </text>
      </svg>
    );
  };
}

function SiTiktok({ size = 24, color = "currentColor", style, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...props}>
      <path fill={color} d="M16.6 3c.35 2.03 1.5 3.5 3.4 4.25v3.22c-1.37-.04-2.55-.43-3.55-1.16v5.75c0 3.57-2.24 5.94-5.58 5.94-2.9 0-5.05-1.92-5.05-4.64 0-3.06 2.45-5.04 5.7-4.78v3.3c-1.37-.2-2.34.36-2.34 1.42 0 .86.7 1.43 1.67 1.43 1.29 0 2.02-.82 2.02-2.49V3h3.73Z" />
    </svg>
  );
}

function SiX({ size = 24, color = "currentColor", style, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...props}>
      <path fill={color} d="M13.9 10.5 21.3 2h-1.75l-6.43 7.36L7.98 2H2.06l7.77 11.12L2.06 22h1.75l6.8-7.78L16.04 22h5.92l-8.06-11.5Zm-2.41 2.76-.79-1.11L4.44 3.3h2.7l5.06 7.16.79 1.11 6.56 9.27h-2.7l-5.36-7.58Z" />
    </svg>
  );
}

function SocialSvgIcon({ size = 24, color = "currentColor", style, children, ...props }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" style={{ display: "inline-block", verticalAlign: "middle", ...style }} {...props}>
      {children(color)}
    </svg>
  );
}

function FacebookIcon(props) {
  return <SocialSvgIcon {...props}>{(color) => <path fill={color} d="M14.1 8.25V6.8c0-.7.48-.86.82-.86H17V2.66l-2.86-.01c-3.18 0-3.9 2.38-3.9 3.9v1.7H7.75v3.38h2.49v9.72h3.86v-9.72H17l.38-3.38H14.1Z" />}</SocialSvgIcon>;
}

function InstagramIcon(props) {
  return (
    <SocialSvgIcon {...props}>{(color) => (
      <>
        <path fill={color} d="M7.2 2.8h9.6a4.4 4.4 0 0 1 4.4 4.4v9.6a4.4 4.4 0 0 1-4.4 4.4H7.2a4.4 4.4 0 0 1-4.4-4.4V7.2a4.4 4.4 0 0 1 4.4-4.4Zm0 2A2.4 2.4 0 0 0 4.8 7.2v9.6a2.4 2.4 0 0 0 2.4 2.4h9.6a2.4 2.4 0 0 0 2.4-2.4V7.2a2.4 2.4 0 0 0-2.4-2.4H7.2Z" />
        <path fill={color} d="M12 7.45a4.55 4.55 0 1 1 0 9.1 4.55 4.55 0 0 1 0-9.1Zm0 2a2.55 2.55 0 1 0 0 5.1 2.55 2.55 0 0 0 0-5.1Z" />
        <circle cx="16.85" cy="7.15" r="1.15" fill={color} />
      </>
    )}</SocialSvgIcon>
  );
}

function LinkedInIcon(props) {
  return <SocialSvgIcon {...props}>{(color) => <path fill={color} d="M4.55 8.65h3.38V19.5H4.55V8.65Zm1.7-5.4a1.96 1.96 0 1 1 0 3.92 1.96 1.96 0 0 1 0-3.92ZM10.04 8.65h3.23v1.48h.05c.45-.85 1.55-1.75 3.18-1.75 3.4 0 4.03 2.24 4.03 5.15v5.97h-3.37v-5.3c0-1.26-.02-2.88-1.75-2.88-1.76 0-2.03 1.37-2.03 2.79v5.39h-3.34V8.65Z" />}</SocialSvgIcon>;
}

function PinterestIcon(props) {
  return <SocialSvgIcon {...props}>{(color) => <path fill={color} d="M12.2 2.7c-5.05 0-7.6 3.62-7.6 6.64 0 1.83.69 3.45 2.18 4.06.24.1.46 0 .53-.27.05-.18.16-.66.21-.86.07-.27.04-.36-.15-.59-.43-.5-.7-1.14-.7-2.05 0-2.68 2-5.08 5.22-5.08 2.85 0 4.42 1.74 4.42 4.07 0 3.06-1.35 5.64-3.36 5.64-1.1 0-1.94-.91-1.67-2.04.32-1.34.94-2.79.94-3.76 0-.87-.46-1.59-1.43-1.59-1.14 0-2.05 1.18-2.05 2.75 0 1 .34 1.68.34 1.68l-1.37 5.8c-.41 1.73-.06 3.85-.03 4.06.02.12.17.15.24.06.1-.13 1.42-1.76 1.87-3.4.13-.46.74-2.88.74-2.88.37.7 1.44 1.31 2.58 1.31 3.4 0 5.7-3.1 5.7-7.25 0-3.14-2.66-6.07-6.7-6.07Z" />}</SocialSvgIcon>;
}

function YouTubeIcon(props) {
  return <SocialSvgIcon {...props}>{(color) => <path fill={color} d="M21.55 7.05a2.5 2.5 0 0 0-1.76-1.78C18.24 4.85 12 4.85 12 4.85s-6.24 0-7.79.42a2.5 2.5 0 0 0-1.76 1.78C2.03 8.62 2.03 11.9 2.03 11.9s0 3.28.42 4.85a2.5 2.5 0 0 0 1.76 1.78c1.55.42 7.79.42 7.79.42s6.24 0 7.79-.42a2.5 2.5 0 0 0 1.76-1.78c.42-1.57.42-4.85.42-4.85s0-3.28-.42-4.85ZM10 14.92V8.88l5.22 3.02L10 14.92Z" />}</SocialSvgIcon>;
}

function GenericSocialIcon(props) {
  return <SocialSvgIcon {...props}>{(color) => <path fill={color} d="M7.2 14.45a2.95 2.95 0 1 1 0-4.9l6.66-3.34a3 3 0 1 1 .9 1.8L8.1 11.35a3.1 3.1 0 0 1 0 1.3l6.7 3.35a2.98 2.98 0 1 1-.9 1.8l-6.7-3.35Z" />}</SocialSvgIcon>;
}

const SiSlack = makeBrandLetterIcon("S", "#4a154b");
const SiNotion = makeBrandLetterIcon("N", "#111827");
const SiZapier = makeBrandLetterIcon("Z", "#ff4a00");
const SiHubspot = makeBrandLetterIcon("H", "#ff5c35");
const SiMailchimp = makeBrandLetterIcon("M", "#ffe01b");
const SiShopify = makeBrandLetterIcon("S", "#95bf47");
const SiWordpress = makeBrandLetterIcon("W", "#21759b");
const SiWix = makeBrandLetterIcon("W", "#0c6efc");
const SiWebflow = makeBrandLetterIcon("W", "#146ef5");
const SiStripe = makeBrandLetterIcon("S", "#635bff");
const SiPaypal = makeBrandLetterIcon("P", "#003087");
const SiGoogleanalytics = makeBrandLetterIcon("GA", "#f9ab00");
const SiGoogle = makeBrandLetterIcon("G", "#4285f4");
const SiGooglemeet = makeBrandLetterIcon("GM", "#00897b");
const SiZoom = makeBrandLetterIcon("Z", "#0b5cff");
const SiAmazon = makeBrandLetterIcon("A", "#ff9900");
const SiSpotify = makeBrandLetterIcon("S", "#1db954");
const SiDropbox = makeBrandLetterIcon("D", "#0061ff");
const SiTrello = makeBrandLetterIcon("T", "#0079bf");
const SiAsana = makeBrandLetterIcon("A", "#f06a6a");
const SiJira = makeBrandLetterIcon("J", "#0052cc");
const SiClickup = makeBrandLetterIcon("C", "#7b68ee");
const SiAirtable = makeBrandLetterIcon("A", "#18bfff");
const SiGoogleads = makeBrandLetterIcon("Ads", "#34a853");

// ─── FontAwesome ──────────────────────────────────────────────────────────────
const FA_ICONS = [
  // Marketing
  { key: "social",        label: "Bullhorn",      group: "Marketing",    Icon: FaBullhorn },
  { key: "marketing",     label: "Target",        group: "Marketing",    Icon: FaBullseye },
  { key: "seo",           label: "Search",        group: "Marketing",    Icon: FaSearch },
  { key: "rocket",        label: "Rocket",        group: "Marketing",    Icon: FaRocket },
  { key: "lightbulb",     label: "Lightbulb",     group: "Marketing",    Icon: FaLightbulb },
  { key: "fire",          label: "Fire",          group: "Marketing",    Icon: FaFire },
  { key: "magic",         label: "Magic",         group: "Marketing",    Icon: FaMagic },
  { key: "percent",       label: "Percent",       group: "Marketing",    Icon: FaPercent },
  { key: "tag",           label: "Tag",           group: "Marketing",    Icon: FaTag },
  { key: "tags",          label: "Tags",          group: "Marketing",    Icon: FaTags },
  { key: "gift",          label: "Gift",          group: "Marketing",    Icon: FaGift },
  { key: "trophy",        label: "Trophy",        group: "Marketing",    Icon: FaTrophy },
  { key: "medal",         label: "Medal",         group: "Marketing",    Icon: FaMedal },
  { key: "award",         label: "Award",         group: "Marketing",    Icon: FaAward },
  { key: "certificate",   label: "Certificate",   group: "Marketing",    Icon: FaCertificate },
  { key: "crown",         label: "Crown",         group: "Marketing",    Icon: FaCrown },
  { key: "gem",           label: "Gem",           group: "Marketing",    Icon: FaGem },
  // Communication
  { key: "email",         label: "Email",         group: "Communication", Icon: FaEnvelope },
  { key: "phone",         label: "Phone",         group: "Communication", Icon: FaPhone },
  { key: "chat",          label: "Chat",          group: "Communication", Icon: FaComments },
  { key: "paper-plane",   label: "Send",          group: "Communication", Icon: FaPaperPlane },
  { key: "reply",         label: "Reply",         group: "Communication", Icon: FaReply },
  { key: "mobile",        label: "Mobile",        group: "Communication", Icon: FaMobileAlt },
  { key: "microphone",    label: "Microphone",    group: "Communication", Icon: FaMicrophone },
  { key: "headphones",    label: "Headphones",    group: "Communication", Icon: FaHeadphones },
  { key: "bell",          label: "Bell",          group: "Communication", Icon: FaBell },
  { key: "bookmark",      label: "Bookmark",      group: "Communication", Icon: FaBookmark },
  { key: "share",         label: "Share",         group: "Communication", Icon: FaShareAlt },
  { key: "link",          label: "Link",          group: "Communication", Icon: FaLink },
  // Technology
  { key: "software",      label: "Server",        group: "Technology",   Icon: FaHdd },
  { key: "web",           label: "Globe",         group: "Technology",   Icon: FaGlobe },
  { key: "laptop",        label: "Laptop",        group: "Technology",   Icon: FaLaptop },
  { key: "desktop",       label: "Desktop",       group: "Technology",   Icon: FaDesktop },
  { key: "wifi",          label: "Wi-Fi",         group: "Technology",   Icon: FaWifi },
  { key: "cloud",         label: "Cloud",         group: "Technology",   Icon: FaCloud },
  { key: "database",      label: "Database",      group: "Technology",   Icon: FaDatabase },
  { key: "server",        label: "Server",        group: "Technology",   Icon: FaServer },
  { key: "code",          label: "Code",          group: "Technology",   Icon: FaCode },
  { key: "robot",         label: "Robot",         group: "Technology",   Icon: FaRobot },
  { key: "brain",         label: "Brain (AI)",    group: "Technology",   Icon: FaBrain },
  { key: "satellite",     label: "Satellite",     group: "Technology",   Icon: FaSatelliteDish },
  { key: "lock",          label: "Lock",          group: "Technology",   Icon: FaLock },
  { key: "shield",        label: "Shield",        group: "Technology",   Icon: FaShieldAlt },
  { key: "key",           label: "Key",           group: "Technology",   Icon: FaKey },
  { key: "wrench",        label: "Wrench",        group: "Technology",   Icon: FaWrench },
  { key: "tools",         label: "Tools",         group: "Technology",   Icon: FaTools },
  { key: "bug",           label: "Bug",           group: "Technology",   Icon: FaBug },
  // Business
  { key: "calendar",      label: "Calendar",      group: "Business",     Icon: FaCalendarAlt },
  { key: "analytics",     label: "Analytics",     group: "Business",     Icon: FaChartLine },
  { key: "chart-bar",     label: "Bar Chart",     group: "Business",     Icon: FaChartBar },
  { key: "chart-pie",     label: "Pie Chart",     group: "Business",     Icon: FaChartPie },
  { key: "settings",      label: "Settings",      group: "Business",     Icon: FaCog },
  { key: "clipboard",     label: "Clipboard",     group: "Business",     Icon: FaClipboard },
  { key: "table",         label: "Table",         group: "Business",     Icon: FaTable },
  { key: "list",          label: "List",          group: "Business",     Icon: FaList },
  { key: "filter",        label: "Filter",        group: "Business",     Icon: FaFilter },
  { key: "location",      label: "Location",      group: "Business",     Icon: FaMapMarkerAlt },
  { key: "map",           label: "Map",           group: "Business",     Icon: FaMapMarked },
  { key: "compass",       label: "Compass",       group: "Business",     Icon: FaCompass },
  { key: "building",      label: "Building",      group: "Business",     Icon: FaBuilding },
  { key: "industry",      label: "Industry",      group: "Business",     Icon: FaIndustry },
  { key: "flag",          label: "Flag",          group: "Business",     Icon: FaFlag },
  { key: "folder",        label: "Folder",        group: "Business",     Icon: FaFolder },
  { key: "file",          label: "File",          group: "Business",     Icon: FaFile },
  { key: "file-pdf",      label: "PDF",           group: "Business",     Icon: FaFilePdf },
  { key: "download",      label: "Download",      group: "Business",     Icon: FaDownload },
  { key: "upload",        label: "Upload",        group: "Business",     Icon: FaUpload },
  // Commerce
  { key: "store",         label: "Store",         group: "Commerce",     Icon: FaStore },
  { key: "shop-cart",     label: "Cart",          group: "Commerce",     Icon: FaShoppingCart },
  { key: "money",         label: "Money",         group: "Commerce",     Icon: FaMoneyBillWave },
  { key: "dollar",        label: "Dollar",        group: "Commerce",     Icon: FaDollarSign },
  { key: "credit-card",   label: "Credit Card",   group: "Commerce",     Icon: FaCreditCard },
  { key: "receipt",       label: "Receipt",       group: "Commerce",     Icon: FaReceipt },
  { key: "box",           label: "Box",           group: "Commerce",     Icon: FaBoxOpen },
  { key: "warehouse",     label: "Warehouse",     group: "Commerce",     Icon: FaWarehouse },
  // People
  { key: "user",          label: "User",          group: "People",       Icon: FaUser },
  { key: "user-tie",      label: "User (Tie)",    group: "People",       Icon: FaUserTie },
  { key: "users",         label: "Users",         group: "People",       Icon: FaUsers },
  { key: "user-friends",  label: "Friends",       group: "People",       Icon: FaUserFriends },
  { key: "user-check",    label: "User Check",    group: "People",       Icon: FaUserCheck },
  { key: "user-plus",     label: "Add User",      group: "People",       Icon: FaUserPlus },
  { key: "user-cog",      label: "User Settings", group: "People",       Icon: FaUserCog },
  { key: "handshake",     label: "Handshake",     group: "People",       Icon: FaHandshake },
  { key: "thumbs-up",     label: "Thumbs Up",     group: "People",       Icon: FaThumbsUp },
  { key: "thumbs-down",   label: "Thumbs Down",   group: "People",       Icon: FaThumbsDown },
  // Education / Skills
  { key: "graduation",    label: "Graduation",    group: "Education",    Icon: FaGraduationCap },
  { key: "university",    label: "University",    group: "Education",    Icon: FaUniversity },
  { key: "school",        label: "School",        group: "Education",    Icon: FaSchool },
  { key: "microscope",    label: "Microscope",    group: "Education",    Icon: FaMicroscope },
  { key: "flask",         label: "Flask",         group: "Education",    Icon: FaFlask },
  // Media
  { key: "video",         label: "Video",         group: "Media",        Icon: FaVideo },
  { key: "camera",        label: "Camera",        group: "Media",        Icon: FaCamera },
  { key: "image",         label: "Image",         group: "Media",        Icon: FaImage },
  { key: "images",        label: "Images",        group: "Media",        Icon: FaImages },
  { key: "music",         label: "Music",         group: "Media",        Icon: FaMusic },
  { key: "headphones-alt", label: "Headphones",   group: "Media",        Icon: FaHeadphonesAlt },
  // Creative
  { key: "design",        label: "Paint Brush",   group: "Creative",     Icon: FaPaintBrush },
  { key: "palette",       label: "Palette",       group: "Creative",     Icon: FaPalette },
  { key: "brush",         label: "Brush",         group: "Creative",     Icon: FaBrush },
  { key: "swatchbook",    label: "Swatch",        group: "Creative",     Icon: FaSwatchbook },
  { key: "crop",          label: "Crop",          group: "Creative",     Icon: FaCrop },
  { key: "edit",          label: "Edit",          group: "Creative",     Icon: FaEdit },
  { key: "pencil",        label: "Pencil",        group: "Creative",     Icon: FaPencilAlt },
  // UI
  { key: "favorite",      label: "Heart",         group: "UI",           Icon: FaHeart },
  { key: "star",          label: "Star",          group: "UI",           Icon: FaStar },
  { key: "check",         label: "Check",         group: "UI",           Icon: FaCheckCircle },
  { key: "info",          label: "Info",          group: "UI",           Icon: FaInfoCircle },
  { key: "warning",       label: "Warning",       group: "UI",           Icon: FaExclamationTriangle },
  { key: "error",         label: "Error",         group: "UI",           Icon: FaExclamationCircle },
  { key: "home",          label: "Home",          group: "UI",           Icon: FaHome },
  { key: "arrow-right",   label: "Arrow Right",   group: "UI",           Icon: FaArrowRight },
  { key: "arrow-left",    label: "Arrow Left",    group: "UI",           Icon: FaArrowLeft },
  { key: "arrow-up",      label: "Arrow Up",      group: "UI",           Icon: FaArrowUp },
  { key: "arrow-down",    label: "Arrow Down",    group: "UI",           Icon: FaArrowDown },
  { key: "external-link", label: "External Link", group: "UI",           Icon: FaExternalLinkAlt },
  { key: "eye",           label: "Eye",           group: "UI",           Icon: FaEye },
  { key: "sun",           label: "Sun",           group: "UI",           Icon: FaSun },
  { key: "moon",          label: "Moon",          group: "UI",           Icon: FaMoon },
  { key: "bolt",          label: "Bolt",          group: "UI",           Icon: FaBolt },
  { key: "leaf",          label: "Leaf",          group: "UI",           Icon: FaLeaf },
  // Transport
  { key: "car",           label: "Car",           group: "Transport",    Icon: FaCar },
  { key: "truck",         label: "Truck",         group: "Transport",    Icon: FaTruck },
  { key: "plane",         label: "Plane",         group: "Transport",    Icon: FaPlane },
  { key: "ship",          label: "Ship",          group: "Transport",    Icon: FaShip },
  // Health & Fitness
  { key: "heartbeat",     label: "Heartbeat",     group: "Health",       Icon: FaHeartbeat },
  { key: "dumbbell",      label: "Dumbbell",      group: "Health",       Icon: FaDumbbell },
  { key: "running",       label: "Running",       group: "Health",       Icon: FaRunning },
  { key: "hospital",      label: "Hospital",      group: "Health",       Icon: FaHospital },
  // Food & Lifestyle
  { key: "coffee",        label: "Coffee",        group: "Lifestyle",    Icon: FaCoffee },
  { key: "utensils",      label: "Utensils",      group: "Lifestyle",    Icon: FaUtensils },
  { key: "pizza",         label: "Pizza",         group: "Lifestyle",    Icon: FaPizzaSlice },
  // Games
  { key: "gamepad",       label: "Gamepad",       group: "Leisure",      Icon: FaGamepad },
  { key: "chess",         label: "Chess",         group: "Leisure",      Icon: FaChess },
  { key: "puzzle",        label: "Puzzle",        group: "Leisure",      Icon: FaPuzzlePiece },
  { key: "dice",          label: "Dice",          group: "Leisure",      Icon: FaDice },
];

// ─── Lucide ───────────────────────────────────────────────────────────────────
const LUCIDE_ICONS = [
  { key: "lc-dashboard",     label: "Dashboard",       group: "Lucide",   Icon: LayoutDashboard },
  { key: "lc-activity",      label: "Activity",        group: "Lucide",   Icon: Activity },
  { key: "lc-alert",         label: "Alert",           group: "Lucide",   Icon: AlertCircle },
  { key: "lc-archive",       label: "Archive",         group: "Lucide",   Icon: Archive },
  { key: "lc-award",         label: "Award",           group: "Lucide",   Icon: Award },
  { key: "lc-barchart",      label: "Bar Chart",       group: "Lucide",   Icon: BarChart2 },
  { key: "lc-battery",       label: "Battery",         group: "Lucide",   Icon: Battery },
  { key: "lc-bell",          label: "Bell",            group: "Lucide",   Icon: Bell },
  { key: "lc-bell-ring",     label: "Bell Ring",       group: "Lucide",   Icon: BellRing },
  { key: "lc-bookmark",      label: "Bookmark",        group: "Lucide",   Icon: Bookmark },
  { key: "lc-box",           label: "Box",             group: "Lucide",   Icon: Box },
  { key: "lc-briefcase",     label: "Briefcase",       group: "Lucide",   Icon: Briefcase },
  { key: "lc-building",      label: "Building",        group: "Lucide",   Icon: Building2 },
  { key: "lc-calendar",      label: "Calendar",        group: "Lucide",   Icon: Calendar },
  { key: "lc-calendar-chk",  label: "Cal. Check",      group: "Lucide",   Icon: CalendarCheck },
  { key: "lc-camera",        label: "Camera",          group: "Lucide",   Icon: Camera },
  { key: "lc-check",         label: "Check",           group: "Lucide",   Icon: CheckCircle2 },
  { key: "lc-clock",         label: "Clock",           group: "Lucide",   Icon: Clock },
  { key: "lc-cloud",         label: "Cloud",           group: "Lucide",   Icon: Cloud },
  { key: "lc-cloud-zap",     label: "Cloud Zap",       group: "Lucide",   Icon: CloudLightning },
  { key: "lc-code",          label: "Code",            group: "Lucide",   Icon: Code2 },
  { key: "lc-cog",           label: "Settings",        group: "Lucide",   Icon: Cog },
  { key: "lc-compass",       label: "Compass",         group: "Lucide",   Icon: Compass },
  { key: "lc-credit",        label: "Credit Card",     group: "Lucide",   Icon: CreditCard },
  { key: "lc-database",      label: "Database",        group: "Lucide",   Icon: Database },
  { key: "lc-download",      label: "Download",        group: "Lucide",   Icon: Download },
  { key: "lc-edit",          label: "Edit",            group: "Lucide",   Icon: Edit3 },
  { key: "lc-eye",           label: "Eye",             group: "Lucide",   Icon: Eye },
  { key: "lc-file",          label: "File",            group: "Lucide",   Icon: FileText },
  { key: "lc-filter",        label: "Filter",          group: "Lucide",   Icon: Filter },
  { key: "lc-flag",          label: "Flag",            group: "Lucide",   Icon: Flag },
  { key: "lc-flame",         label: "Flame",           group: "Lucide",   Icon: Flame },
  { key: "lc-folder",        label: "Folder",          group: "Lucide",   Icon: FolderOpen },
  { key: "lc-gift",          label: "Gift",            group: "Lucide",   Icon: Gift },
  { key: "lc-globe",         label: "Globe",           group: "Lucide",   Icon: Globe },
  { key: "lc-grid",          label: "Grid",            group: "Lucide",   Icon: Grid },
  { key: "lc-hammer",        label: "Hammer",          group: "Lucide",   Icon: Hammer },
  { key: "lc-hash",          label: "Hash",            group: "Lucide",   Icon: Hash },
  { key: "lc-heart",         label: "Heart",           group: "Lucide",   Icon: Heart },
  { key: "lc-help",          label: "Help",            group: "Lucide",   Icon: HelpCircle },
  { key: "lc-home",          label: "Home",            group: "Lucide",   Icon: Home },
  { key: "lc-image",         label: "Image",           group: "Lucide",   Icon: Image },
  { key: "lc-inbox",         label: "Inbox",           group: "Lucide",   Icon: Inbox },
  { key: "lc-info",          label: "Info",            group: "Lucide",   Icon: Info },
  { key: "lc-key",           label: "Key",             group: "Lucide",   Icon: Key },
  { key: "lc-layers",        label: "Layers",          group: "Lucide",   Icon: Layers },
  { key: "lc-layout",        label: "Layout",          group: "Lucide",   Icon: Layout },
  { key: "lc-lifebuoy",      label: "Life Buoy",       group: "Lucide",   Icon: LifeBuoy },
  { key: "lc-link",          label: "Link",            group: "Lucide",   Icon: Link },
  { key: "lc-linechart",     label: "Line Chart",      group: "Lucide",   Icon: LineChart },
  { key: "lc-list",          label: "List",            group: "Lucide",   Icon: List },
  { key: "lc-lock",          label: "Lock",            group: "Lucide",   Icon: Lock },
  { key: "lc-mail",          label: "Mail",            group: "Lucide",   Icon: Mail },
  { key: "lc-map",           label: "Map",             group: "Lucide",   Icon: Map },
  { key: "lc-mappin",        label: "Map Pin",         group: "Lucide",   Icon: MapPin },
  { key: "lc-megaphone",     label: "Megaphone",       group: "Lucide",   Icon: Megaphone },
  { key: "lc-menu",          label: "Menu",            group: "Lucide",   Icon: Menu },
  { key: "lc-message",       label: "Message",         group: "Lucide",   Icon: MessageCircle },
  { key: "lc-messagesq",     label: "Message Box",     group: "Lucide",   Icon: MessageSquare },
  { key: "lc-mic",           label: "Microphone",      group: "Lucide",   Icon: Mic },
  { key: "lc-monitor",       label: "Monitor",         group: "Lucide",   Icon: Monitor },
  { key: "lc-moon",          label: "Moon",            group: "Lucide",   Icon: Moon },
  { key: "lc-music",         label: "Music",           group: "Lucide",   Icon: Music },
  { key: "lc-navigation",    label: "Navigation",      group: "Lucide",   Icon: Navigation },
  { key: "lc-package",       label: "Package",         group: "Lucide",   Icon: Package },
  { key: "lc-percent",       label: "Percent",         group: "Lucide",   Icon: Percent },
  { key: "lc-phone",         label: "Phone",           group: "Lucide",   Icon: Phone },
  { key: "lc-phone-call",    label: "Phone Call",      group: "Lucide",   Icon: PhoneCall },
  { key: "lc-play",          label: "Play",            group: "Lucide",   Icon: Play },
  { key: "lc-power",         label: "Power",           group: "Lucide",   Icon: Power },
  { key: "lc-printer",       label: "Printer",         group: "Lucide",   Icon: Printer },
  { key: "lc-refresh",       label: "Refresh",         group: "Lucide",   Icon: RefreshCw },
  { key: "lc-search",        label: "Search",          group: "Lucide",   Icon: Search },
  { key: "lc-send",          label: "Send",            group: "Lucide",   Icon: Send },
  { key: "lc-server",        label: "Server",          group: "Lucide",   Icon: Server },
  { key: "lc-settings",      label: "Settings",        group: "Lucide",   Icon: Settings },
  { key: "lc-share",         label: "Share",           group: "Lucide",   Icon: Share2 },
  { key: "lc-shield",        label: "Shield",          group: "Lucide",   Icon: ShieldCheck },
  { key: "lc-shop-bag",      label: "Shopping Bag",    group: "Lucide",   Icon: ShoppingBag },
  { key: "lc-shop-cart",     label: "Cart",            group: "Lucide",   Icon: ShoppingCart },
  { key: "lc-sliders",       label: "Sliders",         group: "Lucide",   Icon: Sliders },
  { key: "lc-smartphone",    label: "Smartphone",      group: "Lucide",   Icon: Smartphone },
  { key: "lc-speaker",       label: "Speaker",         group: "Lucide",   Icon: Speaker },
  { key: "lc-star",          label: "Star",            group: "Lucide",   Icon: Star },
  { key: "lc-sun",           label: "Sun",             group: "Lucide",   Icon: Sun },
  { key: "lc-tag",           label: "Tag",             group: "Lucide",   Icon: Tag },
  { key: "lc-target",        label: "Target",          group: "Lucide",   Icon: Target },
  { key: "lc-terminal",      label: "Terminal",        group: "Lucide",   Icon: Terminal },
  { key: "lc-thumbsup",      label: "Thumbs Up",       group: "Lucide",   Icon: ThumbsUp },
  { key: "lc-trash",         label: "Trash",           group: "Lucide",   Icon: Trash2 },
  { key: "lc-trend-up",      label: "Trending Up",     group: "Lucide",   Icon: TrendingUp },
  { key: "lc-trend-dn",      label: "Trending Down",   group: "Lucide",   Icon: TrendingDown },
  { key: "lc-trophy",        label: "Trophy",          group: "Lucide",   Icon: Trophy },
  { key: "lc-tv",            label: "TV",              group: "Lucide",   Icon: Tv },
  { key: "lc-umbrella",      label: "Umbrella",        group: "Lucide",   Icon: Umbrella },
  { key: "lc-upload",        label: "Upload",          group: "Lucide",   Icon: Upload },
  { key: "lc-user",          label: "User",            group: "Lucide",   Icon: User },
  { key: "lc-user-chk",      label: "User Check",      group: "Lucide",   Icon: UserCheck },
  { key: "lc-user-plus",     label: "Add User",        group: "Lucide",   Icon: UserPlus },
  { key: "lc-users",         label: "Users",           group: "Lucide",   Icon: Users },
  { key: "lc-video",         label: "Video",           group: "Lucide",   Icon: Video },
  { key: "lc-voicemail",     label: "Voicemail",       group: "Lucide",   Icon: Voicemail },
  { key: "lc-volume",        label: "Volume",          group: "Lucide",   Icon: Volume2 },
  { key: "lc-wifi",          label: "Wifi",            group: "Lucide",   Icon: Wifi },
  { key: "lc-wind",          label: "Wind",            group: "Lucide",   Icon: Wind },
  { key: "lc-wrench",        label: "Wrench",          group: "Lucide",   Icon: Wrench },
  { key: "lc-zap",           label: "Zap",             group: "Lucide",   Icon: Zap },
  { key: "lc-book",          label: "Book",            group: "Lucide",   Icon: Book },
  { key: "lc-bookopen",      label: "Book Open",       group: "Lucide",   Icon: BookOpen },
  { key: "lc-cpu",           label: "CPU",             group: "Lucide",   Icon: Cpu },
  { key: "lc-dollar",        label: "Dollar",          group: "Lucide",   Icon: DollarSign },
  { key: "lc-headphones",    label: "Headphones",      group: "Lucide",   Icon: Headphones },
  { key: "lc-lightbulb",     label: "Lightbulb",       group: "Lucide",   Icon: Lightbulb },
  { key: "lc-pentool",       label: "Pen Tool",        group: "Lucide",   Icon: PenTool },
  { key: "lc-rss",           label: "RSS",             group: "Lucide",   Icon: Rss },
  { key: "lc-save",          label: "Save",            group: "Lucide",   Icon: Save },
  { key: "lc-scissors",      label: "Scissors",        group: "Lucide",   Icon: Scissors },
  { key: "lc-arrow-right",   label: "Arrow Right",     group: "Lucide",   Icon: ArrowRight },
  { key: "lc-arrow-left",    label: "Arrow Left",      group: "Lucide",   Icon: ArrowLeft },
  { key: "lc-arrow-up",      label: "Arrow Up",        group: "Lucide",   Icon: ArrowUp },
  { key: "lc-arrow-down",    label: "Arrow Down",      group: "Lucide",   Icon: ArrowDown },
  { key: "lc-move",          label: "Move",            group: "Lucide",   Icon: Move },
  { key: "lc-repeat",        label: "Repeat",          group: "Lucide",   Icon: Repeat },
  { key: "lc-skip",          label: "Skip",            group: "Lucide",   Icon: SkipForward },
];

// ─── Material Design ──────────────────────────────────────────────────────────
const MD_ICONS = [
  { key: "md-analytics",      label: "Analytics",       group: "Material", Icon: MdAnalytics },
  { key: "md-autoawesome",    label: "Auto Awesome",    group: "Material", Icon: MdAutoAwesome },
  { key: "md-business",       label: "Business",        group: "Material", Icon: MdBusiness },
  { key: "md-campaign",       label: "Campaign",        group: "Material", Icon: MdCampaign },
  { key: "md-contact",        label: "Contact Page",    group: "Material", Icon: MdContactPage },
  { key: "md-dashboard",      label: "Dashboard",       group: "Material", Icon: MdDashboard },
  { key: "md-email",          label: "Email",           group: "Material", Icon: MdEmail },
  { key: "md-groups",         label: "Groups",          group: "Material", Icon: MdGroups },
  { key: "md-insights",       label: "Insights",        group: "Material", Icon: MdInsights },
  { key: "md-integrations",   label: "Integrations",    group: "Material", Icon: MdIntegrationInstructions },
  { key: "md-notifications",  label: "Notifications",   group: "Material", Icon: MdNotifications },
  { key: "md-payment",        label: "Payment",         group: "Material", Icon: MdPayment },
  { key: "md-people",         label: "People",          group: "Material", Icon: MdPeople },
  { key: "md-schedule",       label: "Schedule",        group: "Material", Icon: MdSchedule },
  { key: "md-security",       label: "Security",        group: "Material", Icon: MdSecurity },
  { key: "md-smartphone",     label: "Smartphone",      group: "Material", Icon: MdSmartphone },
  { key: "md-speed",          label: "Speed",           group: "Material", Icon: MdSpeed },
  { key: "md-support",        label: "Support",         group: "Material", Icon: MdSupport },
  { key: "md-trending",       label: "Trending Up",     group: "Material", Icon: MdTrendingUp },
  { key: "md-workflow",       label: "Workflow",        group: "Material", Icon: MdAccountTree },
  { key: "md-quote",          label: "Quote",           group: "Material", Icon: MdFormatQuote },
  { key: "md-article",        label: "Article",         group: "Material", Icon: MdArticle },
  { key: "md-web",            label: "Web",             group: "Material", Icon: MdWeb },
  { key: "md-storefront",     label: "Storefront",      group: "Material", Icon: MdOutlineStorefront },
  { key: "md-offer",          label: "Local Offer",     group: "Material", Icon: MdOutlineLocalOffer },
  { key: "md-manufacturing",  label: "Manufacturing",   group: "Material", Icon: MdOutlinePrecisionManufacturing },
  { key: "md-rocket",         label: "Rocket Launch",   group: "Material", Icon: MdOutlineRocketLaunch },
  { key: "md-verified",       label: "Verified",        group: "Material", Icon: MdOutlineVerified },
  { key: "md-autofix",        label: "Auto Fix",        group: "Material", Icon: MdOutlineAutoFixHigh },
];

// ─── Simple Icons (brand logos) ───────────────────────────────────────────────
const SI_ICONS = [
  { key: "si-tiktok",      label: "TikTok",          group: "Brand Logos", Icon: SiTiktok },
  { key: "si-x",           label: "X",               group: "Brand Logos", Icon: SiX },
  { key: "si-slack",       label: "Slack",           group: "Brand Logos", Icon: SiSlack },
  { key: "si-notion",      label: "Notion",          group: "Brand Logos", Icon: SiNotion },
  { key: "si-zapier",      label: "Zapier",          group: "Brand Logos", Icon: SiZapier },
  { key: "si-hubspot",     label: "HubSpot",         group: "Brand Logos", Icon: SiHubspot },
  { key: "si-mailchimp",   label: "Mailchimp",       group: "Brand Logos", Icon: SiMailchimp },
  { key: "si-shopify",     label: "Shopify",         group: "Brand Logos", Icon: SiShopify },
  { key: "si-wordpress",   label: "WordPress",       group: "Brand Logos", Icon: SiWordpress },
  { key: "si-wix",         label: "Wix",             group: "Brand Logos", Icon: SiWix },
  { key: "si-webflow",     label: "Webflow",         group: "Brand Logos", Icon: SiWebflow },
  { key: "si-stripe",      label: "Stripe",          group: "Brand Logos", Icon: SiStripe },
  { key: "si-paypal",      label: "PayPal",          group: "Brand Logos", Icon: SiPaypal },
  { key: "si-ga",          label: "Google Analytics",group: "Brand Logos", Icon: SiGoogleanalytics },
  { key: "si-gmb",         label: "Google Business", group: "Brand Logos", Icon: SiGoogle },
  { key: "si-meet",        label: "Google Meet",     group: "Brand Logos", Icon: SiGooglemeet },
  { key: "si-zoom",        label: "Zoom",            group: "Brand Logos", Icon: SiZoom },
  { key: "si-ms",          label: "Microsoft",       group: "Brand Logos", Icon: FaMicrosoft },
  { key: "si-amazon",      label: "Amazon",          group: "Brand Logos", Icon: SiAmazon },
  { key: "si-spotify",     label: "Spotify",         group: "Brand Logos", Icon: SiSpotify },
  { key: "si-dropbox",     label: "Dropbox",         group: "Brand Logos", Icon: SiDropbox },
  { key: "si-trello",      label: "Trello",          group: "Brand Logos", Icon: SiTrello },
  { key: "si-asana",       label: "Asana",           group: "Brand Logos", Icon: SiAsana },
  { key: "si-jira",        label: "Jira",            group: "Brand Logos", Icon: SiJira },
  { key: "si-clickup",     label: "ClickUp",         group: "Brand Logos", Icon: SiClickup },
  { key: "si-airtable",    label: "Airtable",        group: "Brand Logos", Icon: SiAirtable },
  { key: "si-gads",        label: "Google Ads",      group: "Brand Logos", Icon: SiGoogleads },
];

// ─── Feather ──────────────────────────────────────────────────────────────────
const FEATHER_GRID_ICONS = [
  { key: "fi-search",     label: "Search",    group: "Feather", Icon: FiSearch },
  { key: "fi-mail",       label: "Mail",      group: "Feather", Icon: FiMail },
  { key: "fi-phone",      label: "Phone",     group: "Feather", Icon: FiPhone },
  { key: "fi-chat",       label: "Message",   group: "Feather", Icon: FiMessageSquare },
  { key: "fi-monitor",    label: "Monitor",   group: "Feather", Icon: FiMonitor },
  { key: "fi-video",      label: "Video",     group: "Feather", Icon: FiVideo },
  { key: "fi-camera",     label: "Camera",    group: "Feather", Icon: FiCamera },
  { key: "fi-design",     label: "Pen Tool",  group: "Feather", Icon: FiPenTool },
  { key: "fi-layout",     label: "Layout",    group: "Feather", Icon: FiLayout },
  { key: "fi-shop",       label: "Shop Bag",  group: "Feather", Icon: FiShoppingBag },
  { key: "fi-calendar",   label: "Calendar",  group: "Feather", Icon: FiCalendar },
  { key: "fi-chart",      label: "Chart",     group: "Feather", Icon: FiBarChart2 },
  { key: "fi-code",       label: "Code",      group: "Feather", Icon: FiCode },
  { key: "fi-globe",      label: "Globe",     group: "Feather", Icon: FiGlobe },
  { key: "fi-location",   label: "Map Pin",   group: "Feather", Icon: FiMapPin },
  { key: "fi-life-buoy",  label: "Support",   group: "Feather", Icon: FiLifeBuoy },
  { key: "fi-user",       label: "User",      group: "Feather", Icon: FiUser },
  { key: "fi-heart",      label: "Heart",     group: "Feather", Icon: FiHeart },
  { key: "fi-star",       label: "Star",      group: "Feather", Icon: FiStar },
  { key: "fi-check",      label: "Check",     group: "Feather", Icon: FiCheckCircle },
  { key: "fi-feather",    label: "Feather",   group: "Feather", Icon: FiFeather },
  { key: "fi-flag",       label: "Flag",      group: "Feather", Icon: FiFlag },
  { key: "fi-zap",        label: "Zap",       group: "Feather", Icon: FiZap },
];

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const BOOTSTRAP_GRID_ICONS = [
  { key: "bs-megaphone",  label: "Megaphone",    group: "Bootstrap", Icon: BsMegaphone },
  { key: "bs-search",     label: "Search",       group: "Bootstrap", Icon: BsSearch },
  { key: "bs-phone",      label: "Telephone",    group: "Bootstrap", Icon: BsTelephone },
  { key: "bs-chat",       label: "Chat",         group: "Bootstrap", Icon: BsChatSquareText },
  { key: "bs-globe",      label: "Globe",        group: "Bootstrap", Icon: BsGlobe },
  { key: "bs-video",      label: "Cam Video",    group: "Bootstrap", Icon: BsCameraVideo },
  { key: "bs-camera",     label: "Camera",       group: "Bootstrap", Icon: BsCamera },
  { key: "bs-palette",    label: "Palette",      group: "Bootstrap", Icon: BsPalette },
  { key: "bs-cart",       label: "Cart",         group: "Bootstrap", Icon: BsCart3 },
  { key: "bs-calendar",   label: "Calendar",     group: "Bootstrap", Icon: BsCalendar2Event },
  { key: "bs-chart",      label: "Graph",        group: "Bootstrap", Icon: BsGraphUpArrow },
  { key: "bs-gear",       label: "Gear",         group: "Bootstrap", Icon: BsGear },
  { key: "bs-person",     label: "Person",       group: "Bootstrap", Icon: BsPerson },
  { key: "bs-location",   label: "Geo",          group: "Bootstrap", Icon: BsGeoAlt },
  { key: "bs-check",      label: "Check Circle", group: "Bootstrap", Icon: BsCheckCircle },
  { key: "bs-shield",     label: "Shield",       group: "Bootstrap", Icon: BsShieldCheck },
  { key: "bs-stars",      label: "Stars",        group: "Bootstrap", Icon: BsStars },
];

// ─── Social SVG files ─────────────────────────────────────────────────────────
const FILE_GRID_ICONS = [
  { key: "facebook-file",       label: "Facebook",        group: "Social Files", Icon: FacebookIcon },
  { key: "facebook-file-png",   label: "Facebook PNG",    group: "Social Files", Icon: FacebookIcon },
  { key: "instagram-file",      label: "Instagram",       group: "Social Files", Icon: InstagramIcon },
  { key: "instagram-file-png",  label: "Instagram PNG",   group: "Social Files", Icon: InstagramIcon },
  { key: "linkedin-file",       label: "LinkedIn",        group: "Social Files", Icon: LinkedInIcon },
  { key: "linkedin-file-png",   label: "LinkedIn PNG",    group: "Social Files", Icon: LinkedInIcon },
  { key: "pinterest-file",      label: "Pinterest",       group: "Social Files", Icon: PinterestIcon },
  { key: "pinterest-file-png",  label: "Pinterest PNG",   group: "Social Files", Icon: PinterestIcon },
  { key: "youtube-file",        label: "YouTube",         group: "Social Files", Icon: YouTubeIcon },
  { key: "youtube-file-png",    label: "YouTube PNG",     group: "Social Files", Icon: YouTubeIcon },
  { key: "x-file",              label: "X",               group: "Social Files", Icon: SiX },
  { key: "x-file-png",          label: "X PNG",           group: "Social Files", Icon: SiX },
  { key: "tiktok-file",         label: "TikTok",          group: "Social Files", Icon: SiTiktok },
  { key: "whatsapp-file",       label: "WhatsApp",        group: "Social Files", src: "/email-assets/social/whatsapp.svg" },
  { key: "telegram-file",       label: "Telegram",        group: "Social Files", src: "/email-assets/social/telegram.svg" },
  { key: "discord-file",        label: "Discord",         group: "Social Files", src: "/email-assets/social/discord.svg" },
  { key: "reddit-file",         label: "Reddit",          group: "Social Files", src: "/email-assets/social/reddit.svg" },
  { key: "snapchat-file",       label: "Snapchat",        group: "Social Files", src: "/email-assets/social/snapchat.svg" },
  { key: "threads-file",        label: "Threads",         group: "Social Files", src: "/email-assets/social/threads.svg" },
  { key: "bluesky-file",        label: "Bluesky",         group: "Social Files", src: "/email-assets/social/bluesky.svg" },
  { key: "googlebusiness-file", label: "Google Business", group: "Social Files", src: "/email-assets/social/googlebusiness.svg" },
  { key: "lemon8-file",         label: "Lemon8",          group: "Social Files", src: "/email-assets/social/lemon8.svg" },
];

export const GRID_ICON_LIBRARY = [
  ...FA_ICONS,
  ...LUCIDE_ICONS,
  ...MD_ICONS,
  ...SI_ICONS,
  ...FEATHER_GRID_ICONS,
  ...BOOTSTRAP_GRID_ICONS,
  ...FILE_GRID_ICONS,
];

export const GRID_ICON_LIBRARY_MAP = GRID_ICON_LIBRARY.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});

const SOCIAL_ICON_COMPONENTS = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  linkedin: LinkedInIcon,
  pinterest: PinterestIcon,
  tiktok: SiTiktok,
  youtube: YouTubeIcon,
  x: SiX,
  twitter: SiX,
};

const SOCIAL_ICON_KEYS = {
  "facebook-file": "facebook",
  "facebook-file-png": "facebook",
  "instagram-file": "instagram",
  "instagram-file-png": "instagram",
  "linkedin-file": "linkedin",
  "linkedin-file-png": "linkedin",
  "pinterest-file": "pinterest",
  "pinterest-file-png": "pinterest",
  "youtube-file": "youtube",
  "youtube-file-png": "youtube",
  "x-file": "x",
  "x-file-png": "x",
  "si-x": "x",
  "si-tiktok": "tiktok",
  "tiktok-file": "tiktok",
};

export function normalizeSocialPlatformName(value = "") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return "";
  if (/\bfacebook\b|\bfb\b/.test(normalized)) return "facebook";
  if (/\binstagram\b|\binsta\b/.test(normalized)) return "instagram";
  if (/\blinkedin\b|\blinked in\b/.test(normalized)) return "linkedin";
  if (/\bpinterest\b/.test(normalized)) return "pinterest";
  if (/\btiktok\b|\btik tok\b/.test(normalized)) return "tiktok";
  if (/\byoutube\b|\byou tube\b/.test(normalized)) return "youtube";
  if (normalized === "x" || /\btwitter\b|\bx twitter\b/.test(normalized)) return "x";
  return "";
}

export function isUnsafePublishedIconUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^(blob:|file:)/i.test(raw)) return true;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(raw)) return true;
  if (/^\/(?:email-assets|imported|_next|static|tmp|temp)\//i.test(raw)) return true;
  return false;
}

export function resolveSocialPlatformIconKey(item = {}) {
  const iconKey = SOCIAL_ICON_KEYS[String(item?.iconName || "").trim()];
  if (iconKey) return iconKey;
  const legacyIconKey = SOCIAL_ICON_KEYS[String(item?.iconKey || "").trim()];
  if (legacyIconKey) return legacyIconKey;
  return normalizeSocialPlatformName([item?.title, item?.label, item?.text, item?.eyebrow, item?.platform, item?.name].filter(Boolean).join(" "));
}

export function renderSocialPlatformIcon(item = {}, props = {}) {
  const key = resolveSocialPlatformIconKey(item);
  const IconComponent = SOCIAL_ICON_COMPONENTS[key] || (key ? GenericSocialIcon : null);
  if (!IconComponent) return null;
  return <IconComponent aria-hidden="true" focusable="false" {...props} />;
}

export function renderGridLibraryIcon(iconName, props = {}) {
  const entry = GRID_ICON_LIBRARY_MAP[String(iconName || "").trim()];
  if (!entry) return null;
  if (entry.Icon) {
    const IconComponent = entry.Icon;
    return <IconComponent aria-hidden="true" focusable="false" {...props} />;
  }
  if (entry.src) {
    const size = props.size || 24;
    return <img src={entry.src} alt={entry.label || "Icon"} style={{ width: size, height: size, objectFit: "contain", display: "block", pointerEvents: "none" }} />;
  }
  return null;
}

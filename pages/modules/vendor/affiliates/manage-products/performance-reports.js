// /pages/modules/affiliates/vendor/manage-products/performance-reports.js 
// ✅ Vendor Sales Performance Dashboard
// Tracks vendor sales, revenue, and performance.

import { useEffect, useState } from "react";
import Head from "next/head";
import { supabase } from "../../../../../utils/supabase-client";
import VendorUserBanner from "../../../../../components/vendor/VendorUserBanner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";
import Link from "next/link";
import TabbedSectors from "./TabbedSectors";
import ICONS from "../../../../../components/iconMap";

export default function VendorPerformanceReports() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allTime, setAllTime] = useState(true);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalSales: 0,
    avgSale: 0,
    onlineCoursesRevenue: 0,
    onlineCoursesSales: 0,
    onlineCoursesAffiliates: 0,
    physicalProductsRevenue: 0,
    physicalProductsSales: 0,
    physicalProductsAffiliates: 0,
    digitalProductsRevenue: 0,
    digitalProductsSales: 0,
    digitalProductsAffiliates: 0,
    affiliateSalesRevenue: 0,
    affiliateSalesSales: 0,
    affiliateSalesAffiliates: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [chartType, setChartType] = useState("line");
  const [timeRange, setTimeRange] = useState(30);
  // Multi-select for sectors
  const [selectedSectors, setSelectedSectors] = useState([]);

  const sectorKeyMap = {
    'Online Courses': 'onlineCourses',
    'Physical Products': 'physicalProducts',
    'Digital Products': 'digitalProducts',
    'Affiliate Sales': 'affiliateSales',
  };

  useEffect(() => {
    // Fetch real/active sales data from Supabase or your actual data source
    async function fetchSales() {
      setLoading(true);
      const { data: realSales, error } = await supabase
        .from('sales')
        .select('*');
      if (error) {
        setLoading(false);
        return;
      }
      // Calculate stats from real sales
      const totalRevenue = realSales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const totalSales = realSales.length;
      const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;
      // Per-sector stats
      const onlineCourses = realSales.filter(s => s.stream === 'Online Courses');
      const physicalProducts = realSales.filter(s => s.stream === 'Physical Products');
      const digitalProducts = realSales.filter(s => s.stream === 'Digital Products');
      const affiliateSales = realSales.filter(s => s.stream === 'Affiliate Sales');
      const statsObj = {
        totalRevenue,
        totalSales,
        avgSale,
        onlineCoursesRevenue: onlineCourses.reduce((sum, s) => sum + Number(s.amount || 0), 0),
        onlineCoursesSales: onlineCourses.length,
        onlineCoursesAffiliates: 0,
        physicalProductsRevenue: physicalProducts.reduce((sum, s) => sum + Number(s.amount || 0), 0),
        physicalProductsSales: physicalProducts.length,
        physicalProductsAffiliates: 0,
        digitalProductsRevenue: digitalProducts.reduce((sum, s) => sum + Number(s.amount || 0), 0),
        digitalProductsSales: digitalProducts.length,
        digitalProductsAffiliates: 0,
        affiliateSalesRevenue: affiliateSales.reduce((sum, s) => sum + Number(s.amount || 0), 0),
        affiliateSalesSales: affiliateSales.length,
        affiliateSalesAffiliates: 0,
      };
      // Group by date and stream
      const grouped = {};
      realSales.forEach((s) => {
        const date = new Date(s.created_at).toLocaleDateString("en-AU", {
          day: "2-digit",
          month: "short",
        });
        if (!grouped[date]) grouped[date] = {};
        grouped[date][s.stream] = (grouped[date][s.stream] || 0) + Number(s.amount || 0);
      });
      // Build chartData for multi-stream
      const chartReady = Object.entries(grouped).map(([date, streamsObj]) => ({ date, ...streamsObj }));
      setStats(statsObj);
      setChartData(chartReady);
      setSales(realSales);
      setLoading(false);
    }
    fetchSales();
  }, []);

  const page = {
    wrap: {
      minHeight: "100vh",
      background: "#0c121a",
      color: "#fff",
      padding: "28px 22px",
      fontFamily:
        "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    },
    inner: { width: "100%", maxWidth: 1320, margin: "0 auto" },

    // 🔥 Updated banner to match main dashboard style
    banner: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#f97316",
      borderRadius: 14,
      padding: "26px 30px",
      marginBottom: 26,
    },

    statGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 18,
      marginBottom: 36,
    },
    statCard: {
      background: "#111827",
      border: "1px solid #f97316",
      borderRadius: 12,
      padding: 16,
      textAlign: "center",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: 20,
    },
    th: {
      textAlign: "left",
      padding: "10px",
      background: "#1f2937",
      borderBottom: "2px solid #f97316",
    },
    td: {
      padding: "10px",
      borderBottom: "1px solid #2d3748",
    },
  };

  return (
    <>
      <Head>
        <title>Vendor Performance Reports | GR8 RESULT</title>
      </Head>

      <div style={page.wrap}>
        <div style={page.inner}>
          {/* 🔶 Banner with icon + back button */}
          <div style={page.banner}>
            {/* Icon left of text */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <ICONS.analytics size={48} color="#fff" />
              <div>
                <h1 style={{ fontSize: 48, fontWeight: 600, margin: 0 }}>Vendor Performance Reports</h1>
                <div style={{ fontSize: 18, opacity: 0.92, marginTop: 4 }}>Track your sales, revenue, and affiliate performance</div>
              </div>
            </div>
            {/* Back button right */}
            <Link href="/modules/vendor">
              <button
                style={{
                  background: "rgba(0,0,0,0.25)",
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,0.45)",
                  borderRadius: 12,
                  padding: "10px 18px",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  marginLeft: 18,
                }}
              >
                ← Back
              </button>
            </Link>
          </div>

          <VendorUserBanner />

          {/* Chart Controls */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center' }}>
            <label style={{ color: '#fff' }}>
              Chart Type:
              <select
                style={{ marginLeft: 8, background: '#1f2937', color: '#fff', borderRadius: 6, padding: '6px 12px', border: '1px solid #f97316' }}
                value={chartType}
                onChange={e => setChartType(e.target.value)}
              >
                <option value="line">Line Chart</option>
                <option value="bar">Bar Chart</option>
                <option value="combo">Combo Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="semiPie">Semi Pie Chart</option>
              </select>
            </label>
            <label style={{ color: '#fff' }}>
              Time Range:
              <select
                style={{ marginLeft: 8, background: '#1f2937', color: '#fff', borderRadius: 6, padding: '6px 12px', border: '1px solid #f97316' }}
                value={allTime ? 'all' : timeRange}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'all') {
                    setAllTime(true);
                    setStartDate("");
                    setEndDate("");
                  } else {
                    setAllTime(false);
                    setTimeRange(Number(val));
                    setStartDate("");
                    setEndDate("");
                  }
                }}
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
            </label>
            <label style={{ color: '#fff' }}>
              Start Date:
              <input
                type="date"
                style={{ marginLeft: 8, background: '#1f2937', color: '#fff', borderRadius: 6, padding: '6px 12px', border: '1px solid #f97316' }}
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setAllTime(false); setTimeRange(""); }}
              />
            </label>
            <label style={{ color: '#fff' }}>
              End Date:
              <input
                type="date"
                style={{ marginLeft: 8, background: '#1f2937', color: '#fff', borderRadius: 6, padding: '6px 12px', border: '1px solid #f97316' }}
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setAllTime(false); setTimeRange(""); }}
              />
            </label>
          </div>

          {/* Sector Summary Cards - Multi-select to filter chart */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 36 }}>
            {[
              {
                label: 'Online Courses',
                color: '#0ea5e9',
                revenue: stats.onlineCoursesRevenue || 0,
                sales: stats.onlineCoursesSales || 0,
                affiliates: stats.onlineCoursesAffiliates || 0,
              },
              {
                label: 'Physical Products',
                color: '#10b981',
                revenue: stats.physicalProductsRevenue || 0,
                sales: stats.physicalProductsSales || 0,
                affiliates: stats.physicalProductsAffiliates || 0,
              },
              {
                label: 'Digital Products',
                color: '#6366f1',
                revenue: stats.digitalProductsRevenue || 0,
                sales: stats.digitalProductsSales || 0,
                affiliates: stats.digitalProductsAffiliates || 0,
              },
              {
                label: 'Affiliate Sales',
                color: '#f59e0b',
                revenue: stats.affiliateSalesRevenue || 0,
                sales: stats.affiliateSalesSales || 0,
                affiliates: stats.affiliateSalesAffiliates || 0,
              },
              {
                label: 'Combined Total',
                color: '#f97316',
                revenue: (() => {
                  const sectorLabels = Object.keys(sectorKeyMap);
                  const others = selectedSectors.filter(l => l !== 'Combined Total');
                  const keys = others.length > 0 ? others : sectorLabels;
                  return keys.reduce((sum, label) => {
                    const key = sectorKeyMap[label];
                    return sum + (stats[`${key}Revenue`] || 0);
                  }, 0);
                })(),
                sales: (() => {
                  const sectorLabels = Object.keys(sectorKeyMap);
                  const others = selectedSectors.filter(l => l !== 'Combined Total');
                  const keys = others.length > 0 ? others : sectorLabels;
                  return keys.reduce((sum, label) => {
                    const key = sectorKeyMap[label];
                    return sum + (stats[`${key}Sales`] || 0);
                  }, 0);
                })(),
                affiliates: 0,
              },
            ].map((card, idx) => {
              const isSelected = selectedSectors.includes(card.label);
              return (
                <div
                  key={card.label}
                  style={{
                    background: card.color,
                    borderRadius: 12,
                    padding: 16,
                    textAlign: 'center',
                    color: '#fff',
                    cursor: 'pointer',
                    opacity: selectedSectors.length === 0 || isSelected ? 1 : 0.7,
                    border: isSelected ? '3px solid #fff' : 'none',
                  }}
                  onClick={() => {
                    setSelectedSectors(prev =>
                      prev.includes(card.label)
                        ? prev.filter(l => l !== card.label)
                        : [...prev, card.label]
                    );
                  }}
                >
                  <h2 style={{ fontSize: 16, opacity: 0.9 }}>{card.label}</h2>
                  <p style={{ fontSize: 22, fontWeight: 600 }}>${card.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p style={{ fontSize: 16, opacity: 0.8 }}>Sales: {card.sales}</p>
                  <p style={{ fontSize: 16, opacity: 0.8 }}>{card.label === 'Affiliate Sales' ? 'Total Affiliates' : 'Affiliates'}: {card.affiliates}</p>
                </div>
              );
            })}
          </div>

          {loading ? (
            <p>Loading performance data...</p>
          ) : (
            <>
              {/* Summary Cards */}
              <div style={page.statGrid}>
                <div style={page.statCard}>
                  <h2 style={{ fontSize: 16, opacity: 0.8 }}>Total Revenue</h2>
                  <p style={{ fontSize: 26, fontWeight: 600 }}>
                    ${stats.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <div style={page.statCard}>
                  <h2 style={{ fontSize: 16, opacity: 0.8 }}>Total Sales</h2>
                  <p style={{ fontSize: 26, fontWeight: 600 }}>
                    {stats.totalSales}
                  </p>
                </div>
                <div style={page.statCard}>
                  <h2 style={{ fontSize: 16, opacity: 0.8 }}>Average Sale</h2>
                  <p style={{ fontSize: 26, fontWeight: 600 }}>
                    ${stats.avgSale.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Chart Rendering */}
              <div
                style={{
                  background: "#111827",
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 30,
                  border: "1px solid #f97316",
                }}
              >
                <h2 style={{ marginBottom: 10, fontSize: 16 }}>
                  Revenue (Last {timeRange} Days)
                </h2>
                {(() => {
                  let filtered = chartData;
                  if (!allTime && !startDate && !endDate) {
                    // Filter by last N days
                    const days = Number(timeRange) || 30;
                    filtered = chartData.slice(-days);
                  } else if (!allTime) {
                    // Custom date range
                    filtered = chartData.filter(d => {
                      const dt = new Date(d.date);
                      const start = startDate ? new Date(startDate) : null;
                      const end = endDate ? new Date(endDate) : null;
                      if (start && end) return dt >= start && dt <= end;
                      if (start) return dt >= start;
                      if (end) return dt <= end;
                      return true;
                    });
                  }
                  const streamNames = ["Online Courses", "Physical Products", "Digital Products", "Affiliate Sales"];
                  const activeStreams = selectedSectors.length > 0 ? selectedSectors : streamNames;
                  let chartDisplayData = filtered;

                  if (selectedSectors.includes('Combined Total')) {
                    const others = selectedSectors.filter(l => l !== 'Combined Total');
                    const keys = others.length > 0 ? others : streamNames;
                    chartDisplayData = filtered.map(row => {
                      const total = keys.reduce((sum, sector) => sum + (row[sector] || 0), 0);
                      return { ...row, 'Combined Total': total };
                    });
                  }

                  const colorMap = {
                    'Online Courses': '#0ea5e9',
                    'Physical Products': '#10b981',
                    'Digital Products': '#6366f1',
                    'Affiliate Sales': '#f59e0b',
                    'Combined Total': '#f97316',
                  };

                  if (chartType === "line") {
                    return (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartDisplayData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                          <XAxis dataKey="date" stroke="#ccc" />
                          <YAxis stroke="#ccc" />
                          <Tooltip
                            labelStyle={{ color: "#fff" }}
                            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #f97316" }}
                          />
                          {activeStreams.map((stream, idx) => (
                            <Line
                              key={stream}
                              type="linear"
                              dataKey={stream}
                              stroke={colorMap[stream] || '#f97316'}
                              strokeWidth={3}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    );
                  } else if (chartType === "bar") {
                    return (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartDisplayData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                          <XAxis dataKey="date" stroke="#ccc" />
                          <YAxis stroke="#ccc" />
                          <Tooltip labelStyle={{ color: "#fff" }} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #f97316" }} />
                          {activeStreams.map((stream, idx) => (
                            <Bar key={stream} dataKey={stream} fill={colorMap[stream] || '#f97316'} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  } else if (chartType === "combo") {
                    const bars = activeStreams.filter(s => s !== 'Combined Total');
                    const hasCombined = activeStreams.includes('Combined Total');
                    return (
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={chartDisplayData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                          <XAxis dataKey="date" stroke="#ccc" />
                          <YAxis stroke="#ccc" />
                          <Tooltip labelStyle={{ color: "#fff" }} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #f97316" }} />
                          {bars.map((stream, idx) => (
                            <Bar key={stream} dataKey={stream} fill={colorMap[stream] || '#f97316'} />
                          ))}
                          {hasCombined && (
                            <Line
                              key="Combined Total"
                              type="linear"
                              dataKey="Combined Total"
                              stroke={colorMap['Combined Total']}
                              strokeWidth={3}
                              dot={false}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    );
                  } else if (chartType === "pie") {
                    const totals = streamNames.map(stream => ({
                      name: stream,
                      value: filtered.reduce((sum, d) => sum + (d[stream] || 0), 0),
                    }));
                    const pieColors = [
                      '#0ea5e9', // Online Courses
                      '#10b981', // Physical Products
                      '#6366f1', // Digital Products
                      '#f59e0b', // Affiliate Sales
                    ];
                    return (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={totals}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={150}
                            label
                          >
                            {totals.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip labelStyle={{ color: "#fff" }} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #f97316" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  } else if (chartType === "semiPie") {
                    const totals = streamNames.map(stream => ({
                      name: stream,
                      value: filtered.reduce((sum, d) => sum + (d[stream] || 0), 0),
                    }));
                    const pieColors = [
                      '#0ea5e9', // Online Courses
                      '#10b981', // Physical Products
                      '#6366f1', // Digital Products
                      '#f59e0b', // Affiliate Sales
                    ];
                    return (
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={totals}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy={180}
                            startAngle={180}
                            endAngle={0}
                            innerRadius={0}
                            outerRadius={150}
                            label
                          >
                            {totals.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip labelStyle={{ color: "#fff" }} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #f97316" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Sales Table */}
              <div
                style={{
                  background: "#111827",
                  borderRadius: 12,
                  padding: 20,
                  border: "1px solid #f97316",
                }}
              >
                <h2 style={{ marginBottom: 10, fontSize: 16 }}>Recent Sales</h2>
                {sales.length > 0 ? (
                  <table style={page.table}>
                    <thead>
                      <tr>
                        <th style={page.th}>Date</th>
                        <th style={page.th}>Amount</th>
                        <th style={page.th}>Currency</th>
                        <th style={page.th}>Link ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id}>
                          <td style={page.td}>
                            {new Date(s.created_at).toLocaleDateString("en-AU")}
                          </td>
                          <td style={page.td}>
                            ${Number(s.amount).toFixed(2)}
                          </td>
                          <td style={page.td}>{s.currency || "AUD"}</td>
                          <td style={page.td}>
                            {s.link_id?.substring(0, 8) || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p>No sales found.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* Local bar chart icon – matches main dashboard style */
function BarChartIcon({ size = 24, color = "#fff" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="19" x2="20" y2="19" />
      <rect x="6" y="13" width="2" height="6" />
      <rect x="10" y="9" width="2" height="10" />
      <rect x="14" y="5" width="2" height="14" />
    </svg>
  );
}
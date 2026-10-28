import React, { useEffect, useState } from "react";
import {
  Database,
  DollarSign,
  Eye,
  Layers,
  LineChart,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { MetrivaCard, MetrivaBadge, MetrivaButton } from "../../design-system";

interface DeepAnalyticsViewProps {
  onNavigateToDataSources?: () => void;
}

export const DeepAnalyticsView: React.FC<DeepAnalyticsViewProps> = ({
  onNavigateToDataSources,
}) => {
  const [activeTab, setActiveTab] = useState<"revenue" | "customers" | "products">("revenue");
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSampleMode, setIsSampleMode] = useState<boolean>(false);

  const fetchData = async (sample: boolean = isSampleMode) => {
    setLoading(true);
    try {
      const [rev, cust, prod] = await Promise.all([
        api.getRevenueAnalytics({ sample }),
        api.getCustomerSegments({ sample }),
        api.getProductPerformance({ sample }),
      ]);
      setRevenueData(rev || []);
      setCustomerData(cust || []);
      setProductData(prod || []);
    } catch (err) {
      console.error("Error loading deep analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isEmpty =
    !isSampleMode &&
    revenueData.length === 0 &&
    customerData.length === 0 &&
    productData.length === 0;

  if (!loading && isEmpty) {
    return (
      <div className="space-y-6 pb-16 max-w-4xl mx-auto my-6">
        <MetrivaCard variant="glass" className="p-8 sm:p-10 text-center relative overflow-hidden shadow-xl border-dashed">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-5 shadow-lg shadow-cyan-500/10">
            <LineChart className="h-8 w-8" />
          </div>

          <MetrivaBadge variant="cyan" size="sm" className="mb-3">
            Multi-Dimensional SQL
          </MetrivaBadge>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Connect Your Database for Deep Business Analytics
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto mt-2 leading-relaxed">
            Deep Business Analytics computes multi-dimensional SQL aggregations across monthly revenue trends, customer lifetime value segments, and product catalog metrics. Connect your database to start analyzing, or explore sample demonstration analytics.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-7">
            {onNavigateToDataSources && (
              <MetrivaButton
                onClick={onNavigateToDataSources}
                size="md"
                variant="primary"
                icon={<Database className="h-4 w-4" />}
                className="shadow-lg shadow-cyan-500/25"
              >
                Connect Database
              </MetrivaButton>
            )}
            <MetrivaButton
              onClick={() => {
                setIsSampleMode(true);
                fetchData(true);
              }}
              size="md"
              variant="secondary"
              icon={<Eye className="h-4 w-4" />}
            >
              Explore Sample Analytics
            </MetrivaButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 pt-8 border-t border-slate-200 dark:border-slate-800/80 text-left">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60">
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-900 dark:text-white mb-1.5">
                <DollarSign className="h-4 w-4 text-cyan-500" />
                <span>Monthly Revenue Breakdown</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed order volume tracking, settlement totals, and average order value across fiscal months.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60">
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-900 dark:text-white mb-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>Customer Cohort Tiers</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                LTV segmentation across Enterprise, SMB, and Consumer tiers with average orders per account.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/60">
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-900 dark:text-white mb-1.5">
                <Package className="h-4 w-4 text-purple-500" />
                <span>Product Performance</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inventory turnover, stock levels, unit volume, and category revenue realization.
              </p>
            </div>
          </div>
        </MetrivaCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Sample Exploration Mode Banner */}
      {isSampleMode && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-cyan-500/10 border border-amber-500/30 dark:border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Sample Deep Analytics Active
                </span>
                <MetrivaBadge variant="amber" size="sm">Demo Mode</MetrivaBadge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Viewing synthetic e-commerce aggregates (monthly revenue, customer tiers, product metrics). Connect an external database to analyze your workspace&apos;s actual data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {onNavigateToDataSources && (
              <MetrivaButton
                onClick={onNavigateToDataSources}
                size="sm"
                variant="primary"
                icon={<Database className="h-3.5 w-3.5" />}
              >
                Connect Database
              </MetrivaButton>
            )}
            <MetrivaButton
              onClick={() => {
                setIsSampleMode(false);
                fetchData(false);
              }}
              size="sm"
              variant="secondary"
              icon={<X className="h-3.5 w-3.5" />}
            >
              Exit Sample Mode
            </MetrivaButton>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <LineChart className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            Deep Business Analytics
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dedicated multi-dimensional analysis computed via SQL aggregations in PostgreSQL.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("revenue")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === "revenue"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Revenue</span>
          </button>
          <button
            onClick={() => setActiveTab("customers")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === "customers"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Customer Cohorts</span>
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === "products"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Product Catalog</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4 transition-colors">
          {activeTab === "revenue" && (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Monthly Revenue Breakdown</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Aggregated order values, volumes, and AOV</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Month</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Orders</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Avg Value</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                    {revenueData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{row.month}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">{row.orders.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">${row.avg_value}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ${row.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "customers" && (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Customer Segment Analysis</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Performance and value per customer tier</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Customer Segment</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Total Accounts</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Avg Orders / Account</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                    {customerData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{row.customer_segment}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">{row.customer_count.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">{row.avg_orders_per_customer}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ${row.total_spent.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "products" && (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Product Category Catalog Metrics</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Inventory levels, unit sales, and category revenue</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Category</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Products</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Total Stock</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Avg Price</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Units Sold</th>
                      <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                    {productData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">{row.category}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">{row.product_count}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">{row.total_stock.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">${row.avg_price}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">{row.units_sold.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          ${row.total_revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default DeepAnalyticsView;

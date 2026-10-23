import React, { useEffect, useState } from "react";
import { DollarSign, Layers, LineChart, Package, Users } from "lucide-react";
import { api } from "../../services/api";

export const DeepAnalyticsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"revenue" | "customers" | "products">("revenue");
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getRevenueAnalytics(),
      api.getCustomerSegments(),
      api.getProductPerformance(),
    ])
      .then(([rev, cust, prod]) => {
        setRevenueData(rev);
        setCustomerData(cust);
        setProductData(prod);
      })
      .catch((err) => console.error("Error loading deep analytics:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 pb-16">
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

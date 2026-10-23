import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Database,
  Key,
  Layers,
  Link as LinkIcon,
  Table as TableIcon,
  TableProperties,
} from "lucide-react";
import { api } from "../../services/api";
import { SchemaMetadata, SchemaTable } from "../../types";
import { MetrivaCard, MetrivaBadge, MetrivaButton, METRIVA_TOKENS } from "../../design-system";

export const SchemaExplorerView: React.FC = () => {
  const [schema, setSchema] = useState<SchemaMetadata | null>(null);
  const [selectedTable, setSelectedTable] = useState<SchemaTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"tables" | "diagram">("tables");

  useEffect(() => {
    api
      .getSchemaMetadata()
      .then((data) => {
        setSchema(data);
        if (data.tables && data.tables.length > 0) {
          setSelectedTable(data.tables[0]);
        }
      })
      .catch((err) => console.error("Failed to load schema:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !schema) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: METRIVA_TOKENS.colors.cyanPrimary }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MetrivaBadge variant="cyan" size="sm">
              <Layers className="h-3 w-3 mr-1 inline" /> Schema Introspection
            </MetrivaBadge>
            <span className="text-xs text-slate-500 font-mono">
              {schema.tables.length} tables cataloged
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <TableProperties className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            Database Schema Explorer
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Introspect relational models, columns, data types, foreign key relationships, and indexes.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 p-1 rounded-xl backdrop-blur-md">
          <button
            onClick={() => setViewMode("tables")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition ${
              viewMode === "tables"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Table Catalog
          </button>
          <button
            onClick={() => setViewMode("diagram")}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition ${
              viewMode === "diagram"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm shadow-cyan-500/20 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Interactive ER Diagram
          </button>
        </div>
      </div>

      {viewMode === "tables" ? (
        /* Split Tables Catalog View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Table List Column */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tables ({schema.tables.length})
              </span>
              <span className="text-[11px] text-cyan-600 dark:text-cyan-400/80 font-mono">Normalized</span>
            </div>
            <div className="space-y-1.5">
              {schema.tables.map((table) => {
                const isSelected = selectedTable?.name === table.name;
                return (
                  <button
                    key={table.name}
                    onClick={() => setSelectedTable(table)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between ${
                      isSelected
                        ? "bg-cyan-500/10 border-cyan-500/40 text-slate-900 dark:text-white shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500/20"
                        : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <TableIcon
                        className={`h-4 w-4 ${isSelected ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400 dark:text-slate-500"}`}
                      />
                      <div>
                        <span className="font-semibold text-xs block text-slate-800 dark:text-slate-200 font-mono">
                          {table.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block line-clamp-1">
                          {table.columns.length} columns
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      {table.row_count.toLocaleString()} rows
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Table Details Column */}
          <div className="md:col-span-2 space-y-4">
            {selectedTable ? (
              <MetrivaCard variant="glass" className="p-5 shadow-lg space-y-5">
                <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                      <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      {selectedTable.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{selectedTable.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">Row Count</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {selectedTable.row_count.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Columns Table */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                    <span>Columns & Data Types</span>
                    <span className="text-[11px] text-slate-500 font-mono normal-case">
                      {selectedTable.columns.length} attributes detected
                    </span>
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Column</th>
                          <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Type</th>
                          <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Attributes</th>
                          <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                        {selectedTable.columns.map((col) => (
                          <tr key={col.name} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30 transition">
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              {col.primary_key && <Key className="h-3 w-3 text-amber-500 shrink-0" />}
                              {col.foreign_key && <LinkIcon className="h-3 w-3 text-cyan-500 shrink-0" />}
                              <span>{col.name}</span>
                            </td>
                            <td className="py-2.5 px-3 text-cyan-700 dark:text-cyan-300 font-semibold">{col.type}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1">
                                {col.primary_key && (
                                  <span className="text-[10px] bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 px-1.5 py-0.2 rounded font-semibold">
                                    PK
                                  </span>
                                )}
                                {col.foreign_key && (
                                  <span className="text-[10px] bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 px-1.5 py-0.2 rounded font-semibold">
                                    FK → {col.foreign_key}
                                  </span>
                                )}
                                {col.choices && (
                                  <span className="text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 px-1.5 py-0.2 rounded font-semibold">
                                    ENUM
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-sans">{col.description || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </MetrivaCard>
            ) : (
              <div className="p-8 text-center text-slate-500">Select a table to inspect schema.</div>
            )}
          </div>
        </div>
      ) : (
        /* Visual Interactive ER Diagram */
        <MetrivaCard variant="glass" className="p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Entity-Relationship Visual Map</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Foreign key dependencies and cardinality across normalized 3NF tables
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/20">
              3NF Normalized Schema
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Customer Entity Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <span className="font-bold text-sm text-purple-600 dark:text-purple-400 font-mono">customers</span>
                <span className="text-[10px] text-slate-500">250+ rows</span>
              </div>
              <ul className="text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1">
                <li className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Key className="h-3 w-3" /> id (PK)</li>
                <li>name (varchar)</li>
                <li>email (unique)</li>
                <li>country (varchar)</li>
                <li>customer_segment (enum)</li>
              </ul>
            </div>

            {/* Orders Entity Box */}
            <div className="p-4 rounded-xl bg-cyan-50/50 dark:bg-slate-950/70 border border-cyan-400/60 dark:border-cyan-500/40 space-y-3 relative shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/20">
              <div className="flex items-center justify-between border-b border-cyan-200 dark:border-slate-800/80 pb-2">
                <span className="font-bold text-sm text-cyan-600 dark:text-cyan-400 font-mono">orders</span>
                <span className="text-[10px] text-slate-500">2,500+ rows</span>
              </div>
              <ul className="text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1">
                <li className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Key className="h-3 w-3" /> id (PK)</li>
                <li className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400"><LinkIcon className="h-3 w-3" /> customer_id (FK)</li>
                <li>order_date (timestamptz)</li>
                <li>status (enum)</li>
                <li>total_amount (numeric)</li>
              </ul>
            </div>

            {/* Order Items Entity Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">order_items</span>
                <span className="text-[10px] text-slate-500">6,000+ rows</span>
              </div>
              <ul className="text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1">
                <li className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Key className="h-3 w-3" /> id (PK)</li>
                <li className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400"><LinkIcon className="h-3 w-3" /> order_id (FK)</li>
                <li className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400"><LinkIcon className="h-3 w-3" /> product_id (FK)</li>
                <li>quantity (integer)</li>
                <li>subtotal (numeric)</li>
              </ul>
            </div>

            {/* Products Entity Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <span className="font-bold text-sm text-amber-600 dark:text-amber-400 font-mono">products</span>
                <span className="text-[10px] text-slate-500">100+ rows</span>
              </div>
              <ul className="text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1">
                <li className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Key className="h-3 w-3" /> id (PK)</li>
                <li>name (varchar)</li>
                <li>category (varchar)</li>
                <li>price (numeric)</li>
                <li>cost (numeric)</li>
                <li>stock_quantity (integer)</li>
              </ul>
            </div>

            {/* Payments Entity Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400 font-mono">payments</span>
                <span className="text-[10px] text-slate-500">2,500+ rows</span>
              </div>
              <ul className="text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1">
                <li className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Key className="h-3 w-3" /> id (PK)</li>
                <li className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400"><LinkIcon className="h-3 w-3" /> order_id (FK)</li>
                <li>payment_date (timestamptz)</li>
                <li>amount (numeric)</li>
                <li>payment_status (enum)</li>
              </ul>
            </div>

            {/* Website Events Entity Box */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <span className="font-bold text-sm text-rose-600 dark:text-rose-400 font-mono">website_events</span>
                <span className="text-[10px] text-slate-500">5,000+ rows</span>
              </div>
              <ul className="text-xs font-mono text-slate-700 dark:text-slate-300 space-y-1">
                <li className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Key className="h-3 w-3" /> id (PK)</li>
                <li className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400"><LinkIcon className="h-3 w-3" /> customer_id (FK, nullable)</li>
                <li>event_type (enum)</li>
                <li>event_timestamp (timestamptz)</li>
                <li>metadata (jsonb)</li>
              </ul>
            </div>
          </div>
        </MetrivaCard>
      )}
    </div>
  );
};
export default SchemaExplorerView;

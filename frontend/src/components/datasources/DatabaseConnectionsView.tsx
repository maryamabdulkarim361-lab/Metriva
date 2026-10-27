import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { api } from "../../services/api";
import {
  CachedSchema,
  DataSource,
  DataSourceEngine,
  SSLMode,
  TestConnectionRequest,
  UserRole,
} from "../../types";
import { MetrivaBadge, MetrivaButton, MetrivaCard } from "../ui";

interface DatabaseConnectionsViewProps {
  userRole?: UserRole;
}

export const DatabaseConnectionsView: React.FC<DatabaseConnectionsViewProps> = ({ userRole = "ADMIN" }) => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDs, setEditingDs] = useState<DataSource | null>(null);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [selectedDsForSchema, setSelectedDsForSchema] = useState<DataSource | null>(null);

  // Form states
  const [formEngine, setFormEngine] = useState<DataSourceEngine>("postgresql");
  const [formName, setFormName] = useState("");
  const [formHost, setFormHost] = useState("localhost");
  const [formPort, setFormPort] = useState(5432);
  const [formDbName, setFormDbName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formSslMode, setFormSslMode] = useState<SSLMode>("prefer");
  const [formIsActive, setFormIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Testing states
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency_ms?: number;
  } | null>(null);

  // Schema modal states
  const [currentSchema, setCurrentSchema] = useState<CachedSchema | null>(null);
  const [refreshingSchema, setRefreshingSchema] = useState(false);
  const [selectedAllowedTables, setSelectedAllowedTables] = useState<string[]>([]);
  const [savingAllowedTables, setSavingAllowedTables] = useState(false);
  const [tableSearchFilter, setTableSearchFilter] = useState("");

  const fetchDataSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDataSources();
      setDataSources(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load database connections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataSources();
  }, []);

  const openAddModal = () => {
    setEditingDs(null);
    setFormEngine("postgresql");
    setFormName("");
    setFormHost("localhost");
    setFormPort(5432);
    setFormDbName("");
    setFormUsername("");
    setFormPassword("");
    setFormSslMode("prefer");
    setFormIsActive(true);
    setTestResult(null);
    setShowPassword(false);
    setIsFormOpen(true);
  };

  const openEditModal = (ds: DataSource) => {
    setEditingDs(ds);
    setFormEngine(ds.engine);
    setFormName(ds.name);
    setFormHost(ds.host || "localhost");
    setFormPort(ds.port || (ds.engine === "mysql" ? 3306 : 5432));
    setFormDbName(ds.database_name);
    setFormUsername(ds.username || "");
    setFormPassword("");
    setFormSslMode(ds.ssl_mode || "prefer");
    setFormIsActive(ds.is_active);
    setTestResult(null);
    setShowPassword(false);
    setIsFormOpen(true);
  };

  const handleEngineChange = (engine: DataSourceEngine) => {
    setFormEngine(engine);
    if (engine === "postgresql") {
      setFormPort(5432);
      if (formHost === "mysql") setFormHost("postgres");
    } else if (engine === "mysql") {
      setFormPort(3306);
      if (formHost === "postgres" || formHost === "localhost") setFormHost("mysql");
      if (!formDbName) setFormDbName("metriva_mysql_demo");
      if (!formUsername) setFormUsername("metriva_readonly");
    }
  };

  const handleTestParams = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const payload: TestConnectionRequest = {
        engine: formEngine,
        database_name: formDbName,
        host: formEngine === "sqlite" ? undefined : formHost,
        port: formEngine === "sqlite" ? undefined : formPort,
        username: formEngine === "sqlite" ? undefined : formUsername,
        password: formPassword || undefined,
        ssl_mode: formEngine === "sqlite" ? undefined : formSslMode,
      };
      const res = await api.testRawConnection(payload);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Connection failed",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestExisting = async (ds: DataSource) => {
    try {
      const res = await api.testSavedDataSource(ds.id);
      if (res.success) {
        setSuccessMsg(
          `Connection "${ds.name}" is healthy (${res.latency_ms?.toFixed(1) || 0} ms latency)`
        );
      } else {
        setError(`Connection "${ds.name}" failed: ${res.message}`);
      }
      setTimeout(() => {
        setSuccessMsg(null);
        setError(null);
      }, 5000);
    } catch (err: any) {
      setError(`Failed to ping "${ds.name}": ${err.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSaveDataSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: Partial<DataSource> & { password?: string } = {
      name: formName,
      engine: formEngine,
      database_name: formDbName,
      is_active: formIsActive,
      host: formEngine === "sqlite" ? "" : formHost,
      port: formEngine === "sqlite" ? undefined : formPort,
      username: formEngine === "sqlite" ? "" : formUsername,
      ssl_mode: formEngine === "sqlite" ? undefined : formSslMode,
    };

    if (formPassword) {
      payload.password = formPassword;
    }

    try {
      if (editingDs) {
        await api.updateDataSource(editingDs.id, payload);
        setSuccessMsg(`Connection "${formName}" updated successfully.`);
      } else {
        await api.createDataSource(payload);
        setSuccessMsg(`Connection "${formName}" created successfully.`);
      }
      setIsFormOpen(false);
      fetchDataSources();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save connection.");
    }
  };

  const handleDelete = async (ds: DataSource) => {
    if (!window.confirm(`Are you sure you want to remove connection "${ds.name}"?`)) {
      return;
    }
    try {
      await api.deleteDataSource(ds.id);
      setSuccessMsg(`Connection "${ds.name}" deleted.`);
      fetchDataSources();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to delete connection.");
    }
  };

  const openSchemaModal = async (ds: DataSource) => {
    setSelectedDsForSchema(ds);
    setIsSchemaModalOpen(true);
    setCurrentSchema(ds.cached_schema || null);
    setSelectedAllowedTables(ds.allowed_tables || []);
    setTableSearchFilter("");

    if (!ds.cached_schema) {
      handleRefreshSchema(ds.id);
    }
  };

  const handleRefreshSchema = async (dsId?: number) => {
    const id = dsId || selectedDsForSchema?.id;
    if (!id) return;
    setRefreshingSchema(true);
    try {
      const res: any = await api.refreshDataSourceSchema(id);
      const schemaData = res.cached_schema || res;
      setCurrentSchema(schemaData);
      if (res.allowed_tables) {
        setSelectedAllowedTables(res.allowed_tables);
      }
      fetchDataSources();
    } catch (err: any) {
      setError(`Failed to introspect schema: ${err.message}`);
    } finally {
      setRefreshingSchema(false);
    }
  };

  const handleSaveAllowedTables = async () => {
    if (!selectedDsForSchema) return;
    setSavingAllowedTables(true);
    try {
      await api.updateAllowedTables(selectedDsForSchema.id, selectedAllowedTables);
      setSuccessMsg(`Allowed tables updated for "${selectedDsForSchema.name}".`);
      setIsSchemaModalOpen(false);
      fetchDataSources();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(`Failed to update allowed tables: ${err.message}`);
    } finally {
      setSavingAllowedTables(false);
    }
  };

  const toggleTableAllowed = (tableName: string) => {
    if (selectedAllowedTables.includes(tableName)) {
      setSelectedAllowedTables(selectedAllowedTables.filter((t) => t !== tableName));
    } else {
      setSelectedAllowedTables([...selectedAllowedTables, tableName]);
    }
  };

  const selectAllTables = () => {
    if (currentSchema?.tables) {
      setSelectedAllowedTables(currentSchema.tables.map((t) => t.name));
    }
  };

  const deselectAllTables = () => {
    setSelectedAllowedTables([]);
  };

  const filteredTables = currentSchema?.tables
    ? currentSchema.tables.filter((t) =>
        t.name.toLowerCase().includes(tableSearchFilter.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Database className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            Database Connections
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Connect external PostgreSQL, MySQL, and SQLite databases for AI-powered natural language queries.
          </p>
        </div>
        {userRole === "ADMIN" ? (
          <MetrivaButton
            onClick={openAddModal}
            size="sm"
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            className="self-start sm:self-auto"
          >
            Add Connection
          </MetrivaButton>
        ) : (
          <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
            <Lock className="h-3.5 w-3.5" />
            <span>Connection Management (Admin Only)</span>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Connection Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-600 dark:text-cyan-400" />
          <p className="text-sm">Loading database connections...</p>
        </div>
      ) : dataSources.length === 0 ? (
        <div className="p-12 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl text-center bg-slate-50 dark:bg-slate-900/30">
          <Database className="h-12 w-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-300">No external databases connected</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
            Add an external PostgreSQL, MySQL, or SQLite database to allow the AI engine to introspect schemas and query your data securely.
          </p>
          <MetrivaButton
            onClick={openAddModal}
            size="md"
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
          >
            Connect Your First Database
          </MetrivaButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {dataSources.map((ds) => {
            const tableCount = ds.cached_schema?.table_count || ds.allowed_tables?.length || 0;
            const isPostgres = ds.engine === "postgresql";
            const isSQLite = ds.engine === "sqlite";

            return (
              <MetrivaCard
                key={ds.id}
                padding="md"
                hoverGlow
                className="flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full border ${
                            isPostgres
                              ? "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30"
                              : isSQLite
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                              : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
                          }`}
                        >
                          {ds.engine}
                        </span>

                        {ds.is_active ? (
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40" title="Connection is enabled in Metriva">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded" title="Connection is disabled">
                            Disabled
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">{ds.name}</h3>
                    </div>

                    {userRole === "ADMIN" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(ds)}
                          title="Edit Connection"
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(ds)}
                          title="Delete Connection"
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-950/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Database:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[180px]">
                        {ds.database_name}
                      </span>
                    </div>
                    {ds.engine !== "sqlite" && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Host:</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {ds.host}:{ds.port}
                        </span>
                      </div>
                    )}
                    {ds.username && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">User:</span>
                        <span className="text-slate-700 dark:text-slate-300">{ds.username}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-sans">Tables:</span>
                      <span className="text-cyan-600 dark:text-cyan-400 font-sans font-medium">
                        {ds.allowed_tables && ds.allowed_tables.length > 0
                          ? `${ds.allowed_tables.length} allowed / ${tableCount} total`
                          : `${tableCount} discovered`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleTestExisting(ds)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-all"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                    Ping
                  </button>
                  <button
                    onClick={() => openSchemaModal(ds)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/30 rounded-lg transition-all"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Explore & Allow Tables
                  </button>
                </div>
              </MetrivaCard>
            );
          })}
        </div>
      )}

      {/* Add / Edit Connection Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8 transition-colors">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                {editingDs ? "Edit Database Connection" : "Add Database Connection"}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDataSource} autoComplete="off" className="p-6 space-y-4">
              {/* Notice Banner: Clearly Distinguishes DB Credentials from Metriva Web Login */}
              <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 text-xs text-cyan-900 dark:text-cyan-200 flex items-start gap-2.5">
                <span className="text-base select-none">💡</span>
                <div className="space-y-0.5">
                  <div className="font-semibold text-cyan-950 dark:text-cyan-100">Database Engine Credentials</div>
                  <div>
                    Enter credentials for your external database (e.g. <code>metriva_readonly</code>), <strong>not</strong> your Metriva application web login email.
                  </div>
                  {formEngine === "mysql" && (
                    <div className="text-[11px] text-cyan-700 dark:text-cyan-400 font-mono mt-0.5">
                      Docker host: "mysql" | Mac host: "host.docker.internal" | Local: "localhost"
                    </div>
                  )}
                </div>
              </div>

              {/* Engine Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Database Engine
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["postgresql", "mysql", "sqlite"] as DataSourceEngine[]).map((eng) => (
                    <button
                      key={eng}
                      type="button"
                      onClick={() => handleEngineChange(eng)}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-center uppercase tracking-wider ${
                        formEngine === eng
                          ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-md shadow-cyan-500/20"
                          : "bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      {eng}
                    </button>
                  ))}
                </div>
              </div>

              {/* Connection Name */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Connection Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Replica, Analytics DW"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Host & Port (PostgreSQL & MySQL only) */}
              {formEngine !== "sqlite" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Host *</label>
                    <input
                      type="text"
                      required
                      placeholder="localhost or db.company.internal"
                      value={formHost}
                      onChange={(e) => setFormHost(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Port *</label>
                    <input
                      type="number"
                      required
                      value={formPort}
                      onChange={(e) => setFormPort(Number(e.target.value))}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Database Name / File Path */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {formEngine === "sqlite" ? "SQLite Database Path *" : "Database Name *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={formEngine === "sqlite" ? "/path/to/analytics.db" : "app_production"}
                  value={formDbName}
                  onChange={(e) => setFormDbName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Username & Password */}
              {formEngine !== "sqlite" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Database User (DB Role)
                    </label>
                    <input
                      type="text"
                      name="db_account_user"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      placeholder={formEngine === "mysql" ? "metriva_readonly" : "postgres"}
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {editingDs ? "Database Password (leave blank to keep)" : "Database Password"}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="db_account_secret"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        placeholder={editingDs ? "••••••••" : "••••••••"}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        className="w-full px-3.5 py-2 pr-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SSL Mode */}
              {formEngine !== "sqlite" && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">SSL Mode</label>
                  <select
                    value={formSslMode}
                    onChange={(e) => setFormSslMode(e.target.value as SSLMode)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="prefer">Prefer (Standard)</option>
                    <option value="require">Require (Encrypted)</option>
                    <option value="verify-ca">Verify CA</option>
                    <option value="verify-full">Verify Full</option>
                    <option value="disable">Disable</option>
                  </select>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 bg-white dark:bg-slate-950"
                />
                <label htmlFor="formIsActive" className="text-xs text-slate-700 dark:text-slate-300 select-none">
                  Enable this database connection for AI natural language queries
                </label>
              </div>

              {/* Test Result Indicator */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                    testResult.success
                      ? "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">
                      {testResult.success ? "Connection Verified" : "Connection Failed"}
                    </div>
                    <div>{testResult.message}</div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestParams}
                  disabled={testingConnection || !formDbName}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {testingConnection ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-600 dark:text-cyan-400" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                      Test Connection
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <MetrivaButton type="submit" size="sm" variant="primary">
                    {editingDs ? "Save Changes" : "Create Connection"}
                  </MetrivaButton>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schema Discovery & Table Allowlist Modal */}
      {isSchemaModalOpen && selectedDsForSchema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl my-8 transition-colors">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60 shrink-0">
              <div className="space-y-0.5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  Schema Discovery & Allowed Tables: {selectedDsForSchema.name}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Select which tables the AI assistant is permitted to query. Sensitive columns are automatically omitted.
                </p>
              </div>
              <button
                onClick={() => setIsSchemaModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search discovered tables..."
                    value={tableSearchFilter}
                    onChange={(e) => setTableSearchFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllTables}
                    className="text-xs px-2.5 py-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllTables}
                    className="text-xs px-2.5 py-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={() => handleRefreshSchema()}
                    disabled={refreshingSchema}
                    className="text-xs px-2.5 py-1 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-500/30 rounded-lg flex items-center gap-1"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${refreshingSchema ? "animate-spin" : ""}`}
                    />
                    Resync
                  </button>
                </div>
              </div>

              {refreshingSchema ? (
                <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-cyan-600 dark:text-cyan-400" />
                  <p className="text-xs">Introspecting database catalog...</p>
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                  No tables found or match filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTables.map((table) => {
                    const isChecked = selectedAllowedTables.includes(table.name);
                    return (
                      <div
                        key={table.name}
                        onClick={() => toggleTableAllowed(table.name)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-cyan-50 dark:bg-cyan-950/20 border-cyan-400 dark:border-cyan-500/50 shadow-sm"
                            : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-500 focus:ring-cyan-500 bg-white dark:bg-slate-900 pointer-events-none"
                            />
                            <span className="font-bold text-xs text-slate-900 dark:text-white">{table.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {table.columns.length} cols
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {table.columns.slice(0, 5).map((col) => (
                            <span
                              key={col.name}
                              className={`text-[9px] px-1.5 py-0.5 rounded ${
                                col.primary_key
                                  ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40"
                                  : "bg-slate-200/70 dark:bg-slate-900 text-slate-700 dark:text-slate-400"
                              }`}
                            >
                              {col.name}
                              {col.primary_key && " (PK)"}
                            </span>
                          ))}
                          {table.columns.length > 5 && (
                            <span className="text-[9px] text-slate-500 dark:text-slate-600 self-center">
                              +{table.columns.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {selectedAllowedTables.length} of {currentSchema?.tables?.length || 0} tables
                authorized
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSchemaModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <MetrivaButton
                  onClick={handleSaveAllowedTables}
                  loading={savingAllowedTables}
                  size="sm"
                  variant="primary"
                >
                  Save Allowed Tables
                </MetrivaButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

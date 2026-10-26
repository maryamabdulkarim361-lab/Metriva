import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle,
  Eye,
  Lock,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "../../services/api";
import { ColumnMaskingPolicy, OrganizationMembership, UserRole } from "../../types";
import { MetrivaBadge, MetrivaButton, MetrivaCard } from "../ui";

interface TeamAccessViewProps {
  activeOrgId?: number | null;
  userRole?: UserRole;
}

export const TeamAccessView: React.FC<TeamAccessViewProps> = ({ activeOrgId, userRole = "VIEWER" }) => {
  const [members, setMembers] = useState<OrganizationMembership[]>([]);
  const [policies, setPolicies] = useState<ColumnMaskingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Member form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("VIEWER");
  const [addingMember, setAddingMember] = useState(false);

  // Add Policy form state
  const [policyName, setPolicyName] = useState("");
  const [policyPattern, setPolicyPattern] = useState("");
  const [policyMatchType, setPolicyMatchType] = useState<"EXACT" | "REGEX">("EXACT");
  const [policyMaskType, setPolicyMaskType] = useState<"REDACT" | "EMAIL" | "PHONE" | "NULLIFY">("REDACT");
  const [addingPolicy, setAddingPolicy] = useState(false);

  const fetchData = async () => {
    if (!activeOrgId || userRole !== "ADMIN") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [membersData, policiesData] = await Promise.all([
        api.getOrganizationMembers(activeOrgId),
        api.getMaskingPolicies(activeOrgId),
      ]);
      setMembers(membersData);
      setPolicies(policiesData);
    } catch (err: any) {
      setError(err.message || "Failed to load team data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrgId, userRole]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !inviteEmail.trim()) return;
    setAddingMember(true);
    setError(null);
    try {
      await api.addOrganizationMember(activeOrgId, inviteEmail.trim(), inviteRole);
      setSuccessMsg(`User '${inviteEmail}' added successfully.`);
      setInviteEmail("");
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleUpdateRole = async (userId: number, newRole: UserRole) => {
    if (!activeOrgId) return;
    try {
      await api.updateMemberRole(activeOrgId, userId, newRole);
      setSuccessMsg("Role updated successfully.");
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update role.");
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!activeOrgId) return;
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await api.removeOrganizationMember(activeOrgId, userId);
      setSuccessMsg("Member removed.");
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to remove member.");
    }
  };

  const handleAddPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId || !policyName.trim() || !policyPattern.trim()) return;
    setAddingPolicy(true);
    setError(null);
    try {
      await api.createMaskingPolicy(activeOrgId, {
        rule_name: policyName.trim(),
        match_pattern: policyPattern.trim(),
        match_type: policyMatchType,
        masking_type: policyMaskType,
        is_active: true,
      });
      setSuccessMsg(`Masking policy '${policyName}' created.`);
      setPolicyName("");
      setPolicyPattern("");
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to create policy.");
    } finally {
      setAddingPolicy(false);
    }
  };

  const handleDeletePolicy = async (policyId: number) => {
    if (!activeOrgId) return;
    try {
      await api.deleteMaskingPolicy(activeOrgId, policyId);
      setSuccessMsg("Policy deleted.");
      fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete policy.");
    }
  };

  if (userRole !== "ADMIN") {
    return (
      <MetrivaCard variant="glass" className="p-8 text-center space-y-3">
        <Lock className="h-8 w-8 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Team & Access Management Restricted
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Only Organization Administrators have permission to manage members, assign roles, and configure column masking policies.
        </p>
      </MetrivaCard>
    );
  }

  return (
    <div className="space-y-8">
      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-300 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Team Members Card */}
      <MetrivaCard variant="glass" className="p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <span>Team Members & Roles</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Manage organization memberships, assign roles, and control analytical privileges.
            </p>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 px-3 py-1 rounded-full font-medium border border-cyan-200 dark:border-cyan-500/30">
            {members.length} {members.length === 1 ? "Member" : "Members"}
          </span>
        </div>

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              User Email (Registered Account)
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Role Assignment
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="VIEWER">Viewer (Read-only Dashboards/Reports)</option>
              <option value="ANALYST">Analyst (AI & Direct SQL, Masked Results)</option>
              <option value="ADMIN">Admin (Full Control, Unmasked Access)</option>
            </select>
          </div>
          <div className="flex items-end">
            <MetrivaButton
              type="submit"
              size="sm"
              variant="primary"
              loading={addingMember}
              disabled={addingMember || !inviteEmail.trim()}
              icon={<UserPlus className="h-3.5 w-3.5" />}
              className="w-full"
            >
              Add Member
            </MetrivaButton>
          </div>
        </form>

        {/* Members List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold uppercase">User</th>
                <th className="py-2.5 px-4 font-semibold uppercase">Email</th>
                <th className="py-2.5 px-4 font-semibold uppercase">Role</th>
                <th className="py-2.5 px-4 font-semibold uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                    {m.user_name || "Registered User"}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                    {m.user_email}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={m.role}
                      onChange={(e) => handleUpdateRole(m.user_id, e.target.value as UserRole)}
                      className={`text-xs px-2 py-1 rounded border font-semibold ${
                        m.role === "ADMIN"
                          ? "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30"
                          : m.role === "ANALYST"
                          ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="ANALYST">ANALYST</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRemoveMember(m.user_id)}
                      title="Remove member"
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MetrivaCard>

      {/* Column Masking Policies Card */}
      <MetrivaCard variant="glass" className="p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Column-Level Data Masking Policies</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Protect customer PII, phone numbers, and secrets. Masked automatically for Analysts and Viewers.
            </p>
          </div>
        </div>

        {/* Add Policy Form */}
        <form onSubmit={handleAddPolicy} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Rule Name
            </label>
            <input
              type="text"
              required
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              placeholder="Mask SSN"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Match Pattern
            </label>
            <input
              type="text"
              required
              value={policyPattern}
              onChange={(e) => setPolicyPattern(e.target.value)}
              placeholder="ssn"
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Masking Type
            </label>
            <select
              value={policyMaskType}
              onChange={(e) => setPolicyMaskType(e.target.value as any)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="REDACT">Full Redaction ([REDACTED])</option>
              <option value="EMAIL">Email Masking (m***m@example.com)</option>
              <option value="PHONE">Phone Masking (***-***-1234)</option>
              <option value="NULLIFY">Set to Null</option>
            </select>
          </div>
          <div className="flex items-end">
            <MetrivaButton
              type="submit"
              size="sm"
              variant="primary"
              loading={addingPolicy}
              disabled={addingPolicy || !policyName.trim() || !policyPattern.trim()}
              icon={<Plus className="h-3.5 w-3.5" />}
              className="w-full"
            >
              Add Policy
            </MetrivaButton>
          </div>
        </form>

        {/* Policies List */}
        <div className="space-y-2">
          {policies.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-900 dark:text-white">{p.rule_name}</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20">
                  {p.match_pattern}
                </span>
                <span className="text-slate-500">({p.masking_type})</span>
              </div>
              <button
                onClick={() => handleDeletePolicy(p.id)}
                title="Delete policy"
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </MetrivaCard>
    </div>
  );
};


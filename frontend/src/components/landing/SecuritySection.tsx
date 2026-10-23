import React from "react";
import { CheckCircle, Database, FileKey2, KeyRound, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { MetrivaCard, MetrivaBadge } from "../ui";

export const SecuritySection: React.FC = () => {
  const securityFeatures = [
    {
      icon: ShieldCheck,
      title: "Strict Read-Only Enforcement",
      description:
        "Guaranteed at both the application and database session levels. Metriva will never execute INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or schema-altering commands.",
      status: "Active & Enforced",
      badgeVariant: "emerald" as const,
    },
    {
      icon: Lock,
      title: "AST-Level SQL Validation",
      description:
        "Every generated query is parsed into an Abstract Syntax Tree before touching PostgreSQL. Comment injection, multi-statement stacking, and unsafe functions are rejected with zero execution.",
      status: "Zero Toleration",
      badgeVariant: "cyan" as const,
    },
    {
      icon: KeyRound,
      title: "Fernet AES-256 Key Encryption",
      description:
        "External database connection credentials and secrets are encrypted at rest using Fernet symmetric encryption. Passwords are never saved in plaintext or exposed over API payloads.",
      status: "FIPS Compliant Cryptography",
      badgeVariant: "blue" as const,
    },
    {
      icon: UserCheck,
      title: "Multi-Tenant Resource Isolation",
      description:
        "Strict ownership boundaries prevent cross-tenant data leaks. User sessions are cryptographically signed with Argon2/PBKDF2-hashed credentials and tokenized authorization.",
      status: "Strict Tenant Partitioning",
      badgeVariant: "purple" as const,
    },
  ];

  return (
    <section id="security" className="py-24 relative border-t border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-transparent transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <MetrivaBadge variant="emerald" size="md" className="mb-3">
            Zero-Trust Architecture
          </MetrivaBadge>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
            Enterprise Security Built Into <br />
            <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 dark:from-emerald-400 dark:via-cyan-400 dark:to-blue-500 bg-clip-text text-transparent">
              Every Query Execution
            </span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
            Allowing an AI engine to query your database requires rock-solid guardrails. Metriva
            implements multi-layered defense-in-depth so your production data remains pristine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {securityFeatures.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <MetrivaCard
                key={idx}
                padding="lg"
                hoverGlow
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-cyan-600 dark:text-cyan-400">
                      <Icon className="h-6 w-6" />
                    </div>
                    <MetrivaBadge variant={sec.badgeVariant} size="sm">
                      {sec.status}
                    </MetrivaBadge>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{sec.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {sec.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Verified in automated CI/CD test suites</span>
                </div>
              </MetrivaCard>
            );
          })}
        </div>

        {/* Security Architecture Flow Banner */}
        <div className="rounded-2xl p-6 sm:p-8 bg-slate-50 dark:bg-slate-950/80 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-metriva-card">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Security Hardening Baseline Passed</h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                16 dedicated penetration & security tests run against SQL injections, rate limits,
                tampered tokens, and AST mutation attempts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/40 px-3 py-2 rounded-xl shrink-0">
            <span>Audit Status: Passed (0 Vulnerabilities)</span>
          </div>
        </div>
      </div>
    </section>
  );
};


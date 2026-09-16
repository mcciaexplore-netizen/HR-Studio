import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Clock,
  ChevronRight,
  Layers,
  Workflow,
  Bot,
  FolderLock,
  CreditCard,
  UserCheck,
  Award,
  Sparkles,
  BarChart2,
  GitPullRequest,
  Mail,
  Sun,
  Moon,
} from "lucide-react";

interface LandingPageProps {
  onEnterApp: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export default function LandingPage({
  onEnterApp,
  theme,
  onToggleTheme,
}: LandingPageProps) {
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);

  const workflowSteps = [
    {
      title: "Candidate Applies",
      desc: "Resume automatically parsed and analyzed by HR Studio AI.",
    },
    {
      title: "Automated Offer",
      desc: "Offer letter generated instantly with predefined salary bands.",
    },
    {
      title: "Digital Onboarding",
      desc: "ID card and contract generated; onboarding email scheduled.",
    },
    {
      title: "Asset Provision",
      desc: "Company laptop and equipment assigned automatically in inventory.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-600 selection:text-white relative overflow-hidden pb-24 transition-colors duration-300">
      {/* Premium Background Glow Effects */}
      <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[1000px] h-[400px] rounded-full bg-indigo-100/30 dark:bg-indigo-950/20 blur-[130px] pointer-events-none" />
      <div className="absolute top-[35%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-50/20 dark:bg-slate-900/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-100/20 dark:bg-indigo-900/5 blur-[120px] pointer-events-none" />

      {/* Main Fully-Responsive Container */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        {/* Landing Header */}
        <motion.header
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex justify-between items-center py-6 border-b border-slate-200 dark:border-slate-800 mb-12 sm:mb-16"
        >
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.05 }}
              className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20"
            >
              <Layers className="w-4.5 h-4.5 text-white" />
            </motion.div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              HR Studio
            </span>
            <span className="px-2 py-0.5 text-[10px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-full font-mono border border-indigo-100 dark:border-indigo-900/30">
              v2.1
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Interactive Theme Switcher Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleTheme}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 shadow-sm"
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: "#4f46e5" }}
              whileTap={{ scale: 0.95 }}
              onClick={onEnterApp}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-md shadow-indigo-500/10 flex items-center gap-1.5 hover:shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <span>Launch HRMS</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </motion.header>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto my-12 sm:my-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold mb-6 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            <span>Unifying HR, Payroll, and Operations</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight"
          >
            Automate every HR operation <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400 bg-clip-text text-transparent">
              from hire to retire.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
            className="mt-6 text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-medium"
          >
            A comprehensive, modern human capital management suite designed for
            fast-growing companies. Manage directories, track attendance, deploy
            self-service payrolls, design ID cards, and evaluate applicants with
            integrated Gemini capabilities.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)",
              }}
              whileTap={{ scale: 0.95 }}
              onClick={onEnterApp}
              className="px-6 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white transition-all shadow-lg flex items-center gap-2 group cursor-pointer"
            >
              <span>Enter HRMS Portal</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>
            <motion.a
              whileHover={{
                scale: 1.03,
                backgroundColor: "rgba(255,255,255,0.9)",
              }}
              whileTap={{ scale: 0.97 }}
              href="#bento-features"
              className="px-6 py-3 rounded-xl text-sm font-bold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm transition-all"
            >
              Learn More
            </motion.a>
          </motion.div>
        </div>

        {/* Hero Bento Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-16 sm:my-24">
          {/* Bento Card 1: 87% Automated Approvals */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="col-span-1 md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-sm transition-colors"
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-900/30">
                  Efficiency Metrics
                </span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">
                  87% automated approvals
                </h3>
                <p className="text-slate-700 dark:text-slate-300 text-xs mt-2 max-w-md leading-relaxed font-medium">
                  Our smart policy rule engine automatically handles safe leave
                  balances, standard hardware requests, and routine appraisals
                  with zero human clicks required.
                </p>
              </div>

              {/* Custom Animated Graph Visualization */}
              <div className="mt-8 flex items-end gap-3 h-28 bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-100 dark:border-slate-800/60">
                {[
                  { label: "Q1", height: "40%", active: false },
                  { label: "Q2", height: "60%", active: false },
                  {
                    label: "Q3",
                    height: "75%",
                    active: true,
                    color: "bg-indigo-400",
                  },
                  {
                    label: "Q4",
                    height: "87%",
                    active: true,
                    color: "bg-indigo-600",
                  },
                ].map((bar, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      whileInView={{ height: bar.height }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 1,
                        delay: i * 0.15,
                        ease: "easeOut",
                      }}
                      className={`w-full rounded-lg relative group/bar cursor-pointer ${
                        bar.active
                          ? bar.color || "bg-indigo-600"
                          : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-white opacity-0 group-hover/bar:opacity-100 transition-opacity font-bold">
                        {bar.height}
                      </div>
                    </motion.div>
                    <span
                      className={`text-[10px] font-semibold ${
                        bar.active
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {bar.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Bento Card 2: Uptime & Trust */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm transition-colors"
          >
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-100 dark:border-emerald-900/30">
                Operational Trust
              </span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-3">
                Enterprise Infrastructure
              </h3>
              <p className="text-slate-700 dark:text-slate-300 text-xs mt-2 leading-relaxed font-medium">
                Built on premium, distributed Cloud Run frameworks for real-time
                security, global load distribution, and 99.99% service uptime.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {[
                {
                  title: "Secure Data Isolation",
                  icon: Shield,
                  status: "Active",
                  statusColor: "text-indigo-600 dark:text-indigo-400",
                },
                {
                  title: "Real-time Synchronization",
                  icon: Clock,
                  status: "99.9%",
                  statusColor: "text-emerald-600 dark:text-emerald-400",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 transition-colors"
                >
                  <span className="text-slate-800 dark:text-slate-200 flex items-center gap-2 font-semibold">
                    <item.icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {item.title}
                  </span>
                  <span className={`font-mono font-bold ${item.statusColor}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Features Module Grid */}
        <div id="bento-features" className="my-24">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Comprehensive Modules
            </span>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
              All major HR operations, unified.
            </h2>
            <p className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm mt-3 max-w-xl mx-auto font-medium">
              HR Studio integrates the full spectrum of modern HR tools into a
              single workflow-driven framework. Skip tab-switching and
              fragmented folders.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: UserCheck,
                title: "Directory Engine",
                desc: "Add, filter, and manage employees and departments with comprehensive, beautiful detail screens.",
              },
              {
                icon: Clock,
                title: "Attendance & Leaves",
                desc: "Simulate daily check-ins, record location patterns, and review leaves through instant approvals.",
              },
              {
                icon: CreditCard,
                title: "Self-Service Payroll",
                desc: "Calculate basic, HRA, and deductions. Generate and export PDF-ready payslips instantly.",
              },
              {
                icon: Sparkles,
                title: "ID Card Generator",
                desc: "Generate printable front/back company identity cards with matching themes and live-scanned QR codes.",
              },
              {
                icon: GitPullRequest,
                title: "Recruitment (ATS)",
                desc: "Manage job listings, coordinate candidate stages, and score resumes with AI-powered resume matching.",
              },
              {
                icon: Award,
                title: "Goal Appraisals",
                desc: "Establish biannual milestones, collect manager feedback, and visualize core competency progress matrices.",
              },
              {
                icon: Workflow,
                title: "Asset Tracking",
                desc: "Inventory your devices (laptops, monitors, smartphones) and log physical custody histories seamlessly.",
              },
              {
                icon: Bot,
                title: "HR AI Copilot",
                desc: "Draft recommendation letters, generate personalized onboarding checklists, and query policy handbooks instantly.",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                whileHover={{
                  y: -6,
                  scale: 1.02,
                  boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.08)",
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl hover:border-indigo-350 dark:hover:border-indigo-900 transition-all group shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-950 flex items-center justify-center border border-slate-100 dark:border-slate-800 group-hover:border-indigo-200 dark:group-hover:border-indigo-900 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/20 transition-colors">
                    <item.icon className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-950 dark:text-white mt-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-slate-700 dark:text-slate-400 text-xs mt-2 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Interactive Workflow Visualizer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="my-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 relative shadow-sm transition-colors"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 flex flex-col justify-center">
              <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 uppercase tracking-widest font-bold">
                Automation Engine
              </span>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                Route repetitive tasks through smart workflows.
              </h3>
              <p className="text-slate-700 dark:text-slate-300 text-xs mt-3 leading-relaxed font-medium">
                Say goodbye to chasing email threads and physical signatures.
                Choose triggers, set target approval policies, and let HR Studio
                coordinate the execution background logs autonomously.
              </p>
              <div className="mt-6 space-y-2">
                {workflowSteps.map((step, idx) => (
                  <motion.button
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    key={idx}
                    onClick={() => setActiveWorkflowStep(idx)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                      activeWorkflowStep === idx
                        ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-400 font-bold shadow-sm"
                        : "bg-transparent border-transparent text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200"
                    }`}
                  >
                    {idx + 1}. {step.title}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between min-h-[260px] relative overflow-hidden transition-colors">
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    HR Studio AI Workflow Hub
                  </span>
                </div>
                <span className="font-mono text-[9px] text-slate-600 dark:text-slate-400 uppercase font-bold">
                  Step {activeWorkflowStep + 1} of 4
                </span>
              </div>

              {/* Animate change of active workflow steps beautifully */}
              <div className="py-6 min-h-[100px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeWorkflowStep}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-center shrink-0 shadow-sm">
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                        {activeWorkflowStep + 1}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {workflowSteps[activeWorkflowStep].title}
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-relaxed font-medium">
                        {workflowSteps[activeWorkflowStep].desc}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
                <span className="text-[10px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Automated background triggers ready
                </span>
                <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30">
                  Auto Action Active
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Decision and Analytics Section */}
        <div className="my-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 uppercase tracking-widest font-bold">
              Strategic Insights
            </span>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
              Give leadership real-time confidence in every people decision.
            </h2>
            <p className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm mt-3 leading-relaxed font-medium">
              Beautiful, fast visualizations that give you immediate insight
              into key headcount growth rates, quarterly leave profiles, hiring
              cost parameters, and core tenure balances across your entire
              enterprise directory.
            </p>

            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { val: "96%", label: "Retention Rate" },
                { val: "12s", label: "ID Generation" },
                { val: "100%", label: "Compliant" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-center shadow-sm"
                >
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {stat.val}
                  </div>
                  <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-1 uppercase font-bold tracking-wider">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative shadow-sm"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
              <span className="text-xs font-bold text-slate-900 dark:text-white font-sans">
                Executive Headcount Intelligence
              </span>
              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-bold">
                Live Forecast
              </span>
            </div>
            <div className="space-y-4">
              {[
                { label: "Engineering Division", count: 240, pct: "37.5%" },
                { label: "Sales & Marketing", count: 180, pct: "28.1%" },
                { label: "Design & Product Dev", count: 120, pct: "18.7%" },
                { label: "Human Resources", count: 100, pct: "15.6%" },
              ].map((dept, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {dept.label}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 font-mono font-bold">
                      {dept.count} ({dept.pct})
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-200/40 dark:border-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: dept.pct }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 1.2,
                        ease: "easeOut",
                        delay: i * 0.1,
                      }}
                      className="bg-indigo-600 h-full rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* CTA Footer Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-28 text-center bg-gradient-to-br from-indigo-900 to-slate-950 border border-indigo-950/40 rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl"
        >
          {/* Subtle decoration bg element */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Replace HR busywork with enterprise trust.
          </h2>
          <p className="text-indigo-200 text-xs sm:text-sm mt-3 max-w-lg mx-auto leading-relaxed font-medium">
            Equip your recruiters, payroll managers, and HR business partners
            with a unified, robust employee hub that scales effortlessly.
          </p>
          <div className="mt-8 flex justify-center">
            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: "0 10px 25px rgba(255,255,255,0.1)",
              }}
              whileTap={{ scale: 0.95 }}
              onClick={onEnterApp}
              className="px-8 py-3.5 rounded-xl text-sm font-extrabold bg-white text-indigo-950 hover:bg-slate-100 active:scale-95 transition-all shadow-xl flex items-center gap-2 cursor-pointer"
            >
              <span>Launch Enterprise App</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

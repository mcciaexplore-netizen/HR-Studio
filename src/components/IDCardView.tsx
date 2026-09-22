import React, { useState, useRef } from "react";
import {
  Printer,
  Layers,
  RotateCw,
  ShieldCheck,
  Upload,
  Download,
  Trash2,
  Sparkles,
  Building,
  Check,
  Eye,
  Type,
} from "lucide-react";
import { Employee } from "../types";

interface IDCardViewProps {
  employees: Employee[];
  companyName: string;
  onUpdateEmployeeAvatar?: (empId: string, avatarUrl: string) => Promise<boolean>;
}

export default function IDCardView({
  employees,
  companyName,
  onUpdateEmployeeAvatar,
}: IDCardViewProps) {
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || "");
  const [cardColor, setCardColor] = useState("#1e40af"); // Classic corporate navy
  const [isFlipped, setIsFlipped] = useState(false);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [cardTheme, setCardTheme] = useState<"modern-dark" | "clean-light" | "executive-gradient">("modern-dark");
  
  // Default to official branding logo with fallback
  const [customLogo, setCustomLogo] = useState<string | null>("/branding/mccia/logo.png");
  const [cardCompanyName, setCardCompanyName] = useState<string>(companyName || "MCCIA");
  const [customPhotoOverrides, setCustomPhotoOverrides] = useState<{ [empId: string]: string }>({});
  const [exporting, setExporting] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const frontCardRef = useRef<HTMLDivElement>(null);
  const backCardRef = useRef<HTMLDivElement>(null);

  const selectedEmp =
    employees.find((e) => e.id === selectedEmpId) || employees[0];

  const currentPhoto =
    (selectedEmp && customPhotoOverrides[selectedEmp.id]) ||
    selectedEmp?.avatar ||
    "";

  // Clean formatted name without "(Demo)"
  const displayName = selectedEmp?.name ? selectedEmp.name.replace(/\s*\(Demo\)\s*/gi, "").trim() : "Employee Name";

  // Formatted short employee badge ID (e.g. EMP-4C88 or last 6 characters if UUID)
  const shortId = selectedEmp?.id
    ? selectedEmp.id.length > 12
      ? `EMP-${selectedEmp.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`
      : selectedEmp.id
    : "EMP-001";

  const colorPresets = [
    { label: "Navy Corporate", val: "#1e40af" },
    { label: "Sapphire Tech", val: "#0284c7" },
    { label: "Emerald Elite", val: "#059669" },
    { label: "Imperial Violet", val: "#7c3aed" },
    { label: "Sunset Amber", val: "#d97706" },
    { label: "Ruby Crimson", val: "#e11d48" },
    { label: "Obsidian Slate", val: "#1e293b" },
  ];

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Logo file is too large. Please select an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomLogo(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Employee Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedEmp) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Photo file is too large. Please select an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const resultUrl = event.target?.result as string;
        if (resultUrl) {
          setCustomPhotoOverrides((prev) => ({
            ...prev,
            [selectedEmp.id]: resultUrl,
          }));
          if (onUpdateEmployeeAvatar) {
            try {
              await onUpdateEmployeeAvatar(selectedEmp.id, resultUrl);
            } catch (err) {
              console.error("Failed to persist avatar:", err);
            }
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Export card using native SVG / Canvas rasterizer
  const handleExportPNG = async () => {
    const targetElement = isFlipped ? backCardRef.current : frontCardRef.current;
    if (!targetElement) return;

    try {
      setExporting(true);

      const isLandscape = orientation === "horizontal";
      const width = isLandscape ? 480 : 310;
      const height = isLandscape ? 310 : 490;
      const scale = 2; // 2x high resolution for retina & crisp printing

      const elementHtml = targetElement.outerHTML;
      const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
        .map((style) => style.outerHTML)
        .join("\n");

      const svgDoc = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="transform: scale(${scale}); transform-origin: top left; width: ${width}px; height: ${height}px;">
              ${styles}
              ${elementHtml}
            </div>
          </foreignObject>
        </svg>
      `;

      const svgBlob = new Blob([svgDoc], { type: "image/svg+xml;charset=utf-8" });
      const blobUrl = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(image, 0, 0);
          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          const safeName = displayName.toLowerCase().replace(/\s+/g, "_");
          const side = isFlipped ? "back" : "front";
          downloadLink.download = `${safeName}_id_card_${side}.png`;
          downloadLink.href = pngUrl;
          downloadLink.click();
        }
        URL.revokeObjectURL(blobUrl);
        setExporting(false);
      };
      image.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        setExporting(false);
        alert("For the highest resolution printout, use the 'Print / PDF' option.");
      };
      image.src = blobUrl;
    } catch (error) {
      console.error("Export error:", error);
      setExporting(false);
      window.print();
    }
  };

  const getInitials = (name: string) => {
    return name
      .replace(/\(Demo\)/gi, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Corporate ID Badge Studio</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800">
              HD Ready
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Design executive-grade identification cards with smart logo placement, custom company title, and high-resolution export
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportPNG}
            disabled={exporting}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download PNG image of the currently visible card face"
          >
            <Download className="w-4 h-4" />
            <span>{exporting ? "Rendering..." : "Download PNG"}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            title="Print or export card as high-res PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Designer Controls Panel */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-5 self-start transition-colors">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>Card Customizer</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Live Editor</span>
          </div>

          {/* 1. Target Employee Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
              Target Employee
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 font-medium"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name.replace(/\(Demo\)/gi, "").trim()} — {e.role} ({e.department})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Company Name & Title Customization */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
              Company / Organization Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={cardCompanyName}
                onChange={(e) => setCardCompanyName(e.target.value)}
                placeholder="Enter Company Name"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-xl pl-9 pr-3 py-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 font-medium"
              />
              <Type className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* 3. Photo & Logo Upload Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Employee Photo Upload */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
                  Employee Photo
                </span>
                {customPhotoOverrides[selectedEmp?.id || ""] && (
                  <button
                    onClick={() => {
                      setCustomPhotoOverrides((prev) => {
                        const next = { ...prev };
                        delete next[selectedEmp?.id || ""];
                        return next;
                      });
                    }}
                    className="text-rose-500 hover:text-rose-600 p-0.5 rounded text-[10px] flex items-center gap-0.5 cursor-pointer"
                    title="Reset to default photo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full py-2 px-2.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-blue-500" />
                <span>Upload Photo</span>
              </button>
            </div>

            {/* Company Logo Upload */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold">
                  Company Logo
                </span>
                {customLogo && customLogo !== "/branding/mccia/logo.png" && (
                  <button
                    onClick={() => setCustomLogo("/branding/mccia/logo.png")}
                    className="text-rose-500 hover:text-rose-600 p-0.5 rounded text-[10px] flex items-center gap-0.5 cursor-pointer"
                    title="Reset to default MCCIA brand logo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="w-full py-2 px-2.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Building className="w-3.5 h-3.5 text-blue-500" />
                <span>{customLogo ? "Change Logo" : "Upload Logo"}</span>
              </button>
            </div>
          </div>

          {/* 4. Card Style Theme & Orientation */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                Card Orientation
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation("vertical")}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    orientation === "vertical"
                      ? "bg-blue-50 dark:bg-blue-950/70 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <div className="w-3.5 h-5 border border-current rounded-sm flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-current rounded-full" />
                  </div>
                  <span>Vertical (Badge)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrientation("horizontal")}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    orientation === "horizontal"
                      ? "bg-blue-50 dark:bg-blue-950/70 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <div className="w-5 h-3.5 border border-current rounded-sm flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-current rounded-full" />
                  </div>
                  <span>Horizontal (Card)</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                Theme Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCardTheme("modern-dark")}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer text-center ${
                    cardTheme === "modern-dark"
                      ? "bg-slate-900 border-blue-500 text-white shadow-xs"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Midnight Dark
                </button>
                <button
                  type="button"
                  onClick={() => setCardTheme("clean-light")}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer text-center ${
                    cardTheme === "clean-light"
                      ? "bg-white border-blue-500 text-slate-900 shadow-xs ring-1 ring-blue-500"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Clean White
                </button>
                <button
                  type="button"
                  onClick={() => setCardTheme("executive-gradient")}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer text-center ${
                    cardTheme === "executive-gradient"
                      ? "bg-gradient-to-r from-slate-900 to-slate-800 border-blue-500 text-blue-300 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Executive Glass
                </button>
              </div>
            </div>
          </div>

          {/* 5. Brand Accent Color Scheme */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">
                Brand Accent Color
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-400">Custom</span>
                <input
                  type="color"
                  value={cardColor}
                  onChange={(e) => setCardColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  title="Pick custom hex color"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {colorPresets.map((col) => (
                <button
                  key={col.val}
                  type="button"
                  onClick={() => setCardColor(col.val)}
                  style={{ backgroundColor: col.val }}
                  className={`w-7 h-7 rounded-full border-2 transition-all relative cursor-pointer ${
                    cardColor === col.val
                      ? "border-white scale-110 shadow-md ring-2 ring-blue-500/50"
                      : "border-transparent hover:scale-105"
                  }`}
                  title={col.label}
                >
                  {cardColor === col.val && (
                    <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Flip Card Action Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isFlipped ? "rotate-180" : ""}`} />
              <span>Flip Card ({isFlipped ? "Viewing Back Side" : "Viewing Front Side"})</span>
            </button>
          </div>
        </div>

        {/* Live Visual Card Showcase (Print area) */}
        {selectedEmp && (
          <div className="lg:col-span-7 flex flex-col items-center justify-center min-h-[520px] bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 lg:p-10 relative overflow-hidden transition-colors">
            {/* Ambient Background decoration */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[120px] opacity-20 pointer-events-none transition-colors duration-700"
              style={{ backgroundColor: cardColor }}
            />

            {/* Lanyard Holder Hole Clip */}
            <div className="flex flex-col items-center mb-4 select-none">
              <div className="w-14 h-4 rounded-full bg-gradient-to-b from-slate-400 to-slate-200 dark:from-slate-700 dark:to-slate-900 border border-slate-400/80 dark:border-slate-700 shadow-inner flex items-center justify-center">
                <div className="w-10 h-1.5 rounded-full bg-slate-950/40 dark:bg-black/60" />
              </div>
            </div>

            {/* Simulated Badge Frame */}
            <div className="relative group perspective" id="id-card-print-area">
              {/* Actual 3D interactive Card Element */}
              <div
                className={`rounded-2xl shadow-2xl relative transition-all duration-700 transform-style ${
                  orientation === "vertical"
                    ? "w-[300px] h-[480px]"
                    : "w-[460px] h-[290px]"
                }`}
                style={{
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* ========================================================================= */}
                {/* FRONT OF THE ID CARD */}
                {/* ========================================================================= */}
                <div
                  ref={frontCardRef}
                  className={`absolute inset-0 rounded-2xl overflow-hidden flex flex-col justify-between backface-hidden shadow-2xl select-none transition-colors duration-500 border ${
                    cardTheme === "clean-light"
                      ? "bg-white border-slate-200 text-slate-900"
                      : cardTheme === "executive-gradient"
                      ? "bg-gradient-to-b from-slate-900 via-slate-950 to-black border-slate-700 text-white"
                      : "bg-[#0b0f19] border-slate-800 text-white"
                  }`}
                  style={{ transform: "rotateY(0deg)" }}
                >
                  {orientation === "vertical" ? (
                    /* ---------------- VERTICAL FRONT LAYOUT ---------------- */
                    <>
                      {/* Top Header with geometric branding */}
                      <div
                        className="relative h-[125px] px-4 pt-3 pb-2.5 flex flex-col justify-between overflow-hidden transition-colors duration-500"
                        style={{
                          background: `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 60%, ${cardColor}aa 100%)`,
                        }}
                      >
                        {/* Diagonal stylish watermark geometry */}
                        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 transform rotate-45 pointer-events-none" />

                        {/* Top Row: Logo & Company Name Brand Unit */}
                        <div className="flex items-center justify-between z-10">
                          <div className="flex items-center gap-2 max-w-[80%] min-w-0">
                            {/* Company Logo Badge */}
                            {customLogo ? (
                              <div className="p-1 bg-white rounded-lg shadow-sm border border-white/60 shrink-0 flex items-center justify-center">
                                <img
                                  src={customLogo}
                                  alt="Company Logo"
                                  className="h-5.5 max-w-[65px] object-contain"
                                />
                              </div>
                            ) : (
                              <div className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white shadow-inner shrink-0">
                                <Layers className="w-4 h-4" />
                              </div>
                            )}

                            {/* Company Name Typography */}
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-black tracking-wider text-white block truncate uppercase drop-shadow-xs">
                                {cardCompanyName}
                              </span>
                              <span className="text-[7.5px] font-mono tracking-widest text-white/80 uppercase block font-semibold">
                                Corporate ID
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/30 backdrop-blur-md border border-white/15 text-white text-[8.5px] font-mono font-bold shrink-0">
                            <ShieldCheck className="w-3 h-3 text-emerald-300" />
                            <span>PASS</span>
                          </div>
                        </div>

                        {/* Department/Role Sub-strip */}
                        <div className="flex items-center justify-between text-white/90 z-10 text-[9px] font-mono">
                          <span className="uppercase tracking-widest text-[7.5px] font-semibold opacity-85">
                            STAFF DIRECTORY
                          </span>
                          <span className="font-bold tracking-wider opacity-90">
                            {shortId}
                          </span>
                        </div>
                      </div>

                      {/* Profile Photo Area */}
                      <div className="relative -mt-11 flex justify-center z-20">
                        <div className="relative group">
                          {currentPhoto ? (
                            <img
                              src={currentPhoto}
                              alt={displayName}
                              className="w-22 h-22 rounded-2xl object-cover border-[3.5px] border-[#0b0f19] shadow-xl bg-slate-800"
                            />
                          ) : (
                            <div
                              className="w-22 h-22 rounded-2xl border-[3.5px] border-[#0b0f19] shadow-xl flex items-center justify-center text-white text-2xl font-bold font-mono tracking-wider"
                              style={{
                                background: `linear-gradient(135deg, ${cardColor} 0%, #0f172a 100%)`,
                              }}
                            >
                              {getInitials(displayName)}
                            </div>
                          )}
                          <div
                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0b0f19] flex items-center justify-center text-[8px] text-white shadow-md font-bold"
                            style={{ backgroundColor: cardColor }}
                          >
                            ✓
                          </div>
                        </div>
                      </div>

                      {/* Employee Details Information */}
                      <div className="px-5 py-2 text-center space-y-1.5 flex-1 flex flex-col justify-center z-10">
                        <h3 className="text-base font-black tracking-tight leading-tight line-clamp-1">
                          {displayName}
                        </h3>

                        <p
                          className={`text-xs font-semibold leading-none ${
                            cardTheme === "clean-light" ? "text-slate-600" : "text-slate-300"
                          }`}
                        >
                          {selectedEmp.role}
                        </p>

                        <div className="pt-1 flex items-center justify-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-mono tracking-wider uppercase font-bold shadow-2xs"
                            style={{
                              backgroundColor: `${cardColor}20`,
                              border: `1px solid ${cardColor}60`,
                              color: cardColor,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: cardColor }} />
                            {selectedEmp.department}
                          </span>
                        </div>
                      </div>

                      {/* Compact Micro Details Grid */}
                      <div
                        className={`mx-4 mb-3 p-2.5 rounded-xl border grid grid-cols-2 gap-2 text-[9px] font-mono ${
                          cardTheme === "clean-light"
                            ? "bg-slate-50 border-slate-200 text-slate-700"
                            : "bg-slate-900/60 border-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-semibold">
                            CARD ID
                          </span>
                          <span className="font-bold text-[10px] block truncate">
                            {shortId}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[7.5px] uppercase tracking-wider text-slate-400 block font-semibold">
                            JOIN DATE
                          </span>
                          <span className="font-bold text-[10px] block">
                            {selectedEmp.hireDate || "2024-01-01"}
                          </span>
                        </div>
                      </div>

                      {/* Footer Authenticity Bar */}
                      <div
                        className="h-1.5 w-full"
                        style={{ backgroundColor: cardColor }}
                      />
                    </>
                  ) : (
                    /* ---------------- HORIZONTAL FRONT LAYOUT ---------------- */
                    <div className="h-full flex flex-col justify-between">
                      {/* Top Accent Stripe */}
                      <div
                        className="h-[56px] px-5 flex items-center justify-between relative overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%)`,
                        }}
                      >
                        {/* Company Logo & Name Header Unit */}
                        <div className="flex items-center gap-2.5 max-w-[70%]">
                          {customLogo ? (
                            <div className="p-1 bg-white rounded-lg shadow-sm shrink-0">
                              <img
                                src={customLogo}
                                alt="Company Logo"
                                className="h-5.5 max-w-[80px] object-contain"
                              />
                            </div>
                          ) : (
                            <div className="p-1.5 bg-white/20 rounded-lg text-white shrink-0">
                              <Layers className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-black tracking-wider text-white uppercase drop-shadow-xs block truncate">
                              {cardCompanyName}
                            </span>
                            <span className="text-[7.5px] font-mono tracking-widest text-white/80 uppercase block">
                              Official Badge
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-white shrink-0">
                          <div className="text-right">
                            <span className="text-[7.5px] font-mono uppercase tracking-widest opacity-80 block">
                              PASS ID
                            </span>
                            <span className="text-[10px] font-mono font-bold tracking-wider">
                              {shortId}
                            </span>
                          </div>
                          <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        </div>
                      </div>

                      {/* Body Content */}
                      <div className="px-6 py-4 flex items-center gap-5 flex-1">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {currentPhoto ? (
                            <img
                              src={currentPhoto}
                              alt={displayName}
                              className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-700 shadow-xl bg-slate-800"
                            />
                          ) : (
                            <div
                              className="w-24 h-24 rounded-2xl border-2 border-slate-700 shadow-xl flex items-center justify-center text-white text-2xl font-bold font-mono"
                              style={{
                                background: `linear-gradient(135deg, ${cardColor} 0%, #0f172a 100%)`,
                              }}
                            >
                              {getInitials(displayName)}
                            </div>
                          )}
                          <div
                            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-[#0b0f19] flex items-center justify-center text-[7px] text-white font-bold"
                            style={{ backgroundColor: cardColor }}
                          >
                            ✓
                          </div>
                        </div>

                        {/* Text Info */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <h3 className="text-lg font-black tracking-tight truncate">
                            {displayName}
                          </h3>
                          <p
                            className={`text-xs font-semibold truncate ${
                              cardTheme === "clean-light" ? "text-slate-600" : "text-slate-300"
                            }`}
                          >
                            {selectedEmp.role}
                          </p>

                          <div className="flex items-center gap-2 pt-1.5">
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[9px] font-mono tracking-wider uppercase font-bold"
                              style={{
                                backgroundColor: `${cardColor}20`,
                                border: `1px solid ${cardColor}60`,
                                color: cardColor,
                              }}
                            >
                              {selectedEmp.department}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">
                              Issued: {selectedEmp.hireDate || "2024-01-01"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Bar */}
                      <div
                        className={`px-6 py-2 border-t flex justify-between items-center text-[9px] font-mono ${
                          cardTheme === "clean-light"
                            ? "bg-slate-50 border-slate-200 text-slate-600"
                            : "bg-slate-900/90 border-slate-800 text-slate-400"
                        }`}
                      >
                        <span className="truncate max-w-[200px]">{selectedEmp.email}</span>
                        <span className="font-bold text-emerald-400">● ACTIVE DIRECTORY</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ========================================================================= */}
                {/* BACK OF THE ID CARD */}
                {/* ========================================================================= */}
                <div
                  ref={backCardRef}
                  className={`absolute inset-0 rounded-2xl overflow-hidden flex flex-col justify-between p-5 backface-hidden select-none shadow-2xl transition-colors duration-500 border ${
                    cardTheme === "clean-light"
                      ? "bg-white border-slate-200 text-slate-900"
                      : cardTheme === "executive-gradient"
                      ? "bg-gradient-to-b from-slate-900 via-slate-950 to-black border-slate-700 text-white"
                      : "bg-[#0b0f19] border-slate-800 text-white"
                  }`}
                  style={{ transform: "rotateY(180deg)" }}
                >
                  {/* Security Terms Header */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" style={{ color: cardColor }} />
                        <span className="text-[10px] font-black tracking-wider uppercase">
                          TERMS OF ISSUANCE
                        </span>
                      </div>
                      <span className="text-[8px] font-mono opacity-60">
                        {shortId}
                      </span>
                    </div>

                    <ul className="text-[7.5px] space-y-1.5 leading-relaxed list-disc pl-3 font-mono opacity-80">
                      <li>Property of {cardCompanyName}. Must be surrendered upon departure.</li>
                      <li>Display visibly while present on corporate premises & facilities.</li>
                      <li>Loss of card must be reported immediately to HR Operations.</li>
                    </ul>
                  </div>

                  {/* High Quality Styled QR Code Section */}
                  <div
                    className={`flex items-center justify-center gap-3.5 py-3 px-3 rounded-xl border ${
                      cardTheme === "clean-light"
                        ? "bg-slate-50 border-slate-200"
                        : "bg-slate-900/60 border-slate-800"
                    }`}
                  >
                    <div className="p-1.5 bg-white rounded-lg shrink-0 shadow-sm">
                      {/* Scalable QR SVG Pattern */}
                      <svg
                        className="w-16 h-16 text-slate-950"
                        viewBox="0 0 100 100"
                        fill="currentColor"
                      >
                        <rect x="0" y="0" width="24" height="24" rx="2" />
                        <rect x="4" y="4" width="16" height="16" fill="white" />
                        <rect x="8" y="8" width="8" height="8" />

                        <rect x="0" y="76" width="24" height="24" rx="2" />
                        <rect x="4" y="80" width="16" height="16" fill="white" />
                        <rect x="8" y="84" width="8" height="8" />

                        <rect x="76" y="0" width="24" height="24" rx="2" />
                        <rect x="80" y="4" width="16" height="16" fill="white" />
                        <rect x="84" y="8" width="8" height="8" />

                        <rect x="32" y="10" width="8" height="8" />
                        <rect x="46" y="10" width="16" height="6" />
                        <rect x="68" y="10" width="4" height="12" />

                        <rect x="10" y="35" width="14" height="8" />
                        <rect x="30" y="30" width="12" height="12" />
                        <rect x="48" y="24" width="8" height="20" />
                        <rect x="62" y="32" width="18" height="8" />

                        <rect x="32" y="52" width="18" height="12" />
                        <rect x="58" y="48" width="10" height="18" />
                        <rect x="74" y="52" width="14" height="14" />

                        <rect x="10" y="55" width="12" height="14" />
                        <rect x="35" y="72" width="14" height="16" />
                        <rect x="55" y="75" width="18" height="14" />
                        <rect x="78" y="75" width="12" height="12" />
                      </svg>
                    </div>

                    <div className="space-y-1 text-left min-w-0 font-mono">
                      <span className="text-[7.5px] uppercase tracking-wider opacity-60 block font-semibold">
                        SCAN FOR VERIFICATION
                      </span>
                      <span className="text-[9.5px] font-bold block truncate">
                        {displayName}
                      </span>
                      <span className="text-[8px] opacity-75 block truncate">
                        {selectedEmp.email}
                      </span>
                      <span className="text-[8px] opacity-75 block truncate">
                        {selectedEmp.contact || "+1 (555) 019-2834"}
                      </span>
                    </div>
                  </div>

                  {/* Return instruction footer */}
                  <div className="border-t border-slate-800/80 pt-2 text-center text-[7.5px] opacity-60 font-mono">
                    If found, please return to Human Resources, {cardCompanyName}.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5 text-slate-500 text-[11px]">
              <Eye className="w-3.5 h-3.5" />
              <span>
                Click <strong>"Flip Card"</strong> to preview both sides.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

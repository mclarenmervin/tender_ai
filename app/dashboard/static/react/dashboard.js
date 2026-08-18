import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";

const h = React.createElement;
let activeApiRequests = 0;

function setGlobalLoading(active, label = "Loading...") {
    activeApiRequests = Math.max(0, activeApiRequests + (active ? 1 : -1));
    window.dispatchEvent(new CustomEvent("app:loading", {
        detail: { active: activeApiRequests > 0, label },
    }));
}

const nav = [
    ["Tenders", [["/dashboard", "All"], ["/dashboard/high-priority", "Priority"], ["/dashboard/upcoming-deadlines", "Deadlines"], ["/dashboard/applied", "Applied"]]],
    ["Work", [["/dashboard/pipeline", "Pipeline"], ["/dashboard/tracking", "Tracking"]]],
    ["Insights", [["/dashboard/analysis", "Analysis"], ["/dashboard/market", "Market"], ["/dashboard/reports", "Reports"], ["/dashboard/buyers", "Buyers"], ["/dashboard/competitors", "Competitors"]]],
    ["Setup", [["/dashboard/admin/keywords", "Keywords"], ["/dashboard/admin/scoring", "Scoring"], ["/dashboard/admin/settings", "Settings"], ["/dashboard/admin/delete", "Data"]]],
    ["Account", [["/dashboard/company-profile", "Company"], ["/dashboard/profile", "Profile"]]],
];

const buyerNav = [
    ["Home", [["/dashboard/buyer", "Dashboard"]]],
    ["Buyer Modules", [["/dashboard/buyer/bids", "Add Bid"], ["/dashboard/buyer/bid-verification", "Bids & Verification"], ["/dashboard/buyer/grants", "Grants"]]],
    ["Account", [["/dashboard/profile", "Profile"]]],
];

const buyerModules = {
    bids: {
        path: "/dashboard/buyer/bids",
        title: "Add Bids",
        text: "Create buyer bids with reference, department, category, vendor, dates, status, procurement details, and the final price.",
        sampleTitle: "New buyer bid",
        stages: ["Details", "Department", "Category", "Procurement", "Price", "Review"],
        focus: ["Bid reference", "Department", "Category", "Vendor", "Due date", "Final price"],
        checklist: ["Bid details verified", "Department selected", "Category entered", "Procurement mode selected", "Price confirmed", "Due date checked"],
        templates: ["Product Bid", "Service Bid", "Custom Bid"],
    },
    grants: {
        path: "/dashboard/buyer/grants",
        title: "Grants",
        text: "Add grants, identify the allocating department, and see allocated, used, and remaining grant balances.",
        sampleTitle: "New grant allocation",
        stages: ["Grant", "Department", "Allocation", "Bid Usage", "Balance"],
        focus: ["Grant reference", "Allocating department", "Allocated amount", "Used by bids", "Remaining balance"],
        checklist: ["Grant reference recorded", "Allocating department selected", "Amount verified", "Allocation notes added"],
        templates: ["Department Grant", "Project Grant", "Special Allocation"],
    },
    planning: {
        path: "/dashboard/buyer/planning",
        title: "Procurement Planning",
        text: "Build buyer demand before GeM publishing: product/service requirement, consignee, category, budget, and procurement mode.",
        sampleTitle: "New procurement demand",
        stages: ["Demand", "Category", "Specification", "Budget", "Approval", "Ready"],
        focus: ["Product procurement", "Service procurement", "Direct Purchase", "L1 Purchase", "Bid/RA", "Custom Bid"],
        checklist: ["Requirement note approved", "Product/service category selected", "Consignee and delivery location captured", "Estimated value and budget head captured", "Specification avoids restrictive clauses", "Procurement mode confirmed"],
        templates: ["Product demand", "Service demand", "Custom bid requirement", "Forward auction plan"],
    },
    "bid-management": {
        path: "/dashboard/buyer/bids",
        title: "Bid Management",
        text: "Control the published GeM bid lifecycle: draft, publish, clarification, corrigendum, technical opening, financial opening, and cancellation.",
        sampleTitle: "Bid publication tracker",
        stages: ["Draft", "Published", "Clarification", "Corrigendum", "Technical Open", "Financial Open", "Award/Cancel"],
        focus: ["Bid", "Reverse Auction", "Custom Bid", "Global Tender", "Forward Auction"],
        checklist: ["Bid document prepared", "Approvals complete", "Bid start/end dates checked", "Clarification window monitored", "Corrigendum approval recorded", "Technical opening scheduled", "Cancellation reason recorded if applicable"],
        templates: ["Product Bid/RA", "Service Bid", "Custom Bid", "Corrigendum tracker"],
    },
    "vendor-evaluation": {
        path: "/dashboard/buyer/vendors",
        title: "Vendor Evaluation",
        text: "Record technical qualification, disqualification reasons, representation handling, financial ranking, and L1 price reasonability.",
        sampleTitle: "Technical evaluation file",
        stages: ["Technical Open", "Technical Evaluation", "Representation", "Financial Open", "L1 Review", "Award Decision"],
        focus: ["Qualified bidders", "Disqualified bidders", "Representation", "L1 price", "Price reasonability"],
        checklist: ["Qualified bidders recorded", "Disqualification reasons captured exactly", "Representation allowed dates checked", "Buyer remarks recorded", "L1 price and vendor recorded", "Price reasonability note prepared"],
        templates: ["Technical evaluation", "Representation review", "Financial comparison", "L1 approval note"],
    },
    orders: {
        path: "/dashboard/buyer/orders",
        title: "Order Management",
        text: "Track GeM order processing after award: contract, seller acceptance, delivery, consignee receipt, CRAC, invoice, payment, and incidents.",
        sampleTitle: "Order fulfillment tracker",
        stages: ["Contract", "Seller Acceptance", "Dispatch", "Consignee Receipt", "CRAC", "Invoice", "Payment", "Closed"],
        focus: ["Order acceptance", "Delivery", "Consignee", "CRAC", "Invoice", "Payment", "Incident"],
        checklist: ["Contract issued", "Seller acceptance checked", "Delivery timeline set", "Consignee receipt tracked", "CRAC pending/complete", "Invoice verified", "Payment status updated", "Incident/return/replacement logged"],
        templates: ["Contract received", "CRAC pending", "Payment pending", "Incident case"],
    },
    compliance: {
        path: "/dashboard/buyer/compliance",
        title: "Compliance & Audit",
        text: "Keep a defensible purchase file: buyer role, approval trail, bid conditions, corrigendum justification, evaluation evidence, and payment delay notes.",
        sampleTitle: "Purchase file compliance",
        stages: ["Role Check", "Approval", "Bid File", "Evaluation File", "Order File", "Payment File", "Audit Ready"],
        focus: ["Buyer roles", "Approvals", "Purchase file", "Audit trail", "Corrigendum justification", "Payment delay"],
        checklist: ["Buyer role and delegation checked", "Approval note attached", "Bid audit trail complete", "Corrigendum justification recorded", "Evaluation evidence attached", "Order and CRAC evidence retained", "Payment delay checked"],
        templates: ["Purchase file", "Corrigendum justification", "Evaluation audit", "Payment delay note"],
    },
    reports: {
        path: "/dashboard/buyer/reports",
        title: "Reports",
        text: "Prepare buyer management reports for procurement status, bid lifecycle, vendor participation, savings, delayed orders, payments, and audit.",
        sampleTitle: "Monthly procurement report",
        stages: ["Collect", "Validate", "Summarize", "Review", "Export", "Share"],
        focus: ["Procurement summary", "Bid status", "Vendor participation", "Savings", "Delayed orders", "Payment pending"],
        checklist: ["Procurement list updated", "Bid status updated", "Vendor participation checked", "Savings checked", "Delayed orders reviewed", "Payment pending listed", "Audit export prepared"],
        templates: ["Monthly report", "Bid status report", "Delayed order report", "Payment pending report"],
    },
    account: {
        path: "/dashboard/buyer/account",
        title: "Buyer Account",
        text: "Maintain GeM buyer account readiness: government email, department mapping, buyer role, training/certification, and notifications.",
        sampleTitle: "Buyer account readiness",
        stages: ["Registration", "Department", "Role Mapping", "Training", "Certification", "Notifications", "Ready"],
        focus: ["gov.in/nic.in email", "Department mapping", "Buyer role", "Buyer certification", "Notifications"],
        checklist: ["Government email verified", "Department details verified", "Buyer role mapping complete", "Interactive buyer training tracked", "Buyer certification status recorded", "Notifications configured"],
        templates: ["Buyer registration", "Role mapping", "Certification tracker", "Notification setup"],
    },
};

const sellerNav = [
    ["Control Center", [["/dashboard/seller", "Overview"], ["/dashboard/seller/analytics", "Performance"]]],
    ["Tender Discovery", [["/dashboard/tender-search", "Global Search"], ["/dashboard/tenders", "Scraped Bids"], ["/dashboard/scrape-history", "Scrape History"], ["/dashboard/high-priority", "Priority Matches"], ["/dashboard/upcoming-deadlines", "Closing Soon"], ["/dashboard/seller/opportunities", "Opportunity Match"]]],
    ["GeM Portal", [["/dashboard/seller/gem-login", "Secure Login"], ["/dashboard/seller/gem-bids", "Own Bids"], ["/dashboard/seller/gem-alerts", "GeM Alerts"]]],
    ["Seller Operations", [["/dashboard/seller/readiness", "Readiness"], ["/dashboard/seller/catalogue", "Catalogue"], ["/dashboard/seller/bids", "Bid/RA Workflow"]]],
    ["Fulfillment", [["/dashboard/seller/orders", "Orders"], ["/dashboard/pipeline", "Pipeline"], ["/dashboard/tracking", "Tracking"], ["/dashboard/applied", "Applied"]]],
    ["Intelligence", [["/dashboard/seller/intelligence", "Overview"], ["/dashboard/seller/intelligence/risk-data", "Risk Data"], ["/dashboard/seller/intelligence/buyers", "Buyers"], ["/dashboard/seller/intelligence/competitors", "Competitors"], ["/dashboard/seller/intelligence/risk-signals", "Risk Signals"], ["/dashboard/seller/intelligence/reports", "Reports"], ["/dashboard/seller/intelligence/documents", "Documents"]]],
    ["Configuration", [["/dashboard/seller/keywords", "Keywords"], ["/dashboard/seller/scoring", "Scoring"], ["/dashboard/seller/settings", "Automation"], ["/dashboard/seller/data", "Data"], ["/dashboard/company-profile", "Company Profile"], ["/dashboard/profile", "User Profile"]]],
];

function navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new Event("app:navigate"));
}

function useTheme() {
    const [theme, setTheme] = useState(() => document.documentElement.getAttribute("data-theme") || "light");
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        try { localStorage.setItem("tender-ai-theme", theme); } catch {}
    }, [theme]);
    return [theme, () => setTheme(t => (t === "dark" ? "light" : "dark"))];
}

const SUN_ICON = h("svg", { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" },
    h("circle", { cx: 12, cy: 12, r: 4.5 }),
    h("path", { d: "M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" })
);
const MOON_ICON = h("svg", { width: 17, height: 17, viewBox: "0 0 24 24", fill: "currentColor" },
    h("path", { d: "M20.4 14.7A8.6 8.6 0 1 1 9.3 3.6a7 7 0 0 0 11.1 11.1Z" })
);

function ThemeToggle() {
    const [theme, toggleTheme] = useTheme();
    return h("button", {
        type: "button",
        className: "theme-toggle",
        onClick: toggleTheme,
        title: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        "aria-label": "Toggle color theme",
    }, theme === "dark" ? SUN_ICON : MOON_ICON);
}

function ServerClock() {
    const [serverNow, setServerNow] = useState(null);
    const [loadedAt, setLoadedAt] = useState(null);
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let alive = true;
        async function loadTime() {
            try {
                const data = await api("/api/server-time", { silent: true });
                if (!alive) return;
                setServerNow(new Date(data.iso));
                setLoadedAt(Date.now());
            } catch {}
        }
        loadTime();
        const refresh = setInterval(loadTime, 5 * 60 * 1000);
        return () => { alive = false; clearInterval(refresh); };
    }, []);
    useEffect(() => {
        const timer = setInterval(() => setTick(value => value + 1), 1000);
        return () => clearInterval(timer);
    }, []);
    if (!serverNow || !loadedAt) return h("div", { className: "server-clock" }, h("span", null, "Server"), h("strong", null, "--:--:--"));
    const current = new Date(serverNow.getTime() + (Date.now() - loadedAt));
    const time = current.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    const date = current.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    void tick;
    return h("div", { className: "server-clock", title: "Server current time" },
        h("span", null, date),
        h("strong", null, time)
    );
}

function icon(children, viewBox = "0 0 24 24") {
    return h("svg", { width: 16, height: 16, viewBox, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }, children);
}
const ICON_MAIL = icon([h("rect", { key: 1, x: 3, y: 5, width: 18, height: 14, rx: 2 }), h("path", { key: 2, d: "m3 7 9 6 9-6" })]);
const ICON_LOCK = icon([h("rect", { key: 1, x: 4.5, y: 10.5, width: 15, height: 9.5, rx: 2 }), h("path", { key: 2, d: "M7.5 10.5V7.2a4.5 4.5 0 0 1 9 0v3.3" })]);
const ICON_USER = icon([h("circle", { key: 1, cx: 12, cy: 8, r: 3.4 }), h("path", { key: 2, d: "M4.8 20c1.2-3.8 4.2-5.6 7.2-5.6s6 1.8 7.2 5.6" })]);
const ICON_EYE = icon([h("path", { key: 1, d: "M2 12s3.6-7.2 10-7.2S22 12 22 12s-3.6 7.2-10 7.2S2 12 2 12Z" }), h("circle", { key: 2, cx: 12, cy: 12, r: 3 })]);
const ICON_EYE_OFF = icon([
    h("path", { key: 1, d: "M3 3l18 18" }),
    h("path", { key: 2, d: "M10.6 5.1A11 11 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3.2 4.2" }),
    h("path", { key: 3, d: "M6.5 6.7C3.9 8.4 2 12 2 12s3.6 7 10 7c1.4 0 2.7-.3 3.8-.8" }),
    h("path", { key: 4, d: "M9.9 9.9a3 3 0 0 0 4.2 4.2" }),
]);
const ICON_SHIELD = icon([h("path", { key: 1, d: "M12 3.2 5 6v5.4C5 15.9 8 19.4 12 20.6c4-1.2 7-4.7 7-9.2V6l-7-2.8Z" })]);
const ICON_BRIEFCASE = icon([h("rect", { key: 1, x: 3, y: 7.5, width: 18, height: 12, rx: 2 }), h("path", { key: 2, d: "M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" }), h("path", { key: 3, d: "M3 13h18" })]);
const ICON_STORE = icon([
    h("path", { key: 1, d: "M4.5 9 5.6 4h12.8l1.1 5" }),
    h("path", { key: 2, d: "M4.5 9a2 2 0 0 0 4 .3 2 2 0 0 0 3.9 0 2.1 2.1 0 0 0 .1.3 2 2 0 0 0 3.9-.3 2 2 0 0 0 4 0" }),
    h("path", { key: 3, d: "M5.5 9.6V20h13V9.6" }),
]);

function AuthField({ id, label, fieldIcon, type = "text", value, onChange, onBlur, placeholder, error, autoComplete, rightSlot }) {
    return h("div", { className: "field" + (error ? " field-error" : "") },
        h("label", { htmlFor: id }, label),
        h("div", { className: "field-input" },
            h("span", { className: "field-icon" }, fieldIcon),
            h("input", { id, type, value, onChange, onBlur, placeholder, autoComplete, required: true }),
            rightSlot || null
        ),
        error ? h("small", { className: "field-message" }, error) : null
    );
}

function PasswordField({ id, label, value, onChange, onBlur, placeholder, error, autoComplete }) {
    const [visible, setVisible] = useState(false);
    return h(AuthField, {
        id, label, fieldIcon: ICON_LOCK, type: visible ? "text" : "password", value, onChange, onBlur, placeholder, error, autoComplete,
        rightSlot: h("button", {
            type: "button",
            className: "field-toggle",
            tabIndex: -1,
            onClick: () => setVisible(v => !v),
            "aria-label": visible ? "Hide password" : "Show password",
        }, visible ? ICON_EYE_OFF : ICON_EYE),
    });
}

function RoleOption({ title, text, roleIcon, active, onClick }) {
    return h("button", { type: "button", className: "role-card" + (active ? " active" : ""), onClick },
        h("span", { className: "role-icon" }, roleIcon),
        h("strong", null, title),
        h("span", { className: "role-text" }, text)
    );
}

function roleDashboard(user) {
    return user?.role === "seller" ? "/dashboard/seller" : "/dashboard/buyer";
}

async function api(path, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    const showLoader = !options.silent;
    if (showLoader) setGlobalLoading(true, options.loadingLabel || (path.includes("gem-bids/sync-now") ? "Syncing GeM records..." : "Loading..."));
    try {
        const response = await fetch(path, { credentials: "same-origin", headers, ...options });
        if (response.status === 401 && !location.pathname.startsWith("/login") && !location.pathname.startsWith("/signup")) {
            navigate("/login");
            throw new Error("Login required");
        }
        if (!response.ok) {
            let message = `Request failed: ${response.status}`;
            const text = await response.text();
            if (text) {
                try {
                    message = JSON.parse(text).detail || message;
                } catch {
                    message = text;
                }
            }
            throw new Error(message);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } finally {
        if (showLoader) setGlobalLoading(false);
    }
}

function money(value) {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function scoreClass(score) {
    if (score >= 70) return "high";
    if (score >= 40) return "mid";
    return "low";
}

function scrapeMessage(result) {
    const logs = result?.source_logs || [];
    const failures = logs.filter(log => log.status === "failed" || log.message);
    const detail = failures.map(log => `${log.source || "Source"}: ${log.message || log.status}`).join(" | ");
    const extra = [];
    if (result?.used_default_keywords) extra.push(`used starter keywords: ${(result.keywords || []).join(", ")}`);
    else if (result?.used_authority_terms) extra.push("searched each selected authority through GeM hierarchy and verified profile locations");
    else if (result?.keyword_count !== undefined) extra.push(`${result.keyword_count} keyword(s) searched`);
    if (result?.removed_low_priority) extra.push(`${result.removed_low_priority} low-priority tender(s) removed`);
    const base = `Scrape finished. Inserted ${result?.inserted || 0}, scored ${result?.scored || 0}.`;
    return [base, detail, extra.join("; ")].filter(Boolean).join(" ");
}

function scrapeDiagnosticsMessage(data) {
    if (!data) return "";
    const latest = data.latest_run;
    const parts = [];
    if (latest) {
        parts.push(`Last run ${latest.status || "unknown"}: inserted ${latest.inserted_count || 0}, scored ${latest.scored_count || 0}, removed ${latest.removed_low_priority_count || 0}.`);
        if (latest.message) parts.push(latest.message);
    }
    const enabledProfiles = (data.settings?.scrape_profiles || []).filter(profile => profile.enabled !== false);
    if (enabledProfiles.length) {
        parts.push(`Configured criteria: ${enabledProfiles.map(profile => profile.name || "Scrape Criteria").join(", ")}. Each criterion runs independently.`);
    } else if (!data.active_keywords?.length && !data.has_company_profile && !data.settings?.scrape_authorities?.length) {
        parts.push("No active keywords or company profile terms are configured for this user.");
    } else if (!data.active_keywords?.length && data.settings?.scrape_authorities?.length) {
        parts.push(`Product keywords are off; all ${data.settings.scrape_authorities.length} selected authority name(s) will be searched with exact Department matching.`);
    }
    if (data.settings?.only_high_priority) {
        parts.push("High-priority-only mode is enabled, so low-score tenders may be removed after scraping.");
    }
    const recentLog = (data.logs || [])[0];
    if (recentLog?.message) parts.push(`Recent log: ${recentLog.message}`);
    const perf = (data.performance || [])[0];
    if (perf) parts.push(`Keyword ${perf.keyword}: fetched ${perf.fetched_count || 0}, inserted ${perf.inserted_count || 0}, duplicates ${perf.duplicate_count || 0}.`);
    return parts.join(" ");
}

function pageTitle(path) {
    const match = [...nav, ...buyerNav, ...sellerNav].flatMap(([, items]) => items).find(([href]) => href === path);
    if (match) return match[1];
    if (path === "/") return "Tender AI";
    if (path === "/features") return "Features";
    if (path === "/pricing") return "Pricing";
    if (path === "/how-it-works") return "How It Works";
    if (path === "/about") return "About";
    if (path === "/contact") return "Contact";
    if (path === "/login") return "Login";
    if (path === "/signup") return "Create Account";
    if (path === "/dashboard/tenders") return "All Tenders";
    if (path === "/dashboard/buyer") return "Buyer Dashboard";
    const buyerModuleTitle = Object.values(buyerModules).find(item => item.path === path)?.title;
    if (buyerModuleTitle) return buyerModuleTitle;
    if (path === "/dashboard/seller") return "Seller Dashboard";
    if (path === "/dashboard/seller/analytics") return "Seller Analytics";
    if (path === "/dashboard/seller/gem-login") return "GeM Login";
    if (path === "/dashboard/seller/gem-bids") return "GeM Bid Tracking";
    if (path === "/dashboard/seller/gem-alerts") return "GeM Alerts";
    if (path === "/dashboard/seller/intelligence") return "Seller Intelligence";
    if (path === "/dashboard/seller/intelligence/risk-data") return "Risk Data";
    if (path === "/dashboard/seller/intelligence/buyers") return "Buyer History";
    if (path === "/dashboard/seller/intelligence/competitors") return "Competitor Intelligence";
    if (path === "/dashboard/seller/intelligence/risk-signals") return "Risk Signals";
    if (path === "/dashboard/seller/intelligence/reports") return "Risk Reports";
    if (path === "/dashboard/seller/intelligence/documents") return "Document Extraction";
    if (path === "/dashboard/seller/keywords") return "Seller Keywords";
    if (path === "/dashboard/seller/scoring") return "Seller Scoring";
    if (path === "/dashboard/seller/settings") return "Seller Settings";
    if (path === "/dashboard/seller/data") return "Seller Data";
    if (path === "/dashboard/seller/readiness") return "Seller Readiness";
    if (path === "/dashboard/seller/catalogue") return "Catalogue Tracker";
    if (path === "/dashboard/seller/opportunities") return "Opportunity Matching";
    if (path === "/dashboard/seller/bids") return "Bid/RA Workflow";
    if (path === "/dashboard/seller/orders") return "Order Fulfillment";
    if (path === "/dashboard/company-profile") return "Company Profile";
    return "Tender AI";
}

function useSessionProbe() {
    const [me, setMe] = useState(null);
    const [checked, setChecked] = useState(false);
    useEffect(() => {
        let alive = true;
        fetch("/api/me", { credentials: "same-origin", headers: { Accept: "application/json" } })
            .then(response => response.ok ? response.json() : null)
            .then(data => { if (alive) setMe(data); })
            .catch(() => { if (alive) setMe(null); })
            .finally(() => { if (alive) setChecked(true); });
        return () => { alive = false; };
    }, []);
    return { me, checked };
}

const publicNav = [
    ["/features", "Features"],
    ["/how-it-works", "How It Works"],
    ["/pricing", "Pricing"],
    ["/about", "About"],
    ["/contact", "Contact"],
];

const featureCards = [
    ["GeM Discovery", "Scrape relevant GeM opportunities using your saved keywords, states, city filters, and high-priority settings."],
    ["AI Bid Scoring", "Rank tenders by keyword fit, scoring criteria, deadline risk, and business relevance so teams focus faster."],
    ["PDF Intelligence", "Generate downloadable bid reports from tender documents and keep raw PDFs close to every opportunity."],
    ["Live Analytics", "Use charts for score distribution, department mix, state coverage, deadline risk, and document extraction status."],
    ["Workflow Tracking", "Track new, reviewing, applied, won, lost, and ignored tenders with remarks for each user workspace."],
    ["Smart Alerts", "Notify users through Telegram and email when a scrape adds new tender opportunities."],
];

const productStats = [
    ["1-2 min", "target manual scrape cycle"],
    ["User-wise", "private tenders and settings"],
    ["PDF + CSV", "downloadable bid reports"],
    ["Alerts", "Telegram and email ready"],
];

const productModules = [
    ["Discover", "Keyword, synonym, state, and city filters pull more relevant opportunities from GeM."],
    ["Prioritize", "AI and rule-based scoring separate high-priority bids from low-fit tenders."],
    ["Analyze", "Chart.js dashboards turn tender lists, PDFs, departments, states, and deadlines into usable intelligence."],
    ["Act", "Status tracking, remarks, downloads, and alerts help the user move from finding to bidding."],
];

const audiences = [
    ["Bid Teams", "Shortlist opportunities faster and keep every tender decision visible."],
    ["Founders", "Watch new opportunities without manually checking portals all day."],
    ["Operations", "Export reports, track statuses, and keep each user's workspace separate."],
];

const featureDeepDives = [
    ["Keyword Scraping Engine", "Save keywords, synonyms, business profiles, multiple states, and city filters. Manual scrape uses those settings so each user receives tenders matched to their own market."],
    ["High Priority Mode", "Enable high-priority scraping to collect a broader batch and keep only tenders that cross the configured scoring threshold."],
    ["Scoring Control Room", "Manage positive and negative scoring criteria, install defaults, and rescore saved tenders when your business focus changes."],
    ["PDF And Raw Bid Downloads", "Keep source links, raw bid PDF downloads, generated bid reports, and CSV exports available from the tender list."],
    ["Analytics Dashboard", "Chart score distribution, status mix, state-wise volume, departments, deadline risk, value bands, category mix, and PDF extraction coverage."],
    ["Notifications", "Send Telegram and email alerts to users after a scrape inserts new tenders into their workspace."],
];

const workflowDetails = [
    ["Configure", "Set keywords, scoring criteria, locations, notification preferences, and auto-scrape timing from the admin area."],
    ["Collect", "Run manual scrape or scheduled scrape to fetch GeM opportunities into the current user's tender database."],
    ["Qualify", "Use AI scoring, keyword scoring, high-priority filtering, PDF extraction, and analytics to decide what deserves attention."],
    ["Execute", "Update statuses, add remarks, download reports, and keep alerts flowing when new matching bids appear."],
];

const reportItems = [
    "Tender summary and source metadata",
    "Estimated value, deadline, department, state, and category signals",
    "AI score, keyword match reason, and status",
    "PDF coverage, raw bid PDF link, CSV export, and analytics report",
];

const roadmapItems = [
    ["Buyer Intelligence", "Track buyer patterns, departments, and categories that repeatedly match your business."],
    ["Bid/No-Bid Assist", "Convert scoring, eligibility, value, and deadline risk into a clear recommendation."],
    ["More Tender Sources", "Extend the same product workflow beyond GeM into CPPP, eProcure, and state portals."],
];

const testimonials = [
    ["Procurement Lead", "Tender AI gives our team one place to discover, score, track, and export bid opportunities."],
    ["Founder", "The keyword and alert workflow is exactly what we needed to stop checking portals manually."],
    ["Operations Manager", "User-wise settings and downloads make the tender list feel practical for daily review."],
];

const faqs = [
    ["Does each user see separate tenders?", "Yes. Every signup user has their own tenders, keywords, scoring settings, notifications, and status workflow."],
    ["Which source is supported now?", "The working scraper is focused on the GeM portal, with the product roadmap prepared for more tender sources."],
    ["Can users download reports?", "Yes. The app supports tender exports, analytics reports, generated bid reports, and raw bid PDF downloads where available."],
    ["Can scraping run automatically?", "Yes. Auto-scrape settings exist for interval or daily scheduled scraping, alongside manual scraping."],
];

const planComparison = [
    ["Feature", "Starter", "Growth", "Enterprise"],
    ["User-specific workspace", "Yes", "Yes", "Yes"],
    ["GeM keyword scraping", "Yes", "Yes", "Yes"],
    ["High-priority filtering", "Basic", "Advanced", "Advanced"],
    ["Analytics and reports", "CSV", "CSV + PDF", "Custom"],
    ["Notifications", "Email ready", "Email + Telegram", "Custom channels"],
    ["Roadmap intelligence", "No", "Limited", "Buyer and source expansion"],
];

function PublicLayout({ children, path }) {
    const { me } = useSessionProbe();
    return h("div", { className: "site" },
        h("header", { className: "site-nav" },
            h("button", { className: "site-brand", onClick: () => navigate("/") }, h("span", { className: "brand-mark" }, "T"), "Tender ", h("span", null, "AI")),
            h("nav", null, publicNav.map(([href, label]) => h("button", {
                key: href,
                className: path === href ? "active" : "",
                onClick: () => navigate(href),
            }, label))),
            h("div", { className: "site-actions" },
                h(ThemeToggle),
                me ? h("span", { className: "site-user" }, me.name || me.email) : h("button", { className: "ghost", onClick: () => navigate("/login") }, "Login"),
                h("button", { className: "primary", onClick: () => navigate(me ? "/dashboard" : "/signup") }, me ? "Go to Dashboard" : "Start Free")
            )
        ),
        children,
        h(PublicCTA),
        h("footer", { className: "site-footer" },
            h("div", null,
                h("button", { className: "footer-brand", onClick: () => navigate("/") }, h("span", { className: "brand-mark" }, "T"), "Tender ", h("span", null, "AI")),
                h("p", null, "AI-powered tender discovery, scoring, tracking, analytics, and alerts for buyer and seller teams working GeM opportunities.")
            ),
            h("div", { className: "footer-col" },
                h("h4", null, "Product"),
                [["/features", "Features"], ["/pricing", "Pricing"], ["/how-it-works", "How It Works"]].map(([href, label]) =>
                    h("button", { key: href, onClick: () => navigate(href) }, label))
            ),
            h("div", { className: "footer-col" },
                h("h4", null, "Company"),
                [["/about", "About"], ["/contact", "Contact"]].map(([href, label]) =>
                    h("button", { key: href, onClick: () => navigate(href) }, label))
            ),
            h("div", { className: "footer-col" },
                h("h4", null, "Account"),
                [["/login", "Login"], ["/signup", "Create Account"]].map(([href, label]) =>
                    h("button", { key: href, onClick: () => navigate(href) }, label))
            ),
            h("div", { className: "site-footer-bottom" },
                h("span", null, `© ${new Date().getFullYear()} Tender AI. All rights reserved.`),
                h("span", null, "Built for GeM tender discovery and bid workflow teams.")
            )
        )
    );
}

function PublicHeroActions() {
    const { me } = useSessionProbe();
    return h("div", { className: "hero-cta" },
        h("button", { className: "primary large", onClick: () => navigate(me ? "/dashboard" : "/signup") }, me ? "Open Dashboard" : "Create Account"),
        h("button", { className: "ghost large", onClick: () => navigate("/features") }, "View Features")
    );
}

function PublicCTA() {
    const { me } = useSessionProbe();
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    async function subscribe(event) {
        event.preventDefault();
        setMessage("Saving...");
        try {
            const result = await api("/api/public/leads", {
                method: "POST",
                body: JSON.stringify({ lead_type: "newsletter", email, source_page: location.pathname }),
            });
            setEmail("");
            setMessage(result.message || "Saved.");
        } catch (err) {
            setMessage(err.message || "Could not save your email.");
        }
    }
    return h("section", { className: "site-cta" },
        h("div", null,
            h("h2", null, me ? "Your tender workspace is ready." : "Ready to turn tender searching into a workflow?"),
            h("p", null, me ? "Open the dashboard to review tenders, analytics, reports, scoring, and alerts." : "Create an account and start using the Tender AI dashboard with user-specific tenders and settings."),
            h("form", { className: "newsletter-form", onSubmit: subscribe },
                h("input", { value: email, onChange: e => setEmail(e.target.value), type: "email", placeholder: "Get product updates by email", required: true }),
                h("button", { className: "ghost" }, "Subscribe")
            ),
            message ? h("div", { className: "cta-message" }, message) : null
        ),
        h("div", { className: "site-cta-actions" },
            h("button", { className: "primary large", onClick: () => navigate(me ? "/dashboard" : "/signup") }, me ? "Go to Dashboard" : "Start Free"),
            h("button", { className: "ghost large", onClick: () => navigate("/contact") }, "Book Demo")
        )
    );
}

function LeadForm({ leadType = "demo", plan = "" }) {
    const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "", plan });
    const [status, setStatus] = useState("");
    async function submit(event) {
        event.preventDefault();
        setStatus("Saving request...");
        try {
            const result = await api("/api/public/leads", {
                method: "POST",
                body: JSON.stringify({ ...form, lead_type: leadType, source_page: location.pathname }),
            });
            setForm({ name: "", email: "", company: "", phone: "", message: "", plan });
            setStatus(result.message || "Request saved.");
        } catch (err) {
            setStatus(err.message || "Could not save request.");
        }
    }
    return h("form", { onSubmit: submit },
        status ? h("div", { className: status.startsWith("Saving") ? "notice" : "notice ok" }, status) : null,
        h("input", { value: form.name, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: "Name", required: true }),
        h("input", { value: form.email, onChange: e => setForm({ ...form, email: e.target.value }), placeholder: "Email", type: "email", required: true }),
        h("input", { value: form.company, onChange: e => setForm({ ...form, company: e.target.value }), placeholder: "Company" }),
        h("input", { value: form.phone, onChange: e => setForm({ ...form, phone: e.target.value }), placeholder: "Phone" }),
        h("textarea", { value: form.message, onChange: e => setForm({ ...form, message: e.target.value }), placeholder: "Tell us your tender sources, categories, states, and alert needs." }),
        h("button", { className: "primary" }, "Submit Request")
    );
}

function HomePage() {
    return h(PublicLayout, { path: "/" },
        h("main", null,
            h("section", { className: "site-hero" },
                h("div", { className: "hero-copy" },
                    h("div", { className: "eyebrow" }, "Tender intelligence platform"),
                    h("h1", null, "Tender AI"),
                    h("p", null, "Find relevant GeM tenders, score them with AI, analyze bid documents, and alert your team when new opportunities appear."),
                    h(PublicHeroActions),
                    h("div", { className: "hero-proof" }, productStats.map(([value, label]) => h("div", { key: value }, h("strong", null, value), h("span", null, label))))
                ),
                h("div", { className: "hero-console" },
                    h("div", { className: "console-top" }, h("span", null), h("span", null), h("span", null)),
                    h("div", { className: "console-stat" }, h("small", null, "High Priority"), h("strong", null, "72"), h("em", null, "+35 from latest scrape")),
                    h("div", { className: "console-row" }, h("b", null, "IoT sensor procurement"), h("span", null, "Score 86")),
                    h("div", { className: "console-row" }, h("b", null, "Water purification system"), h("span", null, "Score 74")),
                    h("div", { className: "console-row" }, h("b", null, "Ground transport kit"), h("span", null, "Score 68"))
                )
            ),
            h("section", { className: "site-band" },
                h("div", { className: "section-head" }, h("h2", null, "Built from the working product"), h("p", null, "The website presents the same operational systems already available inside the protected dashboard.")),
                h("div", { className: "feature-grid" }, featureCards.slice(0, 3).map(([title, text]) => h("article", { className: "feature-card", key: title }, h("h3", null, title), h("p", null, text))))
            ),
            h("section", { className: "module-band" },
                h("div", { className: "section-head" }, h("h2", null, "One workflow, four clear layers"), h("p", null, "The brand now explains the actual product journey your app already supports.")),
                h("div", { className: "module-grid" }, productModules.map(([title, text], index) => h("article", { key: title }, h("span", null, String(index + 1).padStart(2, "0")), h("h3", null, title), h("p", null, text))))
            ),
            h("section", { className: "audience-band" },
                h("div", { className: "section-head" }, h("h2", null, "Designed for tender-focused teams"), h("p", null, "A practical product story for people who need fewer missed bids and faster decisions.")),
                h("div", { className: "audience-grid" }, audiences.map(([title, text]) => h("article", { key: title }, h("h3", null, title), h("p", null, text))))
            ),
            h("section", { className: "story-panel" },
                h("div", null,
                    h("div", { className: "eyebrow dark" }, "From portal noise to bid action"),
                    h("h2", null, "The platform does the repetitive tender work, then leaves humans with the decisions."),
                    h("p", null, "The product covers discovery, scoring, analytics, reports, status tracking, deletion controls, profile settings, and alerts in one connected flow.")
                ),
                h("div", { className: "story-list" }, workflowDetails.map(([title, text]) => h("article", { key: title }, h("strong", null, title), h("span", null, text))))
            ),
            h("section", { className: "testimonial-band" },
                h("div", { className: "section-head" }, h("h2", null, "Built for practical tender teams"), h("p", null, "Use-case stories that match the product workflows already inside the app.")),
                h("div", { className: "testimonial-grid" }, testimonials.map(([name, quote]) => h("article", { key: name }, h("p", null, quote), h("strong", null, name))))
            )
        )
    );
}

function FeaturesPage() {
    return h(PublicLayout, { path: "/features" },
        h("main", null,
            h("section", { className: "page-hero compact" }, h("h1", null, "Features"), h("p", null, "Everything needed to discover, qualify, track, and report on tenders from one workspace.")),
            h("section", { className: "site-band" }, h("div", { className: "feature-grid" }, featureCards.map(([title, text], index) => h("article", { className: "feature-card", key: title }, h("div", { className: "feature-index" }, String(index + 1).padStart(2, "0")), h("h3", null, title), h("p", null, text))))),
            h("section", { className: "detail-band" },
                h("div", { className: "section-head" }, h("h2", null, "Feature details"), h("p", null, "A closer explanation of the systems already built into the product.")),
                h("div", { className: "detail-grid" }, featureDeepDives.map(([title, text]) => h("article", { key: title }, h("h3", null, title), h("p", null, text))))
            ),
            h("section", { className: "report-band" },
                h("div", null, h("h2", null, "Downloads are part of the workflow"), h("p", null, "Tender AI keeps both operational exports and bid-specific documents close to each tender.")),
                h("ul", null, reportItems.map(item => h("li", { key: item }, item)))
            ),
            h("section", { className: "module-band" }, h("div", { className: "module-grid" }, productModules.map(([title, text], index) => h("article", { key: title }, h("span", null, String(index + 1).padStart(2, "0")), h("h3", null, title), h("p", null, text)))))
        )
    );
}

function PricingPage() {
    const plans = [
        ["Starter", "For a single tender workflow", ["User-specific tender list", "Keyword scraping", "Status tracking"], "Start Free"],
        ["Growth", "For active bid teams", ["High-priority scraping", "Analytics reports", "Telegram and email alerts"], "Request Demo"],
        ["Enterprise", "For larger tender operations", ["Multi-source roadmap", "Buyer intelligence", "Advanced document analysis"], "Contact Us"],
    ];
    return h(PublicLayout, { path: "/pricing" },
        h("main", null,
            h("section", { className: "page-hero compact" }, h("h1", null, "Pricing"), h("p", null, "Simple plans for teams moving from manual tender searching to AI-assisted opportunity management.")),
            h("section", { className: "pricing-grid" }, plans.map(([name, desc, points, cta]) => h("article", { className: "price-card", key: name },
                h("h3", null, name), h("p", null, desc), h("ul", null, points.map(point => h("li", { key: point }, point))), h("button", { className: "primary", onClick: () => navigate(cta === "Start Free" ? "/signup" : "/contact") }, cta)
            ))),
            h("section", { className: "comparison-band" },
                h("div", { className: "section-head" }, h("h2", null, "What every plan is built around"), h("p", null, "The website now positions pricing around business value, not just a feature checklist.")),
                h("div", { className: "comparison-grid" }, [
                    ["Private Workspace", "Each signup user sees their own tenders, keywords, settings, scoring rules, alerts, and status updates."],
                    ["Tender Intelligence", "Scraping, scoring, analytics, reports, and tracking are connected as one tender workflow."],
                    ["Automation Ready", "Manual scrape, auto-scrape settings, Telegram alerts, and email notifications support daily operations."]
                ].map(([title, text]) => h("article", { key: title }, h("h3", null, title), h("p", null, text))))
            ),
            h("section", { className: "plan-table-band" },
                h("div", { className: "section-head" }, h("h2", null, "Plan comparison"), h("p", null, "A clearer purchase path for users comparing what they need.")),
                h("div", { className: "plan-table" }, h("table", null,
                    h("tbody", null, planComparison.map((row, i) => h("tr", { key: row[0], className: i === 0 ? "head-row" : "" }, row.map(cell => h(i === 0 ? "th" : "td", { key: cell }, cell)))))
                ))
            )
        )
    );
}

function HowItWorksPage() {
    const steps = [
        ["Set keywords and locations", "Save product keywords, synonyms, scoring criteria, states, and city filters."],
        ["Run scrape or schedule it", "Manual and auto-scrape collect GeM tender opportunities into the logged-in user's workspace."],
        ["Score and analyze", "AI and keyword scoring prioritize tenders while analytics explains the pipeline."],
        ["Track and alert", "Update bid statuses, download reports, and notify users when new tenders arrive."],
    ];
    return h(PublicLayout, { path: "/how-it-works" },
        h("main", null,
            h("section", { className: "page-hero compact" }, h("h1", null, "How It Works"), h("p", null, "A practical workflow from search to bid decision.")),
            h("section", { className: "steps" }, steps.map(([title, text], i) => h("article", { key: title }, h("span", null, String(i + 1).padStart(2, "0")), h("h3", null, title), h("p", null, text)))),
            h("section", { className: "timeline-band" },
                workflowDetails.map(([title, text], i) => h("article", { key: title },
                    h("div", null, h("span", null, String(i + 1)), h("strong", null, title)),
                    h("p", null, text)
                ))
            ),
            h("section", { className: "faq-band" },
                h("div", { className: "section-head" }, h("h2", null, "Common questions"), h("p", null, "Short answers for users evaluating the platform.")),
                h("div", { className: "faq-list" }, faqs.map(([question, answer]) => h("details", { key: question }, h("summary", null, question), h("p", null, answer))))
            )
        )
    );
}

function AboutPage() {
    return h(PublicLayout, { path: "/about" },
        h("main", null,
            h("section", { className: "page-hero" },
                h("h1", null, "Tender AI turns tender operations into a focused workflow."),
                h("p", null, "The product combines your existing scraping, scoring, analytics, PDF downloads, notifications, and user-specific settings into one platform experience.")
            ),
            h("section", { className: "site-band two-col" },
                h("div", null, h("h2", null, "What we are building"), h("p", null, "A tender intelligence product for teams that need speed, clarity, and fewer missed opportunities.")),
                h("div", null, h("h2", null, "What comes next"), h("p", null, "More sources, deeper PDF eligibility extraction, competitor intelligence, bid/no-bid recommendations, and team collaboration."))
            ),
            h("section", { className: "roadmap-band" },
                h("div", { className: "section-head" }, h("h2", null, "Next product bets"), h("p", null, "These are natural upgrades from the current Tender AI foundation.")),
                h("div", { className: "roadmap-grid" }, roadmapItems.map(([title, text]) => h("article", { key: title }, h("h3", null, title), h("p", null, text))))
            )
        )
    );
}

function ContactPage() {
    return h(PublicLayout, { path: "/contact" },
        h("main", null,
            h("section", { className: "page-hero compact" }, h("h1", null, "Contact"), h("p", null, "Talk to us about using Tender AI for your tender discovery and bid workflow.")),
            h("section", { className: "contact-panel" },
                h("div", null, h("h2", null, "Book a demo"), h("p", null, "Share your tender categories, sources, and alert needs. This request can be connected to email, CRM, Firebase, or the app database.")),
                h(LeadForm, { leadType: "demo" })
            ),
            h("section", { className: "faq-band contact-faq" },
                h("div", { className: "section-head" }, h("h2", null, "Before we talk"), h("p", null, "A few useful details for demo requests.")),
                h("div", { className: "faq-list" }, faqs.slice(0, 3).map(([question, answer]) => h("details", { key: question }, h("summary", null, question), h("p", null, answer))))
            )
        )
    );
}

function buildStarfield(count) {
    const tints = ["#e8effa", "#e8effa", "#e8effa", "#7dd3c0", "#facc86"];
    const stars = [];
    for (let i = 0; i < count; i++) {
        const big = Math.random() < 0.14;
        stars.push({
            left: Math.random() * 100,
            top: Math.random() * 100,
            size: big ? 2.2 + Math.random() * 1.6 : 1 + Math.random() * 1.2,
            dur: 2.6 + Math.random() * 3.4,
            delay: Math.random() * 5,
            tint: tints[Math.floor(Math.random() * tints.length)],
        });
    }
    return stars;
}
const AUTH_STARS = buildStarfield(70);

function AuthStarfield() {
    return h("div", { className: "auth-stars", "aria-hidden": "true" },
        AUTH_STARS.map((s, i) => h("span", {
            key: i,
            className: "star",
            style: {
                left: s.left + "%",
                top: s.top + "%",
                width: s.size + "px",
                height: s.size + "px",
                background: s.tint,
                color: s.tint,
                animationDuration: s.dur + "s",
                animationDelay: s.delay + "s",
            },
        })),
        h("span", { className: "auth-shape shape-a" }),
        h("span", { className: "auth-shape shape-b" }),
        h("span", { className: "auth-shape shape-c" })
    );
}

function buildRoleStars(count) {
    const roles = ["a", "b", "c"];
    const stars = [];
    for (let i = 0; i < count; i++) {
        const big = Math.random() < 0.12;
        stars.push({
            left: Math.random() * 100,
            top: Math.random() * 100,
            size: big ? 2.2 + Math.random() * 1.6 : 1 + Math.random() * 1.2,
            dur: 2.8 + Math.random() * 3.6,
            delay: Math.random() * 6,
            role: roles[Math.floor(Math.random() * roles.length)],
        });
    }
    return stars;
}
const GLOBAL_STARS = buildRoleStars(46);

function GlobalBackdrop() {
    return h("div", { className: "global-backdrop", "aria-hidden": "true" },
        GLOBAL_STARS.map((s, i) => h("span", {
            key: i,
            className: `star role-${s.role}`,
            style: {
                left: s.left + "%",
                top: s.top + "%",
                width: s.size + "px",
                height: s.size + "px",
                animationDuration: s.dur + "s",
                animationDelay: s.delay + "s",
            },
        })),
        h("span", { className: "g-shape g-shape-1" }),
        h("span", { className: "g-shape g-shape-2" }),
        h("span", { className: "g-shape g-shape-3" })
    );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthPage({ mode }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("buyer");
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const isSignup = mode === "signup";
    const { me, checked } = useSessionProbe();
    useEffect(() => {
        // A signed-in user may still need to create a separate buyer or seller
        // workspace. Do not redirect away from the signup form in that case.
        if (!isSignup && checked && me) navigate(roleDashboard(me));
    }, [checked, me, isSignup]);

    function validate() {
        const next = {};
        if (isSignup && !name.trim()) next.name = "Enter your full name.";
        if (!email.trim()) next.email = "Enter your email address.";
        else if (!EMAIL_PATTERN.test(email.trim())) next.email = "Enter a valid email address.";
        if (!password) next.password = "Enter your password.";
        else if (isSignup && password.length < 6) next.password = "Use at least 6 characters.";
        setFieldErrors(next);
        return Object.keys(next).length === 0;
    }

    async function submit(event) {
        event.preventDefault();
        setError("");
        if (!validate()) return;
        setSubmitting(true);
        try {
            const result = await api(isSignup ? "/api/signup" : "/api/login", {
                method: "POST",
                body: JSON.stringify(isSignup ? { name: name.trim(), email: email.trim(), password, role } : { email: email.trim(), password }),
            });
            navigate(result?.dashboard_path || roleDashboard(result));
        } catch (err) {
            setError(err.message || "Authentication failed.");
            setSubmitting(false);
        }
    }

    if (!checked) return h("div", { className: "auth" }, h("div", { className: "empty auth-loading" }, "Checking session..."));
    if (me && !isSignup) return h("div", { className: "empty" }, "Opening dashboard...");

    return h("div", { className: "auth" },
        h("div", { className: "auth-art" },
            h(AuthStarfield),
            h("button", { type: "button", className: "auth-home", onClick: () => navigate("/") }, h("span", { className: "brand-mark" }, "T"), "Tender ", h("span", null, "AI")),
            h("div", { className: "auth-copy" },
                h("h1", null, isSignup ? "Start tracking smarter bids." : "Welcome back."),
                h("p", null, "Scrape GeM tenders, score opportunities, analyze bid coverage, and keep each user workspace isolated."),
                h("div", { className: "auth-proof" }, productStats.slice(1).map(([value, label]) => h("div", { key: value }, h("strong", null, value), h("span", null, label))))
            )
        ),
        h("form", { className: "auth-card", onSubmit: submit, noValidate: true },
            h("div", { className: "auth-card-head" },
                h("div", null,
                    h("h2", null, isSignup ? "Create your account" : "Sign in"),
                    h("div", { className: "auth-subtitle" }, isSignup ? "Set up a buyer or seller workspace in under a minute." : "Enter your details to open your workspace.")
                ),
                h(ThemeToggle)
            ),
            error ? h("div", { className: "notice err" }, error) : null,
            isSignup ? h(AuthField, {
                id: "auth-name", label: "Full name", fieldIcon: ICON_USER, value: name,
                onChange: e => setName(e.target.value), placeholder: "Your name",
                error: fieldErrors.name, autoComplete: "name",
            }) : null,
            isSignup ? h("div", { className: "field" },
                h("label", null, "Workspace type"),
                h("div", { className: "role-choice" },
                    h(RoleOption, { title: "Buyer", text: "Discover, score, and track tenders.", roleIcon: ICON_BRIEFCASE, active: role === "buyer", onClick: () => setRole("buyer") }),
                    h(RoleOption, { title: "Seller", text: "Manage GeM bids, catalogue, and orders.", roleIcon: ICON_STORE, active: role === "seller", onClick: () => setRole("seller") })
                )
            ) : null,
            h(AuthField, {
                id: "auth-email", label: "Email", fieldIcon: ICON_MAIL, type: "email", value: email,
                onChange: e => setEmail(e.target.value), placeholder: "you@company.com",
                error: fieldErrors.email, autoComplete: "email",
            }),
            h(PasswordField, {
                id: "auth-password", label: "Password", value: password,
                onChange: e => setPassword(e.target.value), placeholder: isSignup ? "At least 6 characters" : "Your password",
                error: fieldErrors.password, autoComplete: isSignup ? "new-password" : "current-password",
            }),
            h("button", { className: "primary", disabled: submitting },
                submitting ? h("span", { className: "btn-spinner" }) : null,
                submitting ? (isSignup ? "Creating account..." : "Signing in...") : (isSignup ? "Create Account" : "Sign In")
            ),
            h("div", { className: "auth-switch" },
                isSignup ? "Already have an account? " : "New to Tender AI? ",
                h("button", { type: "button", className: "link-btn", onClick: () => navigate(isSignup ? "/login" : "/signup") }, isSignup ? "Sign in" : "Create an account")
            ),
            h("div", { className: "auth-trust" }, ICON_SHIELD, "Your workspace, tenders, and settings stay private to your account.")
        )
    );
}

function Shell({ children, me, path }) {
    const sections = me?.role === "seller" ? sellerNav : buyerNav;
    const currentSection = sections.find(([, items]) => items.some(([href]) => href === path))?.[0] || sections[0]?.[0];
    const [openSection, setOpenSection] = useState(currentSection);
    const [menuOpen, setMenuOpen] = useState(true);
    const [transitioning, setTransitioning] = useState(false);
    useEffect(() => {
        setOpenSection(currentSection);
        setMenuOpen(true);
        setTransitioning(true);
        const timer = setTimeout(() => setTransitioning(false), 260);
        return () => clearTimeout(timer);
    }, [path, currentSection]);
    function go(href) {
        setMenuOpen(false);
        navigate(href);
    }
    function toggleSection(section) {
        setOpenSection(section);
        setMenuOpen(value => section === openSection ? !value : true);
    }
    const openItems = sections.find(([section]) => section === openSection)?.[1] || [];
    return h("div", { className: "app" },
        false && h("aside", { className: "sidebar" },
            h("div", { className: "sidebar-head" },
                h("div", null,
                    h("div", { className: "brand" }, "Tender ", h("span", null, "AI")),
                    h("div", { className: "workspace-pill" }, me?.role === "seller" ? "Seller Workspace" : "Buyer Workspace")
                ),
                h("button", { className: "sidebar-close", onClick: () => setNavOpen(false), "aria-label": "Close menu" }, "✕")
            ),
            h("nav", { className: "nav" },
                sections.map(([section, items]) => h("div", { className: "nav-group", key: section },
                    h("div", { className: "nav-section" }, section),
                    items.map(([href, label]) => h("button", {
                        key: href,
                        className: path === href ? "active" : "",
                        onClick: () => go(href),
                    }, label))
                ))
            )
        ),
        h("main", { className: "main" },
            h("header", { className: "topbar" },
                transitioning ? h("div", { className: "route-loader", "aria-hidden": "true" }) : null,
                h("div", { className: "topbar-primary" },
                    h("button", { className: "topbar-brand", onClick: () => navigate(roleDashboard(me)), "aria-label": "Open dashboard" },
                        h("span", { className: "brand-mark" }, "T"),
                        h("span", null, "Tender ", h("strong", null, "AI")),
                        h("small", null, me?.role === "seller" ? "Seller Workspace" : "Buyer Workspace")
                    ),
                    h("nav", { className: "top-menu", "aria-label": "Dashboard groups" },
                        sections.map(([section, items]) => {
                            const active = section === currentSection;
                            const open = section === openSection && menuOpen;
                            return h("button", {
                                key: section,
                                className: (active ? "active " : "") + (open ? "open" : ""),
                                onClick: () => toggleSection(section),
                                "aria-expanded": open,
                            },
                                h("span", null, section),
                                h("em", null, items.length)
                            );
                        })
                    )
                ),
                false && h("div", { className: "topbar-title" },
                    h("button", { className: "sidebar-toggle", onClick: () => setNavOpen(true), "aria-label": "Open menu" }, "☰"),
                    h("div", null, h("h1", null, pageTitle(path)), h("div", { className: "muted" }, "Monitor, scrape, score, and analyze tenders"))
                ),
                h("div", { className: "user" },
                    h(ThemeToggle),
                    h(ServerClock),
                    h("div", { className: "avatar" }, (me?.name || me?.email || "U").slice(0, 1).toUpperCase()),
                    h("strong", null, me?.name || "User"),
                    h("span", { className: "profile-pill role-pill" }, me?.role === "seller" ? "Seller" : "Buyer"),
                    h("button", { className: "profile-pill", onClick: () => navigate("/dashboard/profile") }, "Profile"),
                    h("button", { className: "logout", onClick: async () => { await fetch("/api/logout", { method: "POST" }); navigate("/login"); } }, "Logout")
                )
            ),
            h("div", { className: "top-menu-panel" + (menuOpen ? " open" : "") },
                h("div", { className: "top-menu-panel-head" },
                    h("div", null,
                        h("span", { className: "eyebrow" }, "Current Group"),
                        h("strong", null, openSection),
                        h("small", { className: "top-menu-current" }, pageTitle(path))
                    ),
                    h("button", { onClick: () => setMenuOpen(false), "aria-label": "Collapse menu" }, "Collapse")
                ),
                h("div", { className: "top-menu-links" },
                    openItems.map(([href, label]) => h("button", {
                        key: href,
                        className: path === href ? "active" : "",
                        onClick: () => go(href),
                    },
                        h("span", null, label),
                        h("small", null, href.replace("/dashboard/", "").replaceAll("/", " / "))
                    ))
                )
            ),
            h("section", { className: "content page-transition" + (transitioning ? " changing" : "") }, children)
        )
    );
}

function Summary({ summary }) {
    const tiles = [
        ["Total", summary?.total ?? 0],
        ["High Priority", summary?.high_priority ?? 0],
        ["Upcoming", summary?.upcoming_count ?? 0],
        ["Applied", summary?.applied_count ?? 0],
    ];
    return h("div", { className: "summary" }, tiles.map(([label, value]) =>
        h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
    ));
}

function EmptyAction({ title, text, action, onAction }) {
    return h("div", { className: "empty action-empty" },
        h("h3", null, title),
        h("p", null, text),
        action ? h("button", { className: "primary", onClick: onAction }, action) : null
    );
}

function WorkflowTimeline({ steps }) {
    return h("section", { className: "workflow-timeline" },
        steps.map((step, index) => h("button", {
            key: step.label,
            className: `workflow-step ${step.status || "pending"}`,
            type: "button",
            onClick: () => step.href && navigate(step.href),
        },
            h("span", null, index + 1),
            h("strong", null, step.label),
            h("small", null, step.hint || "")
        ))
    );
}

function NextActionPanel({ title = "What To Do Next", actions }) {
    const visible = (actions || []).filter(Boolean).slice(0, 6);
    return h("section", { className: "next-action-panel" },
        h("div", { className: "next-action-head" },
            h("div", null, h("span", { className: "eyebrow" }, "Guided workflow"), h("h3", null, title)),
            h("strong", null, visible.length ? `${visible.length} action(s)` : "Ready")
        ),
        visible.length ? h("div", { className: "next-action-list" }, visible.map(item =>
            h("article", { className: `next-action ${item.level || "info"}`, key: item.title },
                h("div", null, h("h4", null, item.title), h("p", null, item.text)),
                h("button", { className: item.primary ? "primary" : "", onClick: () => navigate(item.href) }, item.action || "Open")
            )
        )) : h("div", { className: "notice ok" }, "Everything important is configured. Continue monitoring alerts and open work items.")
    );
}

function buyerDashboardGuidance(data) {
    const modules = data?.modules || [];
    const byModule = Object.fromEntries(modules.map(item => [item.module, item]));
    const open = key => byModule[key]?.open || 0;
    const done = key => byModule[key]?.completed || 0;
    const total = key => byModule[key]?.total || 0;
    const steps = [
        { label: "Add Grants", href: "/dashboard/buyer/grants", status: total("grants") ? "complete" : "pending", hint: "Department allocation" },
        { label: "Add Bids", href: "/dashboard/buyer/bids", status: total("bids") ? "active" : "pending", hint: "Details and price" },
        { label: "Track Balance", href: "/dashboard/buyer/grants", status: total("grants") ? "active" : "pending", hint: "Used and remaining" },
    ];
    const actions = [
        !total("grants") && { title: "Add the first grant allocation", text: "Record the grant amount and the department that allocated it.", href: "/dashboard/buyer/grants", action: "Add Grant", primary: true },
        !total("bids") && { title: "Add the first buyer bid", text: "Enter all bid details and its final price so grant usage can be calculated.", href: "/dashboard/buyer/bids", action: "Add Bid", primary: true },
        (data?.grant_remaining || 0) < 0 && { title: "Grant is over-allocated", text: `Bid prices exceed available grants by Rs. ${money(Math.abs(data.grant_remaining))}.`, href: "/dashboard/buyer/grants", action: "Review Balance", level: "warn" },
    ];
    return { steps, actions };
}

function sellerDashboardGuidance(data) {
    const readiness = data.readiness?.summary || {};
    const catalogue = data.catalogue?.summary || {};
    const credential = data.credential || {};
    const gemSummary = data.gemBids?.summary || {};
    const bidSummary = data.bids?.summary || {};
    const orderSummary = data.orders?.summary || {};
    const query = data.scrapeQuery || {};
    const readinessDone = (readiness.health_score || 0) >= 70;
    const catalogueDone = (catalogue.total || 0) > 0;
    const keywordsDone = (query.final_keywords || []).length > 0;
    const gemReady = !!credential.session_valid;
    const gemSynced = (gemSummary.total || 0) > 0;
    const bidsDone = (bidSummary.total || 0) > 0;
    const ordersDone = (orderSummary.total || 0) > 0;
    const status = done => done ? "complete" : "pending";
    const steps = [
        { label: "Profile", href: "/dashboard/seller/readiness", status: status(readinessDone), hint: `${readiness.health_score || 0}% ready` },
        { label: "Catalogue", href: "/dashboard/seller/catalogue", status: status(catalogueDone), hint: `${catalogue.total || 0} item(s)` },
        { label: "Keywords", href: "/dashboard/seller/keywords", status: status(keywordsDone), hint: "Scrape query" },
        { label: "GeM Login", href: "/dashboard/seller/gem-login", status: status(gemReady), hint: gemReady ? "Session ready" : "Needs OTP" },
        { label: "Opportunities", href: "/dashboard/tenders", status: (data.summary?.total || 0) ? "active" : "pending", hint: `${data.summary?.total || 0} tenders` },
        { label: "Participated", href: "/dashboard/seller/gem-bids", status: status(gemSynced), hint: `${gemSummary.total || 0} records` },
        { label: "Bid/RA", href: "/dashboard/seller/bids", status: status(bidsDone), hint: `${bidSummary.total || 0} workflows` },
        { label: "Orders", href: "/dashboard/seller/orders", status: status(ordersDone), hint: `${orderSummary.total || 0} orders` },
    ];
    const actions = [
        !readinessDone && { title: "Complete seller profile and documents", text: "Add business identity, tax documents, bank/address checks, caution money, TDS, and vendor assessment status.", href: "/dashboard/seller/readiness", action: "Complete Readiness", primary: true, level: "warn" },
        !catalogueDone && { title: "Add your first catalogue item", text: "Products and services are needed before Tender AI can judge catalogue readiness for opportunities.", href: "/dashboard/seller/catalogue", action: "Add Catalogue", primary: true },
        !keywordsDone && { title: "Configure scrape keywords", text: "Add active keywords or company profile terms so scraping and scoring match your business.", href: "/dashboard/seller/keywords", action: "Add Keywords" },
        !gemReady && { title: "Capture GeM login session", text: "Complete one OTP/CAPTCHA login so participated bids can sync automatically.", href: "/dashboard/seller/gem-login", action: "Start GeM Login", level: "warn" },
        gemReady && !gemSynced && { title: "Sync participated bids", text: "Fetch bids from your logged-in GeM seller account and start status tracking.", href: "/dashboard/seller/gem-bids", action: "Sync Bids", primary: true },
        (data.summary?.total || 0) === 0 && { title: "Run first tender scrape", text: "Open All Tenders, confirm scrape query, and run Manual Scrape to fill the opportunity list.", href: "/dashboard/tenders", action: "Open Tenders" },
        (gemSummary.alerts || 0) > 0 && { title: "Review GeM bid alerts", text: "Some participated bids have status changes, deadlines, or attention items.", href: "/dashboard/seller/gem-bids", action: "Review Alerts", level: "warn" },
    ];
    return { steps, actions };
}

function BuyerDashboardPage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => {
        api("/api/buyer/workspace/summary").then(setData).catch(err => setMessage(err.message));
    }, []);
    const modules = data?.modules || [];
    const guidance = buyerDashboardGuidance(data);
    return h(React.Fragment, null,
        h("div", { className: "hero-panel buyer-landing" },
            h("div", null,
                h("h2", null, "Buyer Dashboard"),
                h("p", null, "Add bids and manage department grant allocations, usage, and remaining balances in one place.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/buyer/bids") }, "Add Bid"),
                h("button", { onClick: () => navigate("/dashboard/buyer/grants") }, "Manage Grants")
            )
        ),
        message ? h("div", { className: "notice err" }, message) : null,
        h(WorkflowTimeline, { steps: guidance.steps }),
        h(NextActionPanel, { actions: guidance.actions }),
        h("div", { className: "summary five" },
            [["Total Grants", `Rs. ${money(data?.total_grant || 0)}`], ["Used by Bids", `Rs. ${money(data?.grant_used || 0)}`], ["Remaining", `Rs. ${money(data?.grant_remaining || 0)}`], ["Bids", byBuyerModule(data, "bids")], ["Grants", byBuyerModule(data, "grants")]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h(DepartmentGrantBalances, { rows: data?.department_balances || [] }),
        h("div", { className: "buyer-process-grid" },
            modules.length ? modules.map(item => {
                const meta = buyerModules[item.module] || {};
                return h("article", { className: "buyer-process-card", key: item.module },
                    h("div", { className: "buyer-process-head" },
                        h("div", null, h("h3", null, item.label), h("p", null, item.description)),
                        h("span", { className: item.open ? "query-pill active" : "query-pill" }, `${item.open || 0} open`)
                    ),
                    h("div", { className: "buyer-process-metrics" },
                        h("div", null, h("span", null, "Total"), h("strong", null, item.total || 0)),
                        h("div", null, h("span", null, "Done"), h("strong", null, item.completed || 0)),
                        h("div", null, h("span", null, "Urgent"), h("strong", null, item.urgent || 0))
                    ),
                    h("button", { onClick: () => navigate(meta.path || "/dashboard/buyer") }, "Open Module")
                );
            }) : h(EmptyAction, { title: data ? "Add your first grant" : "Loading buyer workspace...", text: data ? "Create a department grant allocation, then add bids to track its usage." : "Fetching buyer modules and balances.", action: data ? "Add Grant" : "", onAction: () => navigate("/dashboard/buyer/grants") })
        )
    );
}

function byBuyerModule(data, key) {
    return data?.modules?.find(item => item.module === key)?.total || 0;
}

function DepartmentGrantBalances({ rows }) {
    return h("section", { className: "card" },
        h("h3", null, "Department Grant Balances"),
        rows.length ? h("div", { className: "table-wrap" },
            h("table", null,
                h("thead", null, h("tr", null, ["Department", "Allocated Grant", "Used by Bids", "Remaining"].map(label => h("th", { key: label }, label)))),
                h("tbody", null, rows.map(row => h("tr", { key: row.department },
                    h("td", null, row.department),
                    h("td", null, `Rs. ${money(row.allocated || 0)}`),
                    h("td", null, `Rs. ${money(row.used || 0)}`),
                    h("td", { className: row.remaining < 0 ? "negative-value" : "" }, `Rs. ${money(row.remaining || 0)}`)
                )))
            )
        ) : h("p", { className: "desc" }, "No department allocations yet.")
    );
}

const defaultBidVerificationItems = [
    "Hard copy received", "ITR - 3 years", "Bidder turnover", "EMD / exemption",
    "Experience - 3 years", "Past performance", "Escalation matrix", "PAN", "GST",
    "MSME / Udyam", "ISO", "OEM authorization certificate", "Undertaking",
    "Establishment certificate", "ATC compliance certificate",
];

function BidEvaluationPanel({ bid, onClose }) {
    const [data, setData] = useState(null);
    const [seller, setSeller] = useState({ seller_name: "", gem_seller_id: "" });
    const [criterion, setCriterion] = useState({ label: "", required: true });
    const [message, setMessage] = useState("");
    async function load() {
        setData(await api(`/api/buyer/bids/${bid.id}/evaluation`));
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, [bid.id]);
    async function addSeller(e) {
        e.preventDefault();
        setData(await api(`/api/buyer/bids/${bid.id}/sellers`, { method: "POST", body: JSON.stringify(seller) }));
        setSeller({ seller_name: "", gem_seller_id: "" });
    }
    async function addCriterion(e) {
        e.preventDefault();
        setData(await api(`/api/buyer/bids/${bid.id}/criteria`, { method: "POST", body: JSON.stringify(criterion) }));
        setCriterion({ label: "", required: true });
    }
    async function updateCell(sellerId, criterionId, current, status) {
        setData(await api(`/api/buyer/bids/${bid.id}/verification/${sellerId}/${criterionId}`, {
            method: "PUT",
            body: JSON.stringify({ ...current, status }),
        }));
    }
    async function updateSeller(sellerId, patch) {
        setData(await api(`/api/buyer/bids/${bid.id}/sellers/${sellerId}`, { method: "PUT", body: JSON.stringify(patch) }));
    }
    async function removeSeller(sellerId) {
        setData(await api(`/api/buyer/bids/${bid.id}/sellers/${sellerId}`, { method: "DELETE" }));
    }
    async function removeCriterion(criterionId) {
        setData(await api(`/api/buyer/bids/${bid.id}/criteria/${criterionId}`, { method: "DELETE" }));
    }
    const statusLabel = value => ({ verified: "Verified", unverified: "Unverified", unavailable: "Unavailable", not_required: "N/A" }[value] || value);
    return h("section", { className: "card bid-evaluation-panel" },
        h("div", { className: "buyer-form-head" },
            h("div", null,
                h("h3", null, `Document verification - ${bid.title}`),
                h("p", { className: "desc" }, `${bid.reference_no || "No bid number"} · Add GeM applicants and verify every required document.`)
            ),
            h("div", { className: "mini-links" }, h("button", { onClick: load }, "Refresh"), h("button", { onClick: onClose }, "Close"))
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "evaluation-setup-grid" },
            h("form", { onSubmit: addSeller, className: "evaluation-inline-form" },
                h("strong", null, "Add GeM seller"),
                h("input", { required: true, value: seller.seller_name, onChange: e => setSeller({ ...seller, seller_name: e.target.value }), placeholder: "Seller / agency name" }),
                h("input", { value: seller.gem_seller_id, onChange: e => setSeller({ ...seller, gem_seller_id: e.target.value }), placeholder: "GeM seller ID (optional)" }),
                h("button", { className: "primary" }, "Add Seller")
            ),
            h("form", { onSubmit: addCriterion, className: "evaluation-inline-form" },
                h("strong", null, "Add document to verify"),
                h("input", { required: true, value: criterion.label, onChange: e => setCriterion({ ...criterion, label: e.target.value }), placeholder: "Document / eligibility criterion" }),
                h("label", { className: "evaluation-required" }, h("input", { type: "checkbox", checked: criterion.required, onChange: e => setCriterion({ ...criterion, required: e.target.checked }) }), "Mandatory"),
                h("button", { className: "primary" }, "Add Requirement")
            )
        ),
        data ? h("div", { className: "buyer-process-metrics evaluation-summary" },
            h("div", null, h("span", null, "Sellers"), h("strong", null, data.summary.seller_count)),
            h("div", null, h("span", null, "Requirements"), h("strong", null, data.summary.criteria_count)),
            h("div", null, h("span", null, "Qualified"), h("strong", null, data.summary.qualified)),
            h("div", null, h("span", null, "Disqualified"), h("strong", null, data.summary.disqualified))
        ) : null,
        data?.criteria?.length ? h("div", { className: "evaluation-criteria-list" },
            h("span", null, "Verification columns:"),
            data.criteria.map(item => h("button", { key: item.id, title: "Remove this column", onClick: () => removeCriterion(item.id) }, `${item.label}${item.required ? " *" : ""} ×`))
        ) : null,
        data?.criteria?.length && data?.sellers?.length ? h("div", { className: "table-wrap verification-matrix-wrap" },
            h("table", { className: "verification-matrix" },
                h("thead", null, h("tr", null,
                    h("th", null, "Sr."),
                    h("th", { className: "seller-column" }, "Name of Agency"),
                    data.criteria.map(item => h("th", { key: item.id, title: item.notes || "" }, item.label, item.required ? h("sup", null, "*") : null)),
                    h("th", null, "Remarks / Result")
                )),
                h("tbody", null, data.sellers.map((row, rowIndex) => h("tr", { key: row.id },
                    h("td", null, rowIndex + 1),
                    h("td", { className: "seller-column" },
                        h("strong", null, row.seller_name),
                        row.gem_seller_id ? h("small", null, row.gem_seller_id) : null,
                        h("button", { className: "link-danger", onClick: () => removeSeller(row.id) }, "Remove")
                    ),
                    data.criteria.map(item => {
                        const cell = row.verifications.find(value => value.criterion_id === item.id) || { status: "unverified" };
                        return h("td", { key: item.id, className: `verification-cell ${cell.status}` },
                            h("select", { value: cell.status, title: cell.remarks || cell.evidence_reference || "", onChange: e => updateCell(row.id, item.id, cell, e.target.value) },
                                data.verification_statuses.map(value => h("option", { value, key: value }, statusLabel(value)))
                            )
                        );
                    }),
                    h("td", { className: "result-column" },
                        h("select", { value: row.qualification_status, onChange: e => updateSeller(row.id, { qualification_status: e.target.value }) },
                            data.qualification_statuses.map(value => h("option", { value, key: value }, value.replaceAll("_", " ")))
                        ),
                        h("textarea", { defaultValue: row.remarks, placeholder: row.blocking_count ? `${row.blocking_count} mandatory item(s) need action` : "Buyer remarks", onBlur: e => updateSeller(row.id, { remarks: e.target.value }) })
                    )
                )))
            )
        ) : h("div", { className: "notice" }, "Add at least one seller and one verification requirement to generate the evaluation table.")
    );
}

function BuyerBidRegisterPage() {
    const [data, setData] = useState(null);
    const [evaluationBid, setEvaluationBid] = useState(null);
    const [evaluationSummaries, setEvaluationSummaries] = useState({});
    const [filters, setFilters] = useState({ q: "", status: "all", readiness: "all" });
    const [message, setMessage] = useState("");
    async function load() {
        const result = await api("/api/buyer/workspace?module=bids");
        setData(result);
        const pairs = await Promise.all((result.items || []).map(async bid => {
            try {
                const evaluation = await api(`/api/buyer/bids/${bid.id}/evaluation`, { silent: true });
                return [bid.id, evaluation.summary];
            } catch {
                return [bid.id, { seller_count: 0, criteria_count: 0, qualified: 0, disqualified: 0, pending: 0 }];
            }
        }));
        setEvaluationSummaries(Object.fromEntries(pairs));
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
    const bids = data?.items || [];
    const visible = bids.filter(bid => {
        const summary = evaluationSummaries[bid.id] || {};
        const haystack = [bid.title, bid.reference_no, bid.department, bid.category, bid.city, bid.state].join(" ").toLowerCase();
        if (filters.q && !haystack.includes(filters.q.toLowerCase())) return false;
        if (filters.status !== "all" && bid.status !== filters.status) return false;
        if (filters.readiness === "not_configured" && (summary.criteria_count || summary.seller_count)) return false;
        if (filters.readiness === "pending" && !(summary.pending > 0 || (summary.seller_count > 0 && summary.qualified + summary.disqualified < summary.seller_count))) return false;
        if (filters.readiness === "completed" && !(summary.seller_count > 0 && summary.pending === 0)) return false;
        return true;
    });
    const totals = bids.reduce((acc, bid) => {
        const summary = evaluationSummaries[bid.id] || {};
        acc.sellers += summary.seller_count || 0;
        acc.qualified += summary.qualified || 0;
        acc.disqualified += summary.disqualified || 0;
        return acc;
    }, { sellers: 0, qualified: 0, disqualified: 0 });
    return h(React.Fragment, null,
        h("div", { className: "hero-panel buyer-module-hero" },
            h("div", null, h("h2", null, "Bids & Document Verification"), h("p", null, "See every buyer bid, manage GeM applicants, and complete the seller document evaluation table.")),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/buyer/bids") }, "Add Bid"),
                h("button", { onClick: load }, "Refresh")
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("section", { className: "buyer-process-metrics bid-register-summary" },
            h("div", null, h("span", null, "Added Bids"), h("strong", null, bids.length)),
            h("div", null, h("span", null, "Listed Sellers"), h("strong", null, totals.sellers)),
            h("div", null, h("span", null, "Qualified"), h("strong", null, totals.qualified)),
            h("div", null, h("span", null, "Disqualified"), h("strong", null, totals.disqualified))
        ),
        h("section", { className: "card bid-register-filters" },
            h("input", { value: filters.q, onChange: e => setFilters({ ...filters, q: e.target.value }), placeholder: "Search bid number, title, department or category" }),
            h("select", { value: filters.status, onChange: e => setFilters({ ...filters, status: e.target.value }) },
                h("option", { value: "all" }, "All bid statuses"),
                (data?.status_options || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")))
            ),
            h("select", { value: filters.readiness, onChange: e => setFilters({ ...filters, readiness: e.target.value }) },
                h("option", { value: "all" }, "All verification stages"),
                h("option", { value: "not_configured" }, "Not configured"),
                h("option", { value: "pending" }, "Verification pending"),
                h("option", { value: "completed" }, "Evaluation completed")
            )
        ),
        evaluationBid ? h(BidEvaluationPanel, { bid: evaluationBid, onClose: () => { setEvaluationBid(null); load(); } }) : null,
        h("section", { className: "bid-register-grid" },
            visible.length ? visible.map(bid => {
                const summary = evaluationSummaries[bid.id] || { seller_count: 0, criteria_count: 0, qualified: 0, disqualified: 0, pending: 0 };
                const configured = summary.criteria_count > 0;
                return h("article", { className: "buyer-item-card bid-register-card", key: bid.id },
                    h("div", { className: "buyer-item-head" },
                        h("div", null,
                            h("h3", null, bid.title),
                            h("p", null, bid.reference_no || "Bid number not entered")
                        ),
                        h("span", { className: "query-pill active" }, bid.status.replaceAll("_", " "))
                    ),
                    h("p", { className: "desc" }, [bid.department, bid.category, bid.city, bid.state].filter(Boolean).join(" · ") || "Bid details not completed"),
                    h("div", { className: "buyer-process-metrics" },
                        h("div", null, h("span", null, "Requirements"), h("strong", null, summary.criteria_count || 0)),
                        h("div", null, h("span", null, "Sellers"), h("strong", null, summary.seller_count || 0)),
                        h("div", null, h("span", null, "Qualified"), h("strong", null, summary.qualified || 0)),
                        h("div", null, h("span", null, "Pending"), h("strong", null, summary.pending || 0))
                    ),
                    h("div", { className: configured ? "notice ok" : "notice" },
                        configured ? `${summary.criteria_count} verification columns configured.` : "Document verification requirements are not configured."
                    ),
                    h("div", { className: "mini-links" },
                        h("button", { className: "primary", onClick: () => setEvaluationBid(bid) }, configured ? "Open Verification Table" : "Configure Documents"),
                        h("button", { onClick: () => navigate("/dashboard/buyer/bids") }, "Add Another Bid")
                    )
                );
            }) : h(EmptyAction, {
                title: data ? "No matching bids" : "Loading bids...",
                text: data ? (bids.length ? "Change the filters to see other bids." : "Add the first buyer bid, then configure its document verification table.") : "Fetching the buyer bid register.",
                action: data && !bids.length ? "Add Bid" : "",
                onAction: () => navigate("/dashboard/buyer/bids"),
            })
        )
    );
}

function BuyerModulePage({ moduleKey }) {
    const meta = buyerModules[moduleKey] || buyerModules.bids;
    const [data, setData] = useState(null);
    const [form, setForm] = useState({ module: moduleKey, title: "", reference_no: "", status: "pending", priority: "normal", procurement_mode: "", department: "", state: "", city: "", category: "", vendor_name: "", estimated_value: "", due_date: "", checklist: (meta.checklist || []).join("\n"), evaluation_criteria: defaultBidVerificationItems.join("\n"), notes: "" });
    const [evaluationBid, setEvaluationBid] = useState(null);
    const [message, setMessage] = useState("");
    async function load() {
        const result = await api(`/api/buyer/workspace?module=${encodeURIComponent(moduleKey)}`);
        setData(result);
    }
    useEffect(() => {
        setForm(current => ({ ...current, module: moduleKey, title: "", checklist: (meta.checklist || []).join("\n") }));
        load().catch(err => setMessage(err.message));
    }, [moduleKey]);
    const items = data?.items || [];
    const update = (field, value) => setForm({ ...form, [field]: value });
    async function createItem(e) {
        e.preventDefault();
        setMessage("Saving buyer tracker item...");
        await api("/api/buyer/workspace", { method: "POST", body: JSON.stringify({ ...form, module: moduleKey }) });
        setForm({ module: moduleKey, title: "", reference_no: "", status: "pending", priority: "normal", procurement_mode: "", department: "", state: "", city: "", category: "", vendor_name: "", estimated_value: "", due_date: "", checklist: (meta.checklist || []).join("\n"), evaluation_criteria: defaultBidVerificationItems.join("\n"), notes: "" });
        setMessage("Buyer tracker item saved.");
        await load();
    }
    async function updateItem(item, patch) {
        await api(`/api/buyer/workspace/${item.id}`, { method: "PUT", body: JSON.stringify(patch) });
        await load();
    }
    async function deleteItem(item) {
        await api(`/api/buyer/workspace/${item.id}`, { method: "DELETE" });
        await load();
    }
    function applyTemplate(template) {
        setForm({
            ...form,
            title: template,
            checklist: (meta.checklist || []).join("\n"),
            notes: `${template} created for ${meta.title}. Track each GeM stage, approval, evidence, and next action here.`,
        });
    }
    const openItems = items.filter(item => !item.completed);
    const completedItems = items.filter(item => item.completed);
    const urgentItems = items.filter(item => item.priority === "urgent");
    const selectOptions = (values) => (values || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")));
    return h(React.Fragment, null,
        h("div", { className: "hero-panel buyer-module-hero" },
            h("div", null, h("h2", null, meta.title), h("p", null, meta.text)),
            h("div", { className: "hero-actions" },
                h("button", { onClick: () => navigate("/dashboard/buyer") }, "Dashboard"),
                h("button", { onClick: load }, "Refresh")
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("section", { className: "buyer-gem-flow" },
            h("div", { className: "buyer-stage-rail" },
                (meta.stages || []).map((stage, index) => h("div", { className: "buyer-stage", key: stage },
                    h("span", null, index + 1),
                    h("strong", null, stage)
                ))
            ),
            h("div", { className: "buyer-guide-grid" },
                h("div", { className: "buyer-guide-card" },
                    h("h3", null, "GeM Focus"),
                    h("div", { className: "query-chip-row" }, (meta.focus || []).map(item => h("span", { className: "query-chip", key: item }, item)))
                ),
                h("div", { className: "buyer-guide-card" },
                    h("h3", null, "Default Checklist"),
                    h("ul", { className: "buyer-default-checklist" }, (meta.checklist || []).map(item => h("li", { key: item }, item)))
                ),
                h("div", { className: "buyer-guide-card" },
                    h("h3", null, "Module Health"),
                    h("div", { className: "buyer-process-metrics compact" },
                        h("div", null, h("span", null, "Open"), h("strong", null, openItems.length)),
                        h("div", null, h("span", null, "Done"), h("strong", null, completedItems.length)),
                        h("div", null, h("span", null, "Urgent"), h("strong", null, urgentItems.length))
                    )
                )
            )
        ),
        !items.length && data ? h(EmptyAction, {
            title: `Start ${meta.title}`,
            text: `Use a quick template below to create the first ${meta.title.toLowerCase()} record. The checklist is prefilled with the normal GeM buyer steps.`,
            action: "Use First Template",
            onAction: () => applyTemplate((meta.templates || [meta.sampleTitle])[0]),
        }) : null,
        h("section", { className: "card buyer-form-card" },
            h("div", { className: "buyer-form-head" },
                h("div", null, h("h3", null, moduleKey === "grants" ? "Add Grant" : "Add Bid"), h("p", { className: "desc" }, moduleKey === "grants" ? "Record the grant and the department from which it was allocated." : "Enter the complete bid details, including its final price.")),
                h("div", { className: "buyer-template-row" }, (meta.templates || []).map(template =>
                    h("button", { type: "button", key: template, onClick: () => applyTemplate(template) }, template)
                ))
            ),
            h("form", { className: "buyer-workspace-form", onSubmit: createItem },
                h("label", { className: "field-block" }, h("span", null, moduleKey === "grants" ? "Grant name" : "Bid title"), h("input", { required: true, value: form.title, onChange: e => update("title", e.target.value), placeholder: meta.sampleTitle })),
                h("label", { className: "field-block" }, h("span", null, moduleKey === "grants" ? "Grant reference no." : "Bid reference no."), h("input", { value: form.reference_no, onChange: e => update("reference_no", e.target.value), placeholder: moduleKey === "grants" ? "Grant / sanction no." : "Bid no." })),
                h("label", { className: "field-block" }, h("span", null, "Status"), h("select", { value: form.status, onChange: e => update("status", e.target.value) }, selectOptions(data?.status_options || []))),
                h("label", { className: "field-block" }, h("span", null, "Priority"), h("select", { value: form.priority, onChange: e => update("priority", e.target.value) }, selectOptions(data?.priority_options || []))),
                h("label", { className: "field-block" }, h("span", null, "Procurement mode"), h("select", { value: form.procurement_mode, onChange: e => update("procurement_mode", e.target.value) }, h("option", { value: "" }, "Select mode"), (data?.procurement_modes || []).map(value => h("option", { key: value, value }, value)))),
                h("label", { className: "field-block" }, h("span", null, moduleKey === "grants" ? "Allocating department" : "Department"), h("input", { required: true, value: form.department, onChange: e => update("department", e.target.value), placeholder: moduleKey === "grants" ? "Department providing the grant" : "Department using the bid" })),
                h("label", { className: "field-block" }, h("span", null, "State"), h("input", { required: true, value: form.state, onChange: e => update("state", e.target.value), placeholder: "State" })),
                h("label", { className: "field-block" }, h("span", null, "City"), h("input", { required: true, value: form.city, onChange: e => update("city", e.target.value), placeholder: "City" })),
                h("label", { className: "field-block" }, h("span", null, "Category"), h("input", { value: form.category, onChange: e => update("category", e.target.value), placeholder: "Product / service category" })),
                h("label", { className: "field-block" }, h("span", null, "Vendor / L1"), h("input", { value: form.vendor_name, onChange: e => update("vendor_name", e.target.value), placeholder: "Vendor name, if applicable" })),
                h("label", { className: "field-block" }, h("span", null, moduleKey === "grants" ? "Grant allocated (Rs.)" : "Final price (Rs.)"), h("input", { required: true, type: "number", min: 0, value: form.estimated_value, onChange: e => update("estimated_value", e.target.value), placeholder: "0" })),
                h("label", { className: "field-block" }, h("span", null, "Date"), h("input", { required: true, type: "date", value: form.due_date, onChange: e => update("due_date", e.target.value) })),
                h("label", { className: "field-block span-2" }, h("span", null, "Checklist"), h("textarea", { value: form.checklist, onChange: e => update("checklist", e.target.value), placeholder: "One checklist item per line" })),
                moduleKey === "bids" ? h("label", { className: "field-block span-2" }, h("span", null, "Required seller documents / verification columns"), h("textarea", { value: form.evaluation_criteria, onChange: e => update("evaluation_criteria", e.target.value), placeholder: "One document or criterion per line" })) : null,
                h("label", { className: "field-block span-2" }, h("span", null, "Notes"), h("textarea", { value: form.notes, onChange: e => update("notes", e.target.value), placeholder: "Remarks, evidence, next action, risks" })),
                h("button", { className: "primary span-2" }, "Save Item")
            )
        ),
        moduleKey === "grants" ? h(DepartmentGrantBalances, { rows: data?.summary?.department_balances || [] }) : null,
        moduleKey === "bids" && evaluationBid ? h(BidEvaluationPanel, { bid: evaluationBid, onClose: () => setEvaluationBid(null) }) : null,
        h("section", { className: "buyer-item-list" },
            items.length ? items.map(item => h("article", { className: `buyer-item-card ${item.priority}`, key: item.id },
                h("div", { className: "buyer-item-head" },
                    h("div", null, h("h3", null, item.title), h("p", null, [item.reference_no, item.department, item.city, item.state, item.category].filter(Boolean).join(" | ") || "No reference details")),
                    h("span", { className: item.completed ? "query-pill active" : "query-pill" }, item.status.replaceAll("_", " "))
                ),
                h("div", { className: "buyer-process-metrics" },
                    h("div", null, h("span", null, "Priority"), h("strong", null, item.priority)),
                    h("div", null, h("span", null, "Mode"), h("strong", null, item.procurement_mode || "NA")),
                    h("div", null, h("span", null, moduleKey === "grants" ? "Allocated" : "Final Price"), h("strong", null, `Rs. ${money(item.estimated_value || 0)}`)),
                    h("div", null, h("span", null, "Date"), h("strong", null, item.due_date || "NA"))
                ),
                item.checklist?.length ? h("div", { className: "tag-list buyer-checklist" }, item.checklist.map(check => h("span", { key: check }, check))) : null,
                item.notes ? h("p", { className: "desc" }, item.notes) : null,
                h("div", { className: "mini-links" },
                    moduleKey === "bids" ? h("button", { className: "primary", onClick: () => setEvaluationBid(item) }, "Verify Seller Documents") : null,
                    h("button", { onClick: () => updateItem(item, { completed: !item.completed }) }, item.completed ? "Reopen" : "Mark Complete"),
                    h("button", { onClick: () => updateItem(item, { priority: item.priority === "urgent" ? "normal" : "urgent" }) }, item.priority === "urgent" ? "Normal Priority" : "Urgent"),
                    h("button", { onClick: () => deleteItem(item) }, "Delete")
                )
            )) : h(EmptyAction, { title: data ? "No tracker records yet" : "Loading records...", text: data ? "Create a record above to track status, due date, checklist, evidence, and next action." : "Fetching records for this module.", action: data ? "Use Template" : "", onAction: () => applyTemplate((meta.templates || [meta.sampleTitle])[0]) })
        )
    );
}

function SellerDashboardPage() {
    const [dashboardData, setDashboardData] = useState({ summary: null, readiness: null, catalogue: null, credential: null, gemBids: null, bids: null, orders: null, scrapeQuery: null });
    const [message, setMessage] = useState("");
    useEffect(() => {
        Promise.all([
            api("/api/dashboard/summary", { silent: true }),
            api("/api/seller/readiness", { silent: true }),
            api("/api/seller/catalogue", { silent: true }),
            api("/api/seller/gem-login", { silent: true }),
            api("/api/seller/gem-bids", { silent: true }),
            api("/api/seller/bids", { silent: true }),
            api("/api/seller/orders", { silent: true }),
            api("/api/scrape-query", { silent: true }),
        ]).then(([summary, readiness, catalogue, credential, gemBids, bids, orders, scrapeQuery]) => {
            setDashboardData({ summary, readiness, catalogue, credential, gemBids, bids, orders, scrapeQuery });
        }).catch(err => setMessage(err.message));
    }, []);
    const summary = dashboardData.summary;
    const readiness = dashboardData.readiness?.summary || null;
    const guidance = sellerDashboardGuidance(dashboardData);
    const catalogue = dashboardData.catalogue?.summary || {};
    const credential = dashboardData.credential || {};
    const gemSummary = dashboardData.gemBids?.summary || {};
    const bidSummary = dashboardData.bids?.summary || {};
    const orderSummary = dashboardData.orders?.summary || {};
    const scrapeQuery = dashboardData.scrapeQuery || {};
    const sellerCards = [
        { title: "Scraped Bids", value: summary?.total || 0, meta: `${summary?.high_priority || 0} priority matches`, href: "/dashboard/tenders", action: "Review Scraped Bids", tone: "blue" },
        { title: "Own GeM Bids", value: gemSummary.total || 0, meta: `${gemSummary.alerts || 0} alerts`, href: "/dashboard/seller/gem-bids", action: "Track Own Bids", tone: gemSummary.alerts ? "amber" : "green" },
        { title: "Seller Setup", value: readiness?.health_score ?? 0, suffix: "%", meta: `${readiness?.missing_documents?.length || 0} missing docs`, href: "/dashboard/seller/readiness", action: "Improve Readiness", tone: (readiness?.health_score || 0) >= 70 ? "green" : "amber" },
        { title: "Catalogue", value: catalogue.total || 0, meta: `${catalogue.ready || 0} ready items`, href: "/dashboard/seller/catalogue", action: "Manage Catalogue", tone: catalogue.ready ? "green" : "blue" },
        { title: "Bid/RA Workflows", value: bidSummary.total || 0, meta: `${bidSummary.due_soon || 0} due soon`, href: "/dashboard/seller/bids", action: "Open Workflows", tone: bidSummary.due_soon ? "amber" : "blue" },
        { title: "Orders", value: orderSummary.total || 0, meta: `${orderSummary.overdue_payment || 0} payment overdue`, href: "/dashboard/seller/orders", action: "Open Orders", tone: orderSummary.overdue_payment ? "red" : "green" },
    ];
    return h(React.Fragment, null,
        h("div", { className: "hero-panel seller-landing seller-command-hero" },
            h("div", null,
                h("span", { className: "eyebrow" }, "Seller command center"),
                h("h2", null, "Know what to do next"),
                h("p", null, "Track scraped bids, own GeM participated bids, readiness, catalogue, automation, alerts, and fulfillment from one workspace.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/tenders") }, "Scraped Bids"),
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/gem-bids") }, "Own Bids"),
                h("button", { onClick: () => navigate("/dashboard/seller/settings") }, "Automation")
            )
        ),
        message ? h("div", { className: "notice err" }, message) : null,
        h(WorkflowTimeline, { steps: guidance.steps }),
        h(NextActionPanel, { actions: guidance.actions }),
        h("section", { className: "seller-command-grid" },
            sellerCards.map(card => h("article", { className: `seller-command-card ${card.tone}`, key: card.title },
                h("div", null,
                    h("span", null, card.title),
                    h("strong", null, `${card.value}${card.suffix || ""}`),
                    h("small", null, card.meta)
                ),
                h("button", { onClick: () => navigate(card.href) }, card.action)
            ))
        ),
        h("div", { className: "seller-dashboard-panels" },
            h("section", { className: "card seller-dashboard-panel" },
                h("div", { className: "panel-title-row" }, h("div", null, h("span", { className: "eyebrow" }, "Discovery"), h("h3", null, "Scraped Bid Pipeline")), h("button", { onClick: () => navigate("/dashboard/tenders") }, "Open")),
                h("p", { className: "desc" }, "Use scraped bids for opportunity discovery, scoring, filtering, eligibility extraction, and bid/no-bid decisions."),
                h("div", { className: "alert-status-grid" },
                    h("div", null, h("span", null, "Total scraped"), h("strong", null, summary?.total || 0)),
                    h("div", null, h("span", null, "Priority"), h("strong", null, summary?.high_priority || 0)),
                    h("div", null, h("span", null, "Closing soon"), h("strong", null, summary?.upcoming_count || 0)),
                    h("div", null, h("span", null, "Query terms"), h("strong", null, (scrapeQuery.final_keywords || []).slice(0, 3).join(", ") || "Not set"))
                )
            ),
            h("section", { className: "card seller-dashboard-panel" },
                h("div", { className: "panel-title-row" }, h("div", null, h("span", { className: "eyebrow" }, "GeM Portal"), h("h3", null, "Own Participated Bids")), h("button", { onClick: () => navigate("/dashboard/seller/gem-bids") }, "Open")),
                h("p", { className: "desc" }, "Use own bids for technical status, disqualification reason, representation window, financial opening, L1, and final result tracking."),
                h("div", { className: "alert-status-grid" },
                    h("div", null, h("span", null, "Session"), h("strong", null, credential.session_valid ? "Ready" : "Needs login")),
                    h("div", null, h("span", null, "Tracked bids"), h("strong", null, gemSummary.total || 0)),
                    h("div", null, h("span", null, "Alerts"), h("strong", null, gemSummary.alerts || 0)),
                    h("div", null, h("span", null, "Financial open"), h("strong", null, gemSummary.financial_opened || 0))
                )
            ),
            h("section", { className: "card seller-dashboard-panel" },
                h("div", { className: "panel-title-row" }, h("div", null, h("span", { className: "eyebrow" }, "Setup"), h("h3", null, "Readiness & Catalogue")), h("button", { onClick: () => navigate("/dashboard/seller/readiness") }, "Open")),
                h("p", { className: "desc" }, "Complete profile, documents, catalogue, stock, brand/OEM, and MRP evidence before serious bid participation."),
                h("div", { className: "alert-status-grid" },
                    h("div", null, h("span", null, "Readiness"), h("strong", null, `${readiness?.health_score ?? 0}%`)),
                    h("div", null, h("span", null, "Missing docs"), h("strong", null, readiness?.missing_documents?.length || 0)),
                    h("div", null, h("span", null, "Catalogue items"), h("strong", null, catalogue.total || 0)),
                    h("div", null, h("span", null, "Ready catalogue"), h("strong", null, catalogue.ready || 0))
                )
            ),
            h("section", { className: "card seller-dashboard-panel" },
                h("div", { className: "panel-title-row" }, h("div", null, h("span", { className: "eyebrow" }, "Fulfillment"), h("h3", null, "Workflows & Orders")), h("button", { onClick: () => navigate("/dashboard/seller/orders") }, "Open")),
                h("p", { className: "desc" }, "Move selected tenders into Bid/RA workflows, then track order delivery, invoices, payment, incidents, and TReDS."),
                h("div", { className: "alert-status-grid" },
                    h("div", null, h("span", null, "Bid workflows"), h("strong", null, bidSummary.total || 0)),
                    h("div", null, h("span", null, "Due soon"), h("strong", null, bidSummary.due_soon || 0)),
                    h("div", null, h("span", null, "Orders"), h("strong", null, orderSummary.total || 0)),
                    h("div", null, h("span", null, "Incidents"), h("strong", null, orderSummary.incidents || 0))
                )
            )
        )
    );
}

function SellerAnalyticsPage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => {
        api("/api/seller/analytics").then(setData).catch(err => setMessage(err.message));
    }, []);
    if (!data && !message) return h("div", { className: "empty" }, "Loading seller analytics...");
    const summary = data?.summary || {};
    const charts = data?.charts || {};
    const recLabel = value => value === "no_bid" ? "No bid" : value === "bid" ? "Bid" : "Review";
    return h(React.Fragment, null,
        h("div", { className: "hero-panel seller-analytics-hero" },
            h("div", null,
                h("h2", null, "Seller-Side Analytics Dashboard"),
                h("p", null, "See seller readiness, catalogue quality, opportunity conversion, Bid/RA progress, and order fulfillment health in one view.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/opportunities") }, "Opportunity Match"),
                h("button", { onClick: () => navigate("/dashboard/seller/bids") }, "Bid/RA"),
                h("button", { onClick: () => navigate("/dashboard/seller/orders") }, "Orders")
            )
        ),
        message ? h("div", { className: "notice err" }, message) : null,
        h("div", { className: "summary six seller-analytics-summary" },
            [["Seller Health", summary.seller_health || 0], ["Catalogue Ready", `${summary.catalogue_ready || 0}/${summary.catalogue_total || 0}`], ["Opportunities", summary.opportunities || 0], ["Bid Recommended", summary.bid_recommended || 0], ["Bid Workflows", summary.bid_workflows || 0], ["Order Alerts", summary.order_alerts || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "chart-grid seller-analytics-charts" },
            h(ChartCard, { title: "Catalogue Status", data: charts.catalogueStatus }),
            h(ChartCard, { title: "Catalogue Readiness", data: charts.catalogueReadiness, type: "doughnut" }),
            h(ChartCard, { title: "Opportunity Recommendations", data: charts.opportunityRecommendations, type: "doughnut" }),
            h(ChartCard, { title: "Bid/RA Status", data: charts.bidStatus }),
            h(ChartCard, { title: "Bid Readiness", data: charts.bidReadiness, type: "doughnut" }),
            h(ChartCard, { title: "Order Status", data: charts.orderStatus }),
            h(ChartCard, { title: "Payment Status", data: charts.orderPayments }),
            h(ChartCard, { title: "Order Health", data: charts.orderHealth, type: "doughnut" })
        ),
        h("div", { className: "reports-layout seller-analytics-lower" },
            h("section", { className: "card" },
                h("h3", null, "Recommended Actions"),
                h("div", { className: "recommendation-list" },
                    (data?.recommendations || []).map(item => h("article", { className: "recommendation-card", key: item.title }, h("h4", null, item.title), h("p", null, item.text)))
                ),
                h("h3", null, "Module Health"),
                h("div", { className: "alert-status-grid" },
                    h("div", null, h("span", null, "Missing docs"), h("strong", null, data?.readiness?.missing_documents?.length || 0)),
                    h("div", null, h("span", null, "Catalogue repair"), h("strong", null, data?.catalogue?.repair || 0)),
                    h("div", null, h("span", null, "Bids due soon"), h("strong", null, data?.bids?.due_soon || 0)),
                    h("div", null, h("span", null, "Order incidents"), h("strong", null, data?.orders?.incidents || 0))
                )
            ),
            h("section", { className: "card" },
                h("h3", null, "Top Seller Opportunities"),
                (data?.top_opportunities || []).length ? h("div", { className: "opportunity-list" },
                    data.top_opportunities.map(item => h("article", { className: `opportunity-card ${item.recommendation}`, key: item.tender.id },
                        h("div", { className: "opportunity-head" },
                            h("div", null, h("h4", null, item.tender.title || "Untitled tender"), h("p", null, item.tender.department || "Unknown Buyer")),
                            h("strong", null, item.opportunity_score || 0)
                        ),
                        h("div", { className: "pipeline-meta" },
                            h("span", null, recLabel(item.recommendation)),
                            h("span", null, `Match ${item.match_score || 0}`),
                            h("span", null, item.matched_catalogue?.name || "No catalogue match"),
                            h("span", null, item.tender.deadline || "No deadline")
                        )
                    ))
                ) : h("div", { className: "empty" }, "No matched opportunities yet."),
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/opportunities") }, "Open Opportunity Match")
            )
        )
    );
}

function SellerGemLoginPage() {
    const blank = { gem_user_id: "", password: "", login_url: "https://sso.gem.gov.in/ARXSSO/oauth/login", login_mode: "manual_otp" };
    const [form, setForm] = useState(blank);
    const [credential, setCredential] = useState(null);
    const [assisted, setAssisted] = useState({ active: false });
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);
    const loginWindowRef = useRef(null);
    async function load() {
        const data = await api("/api/seller/gem-login");
        setCredential(data);
        setForm({
            gem_user_id: data.gem_user_id || "",
            password: "",
            login_url: data.login_url || blank.login_url,
            login_mode: data.login_mode || "manual_otp",
        });
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
    async function startAssistedLogin() {
        setSaving(true);
        setMessage("Opening secure GeM login window...");
        const loginWindow = window.open("about:blank", "gemLoginWindow", "width=1320,height=860,noopener=false");
        loginWindowRef.current = loginWindow;
        if (loginWindow) {
            loginWindow.document.title = "GeM Login";
            loginWindow.document.body.innerHTML = "<p style='font:16px Arial;padding:24px'>Starting GeM login...</p>";
        }
        try {
            const result = await api("/api/seller/gem-login/start", { method: "POST" });
            setCredential(result.credential);
            setAssisted(result);
            if (result.vnc_url && loginWindow && !loginWindow.closed) {
                loginWindow.location.replace(result.vnc_url);
            } else if (loginWindow && !loginWindow.closed) {
                loginWindow.document.body.innerHTML = "<p style='font:16px Arial;padding:24px'>The secure GeM viewer was not available. Return to Tender AI for the error details.</p>";
            }
            setMessage(result.message || "GeM login window is ready. Complete OTP/CAPTCHA there, then capture session here.");
        } catch (err) {
            if (loginWindow && !loginWindow.closed) loginWindow.close();
            setMessage(err.message || "Could not start GeM assisted login.");
        } finally {
            setSaving(false);
        }
    }
    async function checkAssistedLogin() {
        setSaving(true);
        setMessage("Checking GeM login window...");
        try {
            const result = await api("/api/seller/gem-login/assisted-status");
            setAssisted(result);
            setMessage(result.message || (result.active ? "GeM login browser is active." : "No GeM login browser is active."));
        } catch (err) {
            setMessage(err.message || "Could not check GeM login window.");
        } finally {
            setSaving(false);
        }
    }
    async function captureAssistedLogin() {
        setSaving(true);
        setMessage("Capturing authorized GeM session...");
        try {
            const result = await api("/api/seller/gem-login/capture", { method: "POST" });
            setCredential(result.credential);
            setAssisted({ active: false });
            if (loginWindowRef.current && !loginWindowRef.current.closed) loginWindowRef.current.close();
            setMessage(result.message || "GeM session captured securely.");
        } catch (err) {
            setMessage(err.message || "Could not capture GeM session. Complete OTP/CAPTCHA in the GeM login window first.");
        } finally {
            setSaving(false);
        }
    }
    async function cancelAssistedLogin() {
        setSaving(true);
        setMessage("Closing GeM login window...");
        try {
            const result = await api("/api/seller/gem-login/cancel", { method: "POST" });
            setCredential(result.credential);
            setAssisted({ active: false });
            if (loginWindowRef.current && !loginWindowRef.current.closed) loginWindowRef.current.close();
            setMessage(result.message || "Assisted GeM login cancelled.");
        } catch (err) {
            setMessage(err.message || "Could not cancel GeM assisted login.");
        } finally {
            setSaving(false);
        }
    }
    async function save(event) {
        event.preventDefault();
        setSaving(true);
        setMessage("Saving GeM login...");
        try {
            const result = await api("/api/seller/gem-login", { method: "POST", body: JSON.stringify(form) });
            setCredential(result.credential);
            setForm({ ...form, password: "" });
            setMessage("GeM login saved securely.");
        } catch (err) {
            setMessage(err.message || "Could not save GeM login.");
        } finally {
            setSaving(false);
        }
    }
    async function checkLogin() {
        setSaving(true);
        setMessage("Checking saved GeM session...");
        try {
            const result = await api("/api/seller/gem-login/check", { method: "POST" });
            setCredential(result.credential);
            setMessage(result.message || "GeM session checked.");
        } catch (err) {
            setMessage(err.message || "Could not check GeM login.");
        } finally {
            setSaving(false);
        }
    }
    async function clearSession() {
        setSaving(true);
        setMessage("Clearing saved GeM session...");
        try {
            const result = await api("/api/seller/gem-login/session", { method: "DELETE" });
            setCredential(result.credential);
            setMessage(result.message || "Saved GeM session cleared.");
        } catch (err) {
            setMessage(err.message || "Could not clear GeM session.");
        } finally {
            setSaving(false);
        }
    }
    async function removeLogin() {
        setSaving(true);
        setMessage("Removing GeM login...");
        try {
            const result = await api("/api/seller/gem-login", { method: "DELETE" });
            setCredential(result.credential);
            setForm(blank);
            setMessage("GeM login removed.");
        } catch (err) {
            setMessage(err.message || "Could not remove GeM login.");
        } finally {
            setSaving(false);
        }
    }
    return h(React.Fragment, null,
        h("div", { className: "hero-panel gem-login-hero" },
            h("div", null,
                h("h2", null, "GeM Portal Secure Login"),
                h("p", null, "Store GeM seller credentials and reuse an authorized encrypted session for participated-bid tracking. OTP/CAPTCHA is only needed again when GeM expires the saved session.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/opportunities") }, "Opportunity Match"),
                h("button", { onClick: () => navigate("/dashboard/seller/bids") }, "Bid/RA")
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "admin-grid gem-login-grid" },
            h("section", { className: "card gem-login-card" },
                h("h3", null, "Credential Vault"),
                h("form", { className: "stack", onSubmit: save },
                    h("label", { className: "field-block" }, h("span", null, "GeM user ID"), h("input", { value: form.gem_user_id, onChange: e => setForm({ ...form, gem_user_id: e.target.value }), placeholder: "Authorized GeM seller login ID", required: true })),
                    h("label", { className: "field-block" }, h("span", null, "Password"), h("input", { type: "password", value: form.password, onChange: e => setForm({ ...form, password: e.target.value }), placeholder: credential?.password_saved ? "Saved password encrypted" : "GeM password", autoComplete: "new-password" })),
                    h("label", { className: "field-block" }, h("span", null, "Login URL"), h("input", { value: form.login_url, onChange: e => setForm({ ...form, login_url: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "Login mode"), h("select", { value: form.login_mode, onChange: e => setForm({ ...form, login_mode: e.target.value }) },
                        h("option", { value: "manual_otp" }, "One-time OTP authorization"),
                        h("option", { value: "assisted_browser" }, "Assisted browser session")
                    )),
                    h("div", { className: "hero-actions" },
                        h("button", { className: "primary", disabled: saving }, saving ? "Saving..." : "Save Login"),
                        h("button", { type: "button", disabled: saving || !credential?.configured, onClick: checkLogin }, "Check Session"),
                        h("button", { type: "button", disabled: saving || !credential?.session_saved, onClick: clearSession }, "Clear Session"),
                        h("button", { type: "button", className: "danger", disabled: saving || !credential?.configured, onClick: removeLogin }, "Remove")
                    )
                )
            ),
            h("section", { className: "card" },
                h("h3", null, "Authorization Status"),
                h("div", { className: "alert-status-grid" },
                    h("div", null, h("span", null, "Configured"), h("strong", null, credential?.configured ? "Yes" : "No")),
                    h("div", null, h("span", null, "Password"), h("strong", null, credential?.password_saved ? "Encrypted" : "Not saved")),
                    h("div", null, h("span", null, "Session"), h("strong", null, credential?.session_valid ? "Ready" : credential?.session_saved ? "Expired" : "Not captured")),
                    h("div", null, h("span", null, "Expires"), h("strong", null, credential?.session_expires_at || "Not set")),
                    h("div", null, h("span", null, "Captured"), h("strong", null, credential?.session_captured_at || "Not captured")),
                    h("div", null, h("span", null, "Last check"), h("strong", null, credential?.last_login_checked_at || "Not checked"))
                ),
                h("div", { className: credential?.session_valid ? "notice ok" : "notice" },
                    credential?.session_valid
                        ? "Saved GeM session is ready. Bid sync can reuse it without asking for OTP."
                        : "After one authorized GeM login, the encrypted session can be reused until GeM expires it."
                ),
                h("div", { className: "gem-assisted-panel" },
                    h("div", { className: "gem-assisted-copy" },
                        h("h4", null, "Assisted GeM Login"),
                        h("ol", null,
                            h("li", null, "Start a secure GeM login window."),
                            h("li", null, "Complete CAPTCHA/OTP in that window."),
                            h("li", null, "Return here and capture the session after login succeeds.")
                        )
                    ),
                    assisted?.active ? h("div", { className: "gem-window-status" },
                        h("span", null, "Login Window Active"),
                        h("strong", null, assisted.url || "GeM login browser is ready")
                    ) : null,
                    h("div", { className: "gem-assisted-actions" },
                        h("button", { className: "primary", disabled: saving || !credential?.configured, onClick: startAssistedLogin }, "Start GeM Login"),
                        h("button", { disabled: saving, onClick: checkAssistedLogin }, "Check Window"),
                        h("button", { disabled: saving || !assisted.active, onClick: captureAssistedLogin }, "Capture Session"),
                        h("button", { className: "danger", disabled: saving || !assisted.active, onClick: cancelAssistedLogin }, "Cancel")
                    )
                ),
                credential?.last_login_status ? h("div", { className: "gem-status-line" }, credential.last_login_status.replaceAll("_", " ")) : null,
                credential?.last_login_error ? h("div", { className: credential.last_login_status === "decrypt_failed" ? "notice err" : "notice" }, credential.last_login_error) : null
            )
        )
    );
}

function SellerGemBidsPage() {
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [credential, setCredential] = useState(null);
    const [options, setOptions] = useState({ technical: [], qualification: [], representation: [], financial: [], final: [] });
    const [filters, setFilters] = useState({ status: "all", search: "" });
    const [message, setMessage] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [autoSynced, setAutoSynced] = useState(false);
    async function load() {
        const data = await api("/api/seller/gem-bids");
        setItems(data.items || []);
        setSummary(data.summary || null);
        setCredential(data.credential || null);
        setOptions(data.status_options || options);
        if (data.session_required) setMessage(data.message || "Capture a valid GeM session to fetch participated bids.");
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
    useEffect(() => {
        if (autoSynced) return;
        setAutoSynced(true);
        syncNow(true);
    }, [autoSynced]);
    async function updateItem(item, patch) {
        const next = { ...item, ...patch };
        setItems(items.map(row => row.id === item.id ? next : row));
        const result = await api(`/api/seller/gem-bids/${item.id}`, { method: "POST", body: JSON.stringify(next) });
        setItems(items.map(row => row.id === item.id ? result.item : row));
        setSummary(result.summary || summary);
    }
    async function deleteItem(item) {
        const result = await api(`/api/seller/gem-bids/${item.id}`, { method: "DELETE" });
        setItems(items.filter(row => row.id !== item.id));
        setSummary(result.summary || summary);
        setMessage("Participated bid removed.");
    }
    async function syncNow(automatic = false) {
        setSyncing(true);
        setMessage(automatic ? "Fetching participated bids from GeM..." : "Checking GeM participated-bid sync...");
        try {
            const result = await api("/api/seller/gem-bids/sync-now", { method: "POST", loadingLabel: "Syncing GeM participated bids..." });
            const delivered = result.alerts_delivered;
            const deliveryText = delivered ? ` Alerts: dashboard ${delivered.dashboard || 0}, Telegram ${delivered.telegram || 0}, Email ${delivered.email || 0}.` : "";
            setMessage((result.message || "Sync check finished.") + deliveryText);
            await load();
        } catch (err) {
            const failedFetch = (err.message || "").toLowerCase().includes("failed to fetch");
            setMessage(failedFetch ? "GeM sync connection was interrupted. Check server logs; the sync may have taken too long or the server restarted." : (err.message || (automatic ? "Could not auto-fetch participated bids." : "Could not start GeM sync.")));
        } finally {
            setSyncing(false);
        }
    }
    const opts = values => (values || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")));
    const filteredItems = useMemo(() => {
        const query = filters.search.trim().toLowerCase();
        return items.filter(item => {
            const haystack = [item.bid_number, item.department, item.district, item.item_name, item.l1_bidder_name, item.disqualification_reason].join(" ").toLowerCase();
            if (query && !haystack.includes(query)) return false;
            if (filters.status === "alerts") return (item.alerts || []).length > 0;
            if (filters.status === "technical_open") return item.technical_status === "opened";
            if (filters.status === "disqualified") return item.our_qualification_status === "disqualified";
            if (filters.status === "representation_due") return (item.alerts || []).some(alert => alert.toLowerCase().includes("representation deadline"));
            if (filters.status === "financial_open") return item.financial_status === "opened";
            if (filters.status === "won_lost") return ["won", "lost", "cancelled"].includes(item.final_status);
            return true;
        });
    }, [items, filters]);
    return h(React.Fragment, null,
        h("div", { className: "hero-panel gem-bids-hero" },
            h("div", null,
                h("h2", null, "GeM Participated Bids"),
                h("p", null, "This page fetches participated bids from the logged-in GeM seller account and tracks technical, representation, financial, L1, and final status updates.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", disabled: syncing, onClick: () => syncNow(false) }, syncing ? "Syncing..." : "Sync GeM Status"),
                h("a", { className: "download-btn", href: "/exports/seller/gem-bids/csv" }, "Export CSV"),
                h("a", { className: "download-btn", href: "/exports/seller/gem-bids/xlsx" }, "Export Excel"),
                h("a", { className: "download-btn", href: "/exports/seller/gem-bids/daily/xlsx" }, "Daily Excel"),
                h("button", { onClick: () => navigate("/dashboard/seller/gem-login") }, "GeM Login")
            )
        ),
        credential ? h("div", { className: credential.session_valid ? "notice ok" : "notice err" },
            credential.session_valid
                ? `GeM session ready. Expires ${credential.session_expires_at || "when GeM expires it"}.`
                : "GeM session is not ready. Open Secure Login and complete one authorized GeM login before automatic sync."
        ) : null,
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary six gem-bids-summary" },
            [["Total", summary?.total || 0], ["Technical Open", summary?.technical_opened || 0], ["Disqualified", summary?.disqualified || 0], ["Rep. Due", summary?.representation_due || 0], ["Financial Open", summary?.financial_opened || 0], ["Alerts", summary?.alerts || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("section", { className: "card gem-bid-filter-card" },
            h("div", { className: "inline-filters" },
                h("label", { className: "field-block" }, h("span", null, "Search"), h("input", { value: filters.search, onChange: e => setFilters({ ...filters, search: e.target.value }), placeholder: "Bid no., buyer, district, item, L1, reason" })),
                h("label", { className: "field-block" }, h("span", null, "View"), h("select", { value: filters.status, onChange: e => setFilters({ ...filters, status: e.target.value }) },
                    h("option", { value: "all" }, "All participated bids"),
                    h("option", { value: "alerts" }, "Needs attention"),
                    h("option", { value: "technical_open" }, "Technical opened"),
                    h("option", { value: "disqualified" }, "Disqualified"),
                    h("option", { value: "representation_due" }, "Representation due"),
                    h("option", { value: "financial_open" }, "Financial opened"),
                    h("option", { value: "won_lost" }, "Final result")
                )),
                h("div", { className: "filter-count" }, `${filteredItems.length} shown`)
            )
        ),
        h("section", { className: "gem-bid-list" },
            filteredItems.length ? filteredItems.map(item => h("article", { className: `catalogue-card gem-bid-card ${item.final_status}`, key: item.id },
                h("div", { className: "catalogue-card-head" },
                    h("div", null,
                        h("h3", null, item.bid_number),
                        h("p", null, [item.department, item.district, item.item_name].filter(Boolean).join(" | "))
                    ),
                    h("div", { className: `readiness-score compact ${item.our_qualification_status === "disqualified" ? "incomplete" : item.final_status === "won" ? "ready" : "needs_review"}` },
                        h("span", null, item.final_status?.replaceAll("_", " ") || "status"),
                        h("strong", null, item.our_financial_rank || "-")
                    )
                ),
                h("div", { className: "pipeline-meta" },
                    h("span", null, `Value Rs. ${money(item.bid_value || 0)}`),
                    h("span", null, `EMD Rs. ${money(item.emd_amount || 0)}`),
                    h("span", null, `Start ${item.bid_start_date || "NA"}`),
                    h("span", null, `End ${item.bid_end_date || "NA"}`),
                    h("span", null, `Updated ${item.last_updated_at || "NA"}`)
                ),
                (item.alerts || []).length ? h("div", { className: "tag-list catalogue-gaps" }, item.alerts.map(alert => h("span", { key: alert }, alert))) : h("div", { className: "notice ok" }, "No active alerts."),
                h("div", { className: "gem-bid-fields read-only" },
                    [["Technical", item.technical_status], ["Our status", item.our_qualification_status], ["Qualified", item.qualified_bidders_count || 0], ["Disqualified", item.disqualified_bidders_count || 0], ["Representation", item.representation_status], ["Rep. deadline", item.representation_end_date || "NA"], ["Financial", item.financial_status], ["L1", item.l1_bidder_name || "NA"], ["L1 price", item.l1_price ? `Rs. ${money(item.l1_price)}` : "NA"], ["Our rank", item.our_financial_rank || "NA"], ["Our price", item.our_quoted_price ? `Rs. ${money(item.our_quoted_price)}` : "NA"], ["Difference", item.price_difference ? `Rs. ${money(item.price_difference)}` : "NA"], ["Final", item.final_status], ["Corrigendum", item.corrigendum_issued ? "Yes" : "No"], ["Cancelled", item.cancelled ? "Yes" : "No"]].map(([label, value]) =>
                        h("div", { className: "readonly-field", key: label }, h("span", null, label), h("strong", null, String(value || "NA").replaceAll("_", " ")))
                    )
                ),
                item.disqualification_reason ? h("div", { className: "notice err" }, `Disqualification reason: ${item.disqualification_reason}`) : null,
                item.qualified_bidders?.length ? h("div", { className: "notice ok" }, `Qualified bidders: ${item.qualified_bidders.join(", ")}`) : null,
                item.disqualified_bidders?.length ? h("div", { className: "notice err" }, `Disqualified bidders: ${item.disqualified_bidders.join(", ")}`) : null,
                item.representation_remarks ? h("div", { className: "notice" }, `Representation remarks: ${item.representation_remarks}`) : null,
                item.remarks ? h("div", { className: "notice" }, item.remarks) : null,
                item.logs?.length ? h("details", { className: "gem-bid-log" }, h("summary", null, "Status change logs"), h("ul", { className: "log-list" }, item.logs.slice(0, 8).map(log => h("li", { key: log.id }, `${log.created_at || ""} | ${log.field_name}: ${log.old_value || "-"} -> ${log.new_value || "-"}`)))) : null,
                h("div", { className: "notice" }, "Fetched from GeM. Manual editing is disabled on this page.")
            )) : h(EmptyAction, {
                title: syncing ? "Fetching participated bids..." : items.length ? "No bids match this filter" : "No participated bids fetched yet",
                text: syncing ? "GeM sync can take some time. Keep this page open while the server reads your authorized GeM session." : items.length ? "Clear filters or search terms to see all fetched participated bids." : "First capture a valid GeM session, then sync this page to import participated bid status, L1, representation, and alert data.",
                action: syncing ? "" : items.length ? "Show All Bids" : "Open GeM Login",
                onAction: () => items.length ? setFilters({ status: "all", search: "" }) : navigate("/dashboard/seller/gem-login"),
            })
        )
    );
}

function TenderPager({ page, pages, pageSize, resultCount, loading, onPage, onPageSize }) {
    const safePage = Math.min(Math.max(page || 1, 1), pages || 1);
    const start = resultCount ? ((safePage - 1) * pageSize) + 1 : 0;
    const end = Math.min(resultCount || 0, safePage * pageSize);
    const pageItems = [];
    const first = Math.max(1, safePage - 2);
    const last = Math.min(pages || 1, safePage + 2);
    for (let i = first; i <= last; i++) pageItems.push(i);
    return h("div", { className: "tender-pager" },
        h("div", { className: "pager-meta" },
            h("strong", null, resultCount ? `${start}-${end}` : "0"),
            h("span", null, `of ${resultCount || 0} tenders`)
        ),
        h("div", { className: "pager-controls" },
            h("button", { type: "button", disabled: loading || safePage <= 1, onClick: () => onPage(1) }, "First"),
            h("button", { type: "button", disabled: loading || safePage <= 1, onClick: () => onPage(safePage - 1) }, "Prev"),
            first > 1 ? h("span", { className: "pager-ellipsis" }, "...") : null,
            pageItems.map(item => h("button", { type: "button", key: item, className: item === safePage ? "active" : "", disabled: loading, onClick: () => onPage(item) }, item)),
            last < pages ? h("span", { className: "pager-ellipsis" }, "...") : null,
            h("button", { type: "button", disabled: loading || safePage >= pages, onClick: () => onPage(safePage + 1) }, "Next"),
            h("button", { type: "button", disabled: loading || safePage >= pages, onClick: () => onPage(pages) }, "Last")
        ),
        h("label", { className: "pager-size" },
            h("span", null, "Rows"),
            h("select", { value: pageSize, disabled: loading, onChange: e => onPageSize(Number(e.target.value)) },
                [10, 25, 50, 100, 200].map(size => h("option", { key: size, value: size }, size))
            )
        )
    );
}

const priorityAdvancedCities = [
    "Tapi", "Vyara", "Surat", "Navsari", "The Dangs", "Chhotaudepur", "Narmada",
    "Vapi", "Bharuch", "Valsad", "Dadra & Nagar Haveli", "Ankleshwar", "Vadodara", "Panch Mahals",
];
const otherAdvancedCities = [
    "Ahmedabad", "Jamnagar", "Mahesana", "Rajkot", "Gir Somnath", "Morbi", "Arvalli",
    "Porbandar", "Kheda", "Devbhumi Dwarka", "Kutch", "Amreli", "Botad", "Sabarkantha",
    "Surendra Nagar", "Patan", "Banaskantha", "Dahod", "Mahisagar", "Anand", "Junagadh",
    "Bhavnagar", "Gandhinagar",
];

function AdvancedCheckboxFilter({ label, items, value, onChange, priorityCount = 0 }) {
    const selected = (value || "").split(",").map(item => item.trim()).filter(Boolean);
    function toggle(item) {
        const next = selected.includes(item) ? selected.filter(value => value !== item) : [...selected, item];
        onChange(next.join(","));
    }
    return h("fieldset", { className: "advanced-checkbox-filter" },
        h("legend", null, label),
        h("div", { className: "advanced-checkbox-grid" },
            (items || []).map((item, index) => h(React.Fragment, { key: item },
                priorityCount && index === priorityCount ? h("div", { className: "city-priority-divider" }, h("span", null, "Other locations")) : null,
                h("label", { className: index < priorityCount ? "priority-location" : "" },
                    h("input", { type: "checkbox", checked: selected.includes(item), onChange: () => toggle(item) }),
                    h("span", null, item)
                )
            ))
        )
    );
}

function TenderTable({ tenders, options, filters, setFilters, onRefresh, onApply, onReset, resultCount, loading, page, pages, pageSize, onPage, onPageSize }) {
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [statusMsg, setStatusMsg] = useState("");
    const update = (field, value) => setFilters({ ...filters, [field]: value });
    const select = (field, label, items) => h("label", { className: "field-block" },
        h("span", null, label),
        h("select", { value: filters[field] || "", onChange: e => update(field, e.target.value) },
            h("option", { value: "" }, `All ${label}`),
            (items || []).map(item => h("option", { key: item, value: item }, item))
        )
    );

    async function saveStatus(tender, status, remarks) {
        await api(`/api/tenders/${tender.id}/status`, { method: "POST", body: JSON.stringify({ status, remarks }) });
        setStatusMsg("Status saved.");
        onRefresh();
    }

    return h(React.Fragment, null,
        statusMsg ? h("p", { className: "status" }, statusMsg) : null,
        h("div", { className: "toolbar" },
            h("input", { value: filters.q, onChange: e => update("q", e.target.value), onKeyDown: e => { if (e.key === "Enter") onApply(); }, placeholder: "Keywords, category, item, bid no..." }),
            h("select", { value: filters.score, onChange: e => update("score", e.target.value) },
                h("option", { value: "all" }, "All Scores"),
                h("option", { value: "high" }, "High 70+"),
                h("option", { value: "medium" }, "Medium 40-69"),
                h("option", { value: "low" }, "Low <40"),
                h("option", { value: "unscored" }, "Unscored")
            ),
            h("button", { className: "primary", onClick: onApply }, "Apply"),
            h("button", { type: "button", onClick: () => setAdvancedOpen(!advancedOpen) }, advancedOpen ? "Hide Filters" : "Advanced Filters"),
            h("a", { className: "download-btn", href: "/exports/tenders/xlsx" }, "Download Excel"),
            h("a", { className: "download-btn", href: "/exports/tenders/pdf" }, "Download Report")
        ),
        advancedOpen ? h("div", { className: "advanced-filters" },
            select("status", "Status", options.statuses),
            select("department", "Buyer", options.departments),
            select("category", "Category", options.categories),
            select("source", "Source", options.sources),
            h(AdvancedCheckboxFilter, {
                label: "State",
                items: [...new Set(["Gujarat", ...(options.states || [])])].sort((a, b) => a === "Gujarat" ? -1 : b === "Gujarat" ? 1 : a.localeCompare(b)),
                value: filters.state,
                onChange: value => update("state", value),
            }),
            h(AdvancedCheckboxFilter, {
                label: "City",
                items: [...priorityAdvancedCities, ...otherAdvancedCities],
                priorityCount: priorityAdvancedCities.length,
                value: filters.city,
                onChange: value => update("city", value),
            }),
            h("label", { className: "field-block" }, h("span", null, "Tender authority / department"), h("input", { value: filters.authority, onChange: e => update("authority", e.target.value), placeholder: "Authority, office, buyer" })),
            h("label", { className: "field-block" }, h("span", null, "Qualification criteria"), h("input", { value: filters.qualification, onChange: e => update("qualification", e.target.value), placeholder: "Experience, turnover, technical terms" })),
            h("label", { className: "field-block" }, h("span", null, "Eligibility criteria"), h("input", { value: filters.eligibility_query, onChange: e => update("eligibility_query", e.target.value), placeholder: "Certificates, documents, OEM, MSME" })),
            h("label", { className: "field-block" }, h("span", null, "Location / district / state"), h("input", { value: filters.location, onChange: e => update("location", e.target.value), placeholder: "Gujarat, Odisha, district" })),
            h("label", { className: "field-block" }, h("span", null, "Excluded keywords"), h("input", { value: filters.excluded_keywords, onChange: e => update("excluded_keywords", e.target.value), placeholder: "Separate by comma" })),
            h("label", { className: "field-block" }, h("span", null, "Deadline"), h("select", { value: filters.deadline_bucket, onChange: e => update("deadline_bucket", e.target.value) },
                h("option", { value: "" }, "Any Deadline"),
                h("option", { value: "next7" }, "Next 7 days"),
                h("option", { value: "next15" }, "Next 15 days"),
                h("option", { value: "next30" }, "Next 30 days"),
                h("option", { value: "expired" }, "Expired"),
                h("option", { value: "no_deadline" }, "No deadline")
            )),
            h("label", { className: "field-block" }, h("span", null, "From Date"), h("input", { type: "date", value: filters.deadline_from, onChange: e => update("deadline_from", e.target.value) })),
            h("label", { className: "field-block" }, h("span", null, "To Date"), h("input", { type: "date", value: filters.deadline_to, onChange: e => update("deadline_to", e.target.value) })),
            h("label", { className: "field-block" }, h("span", null, "Min Value"), h("input", { type: "number", min: 0, value: filters.min_value, onChange: e => update("min_value", e.target.value), placeholder: "Rs." })),
            h("label", { className: "field-block" }, h("span", null, "Max Value"), h("input", { type: "number", min: 0, value: filters.max_value, onChange: e => update("max_value", e.target.value), placeholder: "Rs." })),
            h("label", { className: "toggle tender-expired-toggle" }, h("input", { type: "checkbox", checked: !!filters.include_expired, onChange: e => update("include_expired", e.target.checked) }), " Include expired / closed tenders"),
            h("label", { className: "field-block" }, h("span", null, "Eligibility"), h("select", { value: filters.eligibility, onChange: e => update("eligibility", e.target.value) },
                h("option", { value: "" }, "Any"),
                h("option", { value: "extracted" }, "Extracted"),
                h("option", { value: "missing" }, "Missing")
            )),
            h("label", { className: "field-block" }, h("span", null, "Bid Decision"), h("select", { value: filters.bid_decision, onChange: e => update("bid_decision", e.target.value) },
                h("option", { value: "" }, "Any"),
                h("option", { value: "bid" }, "Bid"),
                h("option", { value: "review" }, "Review"),
                h("option", { value: "no_bid" }, "No Bid"),
                h("option", { value: "missing" }, "Missing")
            )),
            h("label", { className: "field-block" }, h("span", null, "Sort"), h("select", { value: filters.sort, onChange: e => update("sort", e.target.value) },
                h("option", { value: "newest" }, "Newest"),
                h("option", { value: "deadline" }, "Deadline"),
                h("option", { value: "score" }, "Score"),
                h("option", { value: "value" }, "Value")
            )),
            h("div", { className: "filter-actions" }, h("button", { className: "primary", onClick: onApply }, "Apply Filters"), h("button", { onClick: onReset }, "Reset"))
        ) : null,
        h(TenderPager, { page, pages, pageSize, resultCount, loading, onPage, onPageSize }),
        h("div", { className: "panel tender-list-panel" },
            loading ? h("div", { className: "table-loader" }, h("span", { className: "loader" }), h("strong", null, "Loading tenders...")) :
            tenders.length === 0 ? h(EmptyAction, { title: "No tenders shown", text: "Check the scrape query above, clear filters, or run Manual Scrape to bring matching GeM tenders into this list.", action: "Reset Filters", onAction: onReset }) :
            h("table", null,
                h("thead", null, h("tr", null, ["Tender", "Department", "Value", "Deadline", "Score", "Status", "Actions"].map(x => h("th", { key: x }, x)))),
                h("tbody", null, tenders.map(t => h(TenderRow, { key: t.id, tender: t, onSave: saveStatus })))
            )
        ),
        h(TenderPager, { page, pages, pageSize, resultCount, loading, onPage, onPageSize })
    );
}

function TenderRow({ tender, onSave }) {
    const [status, setStatus] = useState(tender.status || "new");
    const [remarks, setRemarks] = useState("");
    const [eligibility, setEligibility] = useState(tender.eligibility || null);
    const [bidDecision, setBidDecision] = useState(tender.bid_decision || null);
    const [checklist, setChecklist] = useState(null);
    const [eligMsg, setEligMsg] = useState("");
    async function extractEligibility() {
        setEligMsg("Extracting...");
        try {
            const result = await api(`/api/tenders/${tender.id}/eligibility/extract`, { method: "POST" });
            setEligibility(result.eligibility);
            setEligMsg("Eligibility extracted.");
        } catch (err) {
            setEligMsg(err.message || "Extraction failed.");
        }
    }
    async function generateBidDecision() {
        setEligMsg("Generating bid decision...");
        try {
            const result = await api(`/api/tenders/${tender.id}/bid-decision/generate`, { method: "POST" });
            setBidDecision(result.bid_decision);
            setEligMsg("Bid decision generated.");
        } catch (err) {
            setEligMsg(err.message || "Bid decision failed.");
        }
    }
    async function generateChecklist() {
        setEligMsg("Generating checklist...");
        try {
            const result = await api(`/api/tenders/${tender.id}/document-checklist/generate`, { method: "POST" });
            setChecklist(result.checklist);
            setEligMsg("Checklist generated.");
        } catch (err) {
            setEligMsg(err.message || "Checklist failed.");
        }
    }
    return h("tr", null,
        h("td", null,
            h("div", { className: "title" }, tender.title),
            h("div", { className: "desc" }, tender.tender_id),
            tender.ai_reason ? h("div", { className: "desc" }, tender.ai_reason) : null,
            bidDecision ? h("div", { className: `bid-box ${bidDecision.recommendation}` },
                h("strong", null, bidDecision.recommendation === "bid" ? "Bid" : bidDecision.recommendation === "no_bid" ? "No Bid" : "Review"),
                h("span", null, `Decision score: ${bidDecision.decision_score}`),
                bidDecision.reasons?.length ? h("span", null, `Why: ${bidDecision.reasons.slice(0, 2).join(", ")}`) : null,
                bidDecision.blockers?.length ? h("span", null, `Blockers: ${bidDecision.blockers.slice(0, 2).join(", ")}`) : null,
                h("small", null, `Confidence: ${Math.round((bidDecision.confidence || 0) * 100)}%`)
            ) : null,
            eligibility ? h("div", { className: "eligibility-box" },
                h("strong", null, "Eligibility"),
                eligibility.emd ? h("span", null, `EMD: ${eligibility.emd}`) : null,
                eligibility.turnover_requirement ? h("span", null, `Turnover: ${eligibility.turnover_requirement}`) : null,
                eligibility.experience_requirement ? h("span", null, `Experience: ${eligibility.experience_requirement}`) : null,
                eligibility.risk_flags?.length ? h("span", null, `Risks: ${eligibility.risk_flags.join(", ")}`) : null,
                h("small", null, `Confidence: ${Math.round((eligibility.confidence || 0) * 100)}%`)
            ) : null,
            checklist ? h("div", { className: "checklist-box" },
                h("strong", null, `Checklist (${checklist.total || 0})`),
                (checklist.items || []).slice(0, 6).map(item => h("span", { key: item.title }, item.title)),
                (checklist.items || []).length > 6 ? h("small", null, `+${checklist.items.length - 6} more`) : null
            ) : null,
            tender.url ? h("a", { className: "source", href: tender.url, target: "_blank" }, "View source") : null
        ),
        h("td", null,
            tender.department || "GeM",
            tender.address ? h("div", { className: "desc" }, tender.address) : null,
            h("div", { className: "desc" }, [tender.city, tender.state].filter(Boolean).join(", "))
        ),
        h("td", null, `Rs. ${money(tender.estimated_value)}`),
        h("td", null, tender.deadline || ""),
        h("td", null, h("span", { className: `score ${scoreClass(tender.relevance_score ?? 0)}` }, tender.relevance_score ?? 0)),
        h("td", null, tender.status || "new"),
        h("td", null,
            h("div", { className: "action-stack" },
                h("select", { value: status, onChange: e => setStatus(e.target.value) }, ["new", "reviewing", "applied", "won", "lost", "ignored"].map(x => h("option", { key: x, value: x }, x))),
                h("input", { value: remarks, onChange: e => setRemarks(e.target.value), placeholder: "Remarks" }),
                h("button", { className: "small primary", onClick: () => onSave(tender, status, remarks) }, "Save"),
                h("div", { className: "mini-links" },
                    h("button", { type: "button", onClick: extractEligibility }, "Eligibility"),
                    h("button", { type: "button", onClick: generateBidDecision }, "Bid/No-Bid"),
                    h("button", { type: "button", onClick: generateChecklist }, "Checklist"),
                    h("a", { href: `/tender/${tender.id}/export/xlsx` }, "CSV"),
                    h("a", { href: `/tender/${tender.id}/export/pdf` }, "Report"),
                    h("a", { href: `/tender/${tender.id}/download/raw-pdf` }, "Raw")
                ),
                eligMsg ? h("div", { className: "desc" }, eligMsg) : null
            )
        )
    );
}

function ScrapeHistoryPage() {
    const [data, setData] = useState({ items: [], total: 0 });
    const [message, setMessage] = useState("");
    async function load() {
        try { setData(await api("/api/scrape-history?limit=100")); }
        catch (error) { setMessage(error.message); }
    }
    useEffect(() => { load(); }, []);
    function dateTime(value) {
        if (!value) return "Not completed";
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
    }
    function duration(seconds) {
        if (seconds === null || seconds === undefined) return "In progress";
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remaining = seconds % 60;
        return `${minutes}m ${remaining}s`;
    }
    function values(items) {
        return (items || []).length ? (items || []).join(", ") : "Not selected";
    }
    return h("div", { className: "scrape-history-page" },
        h("section", { className: "hero-panel scrape-history-hero" },
            h("div", null, h("span", { className: "eyebrow" }, "DISCOVERY AUDIT"), h("h2", null, "Scraping Details"), h("p", null, "Review when every scrape ran, which criteria it used, how many bids it discovered, and download the run-specific Excel report.")),
            h("div", { className: "hero-actions" }, h("button", { onClick: load }, "Refresh"))
        ),
        h("div", { className: "summary four scrape-history-summary" },
            h("div", { className: "tile" }, h("span", null, "Recorded runs"), h("strong", null, data.total || 0)),
            h("div", { className: "tile" }, h("span", null, "Successful"), h("strong", null, (data.items || []).filter(item => item.status === "success").length)),
            h("div", { className: "tile" }, h("span", null, "Tenders inserted"), h("strong", null, (data.items || []).reduce((sum, item) => sum + (item.inserted_count || 0), 0))),
            h("div", { className: "tile" }, h("span", null, "Bids discovered"), h("strong", null, (data.items || []).reduce((sum, item) => sum + (item.fetched_count || 0), 0)))
        ),
        message ? h("div", { className: "notice" }, message) : null,
        !(data.items || []).length ? h(EmptyAction, { title: "No scrape history yet", text: "Run a manual or scheduled scrape. Its timing, criteria, results and Excel report will appear here.", action: "Open Automation", onAction: () => navigate("/dashboard/seller/settings") }) : null,
        h("div", { className: "scrape-history-list" }, (data.items || []).map(item => {
            const criteria = item.criteria || {};
            return h("article", { className: "card scrape-run-card", key: item.id },
                h("div", { className: "scrape-run-head" },
                    h("div", null, h("span", { className: `status-badge ${item.status || "running"}` }, item.status || "running"), h("h3", null, criteria.profile_name || `${item.source || "GeM"} ${String(item.trigger || "manual").replaceAll("_", " ")} scrape`), h("p", { className: "desc" }, `${dateTime(item.started_at)} → ${dateTime(item.finished_at)}`)),
                    h("a", { className: "download-btn", href: item.excel_url }, "Download Excel")
                ),
                h("div", { className: "scrape-run-metrics" },
                    [["Discovered", item.fetched_count || 0], ["Inserted", item.inserted_count || 0], ["Scored", item.scored_count || 0], ["Duplicates", item.duplicate_count || 0], ["High priority", item.high_priority_count || 0], ["Duration", duration(item.duration_seconds)]].map(([label, value]) => h("div", { key: label }, h("span", null, label), h("strong", null, value)))
                ),
                h("div", { className: "scrape-criteria-grid" },
                    h("div", null, h("span", null, "Keywords"), h("p", null, values(criteria.keywords))),
                    h("div", null, h("span", null, "Departments / authorities"), h("p", null, values(criteria.departments))),
                    h("div", null, h("span", null, "States"), h("p", null, values(criteria.states))),
                    h("div", null, h("span", null, "Cities / districts"), h("p", null, values(criteria.cities))),
                    h("div", null, h("span", null, "Time frame"), h("p", null, `${dateTime(item.started_at)} to ${dateTime(item.finished_at)} (${duration(item.duration_seconds)})`)),
                    h("div", null, h("span", null, "Mode"), h("p", null, criteria.only_high_priority ? "High-priority results only" : "All matching results"))
                ),
                item.message ? h("details", { className: "scrape-run-log" }, h("summary", null, "Run details"), h("p", null, item.message)) : null
            );
        }))
    );
}

function DashboardPage({ view }) {
    const [summary, setSummary] = useState(null);
    const [tenders, setTenders] = useState([]);
    const [options, setOptions] = useState({ departments: [], states: [], categories: [], sources: [], statuses: [] });
    const blankFilters = { q: "", authority: "", qualification: "", eligibility_query: "", location: "", city: "", excluded_keywords: "", include_expired: view !== "upcoming", score: "all", status: "", department: "", state: "", category: "", source: "", min_value: "", max_value: "", deadline_from: "", deadline_to: "", deadline_bucket: "", eligibility: "", bid_decision: "", sort: "newest" };
    const [filters, setFilters] = useState(blankFilters);
    const [resultCount, setResultCount] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [listLoading, setListLoading] = useState(false);
    const [message, setMessage] = useState("");
    function queryString(nextFilters = filters, nextPage = page, nextPageSize = pageSize) {
        const params = new URLSearchParams({ view, limit: String(nextPageSize), offset: String((Math.max(1, nextPage) - 1) * nextPageSize) });
        Object.entries(nextFilters).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined && value !== false && !(key === "score" && value === "all") && !(key === "sort" && value === "newest")) {
                params.set(key, value);
            }
        });
        return params.toString();
    }
    async function load(nextFilters = filters, nextPage = page, nextPageSize = pageSize) {
        setListLoading(true);
        try {
            const [s, t, o] = await Promise.all([
                api("/api/dashboard/summary", { silent: true }),
                api(`/api/tenders?${queryString(nextFilters, nextPage, nextPageSize)}`, { silent: true }),
                api("/api/tender-filter-options", { silent: true }),
            ]);
            setSummary(s);
            setTenders(t.items || []);
            setResultCount(t.count ?? (t.items || []).length);
            setPage(t.page || nextPage);
            setPages(t.pages || 1);
            setPageSize(t.limit || nextPageSize);
            setOptions(o);
        } finally {
            setListLoading(false);
        }
    }
    useEffect(() => {
        setFilters(blankFilters);
        setPage(1);
        load(blankFilters, 1, pageSize).catch(e => setMessage(e.message));
    }, [view]);
    async function applyFilters() { setPage(1); await load(filters, 1, pageSize); }
    async function resetFilters() {
        setFilters(blankFilters);
        setPage(1);
        await load(blankFilters, 1, pageSize);
    }
    async function changePage(nextPage) {
        const safePage = Math.min(Math.max(1, nextPage), pages || 1);
        setPage(safePage);
        await load(filters, safePage, pageSize);
    }
    async function changePageSize(nextSize) {
        setPageSize(nextSize);
        setPage(1);
        await load(filters, 1, nextSize);
    }
    async function scrape() {
        setMessage("Manual scrape running...");
        const result = await api("/api/scrape-now", { method: "POST" });
        let nextMessage = scrapeMessage(result);
        if (!(result.inserted || 0)) {
            try {
                const diagnostics = await api("/api/scrape-diagnostics");
                nextMessage = `${nextMessage} ${scrapeDiagnosticsMessage(diagnostics)}`;
            } catch {}
        }
        setMessage(nextMessage);
        await load(filters, page, pageSize);
    }
    async function showScrapeDiagnostics() {
        setMessage("Checking scrape diagnostics...");
        const diagnostics = await api("/api/scrape-diagnostics");
        setMessage(scrapeDiagnosticsMessage(diagnostics) || "No scrape diagnostics available yet.");
    }
    async function extractAllEligibility() {
        setMessage("Extracting eligibility from current tender list...");
        const result = await api("/api/eligibility/extract", { method: "POST" });
        setMessage(`Eligibility extraction finished. Extracted ${result.extracted || 0}, failed ${result.failed || 0}.`);
        await load(filters, page, pageSize);
    }
    async function generateAllBidDecisions() {
        setMessage("Generating bid/no-bid recommendations...");
        const result = await api("/api/bid-decisions/generate", { method: "POST" });
        setMessage(`Bid/no-bid generation finished. Generated ${result.generated || 0}, failed ${result.failed || 0}.`);
        await load(filters, page, pageSize);
    }
    return h(React.Fragment, null,
        message ? h("p", { className: "status" }, message) : null,
        h(Summary, { summary }),
        h("div", { className: "top-actions" },
            h("button", { className: "primary", onClick: scrape }, "Manual Scrape"),
            h("button", { onClick: showScrapeDiagnostics }, "Scrape Diagnostics"),
            h("button", { onClick: extractAllEligibility }, "Extract Eligibility"),
            h("button", { onClick: generateAllBidDecisions }, "Generate Bid/No-Bid")
        ),
        h(TenderTable, { tenders, options, filters, setFilters, onRefresh: () => load(filters, page, pageSize), onApply: applyFilters, onReset: resetFilters, resultCount, loading: listLoading, page, pages, pageSize, onPage: changePage, onPageSize: changePageSize })
    );
}

const pipelineStages = [
    ["new", "New"],
    ["reviewing", "Reviewing"],
    ["applied", "Applied"],
    ["won", "Won"],
    ["lost", "Lost"],
    ["ignored", "Ignored"],
];

function PipelinePage() {
    const [tenders, setTenders] = useState([]);
    const [summary, setSummary] = useState(null);
    const [message, setMessage] = useState("");
    const [query, setQuery] = useState("");
    async function load() {
        const [s, t] = await Promise.all([api("/api/dashboard/summary"), api("/api/tenders?view=all&limit=500&sort=deadline")]);
        setSummary(s);
        setTenders(t.items || []);
    }
    useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return tenders;
        return tenders.filter(t => `${t.title || ""} ${t.department || ""} ${t.state || ""} ${t.tender_id || ""}`.toLowerCase().includes(needle));
    }, [tenders, query]);
    const columns = useMemo(() => {
        const grouped = Object.fromEntries(pipelineStages.map(([key]) => [key, []]));
        filtered.forEach(tender => {
            const key = grouped[tender.status] ? tender.status : "new";
            grouped[key].push(tender);
        });
        return grouped;
    }, [filtered]);
    async function moveTender(tender, nextStatus) {
        setMessage(`Moving tender to ${nextStatus}...`);
        await api(`/api/tenders/${tender.id}/status`, { method: "POST", body: JSON.stringify({ status: nextStatus, remarks: `Moved from pipeline to ${nextStatus}` }) });
        setTenders(current => current.map(item => item.id === tender.id ? { ...item, status: nextStatus } : item));
        setMessage("Pipeline updated.");
    }
    const score = tender => h("span", { className: `score ${scoreClass(tender.relevance_score ?? 0)}` }, tender.relevance_score ?? 0);
    return h(React.Fragment, null,
        h("div", { className: "hero-panel pipeline-hero" },
            h("div", null, h("h2", null, "Tender Pipeline Kanban"), h("p", null, "Move bids through review, application, win/loss, and ignored stages from one visual board.")),
            h("div", { className: "hero-actions" }, h("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Search tender, buyer, state..." }))
        ),
        h(Summary, { summary }),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "pipeline-board" },
            pipelineStages.map(([key, label]) => h("section", { className: `pipeline-column ${key}`, key },
                h("div", { className: "pipeline-column-head" }, h("h3", null, label), h("span", null, columns[key]?.length || 0)),
                h("div", { className: "pipeline-cards" },
                    (columns[key] || []).length ? columns[key].map(tender => h("article", { className: "pipeline-card", key: tender.id },
                        h("div", { className: "pipeline-card-top" }, score(tender), h("span", null, tender.deadline || "No deadline")),
                        h("h4", null, tender.title || "Untitled tender"),
                        h("p", null, tender.department || "GeM"),
                        h("div", { className: "pipeline-meta" },
                            h("span", null, tender.state || "No state"),
                            h("span", null, `Rs. ${money(tender.estimated_value)}`)
                        ),
                        tender.bid_decision ? h("div", { className: `pipeline-decision ${tender.bid_decision.recommendation}` }, tender.bid_decision.recommendation === "no_bid" ? "No Bid" : tender.bid_decision.recommendation === "bid" ? "Bid" : "Review") : null,
                        h("div", { className: "pipeline-actions" },
                            pipelineStages.filter(([stage]) => stage !== key).slice(0, 3).map(([stage, stageLabel]) =>
                                h("button", { key: stage, type: "button", onClick: () => moveTender(tender, stage) }, stageLabel)
                            ),
                            h("select", { value: key, onChange: e => moveTender(tender, e.target.value) },
                                pipelineStages.map(([stage, stageLabel]) => h("option", { key: stage, value: stage }, stageLabel))
                            )
                        )
                    )) : h("div", { className: "pipeline-empty" }, "No tenders")
                )
            ))
        )
    );
}

function TrackingPage() {
    const [items, setItems] = useState([]);
    const [message, setMessage] = useState("");
    async function load() { setItems((await api("/api/tracking")).items || []); }
    useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
    async function refresh() {
        setMessage("Checking source statuses...");
        const result = await api("/api/tracking/update-now", { method: "POST" });
        setMessage(`Updated ${result.updated || 0} tracking rows.`);
        await load();
    }
    return h(React.Fragment, null,
        h("div", { className: "top-actions" }, h("button", { className: "primary", onClick: refresh }, "Update Tracking")),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "panel" }, items.length ? h("table", null,
            h("thead", null, h("tr", null, ["Tender", "Submission", "Docs", "Applied", "Source", "Remarks"].map(x => h("th", { key: x }, x)))),
            h("tbody", null, items.map(item => h("tr", { key: item.id },
                h("td", null, item.tender?.title || item.tender_id),
                h("td", null, item.submission_status || ""),
                h("td", null, item.documents_ready ? "Ready" : "Pending"),
                h("td", null, item.applied ? "Yes" : "No"),
                h("td", null, item.source_status || ""),
                h("td", null, item.remarks || "")
            )))
        ) : h("div", { className: "empty" }, "No tracking rows."))
    );
}

function ChartCard({ title, data, type = "bar" }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current || !window.Chart) return;
        const chart = new Chart(ref.current, {
            type,
            data: { labels: data?.labels || [], datasets: [{ data: data?.values || [], backgroundColor: ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16"] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: type !== "bar", position: "bottom" } } },
        });
        return () => chart.destroy();
    }, [data, type]);
    return h("div", { className: "chart-card" }, h("h3", null, title), h("div", { className: "chart-box" }, h("canvas", { ref })));
}

function AnalysisPage() {
    const [data, setData] = useState(null);
    useEffect(() => { api("/api/analysis").then(setData); }, []);
    const charts = data?.charts || {};
    const summary = data?.summary || {};
    return h(React.Fragment, null,
        h("div", { className: "hero-panel" }, h("div", null, h("h2", null, "Tender Intelligence Matrix"), h("p", null, "Live analysis from your saved tenders and PDF extraction coverage.")),
            h("div", { className: "hero-actions" }, h("a", { href: "/exports/analysis/report" }, "Download Report"), h("a", { href: "/exports/analysis/csv" }, "Download CSV"))),
        h("div", { className: "summary six" }, [["Total", summary.total || 0], ["Avg Score", summary.avg_score || 0], ["Total Value", `Rs. ${money(summary.total_value)}`], ["Expiring", summary.expiring_soon || 0], ["PDF Links", summary.documents || 0], ["PDF Text", summary.pdf_extracted || 0]].map(([a,b]) => h("div", { className: "tile", key: a }, h("span", null, a), h("strong", null, b)))),
        h("div", { className: "chart-grid" },
            h(ChartCard, { title: "AI Score Distribution", data: charts.score, type: "doughnut" }),
            h(ChartCard, { title: "Status Breakdown", data: charts.status }),
            h(ChartCard, { title: "State Wise Tenders", data: charts.state }),
            h(ChartCard, { title: "Top Departments", data: charts.department }),
            h(ChartCard, { title: "Deadline Risk", data: charts.deadline }),
            h(ChartCard, { title: "Value Bands", data: charts.value }),
            h(ChartCard, { title: "Category Mix", data: charts.category }),
            h(ChartCard, { title: "PDF Coverage", data: charts.pdfCoverage })
        )
    );
}

function BuyerIntelligencePage() {
    const [data, setData] = useState(null);
    const [query, setQuery] = useState("");
    const [message, setMessage] = useState("");
    useEffect(() => {
        api("/api/buyers").then(setData).catch(err => setMessage(err.message));
    }, []);
    const summary = data?.summary || {};
    const charts = data?.charts || {};
    const buyers = useMemo(() => {
        const term = query.trim().toLowerCase();
        const items = data?.buyers || [];
        if (!term) return items;
        return items.filter(item =>
            item.name.toLowerCase().includes(term) ||
            (item.states || []).some(s => s.label.toLowerCase().includes(term)) ||
            (item.categories || []).some(c => c.label.toLowerCase().includes(term))
        );
    }, [data, query]);
    const tagList = items => h("div", { className: "tag-list" },
        (items || []).length ? items.map(item => h("span", { key: item.label }, item.label, h("small", null, item.count))) : h("span", null, "No signal")
    );
    return h(React.Fragment, null,
        h("div", { className: "hero-panel buyer-hero" },
            h("div", null,
                h("h2", null, "Buyer Intelligence"),
                h("p", null, "Department-level buyer patterns from your tenders, scores, PDFs, eligibility, and bid decisions.")
            ),
            h("div", { className: "hero-actions" },
                h("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Search buyer, state, category..." })
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary five" },
            [["Buyers", summary.total_buyers || 0], ["Repeat Buyers", summary.repeat_buyers || 0], ["High Priority Buyers", summary.high_priority_buyers || 0], ["Total Value", `Rs. ${money(summary.total_value)}`], ["Top Buyer", summary.top_buyer || "None"]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "chart-grid buyer-charts" },
            h(ChartCard, { title: "Tender Volume by Buyer", data: charts.volume }),
            h(ChartCard, { title: "Value Concentration", data: charts.value }),
            h(ChartCard, { title: "Average Score by Buyer", data: charts.score }),
            h(ChartCard, { title: "Deadline Risk", data: charts.deadlineRisk })
        ),
        h("div", { className: "buyer-grid" },
            buyers.length ? buyers.map(buyer => h("article", { className: "buyer-card", key: buyer.name },
                h("div", { className: "buyer-card-head" },
                    h("div", null, h("h3", null, buyer.name), h("p", null, buyer.last_seen ? `Last seen ${buyer.last_seen}` : "No recent date")),
                    h("span", { className: `score ${scoreClass(buyer.avg_score || 0)}` }, buyer.avg_score || 0)
                ),
                h("div", { className: "buyer-metrics" },
                    h("div", null, h("span", null, "Tenders"), h("strong", null, buyer.tender_count || 0)),
                    h("div", null, h("span", null, "High"), h("strong", null, buyer.high_priority_count || 0)),
                    h("div", null, h("span", null, "Value"), h("strong", null, `Rs. ${money(buyer.total_value)}`)),
                    h("div", null, h("span", null, "Risk"), h("strong", null, buyer.deadline_risk || 0))
                ),
                h("div", { className: "buyer-splits" },
                    h("div", null, h("h4", null, "States"), tagList(buyer.states)),
                    h("div", null, h("h4", null, "Categories"), tagList(buyer.categories))
                ),
                h("div", { className: "decision-strip" },
                    h("span", null, `Bid ${buyer.bid_decisions?.bid || 0}`),
                    h("span", null, `Review ${buyer.bid_decisions?.review || 0}`),
                    h("span", null, `No Bid ${buyer.bid_decisions?.no_bid || 0}`),
                    h("span", null, `PDF ${buyer.documents || 0}`),
                    h("span", null, `Eligibility ${buyer.eligibility_extracted || 0}`)
                ),
                h("div", { className: "recent-list" },
                    h("h4", null, "Recent tenders"),
                    (buyer.recent_tenders || []).map(item => h("button", { key: item.id, type: "button", onClick: () => navigate("/dashboard/tenders") },
                        h("span", null, item.title || "Untitled tender"),
                        h("small", null, `${item.deadline || "No deadline"} | Rs. ${money(item.value)} | ${item.status}`)
                    ))
                )
            )) : h("div", { className: "empty" }, data ? "No buyers found." : "Loading buyer intelligence...")
        )
    );
}

function CompetitorIntelligencePage() {
    const [data, setData] = useState(null);
    const [query, setQuery] = useState("");
    const [message, setMessage] = useState("");
    useEffect(() => {
        api("/api/competitors").then(setData).catch(err => setMessage(err.message));
    }, []);
    const summary = data?.summary || {};
    const charts = data?.charts || {};
    const competitors = useMemo(() => {
        const term = query.trim().toLowerCase();
        const items = data?.competitors || [];
        if (!term) return items;
        return items.filter(item =>
            item.name.toLowerCase().includes(term) ||
            (item.buyers || []).some(b => b.label.toLowerCase().includes(term)) ||
            (item.states || []).some(s => s.label.toLowerCase().includes(term))
        );
    }, [data, query]);
    const awardWatch = useMemo(() => {
        const term = query.trim().toLowerCase();
        const items = data?.award_watch || [];
        if (!term) return items;
        return items.filter(item => `${item.title || ""} ${item.department || ""} ${item.state || ""} ${(item.signals || []).join(" ")}`.toLowerCase().includes(term));
    }, [data, query]);
    const tags = items => h("div", { className: "tag-list" },
        (items || []).length ? items.map(item => h("span", { key: item.label }, item.label, h("small", null, item.count))) : h("span", null, "No signal")
    );
    return h(React.Fragment, null,
        h("div", { className: "hero-panel competitor-hero" },
            h("div", null,
                h("h2", null, "Competitor / Award Intelligence"),
                h("p", null, "Signals from tender text and PDFs for L1, awardee, supplier, vendor, and successful bidder mentions.")
            ),
            h("div", { className: "hero-actions" }, h("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Search competitor, buyer, state..." }))
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary five" },
            [["Competitors", summary.competitors_detected || 0], ["Award Signals", summary.award_signal_tenders || 0], ["Won", summary.won || 0], ["Lost", summary.lost || 0], ["Competitive Buyers", summary.competitive_buyers || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "chart-grid competitor-charts" },
            h(ChartCard, { title: "Detected Competitor Signals", data: charts.competitors }),
            h(ChartCard, { title: "Signal Value Exposure", data: charts.value }),
            h(ChartCard, { title: "Competitive Buyers", data: charts.buyers }),
            h(ChartCard, { title: "Pipeline Outcomes", data: charts.outcomes, type: "doughnut" })
        ),
        h("div", { className: "competitor-layout" },
            h("section", { className: "card" },
                h("h3", null, "Detected Competitors"),
                competitors.length ? h("div", { className: "competitor-list" },
                    competitors.map(item => h("article", { className: "competitor-card", key: item.name },
                        h("div", { className: "competitor-head" },
                            h("div", null, h("h4", null, item.name), h("p", null, item.last_seen ? `Last seen ${item.last_seen}` : "No date signal")),
                            h("strong", null, item.signal_count || 0)
                        ),
                        h("div", { className: "buyer-metrics competitor-metrics" },
                            h("div", null, h("span", null, "Signals"), h("strong", null, item.signal_count || 0)),
                            h("div", null, h("span", null, "Value"), h("strong", null, `Rs. ${money(item.total_value)}`))
                        ),
                        h("h5", null, "Buyers"),
                        tags(item.buyers),
                        h("h5", null, "States"),
                        tags(item.states),
                        h("div", { className: "signal-examples" },
                            (item.examples || []).map(example => h("blockquote", { key: `${item.name}-${example.tender_id}` },
                                h("strong", null, example.buyer),
                                h("span", null, example.snippet)
                            ))
                        )
                    ))
                ) : h("div", { className: "empty" }, data ? "No competitor names detected yet. Extract more PDFs or scrape award-related tenders." : "Loading competitor intelligence...")
            ),
            h("section", { className: "card" },
                h("h3", null, "Award Signal Watch"),
                awardWatch.length ? h("div", { className: "award-watch-list" },
                    awardWatch.map(item => h("article", { className: "award-watch-card", key: item.id },
                        h("div", { className: "pipeline-card-top" }, h("span", { className: `score ${scoreClass(item.score || 0)}` }, item.score || 0), h("span", null, item.deadline || "No deadline")),
                        h("h4", null, item.title || "Untitled tender"),
                        h("p", null, item.department || "Unknown Buyer"),
                        h("div", { className: "pipeline-meta" }, h("span", null, item.state || "No state"), h("span", null, `Rs. ${money(item.value)}`), h("span", null, item.status || "new")),
                        item.signals?.length ? h("div", { className: "tag-list signal-tags" }, item.signals.map(name => h("span", { key: `${item.id}-${name}` }, name))) : null,
                        item.snippet ? h("blockquote", null, item.snippet) : null
                    ))
                ) : h("div", { className: "empty" }, data ? "No award signals found in current tender text." : "Loading award signals...")
            )
        )
    );
}

function MarketIntelligencePage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => {
        api("/api/market").then(setData).catch(err => setMessage(err.message));
    }, []);
    const summary = data?.summary || {};
    const charts = data?.charts || {};
    const leaders = data?.leaders || {};
    return h(React.Fragment, null,
        h("div", { className: "hero-panel market-hero" },
            h("div", null,
                h("h2", null, "Market Intelligence Dashboard"),
                h("p", null, "Strategic demand, value, geography, buyer, category, keyword, and deadline signals from your tender workspace.")
            ),
            h("div", { className: "market-leaders" },
                [["Category", leaders.top_category || "None"], ["State", leaders.top_state || "None"], ["Buyer", leaders.top_buyer || "None"], ["Keyword", leaders.top_keyword || "None"]].map(([label, value]) =>
                    h("span", { key: label }, h("small", null, label), value)
                )
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary six" },
            [["Tenders", summary.total_tenders || 0], ["High Priority", summary.high_priority || 0], ["Market Value", `Rs. ${money(summary.known_market_value)}`], ["Avg Value", `Rs. ${money(summary.avg_value)}`], ["Avg Score", summary.avg_score || 0], ["PDF Coverage", `${summary.pdf_coverage || 0}%`]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "chart-grid market-charts" },
            h(ChartCard, { title: "Monthly Tender Volume", data: charts.monthlyVolume }),
            h(ChartCard, { title: "Category Demand", data: charts.categoryVolume }),
            h(ChartCard, { title: "Category Value", data: charts.categoryValue }),
            h(ChartCard, { title: "State Demand", data: charts.stateVolume }),
            h(ChartCard, { title: "State Value", data: charts.stateValue }),
            h(ChartCard, { title: "Buyer Value Concentration", data: charts.buyerValue }),
            h(ChartCard, { title: "Score Mix", data: charts.scoreMix, type: "doughnut" }),
            h(ChartCard, { title: "Keyword Demand", data: charts.keywords })
        ),
        h("div", { className: "market-layout" },
            h("section", { className: "card" },
                h("h3", null, "Market Recommendations"),
                h("div", { className: "recommendation-list" },
                    (data?.recommendations || []).map(item => h("article", { className: "recommendation-card", key: item.title },
                        h("h4", null, item.title),
                        h("p", null, item.text)
                    ))
                )
            ),
            h("section", { className: "card" },
                h("h3", null, "Opportunity Index"),
                (data?.opportunities || []).length ? h("div", { className: "opportunity-list" },
                    data.opportunities.map(item => h("article", { className: "opportunity-card", key: item.id },
                        h("div", { className: "opportunity-head" },
                            h("div", null, h("h4", null, item.title || "Untitled tender"), h("p", null, item.department || "Unknown Buyer")),
                            h("strong", null, item.market_score || 0)
                        ),
                        h("div", { className: "pipeline-meta" },
                            h("span", null, item.category || "Unknown"),
                            h("span", null, item.state || "No state"),
                            h("span", null, `Rs. ${money(item.value)}`),
                            h("span", null, item.deadline || "No deadline")
                        ),
                        h("div", { className: "decision-strip" },
                            h("span", null, `AI ${item.score || 0}`),
                            h("span", null, item.status || "new")
                        )
                    ))
                ) : h("div", { className: "empty" }, data ? "No opportunities available yet." : "Loading market opportunities...")
            )
        )
    );
}

function ExecutiveReportsPage() {
    const [period, setPeriod] = useState("weekly");
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    async function load(nextPeriod = period) {
        setMessage("");
        try {
            setData(await api(`/api/reports/executive?period=${nextPeriod}`));
        } catch (err) {
            setMessage(err.message);
        }
    }
    useEffect(() => { load(period); }, [period]);
    const summary = data?.summary || {};
    const charts = data?.charts || {};
    return h(React.Fragment, null,
        h("div", { className: "hero-panel reports-hero" },
            h("div", null,
                h("h2", null, "Executive Reports"),
                h("p", null, "Weekly and monthly executive summaries for tender volume, value, pipeline outcomes, deadlines, and bid priorities.")
            ),
            h("div", { className: "reports-controls" },
                h("div", { className: "segment" },
                    [["weekly", "Weekly"], ["monthly", "Monthly"]].map(([key, label]) =>
                        h("button", { key, type: "button", className: period === key ? "active" : "", onClick: () => setPeriod(key) }, label)
                    )
                ),
                h("a", { href: `/exports/executive/${period}/report` }, "Download Report"),
                h("a", { href: `/exports/executive/${period}/csv` }, "Download CSV")
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        data ? h("p", { className: "report-range" }, `${data.period_label} report | ${data.date_range?.start} to ${data.date_range?.end}`) : null,
        h("div", { className: "summary six" },
            [["Tenders", summary.total_tenders || 0], ["High Priority", summary.high_priority || 0], ["Known Value", `Rs. ${money(summary.known_value)}`], ["Avg Score", summary.avg_score || 0], ["Expiring", summary.expiring_soon || 0], ["Bid", summary.bid_recommended || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "chart-grid reports-charts" },
            h(ChartCard, { title: "Status Mix", data: charts.status }),
            h(ChartCard, { title: "Score Mix", data: charts.score, type: "doughnut" }),
            h(ChartCard, { title: "Top Buyers", data: charts.buyers }),
            h(ChartCard, { title: "States", data: charts.states }),
            h(ChartCard, { title: "Categories", data: charts.categories }),
            h(ChartCard, { title: "Bid Decisions", data: charts.decisions, type: "doughnut" })
        ),
        h("div", { className: "reports-layout" },
            h("section", { className: "card" },
                h("h3", null, "Key Findings"),
                h("div", { className: "finding-list" },
                    (data?.key_findings || []).map((text, idx) => h("article", { className: "finding-card", key: idx }, h("span", null, idx + 1), h("p", null, text)))
                ),
                h("h3", null, "Recommended Actions"),
                h("div", { className: "recommendation-list" },
                    (data?.actions || []).map(item => h("article", { className: "recommendation-card", key: item.title }, h("h4", null, item.title), h("p", null, item.text)))
                )
            ),
            h("section", { className: "card" },
                h("h3", null, "Top Opportunities"),
                (data?.top_opportunities || []).length ? h("div", { className: "opportunity-list" },
                    data.top_opportunities.map(item => h("article", { className: "opportunity-card", key: item.id },
                        h("div", { className: "opportunity-head" },
                            h("div", null, h("h4", null, item.title || "Untitled tender"), h("p", null, item.department || "Unknown Buyer")),
                            h("strong", null, item.score || 0)
                        ),
                        h("div", { className: "pipeline-meta" },
                            h("span", null, item.state || "No state"),
                            h("span", null, `Rs. ${money(item.value)}`),
                            h("span", null, item.deadline || "No deadline"),
                            h("span", null, item.status || "new")
                        ),
                        item.decision ? h("div", { className: `pipeline-decision ${item.decision}` }, item.decision === "no_bid" ? "No Bid" : item.decision === "bid" ? "Bid" : "Review") : null
                    ))
                ) : h("div", { className: "empty" }, data ? "No opportunities in this report window." : "Loading executive report...")
            )
        )
    );
}

function SellerReadinessPage() {
    const blank = {
        business_name: "", gem_seller_id: "", pan: "", aadhaar_linked: false, gstin: "", udyam_number: "",
        startup_india_number: "", odop_state: "", odop_product: "", bank_verified: false, address_verified: false,
        secondary_user_created: false, vendor_assessment_status: "not_started", caution_money_status: "pending",
        tds_certificate_status: "missing", notes: "",
    };
    const [profile, setProfile] = useState(blank);
    const [profileVerifications, setProfileVerifications] = useState({});
    const [verificationPrompt, setVerificationPrompt] = useState(null);
    const [documentVerification, setDocumentVerification] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [options, setOptions] = useState({ document: [], vendor_assessment: [], caution_money: [], tds_certificate: [] });
    const [message, setMessage] = useState("");
    async function load() {
        const data = await api("/api/seller/readiness");
        setProfile({ ...blank, ...(data.profile || {}) });
        setProfileVerifications(data.profile_verifications || {});
        setDocuments(data.documents || []);
        setSummary(data.summary || null);
        setOptions(data.status_options || options);
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
    async function saveProfile(e) {
        e.preventDefault();
        setMessage("Saving readiness profile...");
        const result = await api("/api/seller/readiness", { method: "POST", body: JSON.stringify(profile) });
        setProfile({ ...blank, ...(result.profile || {}) });
        setProfileVerifications(result.profile_verifications || {});
        setSummary(result.summary || summary);
        setMessage("Seller readiness profile saved.");
    }
    async function saveDocument(doc, patch) {
        const next = { ...doc, ...patch };
        setDocuments(documents.map(item => item.doc_key === doc.doc_key ? next : item));
        const result = await api(`/api/seller/readiness/documents/${doc.doc_key}`, {
            method: "POST",
            body: JSON.stringify({ status: next.status, expiry_date: next.expiry_date, notes: next.notes, evidence_reference: next.evidence_reference }),
        });
        setDocuments(documents.map(item => item.doc_key === doc.doc_key ? result.document : item));
        setSummary(result.summary || summary);
    }
    async function verifyDocument(doc) {
        const current = documentVerification?.doc_key === doc.doc_key ? documentVerification : doc;
        setMessage(`Verifying ${doc.label}...`);
        const result = await api(`/api/seller/readiness/documents/${doc.doc_key}/verify`, {
            method: "POST",
            body: JSON.stringify({
                evidence_reference: current.evidence_reference || "",
                notes: current.notes || doc.notes || "",
            }),
        });
        setDocuments(documents.map(item => item.doc_key === doc.doc_key ? result.document : item));
        setSummary(result.summary || summary);
        setDocumentVerification(null);
        setMessage(`${result.document?.label || "Document"} verified and readiness updated.`);
    }
    function currentFieldVerified(key) {
        const meta = profileVerifications[key] || {};
        const current = String(profile[key] || "").trim().toUpperCase();
        const saved = String(meta.value || "").trim().toUpperCase();
        return !!meta.verified && !!current && current === saved;
    }
    function openProfileVerification(key) {
        const meta = profileVerifications[key] || {};
        if (!String(profile[key] || "").trim()) {
            setMessage(`Enter ${meta.label || "the field"} before verification.`);
            return;
        }
        if (meta.url) {
            window.open(meta.url, "_blank", "noopener,noreferrer,width=1120,height=820");
            setMessage(`Opened ${meta.portal_label}. Verify the value there, then mark it verified here.`);
        }
        setVerificationPrompt({ key, ...meta });
    }
    async function markProfileVerified(key) {
        setMessage("Saving verification...");
        const result = await api("/api/seller/readiness/verify-field", {
            method: "POST",
            body: JSON.stringify({ field: key, value: profile[key] || "", method: "online_manual" }),
        });
        setProfile({ ...blank, ...(result.profile || {}) });
        setProfileVerifications(result.profile_verifications || {});
        setSummary(result.summary || summary);
        setVerificationPrompt(null);
        setMessage(`${result.profile_verifications?.[key]?.label || "Field"} verified.`);
    }
    const field = (key, label, placeholder = "") => h("label", { className: "field-block" }, h("span", null, label), h("input", { value: profile[key] || "", placeholder, onChange: e => setProfile({ ...profile, [key]: e.target.value }) }));
    const verifiableField = (key, label, placeholder = "") => {
        const meta = profileVerifications[key] || {};
        const hasValue = !!String(profile[key] || "").trim();
        const verified = currentFieldVerified(key);
        return h("label", { className: "field-block verifiable-field" },
            h("span", null, label),
            h("div", { className: "verify-field-row" },
                h("input", { value: profile[key] || "", placeholder, onChange: e => setProfile({ ...profile, [key]: e.target.value }) }),
                hasValue ? verified ?
                    h("span", { className: "verify-badge" }, "Verified") :
                    h("button", { type: "button", className: "small verify-btn", onClick: () => openProfileVerification(key) }, "Verify") : null
            ),
            hasValue && meta.portal_label ? h("small", null, verified ? `Verified on ${meta.portal_label}` : `Verify on ${meta.portal_label}`) : null
        );
    };
    const select = (key, label, values) => h("label", { className: "field-block" }, h("span", null, label), h("select", { value: profile[key] || "", onChange: e => setProfile({ ...profile, [key]: e.target.value }) }, (values || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")))));
    const toggle = (key, label) => h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!profile[key], onChange: e => setProfile({ ...profile, [key]: e.target.checked }) }), label);
    return h(React.Fragment, null,
        h("div", { className: "hero-panel readiness-hero" },
            h("div", null,
                h("h2", null, "Seller Profile & Document Readiness"),
                h("p", null, "Track GeM seller profile completion, compliance status, document readiness, vendor assessment, TDS, and caution money items.")
            ),
            h("div", { className: `readiness-score ${summary?.level || "incomplete"}` },
                h("span", null, "Health Score"),
                h("strong", null, summary?.health_score ?? 0)
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary readiness-summary" },
            [["Checks", `${summary?.completed_checks || 0}/${summary?.total_checks || 0}`], ["Documents", `${summary?.ready_documents || 0}/${summary?.total_documents || 0}`], ["Missing", summary?.missing_documents?.length || 0], ["Expired", summary?.expired_documents?.length || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "admin-grid readiness-grid" },
            h("section", { className: "card profile-card" },
                h("h3", null, "Seller Profile"),
                h("form", { className: "stack", onSubmit: saveProfile },
                    field("business_name", "Business name", "Registered seller business name"),
                    verifiableField("gem_seller_id", "GeM seller ID", "GeM seller registration ID"),
                    verifiableField("pan", "PAN", "ABCDE1234F"),
                    verifiableField("gstin", "GSTIN", "GST number or leave blank if exempt"),
                    verifiableField("udyam_number", "Udyam / MSME number"),
                    field("startup_india_number", "Startup India certificate number"),
                    h("div", { className: "value-row" }, field("odop_state", "ODOP state"), field("odop_product", "ODOP product")),
                    toggle("aadhaar_linked", " Aadhaar linked with registered mobile"),
                    toggle("bank_verified", " Bank account verified"),
                    toggle("address_verified", " Business address verified"),
                    toggle("secondary_user_created", " Secondary user created"),
                    select("vendor_assessment_status", "Vendor assessment", options.vendor_assessment),
                    select("caution_money_status", "Caution money", options.caution_money),
                    select("tds_certificate_status", "TDS certificate", options.tds_certificate),
                    verificationPrompt ? h("div", { className: "verify-panel seller-verify-panel" },
                        h("strong", null, verificationPrompt.label || "Verification"),
                        h("span", null, `Check ${profile[verificationPrompt.key] || "this value"} on ${verificationPrompt.portal_label || "the official portal"}, then confirm.`),
                        h("div", { className: "verify-panel-actions" },
                            verificationPrompt.url ? h("a", { href: verificationPrompt.url, target: "_blank" }, "Open portal") : null,
                            h("button", { type: "button", className: "small primary", onClick: () => markProfileVerified(verificationPrompt.key) }, "Mark Verified"),
                            h("button", { type: "button", className: "small", onClick: () => setVerificationPrompt(null) }, "Cancel")
                        )
                    ) : null,
                    h("label", { className: "field-block" }, h("span", null, "Notes"), h("textarea", { value: profile.notes || "", onChange: e => setProfile({ ...profile, notes: e.target.value }), placeholder: "Add internal readiness notes" })),
                    h("button", { className: "primary" }, "Save Readiness Profile")
                )
            ),
            h("section", { className: "card readiness-gaps" },
                h("h3", null, "Readiness Gaps"),
                (summary?.profile_gaps || []).length ? h("ul", { className: "log-list" }, summary.profile_gaps.map(gap => h("li", { key: gap }, gap))) : h("div", { className: "notice ok" }, "Profile readiness checks are complete."),
                h("h3", null, "Missing Documents"),
                (summary?.missing_documents || []).length ? h("ul", { className: "log-list" }, summary.missing_documents.map(doc => h("li", { key: doc.doc_key }, doc.label))) : h("div", { className: "notice ok" }, "No missing documents.")
            )
        ),
        h("section", { className: "card readiness-documents" },
            h("h3", null, "Document Tracker"),
            h("div", { className: "document-grid" }, documents.map(doc => h("article", { className: `document-card ${doc.status}`, key: doc.doc_key },
                h("div", { className: "document-card-head" },
                    h("strong", null, doc.label),
                    h("span", null, doc.verified ? "verified" : (doc.status || "missing").replaceAll("_", " "))
                ),
                h("select", { value: doc.status || "missing", onChange: e => saveDocument(doc, { status: e.target.value }) },
                    (options.document || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")))
                ),
                h("input", { type: "date", value: doc.expiry_date || "", onChange: e => saveDocument(doc, { expiry_date: e.target.value }) }),
                h("input", {
                    value: doc.evidence_reference || "",
                    placeholder: (doc.verification?.evidence_label || "Evidence / reference number"),
                    onBlur: e => saveDocument(doc, { evidence_reference: e.target.value }),
                    onChange: e => setDocuments(documents.map(item => item.doc_key === doc.doc_key ? { ...item, evidence_reference: e.target.value } : item))
                }),
                h("textarea", { value: doc.notes || "", placeholder: "Notes", onBlur: e => saveDocument(doc, { notes: e.target.value }), onChange: e => setDocuments(documents.map(item => item.doc_key === doc.doc_key ? { ...item, notes: e.target.value } : item)) }),
                doc.verified ? h("div", { className: "notice ok document-verified" }, `Verified ${doc.verified_at || ""}`) :
                    h("button", { type: "button", className: "small verify-btn", onClick: () => setDocumentVerification({ ...doc }) }, "Verify Document"),
                documentVerification?.doc_key === doc.doc_key ? h("div", { className: "verify-panel document-verify-panel" },
                    h("strong", null, `Verify ${doc.label}`),
                    h("span", null, `Complete the checks below. Open ${doc.verification?.portal_label || "the relevant portal"} only if you need to cross-check online.`),
                    h("ul", { className: "verify-checklist" }, (doc.verification?.checks || ["Document is readable", "Details match seller profile", "Validity and expiry are recorded"]).map(check => h("li", { key: check }, check))),
                    h("input", {
                        value: documentVerification.evidence_reference || "",
                        placeholder: doc.verification?.evidence_label || "Evidence / reference number",
                        onChange: e => setDocumentVerification({ ...documentVerification, evidence_reference: e.target.value })
                    }),
                    h("textarea", {
                        value: documentVerification.notes || "",
                        placeholder: "Verification remarks",
                        onChange: e => setDocumentVerification({ ...documentVerification, notes: e.target.value })
                    }),
                    h("div", { className: "verify-panel-actions" },
                        doc.verification?.url ? h("a", { href: doc.verification.url, target: "_blank", rel: "noopener noreferrer" }, "Open official portal") : null,
                        h("button", { type: "button", className: "small primary", onClick: () => verifyDocument(doc) }, "Mark Verified"),
                        h("button", { type: "button", className: "small", onClick: () => setDocumentVerification(null) }, "Cancel")
                    )
                ) : null
            )))
        )
    );
}

function SellerCataloguePage() {
    const blank = {
        item_type: "product", name: "", category: "", gem_category: "", brand: "", model: "", sku: "",
        oem_status: "not_required", reseller_status: "not_required", brand_approval_status: "not_started",
        image_status: "missing", mrp_document_status: "missing", specs_status: "missing", catalogue_status: "draft",
        stock_status: "unknown", stock_qty: 0, offering_expiry: "", repair_status: "none", clone_pair_source: "", notes: "",
    };
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [options, setOptions] = useState({ item_type: [], catalogue: [], document: [], stock: [], repair: [] });
    const [form, setForm] = useState(blank);
    const [message, setMessage] = useState("");
    async function load() {
        const data = await api("/api/seller/catalogue");
        setItems(data.items || []);
        setSummary(data.summary || null);
        setOptions(data.status_options || options);
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
    async function createItem(e) {
        e.preventDefault();
        setMessage("Saving catalogue item...");
        const result = await api("/api/seller/catalogue", { method: "POST", body: JSON.stringify(form) });
        setItems([result.item, ...items]);
        setSummary(result.summary || summary);
        setForm(blank);
        setMessage("Catalogue item added.");
    }
    async function updateItem(item, patch) {
        const next = { ...item, ...patch };
        setItems(items.map(row => row.id === item.id ? next : row));
        const result = await api(`/api/seller/catalogue/${item.id}`, { method: "POST", body: JSON.stringify(next) });
        setItems(items.map(row => row.id === item.id ? result.item : row));
        setSummary(result.summary || summary);
    }
    async function deleteItem(item) {
        const result = await api(`/api/seller/catalogue/${item.id}`, { method: "DELETE" });
        setItems(items.filter(row => row.id !== item.id));
        setSummary(result.summary || summary);
    }
    const selectOptions = (values) => (values || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")));
    const field = (key, label, placeholder = "") => h("label", { className: "field-block" }, h("span", null, label), h("input", { value: form[key] || "", placeholder, onChange: e => setForm({ ...form, [key]: e.target.value }) }));
    return h(React.Fragment, null,
        h("div", { className: "hero-panel catalogue-hero" },
            h("div", null,
                h("h2", null, "Catalogue Management Tracker"),
                h("p", null, "Track product and service catalogue readiness, brand/OEM approvals, images, MRP documents, stock, expiry, and repair workflows.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/readiness") }, "Readiness"),
                h("button", { onClick: () => navigate("/dashboard/high-priority") }, "Matching Tenders")
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary six catalogue-summary" },
            [["Total", summary?.total || 0], ["Active", summary?.active || 0], ["Ready", summary?.ready || 0], ["Draft", summary?.draft || 0], ["Repair", summary?.repair || 0], ["Stock Alerts", summary?.stock_alerts || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("section", { className: "card catalogue-form-card" },
            h("h3", null, "Add Catalogue Item"),
            h("form", { className: "catalogue-form", onSubmit: createItem },
                h("label", { className: "field-block" }, h("span", null, "Type"), h("select", { value: form.item_type, onChange: e => setForm({ ...form, item_type: e.target.value }) }, selectOptions(options.item_type || ["product","service"]))),
                field("name", "Name", "Product or service name"),
                field("gem_category", "GeM category", "Category used on GeM"),
                field("brand", "Brand"),
                field("model", "Model"),
                field("sku", "SKU"),
                h("button", { className: "primary" }, "Add Item")
            )
        ),
        h("section", { className: "catalogue-list" },
            items.length ? items.map(item => h("article", { className: `catalogue-card ${item.readiness?.level || "incomplete"}`, key: item.id },
                h("div", { className: "catalogue-card-head" },
                    h("div", null,
                        h("h3", null, item.name),
                        h("p", null, [item.item_type, item.gem_category || item.category, item.brand, item.model].filter(Boolean).join(" | "))
                    ),
                    h("div", { className: `readiness-score compact ${item.readiness?.level || "incomplete"}` }, h("span", null, "Ready"), h("strong", null, item.readiness?.score || 0))
                ),
                h("div", { className: "catalogue-fields" },
                    h("label", { className: "field-block" }, h("span", null, "Catalogue status"), h("select", { value: item.catalogue_status, onChange: e => updateItem(item, { catalogue_status: e.target.value }) }, selectOptions(options.catalogue))),
                    h("label", { className: "field-block" }, h("span", null, "Brand approval"), h("select", { value: item.brand_approval_status, onChange: e => updateItem(item, { brand_approval_status: e.target.value }) }, selectOptions(options.document))),
                    h("label", { className: "field-block" }, h("span", null, "OEM"), h("select", { value: item.oem_status, onChange: e => updateItem(item, { oem_status: e.target.value }) }, selectOptions(options.document))),
                    h("label", { className: "field-block" }, h("span", null, "Reseller"), h("select", { value: item.reseller_status, onChange: e => updateItem(item, { reseller_status: e.target.value }) }, selectOptions(options.document))),
                    h("label", { className: "field-block" }, h("span", null, "Images"), h("select", { value: item.image_status, onChange: e => updateItem(item, { image_status: e.target.value }) }, selectOptions(options.document))),
                    h("label", { className: "field-block" }, h("span", null, "MRP docs"), h("select", { value: item.mrp_document_status, onChange: e => updateItem(item, { mrp_document_status: e.target.value }) }, selectOptions(options.document))),
                    h("label", { className: "field-block" }, h("span", null, "Specs"), h("select", { value: item.specs_status, onChange: e => updateItem(item, { specs_status: e.target.value }) }, selectOptions(options.document))),
                    h("label", { className: "field-block" }, h("span", null, "Stock"), h("select", { value: item.stock_status, onChange: e => updateItem(item, { stock_status: e.target.value }) }, selectOptions(options.stock))),
                    h("label", { className: "field-block" }, h("span", null, "Qty"), h("input", { type: "number", min: 0, value: item.stock_qty || 0, onChange: e => updateItem(item, { stock_qty: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "Expiry"), h("input", { type: "date", value: item.offering_expiry || "", onChange: e => updateItem(item, { offering_expiry: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "Repair"), h("select", { value: item.repair_status, onChange: e => updateItem(item, { repair_status: e.target.value }) }, selectOptions(options.repair))),
                    h("label", { className: "field-block" }, h("span", null, "Clone / pair source"), h("input", { value: item.clone_pair_source || "", onBlur: e => updateItem(item, { clone_pair_source: e.target.value }), onChange: e => setItems(items.map(row => row.id === item.id ? { ...row, clone_pair_source: e.target.value } : row)) }))
                ),
                (item.readiness?.gaps || []).length ? h("div", { className: "tag-list catalogue-gaps" }, item.readiness.gaps.map(gap => h("span", { key: gap }, gap))) : h("div", { className: "notice ok" }, "Catalogue item is ready."),
                h("textarea", { value: item.notes || "", placeholder: "Notes for rejected/notified repair workflow, brand approval, reseller panel, or catalogue pairing", onBlur: e => updateItem(item, { notes: e.target.value }), onChange: e => setItems(items.map(row => row.id === item.id ? { ...row, notes: e.target.value } : row)) }),
                h("button", { className: "danger", onClick: () => deleteItem(item) }, "Remove")
            )) : h(EmptyAction, { title: "Add your first catalogue item", text: "Catalogue items let Tender AI check whether you are ready for each tender. Start with one product or service you sell on GeM.", action: "Add Catalogue Item", onAction: () => document.querySelector(".catalogue-form-card input")?.focus() })
        )
    );
}

function SellerBidsPage() {
    const blank = { tender_id: "", catalogue_item_id: "", workflow_type: "product_bid", participation_status: "planning", bid_mode: "standard", due_date: "", next_action: "" };
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [tenders, setTenders] = useState([]);
    const [catalogue, setCatalogue] = useState([]);
    const [options, setOptions] = useState({ workflow: [], participation: [], step: [], simple: [], ra: [], l1: [] });
    const [form, setForm] = useState(blank);
    const [message, setMessage] = useState("");
    async function load() {
        const data = await api("/api/seller/bids");
        setItems(data.items || []);
        setSummary(data.summary || null);
        setTenders(data.tenders || []);
        setCatalogue(data.catalogue || []);
        setOptions(data.status_options || options);
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
    async function createItem(e) {
        e.preventDefault();
        setMessage("Creating bid workflow...");
        const result = await api("/api/seller/bids", { method: "POST", body: JSON.stringify(form) });
        setItems([result.item, ...items]);
        setSummary(result.summary || summary);
        setForm(blank);
        setMessage("Bid/RA workflow created.");
    }
    async function updateItem(item, patch) {
        const next = { ...item, ...patch };
        setItems(items.map(row => row.id === item.id ? next : row));
        const result = await api(`/api/seller/bids/${item.id}`, { method: "POST", body: JSON.stringify(next) });
        setItems(items.map(row => row.id === item.id ? result.item : row));
        setSummary(result.summary || summary);
    }
    async function deleteItem(item) {
        const result = await api(`/api/seller/bids/${item.id}`, { method: "DELETE" });
        setItems(items.filter(row => row.id !== item.id));
        setSummary(result.summary || summary);
    }
    const opts = values => (values || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")));
    const tenderOptions = h("select", { value: form.tender_id, onChange: e => setForm({ ...form, tender_id: e.target.value }) },
        h("option", { value: "" }, "No tender selected"),
        tenders.map(t => h("option", { key: t.id, value: t.id }, `${t.title} | ${t.deadline || "No deadline"}`))
    );
    const catalogueOptions = value => h("select", { value: value || "", onChange: e => setForm({ ...form, catalogue_item_id: e.target.value }) },
        h("option", { value: "" }, "No catalogue item"),
        catalogue.map(item => h("option", { key: item.id, value: item.id }, `${item.name} (${item.item_type})`))
    );
    return h(React.Fragment, null,
        h("div", { className: "hero-panel bids-hero" },
            h("div", null,
                h("h2", null, "Bid/RA Participation Workflow"),
                h("p", null, "Track product bids, service bids, RA, BOQ, EMD/PBG, clarifications, rate contracts, push-button procurement, and global tender readiness.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/catalogue") }, "Catalogue"),
                h("button", { onClick: () => navigate("/dashboard/high-priority") }, "Tender Matches")
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary six bids-summary" },
            [["Total", summary?.total || 0], ["Planning", summary?.planning || 0], ["Ready", summary?.ready || 0], ["Submitted", summary?.submitted || 0], ["Due Soon", summary?.due_soon || 0], ["Overdue", summary?.overdue || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("section", { className: "card bids-form-card" },
            h("h3", null, "Create Workflow"),
            h("form", { className: "catalogue-form", onSubmit: createItem },
                h("label", { className: "field-block" }, h("span", null, "Tender"), tenderOptions),
                h("label", { className: "field-block" }, h("span", null, "Catalogue"), catalogueOptions(form.catalogue_item_id)),
                h("label", { className: "field-block" }, h("span", null, "Workflow"), h("select", { value: form.workflow_type, onChange: e => setForm({ ...form, workflow_type: e.target.value }) }, opts(options.workflow || ["product_bid","service_bid"]))),
                h("label", { className: "field-block" }, h("span", null, "Due date"), h("input", { type: "date", value: form.due_date, onChange: e => setForm({ ...form, due_date: e.target.value }) })),
                h("label", { className: "field-block" }, h("span", null, "Next action"), h("input", { value: form.next_action, onChange: e => setForm({ ...form, next_action: e.target.value }), placeholder: "Prepare BOQ, submit EMD..." })),
                h("button", { className: "primary" }, "Create")
            )
        ),
        h("section", { className: "bids-list" },
            items.length ? items.map(item => h("article", { className: `catalogue-card bid-card ${item.readiness?.level || "incomplete"}`, key: item.id },
                h("div", { className: "catalogue-card-head" },
                    h("div", null,
                        h("h3", null, item.tender?.title || "Untitled workflow"),
                        h("p", null, [item.workflow_type?.replaceAll("_", " "), item.catalogue_item_name, item.tender?.deadline ? `Due ${item.tender.deadline}` : ""].filter(Boolean).join(" | "))
                    ),
                    h("div", { className: `readiness-score compact ${item.readiness?.level || "incomplete"}` }, h("span", null, "Ready"), h("strong", null, item.readiness?.score || 0))
                ),
                h("div", { className: "catalogue-fields" },
                    h("label", { className: "field-block" }, h("span", null, "Status"), h("select", { value: item.participation_status, onChange: e => updateItem(item, { participation_status: e.target.value }) }, opts(options.participation))),
                    h("label", { className: "field-block" }, h("span", null, "Workflow"), h("select", { value: item.workflow_type, onChange: e => updateItem(item, { workflow_type: e.target.value }) }, opts(options.workflow))),
                    h("label", { className: "field-block" }, h("span", null, "Eligibility"), h("select", { value: item.eligibility_status, onChange: e => updateItem(item, { eligibility_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Documents"), h("select", { value: item.document_status, onChange: e => updateItem(item, { document_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Price"), h("select", { value: item.price_status, onChange: e => updateItem(item, { price_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "BOQ"), h("select", { value: item.boq_status, onChange: e => updateItem(item, { boq_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!item.emd_required, onChange: e => updateItem(item, { emd_required: e.target.checked }) }), " EMD required"),
                    h("label", { className: "field-block" }, h("span", null, "EMD status"), h("select", { value: item.emd_status, onChange: e => updateItem(item, { emd_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "EMD amount"), h("input", { type: "number", min: 0, value: item.emd_amount || "", onChange: e => updateItem(item, { emd_amount: e.target.value }) })),
                    h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!item.pbg_required, onChange: e => updateItem(item, { pbg_required: e.target.checked }) }), " PBG required"),
                    h("label", { className: "field-block" }, h("span", null, "PBG status"), h("select", { value: item.pbg_status, onChange: e => updateItem(item, { pbg_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "RA"), h("select", { value: item.ra_status, onChange: e => updateItem(item, { ra_status: e.target.value }) }, opts(options.ra))),
                    h("label", { className: "field-block" }, h("span", null, "Clarification"), h("select", { value: item.clarification_status, onChange: e => updateItem(item, { clarification_status: e.target.value }) }, opts(options.simple))),
                    h("label", { className: "field-block" }, h("span", null, "Representation"), h("select", { value: item.representation_status, onChange: e => updateItem(item, { representation_status: e.target.value }) }, opts(options.simple))),
                    h("label", { className: "field-block" }, h("span", null, "Custom catalogue"), h("select", { value: item.custom_catalogue_status, onChange: e => updateItem(item, { custom_catalogue_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Rate contract"), h("select", { value: item.rate_contract_status, onChange: e => updateItem(item, { rate_contract_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Global tender"), h("select", { value: item.global_tender_status, onChange: e => updateItem(item, { global_tender_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Push button"), h("select", { value: item.push_button_status, onChange: e => updateItem(item, { push_button_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "L1 negotiation"), h("select", { value: item.l1_negotiation_status, onChange: e => updateItem(item, { l1_negotiation_status: e.target.value }) }, opts(options.l1))),
                    h("label", { className: "field-block" }, h("span", null, "Due date"), h("input", { type: "date", value: item.due_date || "", onChange: e => updateItem(item, { due_date: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "Next action"), h("input", { value: item.next_action || "", onBlur: e => updateItem(item, { next_action: e.target.value }), onChange: e => setItems(items.map(row => row.id === item.id ? { ...row, next_action: e.target.value } : row)) }))
                ),
                (item.readiness?.gaps || []).length ? h("div", { className: "tag-list catalogue-gaps" }, item.readiness.gaps.map(gap => h("span", { key: gap }, gap))) : h("div", { className: "notice ok" }, "Bid workflow is ready."),
                h("textarea", { value: item.notes || "", placeholder: "Notes for bid/RA participation, BOQ, EMD/PBG, clarification, representation, L1 negotiation, or global tender requirements", onBlur: e => updateItem(item, { notes: e.target.value }), onChange: e => setItems(items.map(row => row.id === item.id ? { ...row, notes: e.target.value } : row)) }),
                h("button", { className: "danger", onClick: () => deleteItem(item) }, "Remove")
            )) : h(EmptyAction, { title: "No Bid/RA workflow yet", text: "Create a workflow when a tender is worth pursuing. Track eligibility, documents, EMD/PBG, BOQ, RA, clarification, representation, and L1 negotiation.", action: "Create Workflow", onAction: () => document.querySelector(".bids-form-card select")?.focus() })
        )
    );
}

function SellerOpportunitiesPage() {
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [readiness, setReadiness] = useState(null);
    const [catalogueSummary, setCatalogueSummary] = useState(null);
    const [message, setMessage] = useState("");
    const [creatingId, setCreatingId] = useState(null);
    async function load() {
        const data = await api("/api/seller/opportunities");
        setItems(data.items || []);
        setSummary(data.summary || null);
        setReadiness(data.seller_readiness || null);
        setCatalogueSummary(data.catalogue_summary || null);
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
    async function createBid(item) {
        setCreatingId(item.tender.id);
        setMessage("Creating bid workflow...");
        try {
            const result = await api(`/api/seller/opportunities/${item.tender.id}/create-bid`, {
                method: "POST",
                body: JSON.stringify({ catalogue_item_id: item.matched_catalogue?.id || "" }),
            });
            setMessage(result.created ? "Bid/RA workflow created." : "Bid/RA workflow already exists.");
            await load();
        } catch (err) {
            setMessage(err.message || "Could not create bid workflow.");
        } finally {
            setCreatingId(null);
        }
    }
    const recLabel = value => value === "no_bid" ? "No bid" : value === "bid" ? "Bid" : "Review";
    return h(React.Fragment, null,
        h("div", { className: "hero-panel opportunity-hero" },
            h("div", null,
                h("h2", null, "Seller Opportunity Matching"),
                h("p", null, "Match saved tenders with seller catalogue readiness, seller documents, deadline pressure, and existing bid decisions.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/catalogue") }, "Catalogue"),
                h("button", { onClick: () => navigate("/dashboard/seller/bids") }, "Bid/RA")
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary six opportunity-summary" },
            [["Total", summary?.total || 0], ["Bid", summary?.bid || 0], ["Review", summary?.review || 0], ["No Bid", summary?.no_bid || 0], ["High Match", summary?.high_match || 0], ["In Workflow", summary?.already_in_workflow || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "admin-grid opportunity-grid" },
            h("section", { className: "card" },
                h("h3", null, "Readiness Inputs"),
                h("div", { className: "alert-status-grid" },
                    h("div", null, h("span", null, "Seller health"), h("strong", null, readiness?.health_score ?? 0)),
                    h("div", null, h("span", null, "Catalogue ready"), h("strong", null, catalogueSummary?.ready ?? 0)),
                    h("div", null, h("span", null, "Catalogue total"), h("strong", null, catalogueSummary?.total ?? 0)),
                    h("div", null, h("span", null, "Missing docs"), h("strong", null, readiness?.missing_documents?.length ?? 0))
                ),
                h("div", { className: "notice" }, "Improve catalogue readiness and seller documents to lift opportunity scores.")
            ),
            h("section", { className: "card" },
                h("h3", null, "Next Actions"),
                h("ul", { className: "rule-list" },
                    h("li", null, h("strong", null, "No match"), h("span", null, "Add catalogue")),
                    h("li", null, h("strong", null, "Low readiness"), h("span", null, "Fix gaps")),
                    h("li", null, h("strong", null, "Bid match"), h("span", null, "Create workflow"))
                )
            )
        ),
        h("section", { className: "opportunity-list seller-opportunity-list" },
            items.length ? items.map(item => h("article", { className: `opportunity-card seller-opportunity-card ${item.recommendation}`, key: item.tender.id },
                h("div", { className: "opportunity-head" },
                    h("div", null,
                        h("h4", null, item.tender.title || "Untitled tender"),
                        h("p", null, [item.tender.department || "Unknown buyer", item.tender.state, item.tender.deadline ? `Deadline ${item.tender.deadline}` : "No deadline"].filter(Boolean).join(" | "))
                    ),
                    h("div", { className: `readiness-score compact ${scoreClass(item.opportunity_score)}` }, h("span", null, recLabel(item.recommendation)), h("strong", null, item.opportunity_score || 0))
                ),
                h("div", { className: "pipeline-meta" },
                    h("span", null, `Tender ${Math.round(item.tender.relevance_score || 0)}`),
                    h("span", null, `Match ${item.match_score || 0}`),
                    h("span", null, `Catalogue ${item.catalogue_readiness_score || 0}`),
                    h("span", null, `Seller ${item.seller_readiness_score || 0}`),
                    h("span", null, `Rs. ${money(item.tender.estimated_value || 0)}`)
                ),
                item.matched_catalogue ? h("div", { className: "notice ok" }, `Matched catalogue: ${item.matched_catalogue.name}`) : h("div", { className: "notice" }, "No strong catalogue match yet."),
                (item.reasons || []).length ? h("div", { className: "tag-list opportunity-tags" }, item.reasons.map(reason => h("span", { key: reason }, reason))) : null,
                (item.blockers || []).length ? h("div", { className: "tag-list catalogue-gaps" }, item.blockers.map(blocker => h("span", { key: blocker }, blocker))) : null,
                h("div", { className: "hero-actions opportunity-actions" },
                    h("button", { className: "primary", disabled: !!item.bid_workflow || creatingId === item.tender.id, onClick: () => createBid(item) }, item.bid_workflow ? "Workflow Exists" : creatingId === item.tender.id ? "Creating..." : "Create Bid Workflow"),
                    h("button", { onClick: () => navigate("/dashboard/tenders") }, "Open Tenders")
                )
            )) : h(EmptyAction, { title: "No opportunities to match yet", text: "Run a tender scrape and add catalogue items first. Opportunity matching needs tenders, seller readiness, and catalogue readiness.", action: "Open All Tenders", onAction: () => navigate("/dashboard/tenders") })
        )
    );
}

function SellerOrdersPage() {
    const blank = { tender_id: "", bid_participation_id: "", order_number: "", order_type: "product", buyer_name: "", order_value: "", delivery_due_date: "", payment_due_date: "", next_action: "" };
    const [items, setItems] = useState([]);
    const [summary, setSummary] = useState(null);
    const [bids, setBids] = useState([]);
    const [tenders, setTenders] = useState([]);
    const [options, setOptions] = useState({ order_type: [], order: [], step: [], payment: [], incident: [], treds: [], l1: [] });
    const [form, setForm] = useState(blank);
    const [message, setMessage] = useState("");
    async function load() {
        const data = await api("/api/seller/orders");
        setItems(data.items || []);
        setSummary(data.summary || null);
        setBids(data.bids || []);
        setTenders(data.tenders || []);
        setOptions(data.status_options || options);
    }
    useEffect(() => { load().catch(err => setMessage(err.message)); }, []);
    async function createItem(e) {
        e.preventDefault();
        setMessage("Creating order tracker...");
        const result = await api("/api/seller/orders", { method: "POST", body: JSON.stringify(form) });
        setItems([result.item, ...items]);
        setSummary(result.summary || summary);
        setForm(blank);
        setMessage("Order fulfillment tracker created.");
    }
    async function updateItem(item, patch) {
        const next = { ...item, ...patch };
        setItems(items.map(row => row.id === item.id ? next : row));
        const result = await api(`/api/seller/orders/${item.id}`, { method: "POST", body: JSON.stringify(next) });
        setItems(items.map(row => row.id === item.id ? result.item : row));
        setSummary(result.summary || summary);
    }
    async function deleteItem(item) {
        const result = await api(`/api/seller/orders/${item.id}`, { method: "DELETE" });
        setItems(items.filter(row => row.id !== item.id));
        setSummary(result.summary || summary);
    }
    const opts = values => (values || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")));
    return h(React.Fragment, null,
        h("div", { className: "hero-panel orders-hero" },
            h("div", null,
                h("h2", null, "Order Fulfillment Tracker"),
                h("p", null, "Track delivery, invoice generation, supplementary invoices, service billing, DP extension, incidents, TReDS, L1 negotiation, and payments.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/bids") }, "Bid/RA"),
                h("button", { onClick: () => navigate("/dashboard/tracking") }, "Tracking")
            )
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("div", { className: "summary six orders-summary" },
            [["Total", summary?.total || 0], ["Fulfillment", summary?.in_fulfillment || 0], ["Delivered", summary?.delivered || 0], ["Completed", summary?.completed || 0], ["Delivery Due", summary?.due_delivery || 0], ["Incidents", summary?.incidents || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("section", { className: "card orders-form-card" },
            h("h3", null, "Create Order Tracker"),
            h("form", { className: "catalogue-form", onSubmit: createItem },
                h("label", { className: "field-block" }, h("span", null, "Bid workflow"), h("select", { value: form.bid_participation_id, onChange: e => setForm({ ...form, bid_participation_id: e.target.value }) },
                    h("option", { value: "" }, "No bid workflow"),
                    bids.map(item => h("option", { key: item.id, value: item.id }, `${item.label || "Bid workflow"} | ${item.status}`))
                )),
                h("label", { className: "field-block" }, h("span", null, "Tender"), h("select", { value: form.tender_id, onChange: e => setForm({ ...form, tender_id: e.target.value }) },
                    h("option", { value: "" }, "No tender selected"),
                    tenders.map(t => h("option", { key: t.id, value: t.id }, t.title))
                )),
                h("label", { className: "field-block" }, h("span", null, "Order no."), h("input", { value: form.order_number, onChange: e => setForm({ ...form, order_number: e.target.value }), placeholder: "GeM order number" })),
                h("label", { className: "field-block" }, h("span", null, "Type"), h("select", { value: form.order_type, onChange: e => setForm({ ...form, order_type: e.target.value }) }, opts(options.order_type || ["product","service"]))),
                h("label", { className: "field-block" }, h("span", null, "Buyer"), h("input", { value: form.buyer_name, onChange: e => setForm({ ...form, buyer_name: e.target.value }), placeholder: "Buyer/department" })),
                h("label", { className: "field-block" }, h("span", null, "Value"), h("input", { type: "number", min: 0, value: form.order_value, onChange: e => setForm({ ...form, order_value: e.target.value }) })),
                h("label", { className: "field-block" }, h("span", null, "Delivery due"), h("input", { type: "date", value: form.delivery_due_date, onChange: e => setForm({ ...form, delivery_due_date: e.target.value }) })),
                h("label", { className: "field-block" }, h("span", null, "Payment due"), h("input", { type: "date", value: form.payment_due_date, onChange: e => setForm({ ...form, payment_due_date: e.target.value }) })),
                h("button", { className: "primary" }, "Create")
            )
        ),
        h("section", { className: "orders-list" },
            items.length ? items.map(item => h("article", { className: `catalogue-card order-card ${item.readiness?.level || "blocked"}`, key: item.id },
                h("div", { className: "catalogue-card-head" },
                    h("div", null,
                        h("h3", null, item.order_number || item.tender?.title || "Order tracker"),
                        h("p", null, [item.order_type, item.buyer_name || item.tender?.department, item.order_value ? `Rs. ${money(item.order_value)}` : ""].filter(Boolean).join(" | "))
                    ),
                    h("div", { className: `readiness-score compact ${item.readiness?.level || "blocked"}` }, h("span", null, "Health"), h("strong", null, item.readiness?.score || 0))
                ),
                h("div", { className: "catalogue-fields" },
                    h("label", { className: "field-block" }, h("span", null, "Order status"), h("select", { value: item.order_status, onChange: e => updateItem(item, { order_status: e.target.value }) }, opts(options.order))),
                    h("label", { className: "field-block" }, h("span", null, "Delivery"), h("select", { value: item.delivery_status, onChange: e => updateItem(item, { delivery_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Invoice"), h("select", { value: item.invoice_status, onChange: e => updateItem(item, { invoice_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Invoice no."), h("input", { value: item.invoice_number || "", onBlur: e => updateItem(item, { invoice_number: e.target.value }), onChange: e => setItems(items.map(row => row.id === item.id ? { ...row, invoice_number: e.target.value } : row)) })),
                    h("label", { className: "field-block" }, h("span", null, "Invoice amount"), h("input", { type: "number", min: 0, value: item.invoice_amount || "", onChange: e => updateItem(item, { invoice_amount: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "Supplementary invoice"), h("select", { value: item.supplementary_invoice_status, onChange: e => updateItem(item, { supplementary_invoice_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Service billing"), h("select", { value: item.service_billing_status, onChange: e => updateItem(item, { service_billing_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "DP extension"), h("select", { value: item.dp_extension_status, onChange: e => updateItem(item, { dp_extension_status: e.target.value }) }, opts(options.step))),
                    h("label", { className: "field-block" }, h("span", null, "Payment"), h("select", { value: item.payment_status, onChange: e => updateItem(item, { payment_status: e.target.value }) }, opts(options.payment))),
                    h("label", { className: "field-block" }, h("span", null, "L1 negotiation"), h("select", { value: item.l1_negotiation_status, onChange: e => updateItem(item, { l1_negotiation_status: e.target.value }) }, opts(options.l1))),
                    h("label", { className: "field-block" }, h("span", null, "Incident"), h("select", { value: item.incident_status, onChange: e => updateItem(item, { incident_status: e.target.value }) }, opts(options.incident))),
                    h("label", { className: "field-block" }, h("span", null, "TReDS"), h("select", { value: item.treds_status, onChange: e => updateItem(item, { treds_status: e.target.value }) }, opts(options.treds))),
                    h("label", { className: "field-block" }, h("span", null, "Delivery due"), h("input", { type: "date", value: item.delivery_due_date || "", onChange: e => updateItem(item, { delivery_due_date: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "Payment due"), h("input", { type: "date", value: item.payment_due_date || "", onChange: e => updateItem(item, { payment_due_date: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "Next action"), h("input", { value: item.next_action || "", onBlur: e => updateItem(item, { next_action: e.target.value }), onChange: e => setItems(items.map(row => row.id === item.id ? { ...row, next_action: e.target.value } : row)) }))
                ),
                (item.readiness?.gaps || []).length ? h("div", { className: "tag-list catalogue-gaps" }, item.readiness.gaps.map(gap => h("span", { key: gap }, gap))) : h("div", { className: "notice ok" }, "Order fulfillment is on track."),
                h("textarea", { value: item.notes || "", placeholder: "Notes for invoice generation, supplementary invoice, service billing, DP extension, incident, TReDS, or payment follow-up", onBlur: e => updateItem(item, { notes: e.target.value }), onChange: e => setItems(items.map(row => row.id === item.id ? { ...row, notes: e.target.value } : row)) }),
                h("button", { className: "danger", onClick: () => deleteItem(item) }, "Remove")
            )) : h(EmptyAction, { title: "No order tracker yet", text: "Create an order tracker after award or contract receipt. Track delivery, CRAC, invoice, payment, incidents, and next action.", action: "Create Order Tracker", onAction: () => document.querySelector(".orders-form-card input")?.focus() })
        )
    );
}

function AdminPage() {
    const [summary, setSummary] = useState(null);
    const [logs, setLogs] = useState([]);
    const [message, setMessage] = useState("");
    async function load() { setSummary(await api("/api/dashboard/summary")); setLogs((await api("/api/admin/logs")).items || []); }
    useEffect(() => { load(); }, []);
    async function scrape() {
        setMessage("Manual scrape running...");
        const r = await api("/api/scrape-now", { method: "POST" });
        let nextMessage = scrapeMessage(r);
        if (!(r.inserted || 0)) {
            try {
                const diagnostics = await api("/api/scrape-diagnostics");
                nextMessage = `${nextMessage} ${scrapeDiagnosticsMessage(diagnostics)}`;
            } catch {}
        }
        setMessage(nextMessage);
        await load();
    }
    async function rescore() { setMessage("Rescoring..."); const r = await api("/api/rescore", { method: "POST" }); setMessage(`Rescored ${r.rescored || 0} tenders.`); await load(); }
    return h(React.Fragment, null,
        h(Summary, { summary }),
        h("div", { className: "admin-grid" },
            h("div", { className: "card" }, h("h3", null, "Automation"), h("button", { className: "primary", onClick: rescore }, "Trigger AI Rescoring"), h("button", { className: "primary", onClick: scrape }, "Trigger Manual Scrape"), message ? h("p", { className: "status" }, message) : null),
            h("div", { className: "card" }, h("h3", null, "Recent Scraping Logs"), logs.length ? h("ul", { className: "log-list" }, logs.map(log => h("li", { key: log.id }, h("strong", null, log.source), " ", h("span", { className: log.status === "success" ? "green" : "red" }, log.status), h("div", { className: "desc" }, log.message || ""), h("div", { className: "desc" }, log.created_at)))) : h("p", { className: "desc" }, "No logs yet."))
        )
    );
}

function KeywordsPage() {
    const [data, setData] = useState({ items: [], profiles: [], performance: [] });
    const [form, setForm] = useState({ keyword: "", profile: "Custom", synonyms: "" });
    async function load() { setData(await api("/api/admin/keywords")); }
    useEffect(() => { load(); }, []);
    async function add(e) { e.preventDefault(); await api("/api/admin/keywords", { method: "POST", body: JSON.stringify(form) }); setForm({ keyword: "", profile: "Custom", synonyms: "" }); await load(); }
    return h(React.Fragment, null,
        h("div", { className: "card" }, h("h3", null, "GeM Search Keywords"), h("form", { className: "keyword-form", onSubmit: add },
            h("input", { value: form.keyword, onChange: e => setForm({ ...form, keyword: e.target.value }), placeholder: "Keyword" }),
            h("select", { value: form.profile, onChange: e => setForm({ ...form, profile: e.target.value }) }, h("option", { value: "Custom" }, "Custom"), data.profiles.map(p => h("option", { key: p, value: p }, p))),
            h("input", { value: form.synonyms, onChange: e => setForm({ ...form, synonyms: e.target.value }), placeholder: "Synonyms, comma separated" }),
            h("button", { className: "primary" }, "Add")
        ), h("div", { className: "pill-list" }, data.items.map(item => h("span", { className: `pill ${item.is_active ? "" : "off"}`, key: item.id }, item.keyword, " ", h("small", null, item.profile), h("button", { onClick: async () => { await api(`/api/admin/keywords/${item.id}/toggle`, { method: "POST" }); await load(); } }, item.is_active ? "On" : "Off"), h("button", { onClick: async () => { await api(`/api/admin/keywords/${item.id}`, { method: "DELETE" }); await load(); } }, "Remove"))))),
        h(SimpleTable, { title: "Keyword Performance", headers: ["Keyword", "Fetched", "Inserted", "Duplicates", "High Priority", "Avg Score"], rows: data.performance.map(r => [r.keyword, r.fetched_count, r.inserted_count, r.duplicate_count, r.high_priority_count, Number(r.average_score || 0).toFixed(1)]) })
    );
}

function ScoringPage() {
    const [data, setData] = useState({ items: [], profiles: [] });
    const [form, setForm] = useState({ keyword: "", weight: 10, match_type: "positive", profile: "Custom" });
    async function load() { setData(await api("/api/admin/scoring")); }
    useEffect(() => { load(); }, []);
    async function add(e) { e.preventDefault(); await api("/api/admin/scoring-criteria", { method: "POST", body: JSON.stringify(form) }); setForm({ keyword: "", weight: 10, match_type: "positive", profile: "Custom" }); await load(); }
    return h(React.Fragment, null,
        h("div", { className: "card" }, h("h3", null, "Scoring Criteria"), h("form", { className: "keyword-form", onSubmit: add },
            h("input", { value: form.keyword, onChange: e => setForm({ ...form, keyword: e.target.value }), placeholder: "Keyword" }),
            h("input", { type: "number", value: form.weight, onChange: e => setForm({ ...form, weight: e.target.value }), min: 0, max: 60 }),
            h("select", { value: form.match_type, onChange: e => setForm({ ...form, match_type: e.target.value }) }, h("option", { value: "positive" }, "Positive"), h("option", { value: "negative" }, "Negative")),
            h("select", { value: form.profile, onChange: e => setForm({ ...form, profile: e.target.value }) }, h("option", { value: "Custom" }, "Custom"), h("option", { value: "Negative" }, "Negative"), data.profiles.map(p => h("option", { key: p, value: p }, p))),
            h("button", { className: "primary" }, "Save")
        ), h("button", { onClick: async () => { await api("/api/admin/scoring-criteria/install-defaults", { method: "POST" }); await load(); } }, "Install Defaults")),
        h(SimpleTable, { title: "Active Criteria", headers: ["Keyword", "Weight", "Type", "Profile", "Active", "Actions"], rows: data.items.map(r => [r.keyword, r.weight, r.match_type, r.profile, r.is_active ? "Yes" : "No", h("span", null, h("button", { onClick: async () => { await api(`/api/admin/scoring-criteria/${r.id}/toggle`, { method: "POST" }); await load(); } }, "Toggle"), h("button", { onClick: async () => { await api(`/api/admin/scoring-criteria/${r.id}`, { method: "DELETE" }); await load(); } }, "Delete"))]) })
    );
}

function GemAlertsPage() {
    const [settings, setSettings] = useState(null);
    const [message, setMessage] = useState("");
    const [running, setRunning] = useState(false);
    async function load() { setSettings(await api("/api/seller/gem-alerts")); }
    useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
    if (!settings) return h("div", { className: "empty" }, "Loading GeM alerts...");
    const multiSelect = (field, label, items, placeholder) => {
        const selected = settings[field] || [];
        const sourceOptions = Array.from(new Set(items || [])).filter(Boolean);
        const displaySelected = selected.map(value => sourceOptions.find(option => String(option).toLowerCase() === String(value).toLowerCase()) || value);
        const options = Array.from(new Map([...sourceOptions, ...displaySelected].map(value => [String(value).toLowerCase(), value])).values());
        return h(AutomationMultiSelect, {
            label,
            hint: "Select one or more",
            options,
            selected: displaySelected,
            placeholder,
            onChange: values => setSettings({ ...settings, [field]: values }),
        });
    };
    async function save(e) {
        e.preventDefault();
        setMessage("Saving GeM alert settings...");
        const result = await api("/api/seller/gem-alerts", { method: "POST", body: JSON.stringify(settings) });
        setSettings({ ...settings, ...result });
        setMessage("GeM alerts saved.");
    }
    async function runNow() {
        setRunning(true);
        setMessage("Running GeM alert check...");
        try {
            const result = await api("/api/seller/gem-alerts/run-now", { method: "POST" });
            setMessage(`GeM alert check finished. Inserted ${result.inserted || 0}, scored ${result.scored || 0}, Telegram ${result.alerts_sent || 0}, Email ${result.emails_sent || 0}.`);
            await load();
        } catch (err) {
            setMessage(err.message || "GeM alert check failed.");
        } finally {
            setRunning(false);
        }
    }
    return h("div", { className: "admin-grid gem-alert-grid" },
        h("section", { className: "card gem-alert-card" },
            h("h3", null, "GeM Website Alerts"),
            h("p", { className: "desc" }, "Receive email alerts for newly published GeM bids matching your categories, departments, states, and cities. Scheduled checks run daily at 6 AM and 6 PM."),
            message ? h("p", { className: "status" }, message) : null,
            h("form", { className: "stack", onSubmit: save },
                h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!settings.enabled, onChange: e => setSettings({ ...settings, enabled: e.target.checked }) }), " Enable GeM alert schedule"),
                h("div", { className: "gem-alert-filter-grid" },
                    multiSelect("categories", "GeM categories", settings.options?.categories || [], "Choose product or service categories"),
                    multiSelect("departments", "Departments / authorities", settings.options?.departments || [], "Choose GeM departments"),
                    multiSelect("states", "States", settings.options?.states || [], "Choose one or more states"),
                    multiSelect("cities", "Cities / districts", settings.options?.cities || [], "Choose cities or districts")
                ),
                h("div", { className: "schedule-pills" }, (settings.schedules || ["06:00","18:00"]).map(slot => h("span", { key: slot }, slot === "06:00" ? "6:00 AM" : "6:00 PM"))),
                h("button", { className: "primary" }, "Save Alert Settings"),
                h("button", { type: "button", disabled: running, onClick: runNow }, running ? "Running..." : "Run Alert Check Now")
            )
        ),
        h("section", { className: "card" },
            h("h3", null, "Alert Status"),
            h("div", { className: "gem-alert-scope" },
                h("span", null, "Current alert scope"),
                h("strong", null, `${(settings.categories || []).length} categories · ${(settings.departments || []).length} departments`),
                h("p", null, `${(settings.states || []).length} states · ${(settings.cities || []).length} cities / districts`)
            ),
            h("div", { className: "alert-status-grid" },
                h("div", null, h("span", null, "Telegram"), h("strong", null, settings.telegram_enabled ? "Enabled" : "Off")),
                h("div", null, h("span", null, "Email"), h("strong", null, settings.email_enabled ? "Enabled" : "Off")),
                h("div", null, h("span", null, "Last 6 AM"), h("strong", null, settings.last_6am || "Not run")),
                h("div", null, h("span", null, "Last 6 PM"), h("strong", null, settings.last_6pm || "Not run"))
            ),
            h("div", { className: "notice" }, "Only newly published matching bids are emailed. Email must remain enabled in Profile; previously stored bids are not resent.")
        )
    );
}

function AutomationMultiSelect({ label, hint, options, selected, onChange, placeholder }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const values = Array.from(new Set([...(options || []), ...(selected || [])])).filter(Boolean);
    const visible = values.filter(value => String(value).toLowerCase().includes(search.trim().toLowerCase()));
    const toggle = value => onChange((selected || []).includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
    return h("div", { className: "automation-multiselect" },
        h("div", { className: "automation-field-head" }, h("div", null, h("strong", null, label), hint ? h("small", null, hint) : null), h("span", null, `${(selected || []).length} selected`)),
        h("button", { type: "button", className: "automation-select-trigger", onClick: () => setOpen(!open), "aria-expanded": open },
            h("span", null, selected?.length ? selected.slice(0, 2).join(", ") + (selected.length > 2 ? ` +${selected.length - 2}` : "") : placeholder),
            h("b", null, open ? "▲" : "▼")
        ),
        open ? h("div", { className: "automation-select-panel" },
            h("input", { value: search, onChange: e => setSearch(e.target.value), placeholder: `Search ${label.toLowerCase()}...`, autoFocus: true }),
            h("div", { className: "automation-select-actions" },
                h("button", { type: "button", onClick: () => onChange(Array.from(new Set([...(selected || []), ...visible]))) }, "Select shown"),
                h("button", { type: "button", onClick: () => onChange([]) }, "Clear all")
            ),
            h("div", { className: "automation-option-list" }, visible.length ? visible.map(value => h("label", { key: value, className: (selected || []).includes(value) ? "selected" : "" },
                h("input", { type: "checkbox", checked: (selected || []).includes(value), onChange: () => toggle(value) }), h("span", null, value)
            )) : h("p", { className: "desc" }, "No matching options"))
        ) : null,
        h("div", { className: "automation-selected-tags" }, (selected || []).map(value => h("button", { key: value, type: "button", onClick: () => toggle(value), title: `Remove ${value}` }, value, h("span", null, "×"))))
    );
}

function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [digestMessage, setDigestMessage] = useState("");
    const [filterMessage, setFilterMessage] = useState("");
    const [refreshingAuthorities, setRefreshingAuthorities] = useState(false);
    const [customAuthority, setCustomAuthority] = useState("");
    const blankProfile = { id: "", name: "", enabled: true, keywords: [], authorities: [], states: [], cities: [], emd_amount: "", only_high_priority: false };
    const [profileForm, setProfileForm] = useState(blankProfile);
    const [profileMessage, setProfileMessage] = useState("");
    async function load() { setSettings(await api("/api/admin/settings")); }
    useEffect(() => { load(); }, []);
    if (!settings) return h("div", { className: "empty" }, "Loading settings...");
    async function saveHigh(value) { await api("/api/admin/settings/only-high-priority", { method: "POST", body: JSON.stringify({ enabled: value }) }); await load(); }
    async function saveLocation(e) { e.preventDefault(); await api("/api/admin/settings/location", { method: "POST", body: JSON.stringify({ states: settings.scrape_states, city: settings.scrape_city, authorities: settings.scrape_authorities }) }); await load(); }
    async function refreshAuthorities() {
        setRefreshingAuthorities(true); setFilterMessage("Reading current authority names from GeM...");
        try {
            const result = await api("/api/admin/settings/authorities/refresh", { method: "POST" });
            setSettings({ ...settings, authority_options: result.authorities || [] }); setFilterMessage(result.message);
        } catch (err) { setFilterMessage(err.message); }
        finally { setRefreshingAuthorities(false); }
    }
    function addCustomAuthority() {
        const value = customAuthority.trim().replace(/\s+/g, " ");
        if (!value) { setFilterMessage("Enter an authority or department name first."); return; }
        const options = settings.authority_options || [];
        const selected = profileForm.authorities || [];
        const existing = [...options, ...selected].find(item => String(item).toLowerCase() === value.toLowerCase());
        const authority = existing || value;
        setSettings({ ...settings, authority_options: Array.from(new Set([...options, authority])).sort((a, b) => a.localeCompare(b)) });
        setProfileForm({ ...profileForm, authorities: Array.from(new Set([...selected, authority])) });
        setCustomAuthority(""); setProfileMessage(existing ? `${existing} selected.` : `${value} added to this criterion.`);
    }
    async function saveProfile(e) {
        e.preventDefault();
        setProfileMessage("Saving scrape criterion...");
        try {
            const result = await api("/api/admin/settings/scrape-profiles", { method: "POST", body: JSON.stringify(profileForm) });
            setSettings({ ...settings, scrape_profiles: result.profiles || [] });
            setProfileForm(blankProfile);
            setProfileMessage("Scrape criterion saved.");
        } catch (err) { setProfileMessage(err.message); }
    }
    function editProfile(profile) { setProfileForm({ ...blankProfile, ...profile }); setProfileMessage(`Editing ${profile.name}.`); }
    async function removeProfile(profile) {
        if (!confirm(`Delete scrape criterion "${profile.name}"?`)) return;
        const result = await api(`/api/admin/settings/scrape-profiles/${profile.id}`, { method: "DELETE" });
        setSettings({ ...settings, scrape_profiles: result.profiles || [] });
        if (profileForm.id === profile.id) setProfileForm(blankProfile);
    }
    async function toggleProfile(profile) {
        const result = await api("/api/admin/settings/scrape-profiles", { method: "POST", body: JSON.stringify({ ...profile, enabled: !profile.enabled }) });
        setSettings({ ...settings, scrape_profiles: result.profiles || [] });
    }
    async function runProfile(profile) {
        setProfileMessage(`Running ${profile.name}...`);
        try {
            const result = await api(`/api/admin/settings/scrape-profiles/${profile.id}/run`, { method: "POST", loadingLabel: `Scraping ${profile.name}...` });
            setProfileMessage(`${profile.name} finished: inserted ${result.inserted || 0}, scored ${result.scored || 0}. Its Excel report is available in Scrape History.`);
        } catch (err) { setProfileMessage(err.message); }
    }
    async function saveAuto(e) {
        e.preventDefault();
        await api("/api/admin/settings/auto-scrape", {
            method: "POST",
            body: JSON.stringify({
                enabled: settings.auto_scrape_enabled,
                mode: settings.auto_scrape_mode,
                interval_hours: settings.auto_scrape_interval_hours,
                scrape_time: settings.auto_scrape_time,
            }),
        });
        await load();
    }
    async function saveDigest(e) {
        e.preventDefault();
        await api("/api/admin/settings/daily-digest", {
            method: "POST",
            body: JSON.stringify({
                enabled: settings.daily_digest_enabled,
                time: settings.daily_digest_time,
                min_score: settings.daily_digest_min_score,
            }),
        });
        await load();
    }
    async function sendDigestNow() {
        setDigestMessage("Sending daily digest...");
        const result = await api("/api/daily-digest/send-now", { method: "POST" });
        setDigestMessage(`Daily digest sent. Email: ${result.email_sent || 0}, Telegram: ${result.telegram_sent || 0}, Tenders: ${result.total_tenders || 0}.`);
        await load();
    }
    const autoStatus = settings.auto_scrape_status || {};
    return h(React.Fragment, null,
        h("div", { className: "automation-hero" }, h("div", null, h("span", null, "SCRAPING CONTROL"), h("h2", null, "Automation Settings"), h("p", null, "Choose exactly where and for whom GeM opportunities should be collected.")), h("div", { className: settings.auto_scrape_enabled ? "automation-live active" : "automation-live" }, h("i", null), settings.auto_scrape_enabled ? "Automation active" : "Automation paused")),
        h("div", { className: "admin-grid automation-settings-grid" },
        h("div", { className: "card automation-profile-card" },
            h("div", { className: "automation-card-title" }, h("div", null, h("h3", null, "Multiple Scrape Criteria"), h("p", { className: "desc" }, "Create independent targeting profiles. Authorities and locations are alternative discovery targets within a criterion; matching either target is included. Every enabled profile receives its own history entry, email attachment, and Excel report.")), h("div", { className: "scrape-profile-title-actions" }, h("strong", null, `${(settings.scrape_profiles || []).length}/20`), h("button", { type: "button", disabled: refreshingAuthorities, onClick: refreshAuthorities }, refreshingAuthorities ? "Refreshing..." : "Refresh Departments"))),
            profileMessage ? h("p", { className: "status" }, profileMessage) : null,
            h("form", { className: "stack scrape-profile-form", onSubmit: saveProfile },
                h("div", { className: "automation-time-grid" },
                    h("label", { className: "field-block" }, h("span", null, "Criteria name"), h("input", { value: profileForm.name, required: true, maxLength: 100, onChange: e => setProfileForm({ ...profileForm, name: e.target.value }), placeholder: "Example: Odisha software bids" })),
                    h("label", { className: "field-block" }, h("span", null, "Keywords"), h("input", { value: (profileForm.keywords || []).join(", "), onChange: e => setProfileForm({ ...profileForm, keywords: e.target.value.split(",").map(v => v.trim()).filter(Boolean) }), placeholder: "software, automation, IoT" }))
                ),
                h(AutomationMultiSelect, { label: "States", hint: "Profile-specific locations", options: settings.indian_states || [], selected: profileForm.states || [], onChange: values => setProfileForm({ ...profileForm, states: values }), placeholder: "Select states" }),
                h("label", { className: "field-block" }, h("span", null, "Cities / districts"), h("input", { value: (profileForm.cities || []).join(", "), onChange: e => setProfileForm({ ...profileForm, cities: e.target.value.split(",").map(v => v.trim()).filter(Boolean) }), placeholder: "Bhubaneswar, Koraput" })),
                h("label", { className: "field-block" }, h("span", null, "Maximum EMD (₹)"), h("input", { type: "number", min: 0, step: 1, value: profileForm.emd_amount ?? "", onChange: e => setProfileForm({ ...profileForm, emd_amount: e.target.value }), placeholder: "Blank = any EMD; 0 = nil / unspecified" }), h("small", null, "Include bids at or below this EMD. Enter 0 for nil, exempt, or unspecified EMD.")),
                h(AutomationMultiSelect, { label: "Departments / authorities", hint: "Profile-specific organisations", options: settings.authority_options || [], selected: profileForm.authorities || [], onChange: values => setProfileForm({ ...profileForm, authorities: values }), placeholder: "Select departments" }),
                h("div", { className: "automation-custom-authority" }, h("input", { value: customAuthority, maxLength: 200, onChange: e => setCustomAuthority(e.target.value), onKeyDown: e => { if (e.key === "Enter") { e.preventDefault(); addCustomAuthority(); } }, placeholder: "Department not listed? Enter it manually" }), h("button", { type: "button", onClick: addCustomAuthority }, "Add Department")),
                filterMessage ? h("div", { className: "notice" }, filterMessage) : null,
                h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!profileForm.only_high_priority, onChange: e => setProfileForm({ ...profileForm, only_high_priority: e.target.checked }) }), " Keep only high-priority tenders for this criterion"),
                h("div", { className: "scrape-profile-form-actions" }, h("button", { className: "primary" }, profileForm.id ? "Update Criterion" : "Add Criterion"), profileForm.id ? h("button", { type: "button", onClick: () => setProfileForm(blankProfile) }, "Cancel Edit") : null)
            ),
            h("div", { className: "scrape-profile-list" }, (settings.scrape_profiles || []).map((profile, index) => h("article", { className: `scrape-profile-item ${profile.enabled ? "active" : "paused"}`, key: profile.id },
                h("div", { className: "scrape-profile-content" }, h("span", null, profile.enabled ? "Enabled" : "Paused"), h("h4", null, profile.name || `Scrape Criteria ${index + 1}`), h("div", { className: "scrape-profile-details" },
                    h("div", null, h("b", null, "Keywords"), h("div", { className: "criteria-value-list" }, (profile.keywords || []).length ? profile.keywords.map(value => h("em", { key: value }, value)) : h("p", null, "No keyword filter"))),
                    h("div", null, h("b", null, "Departments"), h("div", { className: "criteria-value-list" }, (profile.authorities || []).length ? profile.authorities.map(value => h("em", { key: value }, value)) : h("p", null, "All departments"))),
                    h("div", null, h("b", null, "States"), h("div", { className: "criteria-value-list" }, (profile.states || []).length ? profile.states.map(value => h("em", { key: value }, value)) : h("p", null, "All states"))),
                    h("div", null, h("b", null, "Cities / districts"), h("div", { className: "criteria-value-list" }, (profile.cities || []).length ? profile.cities.map(value => h("em", { key: value }, value)) : h("p", null, "All cities"))),
                    h("div", null, h("b", null, "Maximum EMD"), h("p", null, profile.emd_amount === null || profile.emd_amount === undefined || profile.emd_amount === "" ? "Any EMD" : `₹${Number(profile.emd_amount).toLocaleString("en-IN")}${Number(profile.emd_amount) === 0 ? " (nil / unspecified)" : ""}`))
                )),
                h("div", { className: "scrape-profile-actions" }, h("button", { type: "button", onClick: () => runProfile(profile) }, "Run Now"), h("button", { type: "button", onClick: () => editProfile(profile) }, "Edit"), h("button", { type: "button", onClick: () => toggleProfile(profile) }, profile.enabled ? "Pause" : "Enable"), h("button", { type: "button", className: "danger", onClick: () => removeProfile(profile) }, "Delete"))
            )))
        ),
        h("div", { className: "card automation-schedule-card" }, h("div", { className: "automation-card-title" }, h("div", null, h("h3", null, "Auto Scrape Schedule"), h("p", { className: "desc" }, "Run discovery at a fixed interval or once per day.")), h("label", { className: "switch" }, h("input", { type: "checkbox", checked: settings.auto_scrape_enabled, onChange: e => setSettings({ ...settings, auto_scrape_enabled: e.target.checked }) }), h("span", null))), h("form", { onSubmit: saveAuto, className: "stack" },
            h("label", { className: "field-block" }, h("span", null, "Schedule mode"), h("select", { value: settings.auto_scrape_mode, onChange: e => setSettings({ ...settings, auto_scrape_mode: e.target.value }) }, h("option", { value: "interval" }, "Every N hours"), h("option", { value: "daily" }, "Daily time"))),
            h("div", { className: "automation-time-grid" }, h("label", { className: "field-block" }, h("span", null, "Interval hours"), h("input", { type: "number", min: 1, max: 168, value: settings.auto_scrape_interval_hours, disabled: settings.auto_scrape_mode !== "interval", onChange: e => setSettings({ ...settings, auto_scrape_interval_hours: e.target.value }) })), h("label", { className: "field-block" }, h("span", null, "Daily time"), h("input", { type: "time", value: settings.auto_scrape_time, disabled: settings.auto_scrape_mode !== "daily", onChange: e => setSettings({ ...settings, auto_scrape_time: e.target.value }) }))),
            h("button", { className: "primary" }, "Save Auto Scrape"),
            h("div", { className: autoStatus.scheduler_running ? "notice ok" : "notice err" }, autoStatus.scheduler_running ? "Scheduler is running in the web app." : "Scheduler is not running in the web app. Redeploy or restart the container."),
            h("div", { className: "alert-status-grid" },
                h("div", null, h("span", null, "Server now"), h("strong", null, autoStatus.server_now || "NA")),
                h("div", null, h("span", null, "Last auto scrape"), h("strong", null, autoStatus.last_run || "Not run")),
                h("div", null, h("span", null, "Next due"), h("strong", null, autoStatus.next_due || "NA")),
                h("div", null, h("span", null, "Due now"), h("strong", null, autoStatus.due_now ? "Yes" : "No"))
            ),
            autoStatus.reason ? h("p", { className: "desc" }, autoStatus.reason) : null
        )),
        h("div", { className: "card automation-digest-card" }, h("h3", null, "Daily Digest Alerts"), h("form", { onSubmit: saveDigest, className: "stack" },
            digestMessage ? h("p", { className: "status" }, digestMessage) : null,
            h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!settings.daily_digest_enabled, onChange: e => setSettings({ ...settings, daily_digest_enabled: e.target.checked }) }), " Send daily digest"),
            h("label", { className: "field-block" }, h("span", null, "Digest time"), h("input", { type: "time", value: settings.daily_digest_time || "09:00", onChange: e => setSettings({ ...settings, daily_digest_time: e.target.value }) })),
            h("label", { className: "field-block" }, h("span", null, "High priority minimum score"), h("input", { type: "number", min: 0, max: 100, value: settings.daily_digest_min_score || "70", onChange: e => setSettings({ ...settings, daily_digest_min_score: e.target.value }) })),
            settings.daily_digest_last_run ? h("p", { className: "desc" }, `Last digest: ${settings.daily_digest_last_run}`) : h("p", { className: "desc" }, "No daily digest sent yet."),
            h("button", { className: "primary" }, "Save Digest Settings"),
            h("button", { type: "button", onClick: sendDigestNow }, "Send Digest Now")
        )))
    );
}

function DeletePage() {
    const [summary, setSummary] = useState(null);
    const [confirm, setConfirm] = useState("");
    const [checked, setChecked] = useState(false);
    const [message, setMessage] = useState("");
    useEffect(() => { api("/api/admin/delete-summary").then(setSummary); }, []);
    async function remove() {
        const result = await api("/api/admin/delete-tenders", { method: "POST", body: JSON.stringify({ confirm }) });
        setMessage(`Deleted ${result.deleted_tenders || 0} tenders, ${result.deleted_seller_bids || 0} bid workflows, and ${result.deleted_seller_orders || 0} linked orders.`);
        setSummary(await api("/api/admin/delete-summary"));
    }
    return h("div", { className: "card danger-card" },
        h("h3", null, "Delete All Tender Data"),
        h("p", { className: "desc" }, "This deletes only data owned by your account. Your login, company profile, seller readiness documents, and catalogue are retained."),
        h("div", { className: "buyer-process-metrics" },
            h("div", null, h("span", null, "Tenders"), h("strong", null, summary?.tenders ?? 0)),
            h("div", null, h("span", null, "Documents"), h("strong", null, summary?.documents ?? 0)),
            h("div", null, h("span", null, "Bid Workflows"), h("strong", null, summary?.seller_bid_workflows ?? 0)),
            h("div", null, h("span", null, "Linked Orders"), h("strong", null, summary?.seller_orders ?? 0))
        ),
        message ? h("p", { className: "status" }, message) : null,
        h("input", { value: confirm, onChange: e => setConfirm(e.target.value), placeholder: "DELETE ALL TENDERS" }),
        h("label", { className: "toggle" }, h("input", { type: "checkbox", checked, onChange: e => setChecked(e.target.checked) }), " I understand this permanently deletes my tender data and linked seller workflows."),
        h("button", { className: "primary danger", disabled: confirm !== "DELETE ALL TENDERS" || !checked, onClick: remove }, "Delete All My Tender Data")
    );
}

function CompanyProfilePage() {
    const blank = { company_name: "", products: "", services: "", industries: "", target_departments: "", target_states: "", certifications: "", experience_keywords: "", negative_keywords: "", min_tender_value: "", max_tender_value: "", is_active: true };
    const [profile, setProfile] = useState(blank);
    const [rules, setRules] = useState([]);
    const [message, setMessage] = useState("");
    async function load() {
        const data = await api("/api/company-profile");
        setProfile({ ...blank, ...(data.profile || {}) });
        setRules(data.matching_rules || []);
    }
    useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
    async function save(e) {
        e.preventDefault();
        setMessage("Saving company profile...");
        const result = await api("/api/company-profile", { method: "POST", body: JSON.stringify(profile) });
        setProfile({ ...blank, ...(result.profile || {}) });
        setMessage("Company profile saved. Rescore tenders to apply the new matching profile.");
    }
    const textarea = (field, label, hint) => h("label", { className: "field-block" }, h("span", null, label), h("textarea", { value: profile[field] || "", onChange: e => setProfile({ ...profile, [field]: e.target.value }), placeholder: hint }));
    return h("div", { className: "admin-grid profile-grid" },
        h("div", { className: "card profile-card" },
            h("h3", null, "Company Matching Profile"),
            h("p", { className: "desc" }, "Tender AI uses this profile during scoring and manual scrape keyword expansion. Use comma or line separated values."),
            message ? h("p", { className: "status" }, message) : null,
            h("form", { className: "stack", onSubmit: save },
                h("label", { className: "field-block" }, h("span", null, "Company name"), h("input", { value: profile.company_name || "", onChange: e => setProfile({ ...profile, company_name: e.target.value }), placeholder: "Example: Mervin Automation Pvt Ltd" })),
                textarea("products", "Products", "IoT sensors, flow meters, telemetry devices"),
                textarea("services", "Services", "SCADA integration, remote monitoring, automation maintenance"),
                textarea("industries", "Industries", "Water, smart city, defence, industrial automation"),
                textarea("target_departments", "Target departments", "Ministry of Defence, Municipal Corporation, Jal Board"),
                textarea("target_states", "Target states", "Delhi, Odisha, Maharashtra"),
                textarea("certifications", "Certifications", "ISO 9001, GeM seller, MSME"),
                textarea("experience_keywords", "Experience keywords", "smart irrigation, pump automation, telemetry project"),
                textarea("negative_keywords", "Negative keywords", "medicine, furniture, catering, manpower"),
                h("div", { className: "value-row" },
                    h("label", { className: "field-block" }, h("span", null, "Minimum tender value"), h("input", { type: "number", min: 0, value: profile.min_tender_value || "", onChange: e => setProfile({ ...profile, min_tender_value: e.target.value }), placeholder: "0" })),
                    h("label", { className: "field-block" }, h("span", null, "Maximum tender value"), h("input", { type: "number", min: 0, value: profile.max_tender_value || "", onChange: e => setProfile({ ...profile, max_tender_value: e.target.value }), placeholder: "No limit" }))
                ),
                h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!profile.is_active, onChange: e => setProfile({ ...profile, is_active: e.target.checked }) }), " Enable company profile matching"),
                h("button", { className: "primary" }, "Save Company Profile")
            )
        ),
        h("div", { className: "card" },
            h("h3", null, "How Matching Works"),
            h("p", { className: "desc" }, "When a tender is scored, Tender AI compares title, department, state, description, and value against this profile."),
            h("ul", { className: "rule-list" }, rules.map(rule => h("li", { key: rule.field }, h("strong", null, rule.field), h("span", null, rule.impact)))),
            h("div", { className: "notice" }, "Tip: after saving, use Admin -> Trigger AI Rescoring to update existing tenders.")
        )
    );
}

function RiskBadge({ level }) {
    const label = (level || "low").replaceAll("_", " ");
    return h("span", { className: `risk-badge ${level || "low"}` }, label);
}

function IntelligenceHero({ title, text }) {
    return h("div", { className: "hero-panel seller-intel-hero" },
        h("div", null, h("h2", null, title), h("p", null, text)),
        h("div", { className: "hero-actions" },
            h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/gem-bids") }, "Sync GeM Records"),
            h("button", { onClick: () => navigate("/dashboard/seller/intelligence/risk-signals") }, "Risk Signals"),
            h("button", { onClick: () => navigate("/dashboard/seller/intelligence/reports") }, "Reports")
        )
    );
}

function SellerIntelligenceOverviewPage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => { api("/api/seller/intelligence/overview").then(setData).catch(err => setMessage(err.message)); }, []);
    const summary = data?.summary || {};
    return h(React.Fragment, null,
        h(IntelligenceHero, { title: "Seller Intelligence Overview", text: "Evidence-based buyer, order, concentration, and risk signals from your GeM seller records." }),
        message ? h("div", { className: "notice err" }, message) : null,
        data?.session_required ? h("div", { className: "notice err" }, data.message) : null,
        h("div", { className: "summary six" },
            [["Records", summary.total_records || 0], ["Total Value", `Rs. ${money(summary.total_value || 0)}`], ["Buyers", summary.buyers || 0], ["Districts", summary.districts || 0], ["High Risk", summary.high_risk || 0], ["Cancelled", summary.cancelled || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "chart-grid" },
            h(ChartCard, { title: "Top Buyers", data: { labels: (data?.top_buyers || []).map(row => row.name), values: (data?.top_buyers || []).map(row => row.count) } }),
            h(ChartCard, { title: "Order Status", data: { labels: (data?.status_rows || []).map(row => row.name), values: (data?.status_rows || []).map(row => row.count) }, type: "doughnut" })
        ),
        h(SimpleTable, {
            title: "Top Risk Signals",
            headers: ["Record", "Buyer", "District", "Value", "Risk", "Reasons"],
            rows: (data?.top_risk_signals || []).map(row => [row.bid_number, row.buyer, row.district, `Rs. ${money(row.value)}`, h(RiskBadge, { level: row.risk_level }), row.reasons.join("; ")])
        })
    );
}

function SellerRiskDataPage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    const [importing, setImporting] = useState(false);
    const [master, setMaster] = useState({ kind: "vendor", id: "", name: "", gst_no: "", department: "", state: "", city: "", district: "", parent_category: "", sector: "" });
    const load = () => api("/api/seller/intelligence/risk-data").then(setData).catch(err => setMessage(err.message));
    useEffect(load, []);
    async function importResults(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        setImporting(true); setMessage("");
        try {
            const content = await file.text();
            const result = await api("/api/seller/intelligence/import-results", { method: "POST", body: JSON.stringify({ filename: file.name, content }) });
            setMessage(result.message + (result.errors?.length ? ` ${result.errors.join("; ")}` : ""));
            load();
        } catch (err) { setMessage(err.message); }
        finally { setImporting(false); event.target.value = ""; }
    }
    async function saveMaster(event) {
        event.preventDefault(); setMessage("");
        try {
            const result = await api(`/api/seller/intelligence/master/${master.kind}`, { method: "POST", body: JSON.stringify(master) });
            setMessage(result.message); setMaster({ kind: master.kind, id: "", name: "", gst_no: "", department: "", state: "", city: "", district: "", parent_category: "", sector: "" }); load();
        } catch (err) { setMessage(err.message); }
    }
    function editMaster(kind, row) { setMaster({ kind, id: row.id, name: row.name || "", gst_no: row.gst_no || "", department: row.department || "", state: row.state || "", city: row.city || "", district: row.district || "", parent_category: row.parent_category || "", sector: row.sector || "" }); }
    const summary = data?.summary || {};
    return h(React.Fragment, null,
        h(IntelligenceHero, { title: "Risk Data Foundation", text: "Track the data needed for vendor concentration, L1/L2/L3 price-gap, repeated bidder group, and restrictive-clause analytics." }),
        message ? h("div", { className: "notice err" }, message) : null,
        data?.message ? h("div", { className: "notice" }, data.message) : null,
        h("section", { className: "card" },
            h("h3", null, "Import Historical Bid Results"),
            h("p", { className: "desc" }, "Upload a CSV containing one participant per row. The CSV is processed into intelligence records and the original file is not stored on the server."),
            h("input", { type: "file", accept: ".csv,text/csv", disabled: importing, onChange: importResults }),
            h("a", { className: "download-btn", href: "/exports/seller/intelligence/import-template.csv" }, "Download CSV Template"),
            h("p", { className: "desc" }, "Required: bid_no. Recommended: buyer, department, category, vendor, rank, quoted_price, technical_status, is_awarded, total_bidders, awarded_value, restrictive_clause."),
            importing ? h("p", null, "Importing...") : null
        ),
        h("section", { className: "card" },
            h("h3", null, "Master Data Correction"),
            h("form", { className: "form-grid", onSubmit: saveMaster },
                h("label", { className: "field-block" }, h("span", null, "Type"), h("select", { value: master.kind, onChange: e => setMaster({ ...master, kind: e.target.value, id: "", name: "" }) }, ["vendor", "buyer", "category"].map(x => h("option", { key: x, value: x }, x)))),
                h("label", { className: "field-block" }, h("span", null, "Name"), h("input", { required: true, value: master.name, onChange: e => setMaster({ ...master, name: e.target.value }) })),
                master.kind === "vendor" ? h(React.Fragment, null,
                    h("label", { className: "field-block" }, h("span", null, "GST No."), h("input", { value: master.gst_no, onChange: e => setMaster({ ...master, gst_no: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "City"), h("input", { value: master.city, onChange: e => setMaster({ ...master, city: e.target.value }) }))
                ) : null,
                master.kind === "buyer" ? h(React.Fragment, null,
                    h("label", { className: "field-block" }, h("span", null, "Department"), h("input", { value: master.department, onChange: e => setMaster({ ...master, department: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "District"), h("input", { value: master.district, onChange: e => setMaster({ ...master, district: e.target.value }) }))
                ) : null,
                master.kind === "category" ? h(React.Fragment, null,
                    h("label", { className: "field-block" }, h("span", null, "Parent Category"), h("input", { value: master.parent_category, onChange: e => setMaster({ ...master, parent_category: e.target.value }) })),
                    h("label", { className: "field-block" }, h("span", null, "Sector"), h("input", { value: master.sector, onChange: e => setMaster({ ...master, sector: e.target.value }) }))
                ) : null,
                master.kind !== "category" ? h("label", { className: "field-block" }, h("span", null, "State"), h("input", { value: master.state, onChange: e => setMaster({ ...master, state: e.target.value }) })) : null,
                h("button", { type: "submit" }, master.id ? "Update Master" : "Add Master")
            )
        ),
        h("div", { className: "admin-grid" },
            h(SimpleTable, { title: "Vendor Master", headers: ["Vendor", "GST", "Location", "Action"], rows: (data?.masters?.vendors || []).map(row => [row.name, row.gst_no, [row.city, row.state].filter(Boolean).join(", "), h("button", { onClick: () => editMaster("vendor", row) }, "Edit")]) }),
            h(SimpleTable, { title: "Buyer Master", headers: ["Buyer", "Department", "Location", "Action"], rows: (data?.masters?.buyers || []).map(row => [row.name, row.department, [row.district, row.state].filter(Boolean).join(", "), h("button", { onClick: () => editMaster("buyer", row) }, "Edit")]) }),
            h(SimpleTable, { title: "Category Master", headers: ["Category", "Parent", "Sector", "Action"], rows: (data?.masters?.categories || []).map(row => [row.name, row.parent_category, row.sector, h("button", { onClick: () => editMaster("category", row) }, "Edit")]) })
        ),
        h("div", { className: "summary six" },
            [["Vendors", summary.vendors || 0], ["Buyers", summary.buyers || 0], ["Categories", summary.categories || 0], ["Risk Bids", summary.risk_bids || 0], ["Participants", summary.participants || 0], ["Risk Flags", summary.risk_flags || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h(SimpleTable, {
            title: "Phase Progress",
            headers: ["Phase", "Name", "Status", "Done", "Next"],
            rows: (data?.phases || []).map(row => [row.phase, row.name, row.status, (row.done || []).join("; "), (row.next || []).join("; ")])
        }),
        h("section", { className: "card" },
            h("h3", null, "Missing For Full Anomaly Engine"),
            h("div", { className: "tag-list catalogue-gaps" }, (data?.missing || []).map(item => h("span", { key: item }, item)))
        )
    );
}

function SellerBuyerHistoryPage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => { api("/api/seller/intelligence/buyers").then(setData).catch(err => setMessage(err.message)); }, []);
    return h(React.Fragment, null,
        h(IntelligenceHero, { title: "Buyer History", text: "See buyer/department concentration, value share, districts served, and latest fulfilment status." }),
        message ? h("div", { className: "notice err" }, message) : null,
        data?.session_required ? h("div", { className: "notice err" }, "Capture a valid GeM session and sync participated bids to view buyer history.") : null,
        h(SimpleTable, {
            title: "Buyer / Department Records",
            headers: ["Buyer / Department", "Records", "Value", "Value Share", "Districts", "Latest Status", "Risk"],
            rows: (data?.items || []).map(row => [row.buyer, row.records, `Rs. ${money(row.value)}`, `${row.value_share}%`, row.districts, row.latest_status, h(RiskBadge, { level: row.risk_level })])
        })
    );
}

function SellerCompetitorIntelligencePage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => { api("/api/seller/intelligence/competitors").then(setData).catch(err => setMessage(err.message)); }, []);
    return h(React.Fragment, null,
        h(IntelligenceHero, { title: "Competitor Intelligence", text: "Prepare L1/L2/L3, repeated bidder group, and vendor dominance analytics from result data." }),
        message ? h("div", { className: "notice err" }, message) : null,
        h("div", { className: "summary three" },
            [["Competitors", data?.summary?.competitors_tracked || 0], ["L1/L2 Records", data?.summary?.l1_l2_records || 0], ["Low Competition", data?.summary?.low_competition_records || 0], ["Award Reviews", data?.summary?.award_value_review_records || 0], ["High Concentration", data?.summary?.high_concentration_records || 0], ["Repeated Groups", data?.summary?.repeated_groups || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("section", { className: "card" },
            h("h3", null, "Next Data Required"),
            h("p", { className: "desc" }, data?.message || "Upload or ingest financial evaluation/result records to activate competitor analytics."),
            h("div", { className: "tag-list catalogue-gaps" }, (data?.required_fields || []).map(field => h("span", { key: field }, field)))
        ),
        h(SimpleTable, { title: "Vendor Dominance", headers: ["Vendor", "Bids", "Awards", "Award Share", "Risk"], rows: (data?.items || []).map(row => [row.vendor, row.bids, row.awards, `${row.award_share}%`, h(RiskBadge, { level: row.risk_level })]) }),
        h(SimpleTable, { title: "Vendor Concentration by Department and Category", headers: ["Vendor", "Department", "Category", "Wins", "Segment Awards", "Win Share", "Value Share", "Level", "Explanation"], rows: (data?.vendor_concentration || []).map(row => [row.vendor, row.department, row.category, row.wins, row.total_awards, `${row.win_share_percent}%`, row.value_share_percent == null ? "NA" : `${row.value_share_percent}%`, row.concentration_level, row.explanation]) }),
        h(SimpleTable, { title: "L1/L2/L3 Price Gaps", headers: ["Bid", "L1", "L1 Price", "L2", "L2 Price", "L3", "L3 Price", "L1-L2 Gap", "L2-L3 Gap", "Cluster Spread", "Risk", "Explanation"], rows: (data?.price_gaps || []).map(row => [row.bid_no, row.l1, `Rs. ${money(row.l1_price)}`, row.l2, `Rs. ${money(row.l2_price)}`, row.l3 || "NA", row.l3_price ? `Rs. ${money(row.l3_price)}` : "NA", `${row.gap_percent}%`, row.l2_l3_gap_percent == null ? "NA" : `${row.l2_l3_gap_percent}%`, row.cluster_spread_percent == null ? "NA" : `${row.cluster_spread_percent}%`, h(RiskBadge, { level: row.risk_level }), row.explanation || ""] ) }),
        h(SimpleTable, { title: "Low Competition / Technical Rejection", headers: ["Bid", "Buyer", "Total", "Qualified", "Disqualified", "Competition Ratio", "Rejection Rate", "Risk", "Explanation"], rows: (data?.competition_risks || []).map(row => [row.bid_no, row.buyer, row.total_bidders, row.technically_qualified == null ? "NA" : row.technically_qualified, row.technically_disqualified == null ? "NA" : row.technically_disqualified, row.competition_ratio_percent == null ? "NA" : `${row.competition_ratio_percent}%`, row.disqualification_rate_percent == null ? "NA" : `${row.disqualification_rate_percent}%`, h(RiskBadge, { level: row.risk_level }), row.explanation]) }),
        h(SimpleTable, { title: "Awarded Value vs Estimated Value", headers: ["Bid", "Buyer", "Estimated", "Awarded", "Award Ratio", "Saving", "Risk", "Interpretation"], rows: (data?.award_value_risks || []).map(row => [row.bid_no, row.buyer, `Rs. ${money(row.estimated_value)}`, `Rs. ${money(row.awarded_value)}`, `${row.award_ratio_percent}%`, `${row.saving_percent}%`, h(RiskBadge, { level: row.risk_level }), row.explanation]) }),
        h(SimpleTable, { title: "Repeated Bidder Groups", headers: ["Group", "Bids Together", "Bid Numbers", "Risk"], rows: (data?.repeated_groups || []).map(row => [row.group, row.bids_together, row.bid_numbers.join(", "), h(RiskBadge, { level: row.risk_level })]) })
    );
}

function SellerRiskSignalsPage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => { api("/api/seller/intelligence/risk-signals").then(setData).catch(err => setMessage(err.message)); }, []);
    return h(React.Fragment, null,
        h(IntelligenceHero, { title: "Risk Signals", text: "Review evidence-based signals. These are observations for manual review, not allegations." }),
        message ? h("div", { className: "notice err" }, message) : null,
        h("div", { className: "notice" }, data?.language_note || "Risk signals are not proof of wrongdoing."),
        h(SimpleTable, {
            title: "Procurement Risk Signals",
            headers: ["Record", "Buyer", "District", "Value", "Final", "Score", "Risk", "Reasons"],
            rows: (data?.items || []).map(row => [row.bid_number, row.buyer, row.district, `Rs. ${money(row.value)}`, row.final_status, row.risk_score, h(RiskBadge, { level: row.risk_level }), row.reasons.join("; ")])
        })
    );
}

function SellerRiskReportsPage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => { api("/api/seller/intelligence/reports").then(setData).catch(err => setMessage(err.message)); }, []);
    const reports = data?.reports || {};
    return h(React.Fragment, null,
        h(IntelligenceHero, { title: "Risk Reports", text: "Department-wise concentration and seller risk reports, with placeholders for L1/L2/L3 and bidder group reports." }),
        message ? h("div", { className: "notice err" }, message) : null,
        data?.message ? h("div", { className: "notice" }, data.message) : null,
        h("div", { className: "hero-actions" },
            h("a", { href: "/exports/seller/intelligence/vendor-dominance/csv" }, "Vendor CSV"),
            h("a", { href: "/exports/seller/intelligence/vendor-concentration/csv" }, "Concentration CSV"),
            h("a", { href: "/exports/seller/intelligence/price-gaps/csv" }, "Price Gap CSV"),
            h("a", { href: "/exports/seller/intelligence/low-competition/csv" }, "Competition CSV"),
            h("a", { href: "/exports/seller/intelligence/award-ratios/csv" }, "Award Ratio CSV"),
            h("a", { href: "/exports/seller/intelligence/repeated-groups/pdf" }, "Group PDF"),
            h("a", { href: "/exports/seller/intelligence/restrictive-clauses/pdf" }, "Clause PDF")
        ),
        h(SimpleTable, { title: "Department-Wise Risk Report", headers: ["Department", "Total Records", "Total Value", "Record Share %", "Risk Level"], rows: (reports.department_risk || []).map(row => [row.Department, row["Total Records"], `Rs. ${money(row["Total Value"])}`, row["Record Share %"], row["Risk Level"]]) }),
        h(SimpleTable, { title: "Seller Risk Signal Report", headers: ["Record No", "Buyer", "District", "Value", "Risk Score", "Risk Level", "Reasons"], rows: (reports.seller_risk_signals || []).map(row => [row["Record No"], row.Buyer, row.District, `Rs. ${money(row.Value)}`, row["Risk Score"], row["Risk Level"], row.Reasons]) }),
        h("div", { className: "admin-grid" },
            h(SimpleTable, { title: "L1/L2/L3 Price Gap Report", headers: ["Bid No", "L1", "L2", "L3", "L1-L2 Gap %", "L2-L3 Gap %", "Cluster Spread %", "Risk", "Explanation"], rows: (reports.l1_l2_l3_gap || []).map(row => [row.bid_no, row.l1, row.l2, row.l3 || "NA", row.gap_percent, row.l2_l3_gap_percent == null ? "NA" : row.l2_l3_gap_percent, row.cluster_spread_percent == null ? "NA" : row.cluster_spread_percent, h(RiskBadge, { level: row.risk_level }), row.explanation || ""]) }),
            h(SimpleTable, { title: "Repeated Bidder Group Report", headers: ["Group", "Bids Together", "Bid Numbers", "Risk"], rows: (reports.repeated_bidder_group || []).map(row => [row.group, row.bids_together, row.bid_numbers.join(", "), h(RiskBadge, { level: row.risk_level })]) })
        ),
        h(SimpleTable, { title: "Vendor Dominance Report", headers: ["Vendor", "Bids", "Awards", "Award Share", "Risk"], rows: (reports.vendor_dominance || []).map(row => [row.vendor, row.bids, row.awards, `${row.award_share}%`, h(RiskBadge, { level: row.risk_level })]) }),
        h(SimpleTable, { title: "Vendor Concentration Report", headers: ["Vendor", "Department", "Category", "Wins", "Segment Awards", "Win Share", "Value Share", "Level", "Explanation"], rows: (reports.vendor_concentration || []).map(row => [row.vendor, row.department, row.category, row.wins, row.total_awards, `${row.win_share_percent}%`, row.value_share_percent == null ? "NA" : `${row.value_share_percent}%`, row.concentration_level, row.explanation]) }),
        h(SimpleTable, { title: "Low Competition / Technical Rejection Report", headers: ["Bid", "Buyer", "Total", "Qualified", "Disqualified", "Competition Ratio", "Rejection Rate", "Risk", "Explanation"], rows: (reports.low_competition || []).map(row => [row.bid_no, row.buyer, row.total_bidders, row.technically_qualified == null ? "NA" : row.technically_qualified, row.technically_disqualified == null ? "NA" : row.technically_disqualified, row.competition_ratio_percent == null ? "NA" : `${row.competition_ratio_percent}%`, row.disqualification_rate_percent == null ? "NA" : `${row.disqualification_rate_percent}%`, h(RiskBadge, { level: row.risk_level }), row.explanation]) }),
        h(SimpleTable, { title: "Awarded Value vs Estimated Value Report", headers: ["Bid", "Buyer", "Estimated", "Awarded", "Award Ratio", "Saving", "Risk", "Explanation"], rows: (reports.award_value_ratio || []).map(row => [row.bid_no, row.buyer, `Rs. ${money(row.estimated_value)}`, `Rs. ${money(row.awarded_value)}`, `${row.award_ratio_percent}%`, `${row.saving_percent}%`, h(RiskBadge, { level: row.risk_level }), row.explanation]) }),
        h(SimpleTable, { title: "Restrictive Clause Report", headers: ["Bid", "Score", "Risk", "Explanation"], rows: (reports.restrictive_clause || []).map(row => [row.bid_no, row.risk_score, h(RiskBadge, { level: row.risk_level }), row.explanation]) })
    );
}

function SellerDocumentExtractionPage() {
    const [data, setData] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => { api("/api/seller/intelligence/documents").then(setData).catch(err => setMessage(err.message)); }, []);
    return h(React.Fragment, null,
        h(IntelligenceHero, { title: "Document Extraction", text: "Track uploaded tender/result documents and extraction readiness for risk analytics." }),
        message ? h("div", { className: "notice err" }, message) : null,
        data?.message ? h("div", { className: "notice" }, data.message) : null,
        h("section", { className: "card" },
            h("h3", null, "Extraction Targets"),
            h("div", { className: "tag-list catalogue-gaps" }, (data?.extraction_tasks || []).map(task => h("span", { key: task }, task)))
        ),
        h(SimpleTable, {
            title: "Uploaded Documents",
            headers: ["File", "Type", "Status", "Confidence", "Uploaded"],
            rows: (data?.items || []).map(row => [row.file_name, row.document_type, row.extraction_status, row.confidence_score || "NA", row.uploaded_at || "NA"])
        })
    );
}

function ProfilePage({ me, refreshMe }) {
    const [form, setForm] = useState({ name: me?.name || "", email: me?.email || "", telegram_enabled: me?.notifications?.telegram, email_enabled: me?.notifications?.email });
    const [password, setPassword] = useState({ current_password: "", new_password: "", confirm_password: "" });
    const [message, setMessage] = useState("");
    useEffect(() => setForm({ name: me?.name || "", email: me?.email || "", telegram_enabled: me?.notifications?.telegram, email_enabled: me?.notifications?.email }), [me]);
    async function saveProfile(e) { e.preventDefault(); await api("/api/profile", { method: "POST", body: JSON.stringify(form) }); setMessage("Profile saved."); refreshMe(); }
    async function savePassword(e) { e.preventDefault(); await api("/api/profile/password", { method: "POST", body: JSON.stringify(password) }); setPassword({ current_password: "", new_password: "", confirm_password: "" }); setMessage("Password updated."); }
    async function sendTestEmail() {
        try {
            const result = await api("/api/profile/test-email", { method: "POST", loadingLabel: "Sending test email..." });
            setMessage(result.message || "Test email sent.");
            refreshMe();
        } catch (err) {
            setMessage(err.message || "Could not send test email.");
        }
    }
    return h("div", { className: "admin-grid" },
        h("div", { className: "card" }, h("h3", null, "Account"), message ? h("p", { className: "status" }, message) : null, h("form", { onSubmit: saveProfile, className: "stack" }, h("input", { value: form.name, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: "Name" }), h("input", { type: "email", value: form.email, onChange: e => setForm({ ...form, email: e.target.value }), placeholder: "Email" }), h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!form.telegram_enabled, onChange: e => setForm({ ...form, telegram_enabled: e.target.checked }) }), " Telegram alerts"), h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!form.email_enabled, onChange: e => setForm({ ...form, email_enabled: e.target.checked }) }), " Email alerts"), h("div", { className: "actions" }, h("button", { className: "primary" }, "Save Profile"), h("button", { type: "button", onClick: sendTestEmail }, "Send Test Email")))),
        h("div", { className: "card" }, h("h3", null, "Password"), h("form", { onSubmit: savePassword, className: "stack" }, h("input", { type: "password", value: password.current_password, onChange: e => setPassword({ ...password, current_password: e.target.value }), placeholder: "Current password" }), h("input", { type: "password", value: password.new_password, onChange: e => setPassword({ ...password, new_password: e.target.value }), placeholder: "New password" }), h("input", { type: "password", value: password.confirm_password, onChange: e => setPassword({ ...password, confirm_password: e.target.value }), placeholder: "Confirm password" }), h("button", { className: "primary" }, "Update Password")))
    );
}

function SimpleTable({ title, headers, rows }) {
    return h("div", { className: "panel table-panel" }, h("h3", null, title), rows.length ? h("table", null, h("thead", null, h("tr", null, headers.map(x => h("th", { key: x }, x)))), h("tbody", null, rows.map((row, i) => h("tr", { key: i }, row.map((cell, j) => h("td", { key: j }, cell)))))) : h("div", { className: "empty" }, "No data available."));
}

const GLOBAL_SEARCH_STATES = ["", "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];

function displayGemDate(value) {
    if (!value) return "Not specified";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function GlobalTenderSearchPage() {
    const defaults = { mode: "all", q: "", department: "", state: "", city: "", bid_type: "all", status: "ongoing_bids", from_date: "", to_date: "", sort: "Bid-End-Date-Oldest", bid_number: "", category: "", ministry: "", buyer_state: "", organization: "", advanced_department: "", boq_title: "", high_value: "" };
    const [filters, setFilters] = useState(defaults);
    const [advancedOptions, setAdvancedOptions] = useState({ ministries: [], states: [] });
    const [organizationOptions, setOrganizationOptions] = useState([]);
    const [departmentOptions, setDepartmentOptions] = useState([]);
    const [locationCities, setLocationCities] = useState([]);
    const [result, setResult] = useState({ items: [], page: 1, pages: 1, total: 0, notice: "" });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [saved, setSaved] = useState({});
    const update = (key, value) => setFilters(current => ({ ...current, [key]: value }));
    async function loadDependent(kind, values) {
        try {
            const params=new URLSearchParams({kind,...values});
            const data=await api(`/api/gem/advance-options?${params}`,{silent:true});
            return data.items || [];
        } catch (error) {
            setMessage(error.message || `Could not load GeM ${kind}.`); return [];
        }
    }
    async function chooseMinistry(value) {
        setFilters(current=>({...current,ministry:value,buyer_state:"",organization:"",advanced_department:""}));
        setDepartmentOptions([]); setOrganizationOptions(value?await loadDependent("organizations",{ministry:value}):[]);
    }
    async function chooseBuyerState(value) {
        setFilters(current=>({...current,buyer_state:value,ministry:"",organization:"",advanced_department:""}));
        setDepartmentOptions([]); setOrganizationOptions(value?await loadDependent("organizations",{buyer_state:value}):[]);
    }
    async function chooseOrganization(value) {
        setFilters(current=>({...current,organization:value,advanced_department:""}));
        setDepartmentOptions(value?await loadDependent("departments",{ministry:filters.ministry,buyer_state:filters.buyer_state,organization:value}):[]);
    }
    async function chooseConsigneeState(value) {
        setFilters(current=>({...current,state:value,city:""}));
        setLocationCities(value?await loadDependent("cities",{state:value}):[]);
    }

    async function search(page = 1, values = filters) {
        if (values.mode === "bid" && !values.bid_number && !values.category && !values.from_date && !values.to_date) { setMessage("Enter a bid number, category, or bid-end date range."); return; }
        if (values.mode === "ministry" && !values.ministry && !values.buyer_state) { setMessage("Select a ministry or buyer state."); return; }
        if (values.mode === "location" && !values.state) { setMessage("Select a consignee state."); return; }
        if (values.mode === "boq" && !values.boq_title) { setMessage("Enter a BOQ title."); return; }
        if ((values.from_date && !values.to_date) || (!values.from_date && values.to_date)) {
            setMessage("Select both End date from and End date to."); return;
        }
        setLoading(true); setMessage("");
        const requestValues = values.mode === "ministry" ? { ...values, department: values.advanced_department } : values;
        const params = new URLSearchParams({ ...requestValues, page: String(page), page_size: "10" });
        try {
            const endpoint = values.mode === "all" ? "/api/gem/global-search" : "/api/gem/advanced-search";
            const data = await api(`${endpoint}?${params}`, { silent: true });
            setResult(data);
        } catch (error) {
            setMessage(error.message || "Live GeM search could not be completed.");
        } finally { setLoading(false); }
    }
    useEffect(() => { search(1, defaults); api("/api/gem/advance-options", { silent: true }).then(setAdvancedOptions).catch(() => {}); }, []);

    async function save(item) {
        setSaved(current => ({ ...current, [item.bid_number]: "saving" }));
        try {
            const data = await api("/api/gem/global-search/save", { method: "POST", body: JSON.stringify(item), silent: true });
            setSaved(current => ({ ...current, [item.bid_number]: "saved" }));
            setMessage(data.message);
        } catch (error) {
            setSaved(current => ({ ...current, [item.bid_number]: "" }));
            setMessage(error.message);
        }
    }
    function reset() {
        setFilters(defaults); setOrganizationOptions([]); setDepartmentOptions([]); setLocationCities([]); search(1, defaults);
    }
    return h("div", { className: "global-search-page" },
        h("section", { className: "global-search-hero" },
            h("div", null, h("span", { className: "eyebrow" }, "Live GeM discovery"), h("h2", null, "Global Tender Search"), h("p", null, "Search current GeM bids by bid number, item, department, authority, state, or city.")),
            h("form", { className: "global-search-bar", onSubmit: e => { e.preventDefault(); search(1); } },
                h("select", { value: "contains", "aria-label": "Search matching method", disabled: true }, h("option", null, "Contains")),
                h("input", { value: filters.mode === "all" ? filters.q : "", disabled: filters.mode !== "all", onChange: e => update("q", e.target.value), placeholder: filters.mode === "all" ? "Bid number, item, department or keyword" : "Use the selected Advanced Search filters below", "aria-label": "Search GeM tenders" }),
                h("button", { className: "primary", disabled: loading }, loading ? "Searching…" : "Search GeM")
            )
        ),
        h("div", { className: "global-search-layout" },
            h("aside", { className: "global-search-filters panel" },
                h("div", { className: "panel-title-row" }, h("h3", null, "Filters"), h("button", { type: "button", onClick: reset }, "Reset")),
                h("div", { className: "global-advanced-tabs" }, [["all","All bids"],["bid","Bid / RA"],["ministry","Ministry"],["location","Location"],["boq","BOQ"]].map(([value,label]) => h("button", { key:value,type:"button",className:filters.mode===value?"active":"",onClick:()=>update("mode",value) },label))),
                filters.mode === "all" ? h(React.Fragment,null,
                    h("label", { className: "field-block" }, h("span", null, "Listing status"), h("select", { value: filters.status, onChange: e => update("status", e.target.value) }, h("option", { value: "ongoing_bids" }, "Ongoing bids / RA"), h("option", { value: "bidrastatus" }, "Bid / RA status"))),
                    h("label", { className: "field-block" }, h("span", null, "Bid type"), h("select", { value: filters.bid_type, onChange: e => update("bid_type", e.target.value) }, h("option", { value: "all" }, "All Bid / RAs"), h("option", { value: "product" }, "Product bids"), h("option", { value: "service" }, "Service bids"), h("option", { value: "custom" }, "Custom bids"), h("option", { value: "boq" }, "BOQ bids"), h("option", { value: "gt" }, "Global tenders"), h("option", { value: "lt" }, "Limited tenders"), h("option", { value: "st" }, "Single tenders"))),
                    h("label", { className: "field-block" }, h("span", null, "Department / authority"), h("input", { value: filters.department, onChange: e => update("department", e.target.value), placeholder: "e.g. Materials, STPI" })),
                    h("label", { className: "field-block" }, h("span", null, "State"), h("select", { value: filters.state, onChange: e => update("state", e.target.value) }, GLOBAL_SEARCH_STATES.map(value => h("option", { key: value || "all", value }, value || "All Indian states")))),
                    h("label", { className: "field-block" }, h("span", null, "City / district"), h("input", { value: filters.city, onChange: e => update("city", e.target.value), placeholder: "e.g. Surat, Koraput" }))
                ) : null,
                filters.mode === "bid" ? h(React.Fragment,null,
                    h("label",{className:"field-block"},h("span",null,"Bid / RA number"),h("input",{value:filters.bid_number,onChange:e=>update("bid_number",e.target.value),placeholder:"GEM/2026/B/1234567"})),
                    h("label",{className:"field-block"},h("span",null,"Category"),h("input",{value:filters.category,onChange:e=>update("category",e.target.value),placeholder:"Product or service category"}))
                ):null,
                filters.mode === "ministry" ? h(React.Fragment,null,
                    h("label",{className:"field-block"},h("span",null,"Ministry"),h("select",{value:filters.ministry,disabled:!!filters.buyer_state,onChange:e=>chooseMinistry(e.target.value)},h("option",{value:""},"Select ministry"),(advancedOptions.ministries||[]).map(value=>h("option",{key:value,value},value)))),
                    h("label",{className:"field-block"},h("span",null,"Buyer state"),h("select",{value:filters.buyer_state,disabled:!!filters.ministry,onChange:e=>chooseBuyerState(e.target.value)},h("option",{value:""},"Select buyer state"),(advancedOptions.buyer_states||[]).map(value=>h("option",{key:value,value},value)))),
                    h("label",{className:"field-block"},h("span",null,"Organization"),h("select",{value:filters.organization,disabled:!(filters.ministry||filters.buyer_state),onChange:e=>chooseOrganization(e.target.value)},h("option",{value:""},filters.ministry||filters.buyer_state?"Select organization":"Select ministry or buyer state first"),organizationOptions.map(value=>h("option",{key:value,value},value)))),
                    h("label",{className:"field-block"},h("span",null,"Department"),h("select",{value:filters.advanced_department,disabled:!filters.organization,onChange:e=>update("advanced_department",e.target.value)},h("option",{value:""},filters.organization?"Select department":"Select organization first"),departmentOptions.map(value=>h("option",{key:value,value},value))))
                ):null,
                filters.mode === "location" ? h(React.Fragment,null,
                    h("label",{className:"field-block"},h("span",null,"Consignee state"),h("select",{value:filters.state,onChange:e=>chooseConsigneeState(e.target.value)},h("option",{value:""},"Select state"),(advancedOptions.states||[]).map(value=>h("option",{key:value,value},value)))),
                    h("div",{className:"global-city-checkboxes"},
                        !filters.state?h("p",{className:"desc"},"Select a state to load GeM cities."):null,
                        filters.state.toUpperCase()==="GUJARAT"?h(React.Fragment,null,h(AdvancedCheckboxFilter,{label:"Priority cities / districts",items:priorityAdvancedCities,value:filters.city,onChange:value=>update("city",value)}),h(AdvancedCheckboxFilter,{label:"Other locations",items:Array.from(new Set([...otherAdvancedCities,...locationCities])),value:filters.city,onChange:value=>update("city",value)})):null,
                        filters.state&&filters.state.toUpperCase()!=="GUJARAT"?h(AdvancedCheckboxFilter,{label:"GeM cities / districts",items:locationCities,value:filters.city,onChange:value=>update("city",value)}):null)
                ):null,
                filters.mode === "boq" ? h(React.Fragment,null,
                    h("label",{className:"field-block"},h("span",null,"BOQ title"),h("input",{value:filters.boq_title,onChange:e=>update("boq_title",e.target.value),placeholder:"Enter exact BOQ title"})),
                    h("label",{className:"field-block"},h("span",null,"Bid value"),h("select",{value:filters.high_value,onChange:e=>update("high_value",e.target.value)},h("option",{value:""},"All bid values"),h("option",{value:"highbid"},"High value (Rs. 2 Cr or more)")))
                ):null,
                h("div", { className: "global-date-grid" }, h("label", { className: "field-block" }, h("span", null, "End date from"), h("input", { type: "date", value: filters.from_date, onChange: e => update("from_date", e.target.value) })), h("label", { className: "field-block" }, h("span", null, "End date to"), h("input", { type: "date", value: filters.to_date, onChange: e => update("to_date", e.target.value) }))),
                h("button", { className: "primary global-filter-submit", onClick: () => search(1), disabled: loading }, "Apply Filters")
            ),
            h("main", { className: "global-search-results" },
                result.notice ? h("div", { className: "global-search-notice" }, result.notice) : null,
                message ? h("div", { className: "notice" }, message) : null,
                h("div", { className: "global-results-toolbar" },
                    h("strong", null, loading ? "Loading live results…" : `Showing ${result.items.length} of ${result.total || 0} records`),
                    filters.mode === "all" ? h("label", null, h("span", null, "Sort by"), h("select", { value: filters.sort, onChange: e => { const next = { ...filters, sort: e.target.value }; setFilters(next); search(1, next); } }, h("option", { value: "Bid-End-Date-Oldest" }, "End date: oldest first"), h("option", { value: "Bid-End-Date-Latest" }, "End date: latest first"), h("option", { value: "Bid-Start-Date-Latest" }, "Start date: latest first"), h("option", { value: "Bid-Start-Date-Oldest" }, "Start date: oldest first"))) : h("span", { className: "advanced-live-label" }, "GeM Advanced Search")
                ),
                !loading && !result.items.length ? h("div", { className: "empty" }, h("h3", null, "No matching live bids"), h("p", null, "Try a bid number or use fewer filters. GeM can take several minutes to publish new changes.")) : null,
                result.items.map(item => h("article", { className: "global-tender-card", key: item.bid_number || item.source_id },
                    h("div", { className: "global-card-top" }, h("a", { href: item.url, target: "_blank", rel: "noreferrer" }, item.bid_number || "GeM bid"), h("div", { className: "global-card-badges" }, item.is_high_value ? h("span", null, "High value") : null, item.is_global_tender ? h("span", null, "Global") : null)),
                    h("div", { className: "global-card-body" },
                        h("div", null, h("h3", null, item.title), h("p", null, `Quantity: ${item.quantity || "Not specified"}`)),
                        h("div", null, h("small", null, "Department name and address"), h("strong", null, item.authority || "Not specified"), item.organisation ? h("p", null, item.organisation) : null, item.office ? h("p", null, item.office) : null, (item.state || item.city) ? h("p", { className: "global-location" }, [item.city, item.state].filter(Boolean).join(", ")) : null),
                        h("div", { className: "global-card-dates" }, h("span", null, "Start date", h("strong", null, displayGemDate(item.start_date))), h("span", null, "End date", h("strong", null, displayGemDate(item.end_date))))
                    ),
                    h("div", { className: "global-card-actions" }, h("a", { className: "button secondary", href: item.url, target: "_blank", rel: "noreferrer" }, "View on GeM"), h("button", { className: "primary", disabled: saved[item.bid_number], onClick: () => save(item) }, saved[item.bid_number] === "saving" ? "Adding…" : saved[item.bid_number] === "saved" ? "Added" : "Add to Discovery"))
                )),
                result.items.length ? h("div", { className: "global-pagination" }, h("button", { disabled: loading || result.page <= 1, onClick: () => search(result.page - 1) }, "Previous"), h("span", null, `Page ${result.page} of ${result.pages}`), h("button", { disabled: loading || result.page >= result.pages, onClick: () => search(result.page + 1) }, "Next")) : null
            )
        )
    );
}

function App() {
    const [path, setPath] = useState(location.pathname);
    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(true);
    const [globalLoading, setGlobalLoadingState] = useState({ active: false, label: "Loading..." });
    const publicRoutes = ["/", "/features", "/pricing", "/how-it-works", "/about", "/contact", "/login", "/signup"];
    useEffect(() => {
        const onNav = () => setPath(location.pathname);
        addEventListener("popstate", onNav); addEventListener("app:navigate", onNav);
        return () => { removeEventListener("popstate", onNav); removeEventListener("app:navigate", onNav); };
    }, []);
    useEffect(() => {
        document.title = `${pageTitle(path)} | Tender AI`;
    }, [path]);
    useEffect(() => {
        const onLoading = event => setGlobalLoadingState(event.detail || { active: false, label: "Loading..." });
        addEventListener("app:loading", onLoading);
        return () => removeEventListener("app:loading", onLoading);
    }, []);
    async function refreshMe() {
        try { setMe(await api("/api/me")); }
        finally { setLoading(false); }
    }
    useEffect(() => {
        if (publicRoutes.includes(path)) { setLoading(false); return; }
        // Client-side dashboard navigation must not unmount the whole app just
        // to re-check a session that is already loaded. API calls still handle
        // an expired session through the shared 401 redirect.
        if (me) { setLoading(false); return; }
        setLoading(true); refreshMe();
    }, [path, me]);
    if (path === "/") return h(React.Fragment, null, h(GlobalBackdrop), h(HomePage));
    if (path === "/features") return h(React.Fragment, null, h(GlobalBackdrop), h(FeaturesPage));
    if (path === "/pricing") return h(React.Fragment, null, h(GlobalBackdrop), h(PricingPage));
    if (path === "/how-it-works") return h(React.Fragment, null, h(GlobalBackdrop), h(HowItWorksPage));
    if (path === "/about") return h(React.Fragment, null, h(GlobalBackdrop), h(AboutPage));
    if (path === "/contact") return h(React.Fragment, null, h(GlobalBackdrop), h(ContactPage));
    if (path === "/login") return h(AuthPage, { mode: "login" });
    if (path === "/signup") return h(AuthPage, { mode: "signup" });
    if (loading) return h(React.Fragment, null,
        h(GlobalBackdrop),
        h("div", { className: "empty" }, "Loading..."),
        globalLoading.active ? h("div", { className: "loading-overlay" }, h("div", { className: "loading-box" }, h("span", { className: "loader" }), h("strong", null, globalLoading.label || "Loading..."))) : null
    );
    const sellerOnlyRoutes = ["/dashboard/seller"];
    const buyerOnlyRoutes = ["/dashboard/buyer", "/dashboard/buyers", "/dashboard/market", "/dashboard/reports", "/dashboard/analysis", "/dashboard/competitors", "/dashboard/admin"];
    const restrictedBuyerRoutes = ["/dashboard/tender-search", "/dashboard/tenders", "/dashboard/scrape-history", "/dashboard/high-priority", "/dashboard/upcoming-deadlines", "/dashboard/applied", "/dashboard/pipeline", "/dashboard/tracking", "/dashboard/analysis", "/dashboard/market", "/dashboard/reports", "/dashboard/buyers", "/dashboard/competitors", "/dashboard/admin"];
    let route = path === "/dashboard" ? roleDashboard(me) : path;
    if (me?.role === "seller" && buyerOnlyRoutes.some(prefix => route === prefix || route.startsWith(`${prefix}/`))) route = "/dashboard/seller";
    if (me?.role !== "seller" && sellerOnlyRoutes.some(prefix => route === prefix || route.startsWith(`${prefix}/`))) route = "/dashboard/buyer";
    if (me?.role !== "seller" && restrictedBuyerRoutes.some(prefix => route === prefix || route.startsWith(`${prefix}/`))) route = "/dashboard/buyer";
    let page;
    if (route === "/dashboard/buyer") page = h(BuyerDashboardPage);
    else if (route === "/dashboard/buyer/bids") page = h(BuyerModulePage, { moduleKey: "bids" });
    else if (route === "/dashboard/buyer/bid-verification") page = h(BuyerBidRegisterPage);
    else if (route === "/dashboard/buyer/grants") page = h(BuyerModulePage, { moduleKey: "grants" });
    else if (route.startsWith("/dashboard/buyer/")) page = h(BuyerDashboardPage);
    else if (route === "/dashboard/seller") page = h(SellerDashboardPage);
    else if (route === "/dashboard/seller/analytics") page = h(SellerAnalyticsPage);
    else if (route === "/dashboard/seller/gem-login") page = h(SellerGemLoginPage);
    else if (route === "/dashboard/seller/gem-bids") page = h(SellerGemBidsPage);
    else if (route === "/dashboard/seller/intelligence") page = h(SellerIntelligenceOverviewPage);
    else if (route === "/dashboard/seller/intelligence/risk-data") page = h(SellerRiskDataPage);
    else if (route === "/dashboard/seller/intelligence/buyers") page = h(SellerBuyerHistoryPage);
    else if (route === "/dashboard/seller/intelligence/competitors") page = h(SellerCompetitorIntelligencePage);
    else if (route === "/dashboard/seller/intelligence/risk-signals") page = h(SellerRiskSignalsPage);
    else if (route === "/dashboard/seller/intelligence/reports") page = h(SellerRiskReportsPage);
    else if (route === "/dashboard/seller/intelligence/documents") page = h(SellerDocumentExtractionPage);
    else if (route === "/dashboard/seller/readiness") page = h(SellerReadinessPage);
    else if (route === "/dashboard/seller/catalogue") page = h(SellerCataloguePage);
    else if (route === "/dashboard/seller/opportunities") page = h(SellerOpportunitiesPage);
    else if (route === "/dashboard/seller/bids") page = h(SellerBidsPage);
    else if (route === "/dashboard/seller/orders") page = h(SellerOrdersPage);
    else if (route === "/dashboard/seller/keywords") page = h(KeywordsPage);
    else if (route === "/dashboard/seller/scoring") page = h(ScoringPage);
    else if (route === "/dashboard/seller/settings") page = h(SettingsPage);
    else if (route === "/dashboard/seller/data") page = h(DeletePage);
    else if (route === "/dashboard/tender-search") page = h(GlobalTenderSearchPage);
    else if (route === "/dashboard/tenders") page = h(DashboardPage, { view: "all" });
    else if (route === "/dashboard/scrape-history") page = h(ScrapeHistoryPage);
    else if (route === "/dashboard/high-priority") page = h(DashboardPage, { view: "high" });
    else if (route === "/dashboard/upcoming-deadlines") page = h(DashboardPage, { view: "upcoming" });
    else if (route === "/dashboard/applied") page = h(DashboardPage, { view: "applied" });
    else if (route === "/dashboard/pipeline") page = h(PipelinePage);
    else if (route === "/dashboard/tracking") page = h(TrackingPage);
    else if (route === "/dashboard/analysis") page = h(AnalysisPage);
    else if (route === "/dashboard/market") page = h(MarketIntelligencePage);
    else if (route === "/dashboard/reports") page = h(ExecutiveReportsPage);
    else if (route === "/dashboard/buyers") page = h(BuyerIntelligencePage);
    else if (route === "/dashboard/competitors") page = h(CompetitorIntelligencePage);
    else if (route === "/dashboard/admin") page = h(AdminPage);
    else if (route === "/dashboard/admin/keywords") page = h(KeywordsPage);
    else if (route === "/dashboard/admin/scoring") page = h(ScoringPage);
    else if (route === "/dashboard/seller/gem-alerts" || route === "/dashboard/admin/gem-alerts") page = h(GemAlertsPage);
    else if (route === "/dashboard/admin/settings") page = h(SettingsPage);
    else if (route === "/dashboard/admin/delete") page = h(DeletePage);
    else if (route === "/dashboard/company-profile") page = h(CompanyProfilePage);
    else if (route === "/dashboard/profile") page = h(ProfilePage, { me, refreshMe });
    else page = h(DashboardPage, { view: "all" });
    return h(React.Fragment, null,
        h(GlobalBackdrop),
        h(Shell, { me, path: route }, page),
        globalLoading.active ? h("div", { className: "loading-overlay" }, h("div", { className: "loading-box" }, h("span", { className: "loader" }), h("strong", null, globalLoading.label || "Loading..."))) : null
    );
}

createRoot(document.getElementById("root")).render(h(App));

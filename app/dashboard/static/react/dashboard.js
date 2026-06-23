import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";

const h = React.createElement;

const nav = [
    ["Tenders", [["/dashboard", "All Tenders"], ["/dashboard/high-priority", "High Priority"], ["/dashboard/upcoming-deadlines", "Upcoming"], ["/dashboard/applied", "Applied"]]],
    ["Workflow", [["/dashboard/pipeline", "Pipeline Kanban"], ["/dashboard/tracking", "Status Tracking"]]],
    ["Intelligence", [["/dashboard/analysis", "Analysis"], ["/dashboard/market", "Market Intelligence"], ["/dashboard/reports", "Executive Reports"], ["/dashboard/buyers", "Buyer Intelligence"], ["/dashboard/competitors", "Competitor Intelligence"]]],
    ["Automation", [["/dashboard/admin", "Admin"], ["/dashboard/admin/keywords", "Keywords"], ["/dashboard/admin/scoring", "Scoring"], ["/dashboard/admin/gem-alerts", "GeM Alerts"], ["/dashboard/admin/settings", "Settings"], ["/dashboard/admin/delete", "Delete Data"]]],
    ["Account", [["/dashboard/company-profile", "Company Profile"], ["/dashboard/profile", "Profile"]]],
];

const buyerNav = [
    ["Buyer", [["/dashboard/buyer", "Buyer Dashboard"]]],
    ["Tenders", [["/dashboard/tenders", "All Tenders"], ["/dashboard/high-priority", "High Priority"], ["/dashboard/upcoming-deadlines", "Upcoming"], ["/dashboard/applied", "Applied"]]],
    ["Workflow", [["/dashboard/pipeline", "Pipeline Kanban"], ["/dashboard/tracking", "Status Tracking"]]],
    ["Intelligence", [["/dashboard/analysis", "Analysis"], ["/dashboard/market", "Market Intelligence"], ["/dashboard/reports", "Executive Reports"], ["/dashboard/buyers", "Buyer Intelligence"], ["/dashboard/competitors", "Competitor Intelligence"]]],
    ["Automation", [["/dashboard/admin", "Admin"], ["/dashboard/admin/keywords", "Keywords"], ["/dashboard/admin/scoring", "Scoring"], ["/dashboard/admin/settings", "Settings"], ["/dashboard/admin/delete", "Delete Data"]]],
    ["Account", [["/dashboard/company-profile", "Company Profile"], ["/dashboard/profile", "Profile"]]],
];

const sellerNav = [
    ["Seller", [["/dashboard/seller", "Seller Dashboard"], ["/dashboard/seller/analytics", "Analytics"]]],
    ["GeM Portal", [["/dashboard/seller/gem-login", "Secure Login"], ["/dashboard/seller/gem-bids", "Participated Bids"], ["/dashboard/seller/gem-alerts", "GeM Alerts"]]],
    ["Operations", [["/dashboard/seller/readiness", "Readiness"], ["/dashboard/seller/catalogue", "Catalogue"], ["/dashboard/seller/opportunities", "Opportunity Match"], ["/dashboard/seller/bids", "Bid/RA Workflow"], ["/dashboard/seller/orders", "Orders"]]],
    ["Bid Work", [["/dashboard/tenders", "All Tenders"], ["/dashboard/high-priority", "High Priority"], ["/dashboard/upcoming-deadlines", "Upcoming"], ["/dashboard/applied", "Applied"], ["/dashboard/pipeline", "Pipeline Kanban"], ["/dashboard/tracking", "Status Tracking"]]],
    ["Account", [["/dashboard/company-profile", "Company Profile"], ["/dashboard/profile", "Profile"]]],
];

function navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new Event("app:navigate"));
}

function roleDashboard(user) {
    return user?.role === "seller" ? "/dashboard/seller" : "/dashboard/buyer";
}

async function api(path, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
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
    const base = `Scrape finished. Inserted ${result?.inserted || 0}, scored ${result?.scored || 0}.`;
    return detail ? `${base} ${detail}` : base;
}

function pageTitle(path) {
    const match = nav.flatMap(([, items]) => items).find(([href]) => href === path);
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
    if (path === "/dashboard/seller") return "Seller Dashboard";
    if (path === "/dashboard/seller/analytics") return "Seller Analytics";
    if (path === "/dashboard/seller/gem-login") return "GeM Login";
    if (path === "/dashboard/seller/gem-bids") return "GeM Bid Tracking";
    if (path === "/dashboard/seller/gem-alerts") return "GeM Alerts";
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
                me ? h("span", { className: "site-user" }, me.name || me.email) : h("button", { className: "ghost", onClick: () => navigate("/login") }, "Login"),
                h("button", { className: "primary", onClick: () => navigate(me ? "/dashboard" : "/signup") }, me ? "Go to Dashboard" : "Start Free")
            )
        ),
        children,
        h(PublicCTA),
        h("footer", { className: "site-footer" },
            h("div", null, h("strong", null, "Tender AI"), h("p", null, "AI-powered tender discovery, scoring, tracking, analytics, and alerts.")),
            h("div", null, publicNav.map(([href, label]) => h("button", { key: href, onClick: () => navigate(href) }, label)))
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

function AuthPage({ mode }) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("buyer");
    const [error, setError] = useState("");
    const isSignup = mode === "signup";
    const { me, checked } = useSessionProbe();
    useEffect(() => {
        if (checked && me) navigate(roleDashboard(me));
    }, [checked, me]);

    async function submit(event) {
        event.preventDefault();
        setError("");
        try {
            const result = await api(isSignup ? "/api/signup" : "/api/login", {
                method: "POST",
                body: JSON.stringify(isSignup ? { name, email, password, role } : { email, password }),
            });
            navigate(result?.dashboard_path || roleDashboard(result));
        } catch (err) {
            setError(err.message || "Authentication failed.");
        }
    }

    if (!checked) return h("div", { className: "auth" }, h("div", { className: "empty auth-loading" }, "Checking session..."));
    if (me) return h("div", { className: "empty" }, "Opening dashboard...");

    return h("div", { className: "auth" },
        h("div", { className: "auth-art" },
            h("button", { type: "button", className: "auth-home", onClick: () => navigate("/") }, h("span", { className: "brand-mark" }, "T"), "Tender ", h("span", null, "AI")),
            h("h1", null, isSignup ? "Start tracking smarter bids." : "Welcome back."),
            h("p", null, "Scrape GeM tenders, score opportunities, analyze bid coverage, and keep each user workspace isolated."),
            h("div", { className: "auth-proof" }, productStats.slice(1).map(([value, label]) => h("div", { key: value }, h("strong", null, value), h("span", null, label))))
        ),
        h("form", { className: "auth-card", onSubmit: submit },
            h("h2", null, isSignup ? "Create account" : "Sign in"),
            error ? h("div", { className: "notice err" }, error) : null,
            isSignup ? h("input", { value: name, onChange: e => setName(e.target.value), placeholder: "Name", required: true }) : null,
            isSignup ? h("div", { className: "role-choice" },
                h("button", { type: "button", className: role === "buyer" ? "active" : "", onClick: () => setRole("buyer") }, "Buyer"),
                h("button", { type: "button", className: role === "seller" ? "active" : "", onClick: () => setRole("seller") }, "Seller")
            ) : null,
            h("input", { value: email, onChange: e => setEmail(e.target.value), placeholder: "Email", type: "email", required: true }),
            h("input", { value: password, onChange: e => setPassword(e.target.value), placeholder: "Password", type: "password", required: true }),
            h("button", { className: "primary" }, isSignup ? "Create Account" : "Login"),
            h("button", { type: "button", className: "link-btn", onClick: () => navigate(isSignup ? "/login" : "/signup") }, isSignup ? "Already have an account?" : "Create new account")
        )
    );
}

function Shell({ children, me, path }) {
    const sections = me?.role === "seller" ? sellerNav : buyerNav;
    return h("div", { className: "app" },
        h("aside", { className: "sidebar" },
            h("div", { className: "brand" }, "Tender ", h("span", null, "AI")),
            h("div", { className: "muted" }, me?.role === "seller" ? "Seller Workspace" : "Buyer Workspace"),
            h("nav", { className: "nav" },
                sections.map(([section, items]) => h("div", { className: "nav-group", key: section },
                    h("div", { className: "nav-section" }, section),
                    items.map(([href, label]) => h("button", {
                        key: href,
                        className: path === href ? "active" : "",
                        onClick: () => navigate(href),
                    }, label))
                ))
            )
        ),
        h("main", { className: "main" },
            h("header", { className: "topbar" },
                h("div", null, h("h1", null, pageTitle(path)), h("div", { className: "muted" }, "Monitor, scrape, score, and analyze tenders")),
                h("div", { className: "user" },
                    h("div", { className: "avatar" }, (me?.name || me?.email || "U").slice(0, 1).toUpperCase()),
                    h("strong", null, me?.name || "User"),
                    h("span", { className: "profile-pill role-pill" }, me?.role === "seller" ? "Seller" : "Buyer"),
                    h("button", { className: "profile-pill", onClick: () => navigate("/dashboard/profile") }, "Profile"),
                    h("button", { className: "logout", onClick: async () => { await fetch("/api/logout", { method: "POST" }); navigate("/login"); } }, "Logout")
                )
            ),
            h("section", { className: "content" }, children)
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

function BuyerDashboardPage() {
    const [summary, setSummary] = useState(null);
    const [buyerData, setBuyerData] = useState(null);
    const [marketData, setMarketData] = useState(null);
    const [upcoming, setUpcoming] = useState([]);
    const [message, setMessage] = useState("");
    useEffect(() => {
        Promise.all([
            api("/api/dashboard/summary"),
            api("/api/buyers"),
            api("/api/market"),
            api("/api/tenders?view=upcoming&limit=6&sort=deadline"),
        ]).then(([s, b, m, t]) => {
            setSummary(s);
            setBuyerData(b);
            setMarketData(m);
            setUpcoming(t.items || []);
        }).catch(err => setMessage(err.message));
    }, []);
    const topBuyers = buyerData?.buyers || [];
    const opportunities = marketData?.opportunities || [];
    return h(React.Fragment, null,
        h("div", { className: "hero-panel buyer-landing" },
            h("div", null,
                h("h2", null, "Buyer Dashboard"),
                h("p", null, "Review procurement demand, buyer behavior, market movement, and upcoming tender deadlines from one workspace.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/buyers") }, "Buyer Intelligence"),
                h("button", { onClick: () => navigate("/dashboard/market") }, "Market View")
            )
        ),
        message ? h("div", { className: "notice err" }, message) : null,
        h(Summary, { summary }),
        h("div", { className: "admin-grid" },
            h("div", { className: "card" }, h("h3", null, "Top Buyers"), topBuyers.length ? topBuyers.slice(0, 5).map(buyer =>
                h("div", { className: "rule-list", key: buyer.name },
                    h("span", null, buyer.name),
                    h("strong", null, `${buyer.tender_count || 0} tenders`)
                )
            ) : h("div", { className: "empty" }, "No buyer data yet."), h("button", { onClick: () => navigate("/dashboard/buyers") }, "Open Buyers")),
            h("div", { className: "card" }, h("h3", null, "Market Opportunities"), opportunities.length ? opportunities.slice(0, 5).map(item =>
                h("div", { className: "rule-list", key: item.id || item.title },
                    h("span", null, item.title || item.department || "Opportunity"),
                    h("strong", null, item.market_score ? `${item.market_score} score` : money(item.value || 0))
                )
            ) : h("div", { className: "empty" }, "No market signals yet."), h("button", { onClick: () => navigate("/dashboard/reports") }, "Open Reports")),
            h("div", { className: "card" }, h("h3", null, "Upcoming Deadlines"), upcoming.length ? upcoming.map(tender =>
                h("div", { className: "rule-list", key: tender.id },
                    h("span", null, tender.title),
                    h("strong", null, tender.deadline || "No deadline")
                )
            ) : h("div", { className: "empty" }, "No upcoming tenders."), h("button", { onClick: () => navigate("/dashboard/upcoming-deadlines") }, "Review Upcoming"))
        )
    );
}

function SellerDashboardPage() {
    const [summary, setSummary] = useState(null);
    const [readiness, setReadiness] = useState(null);
    const [message, setMessage] = useState("");
    useEffect(() => {
        Promise.all([
            api("/api/dashboard/summary"),
            api("/api/seller/readiness"),
        ]).then(([s, r]) => {
            setSummary(s);
            setReadiness(r.summary || null);
        }).catch(err => setMessage(err.message));
    }, []);
    return h(React.Fragment, null,
        h("div", { className: "hero-panel seller-landing" },
            h("div", null,
                h("h2", null, "Seller Dashboard"),
                h("p", null, "Manage seller readiness, bid workflow, document health, and tender follow-up.")
            ),
            h("div", { className: "hero-actions" },
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/analytics") }, "Analytics"),
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/readiness") }, "Readiness"),
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/catalogue") }, "Catalogue"),
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/gem-bids") }, "GeM Bids"),
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/bids") }, "Bid/RA"),
                h("button", { className: "primary", onClick: () => navigate("/dashboard/seller/orders") }, "Orders"),
                h("button", { className: "primary", onClick: () => navigate("/dashboard/high-priority") }, "High Priority"),
                h("button", { onClick: () => navigate("/dashboard/pipeline") }, "Pipeline")
            )
        ),
        message ? h("div", { className: "notice err" }, message) : null,
        h("div", { className: "summary six seller-summary" },
            [["Tenders", summary?.total || 0], ["High Priority", summary?.high_priority || 0], ["Applied", summary?.applied_count || 0], ["Upcoming", summary?.upcoming_count || 0], ["Readiness", readiness?.health_score ?? 0], ["Missing Docs", readiness?.missing_documents?.length || 0]].map(([label, value]) =>
                h("div", { className: "tile", key: label }, h("span", null, label), h("strong", null, value))
            )
        ),
        h("div", { className: "admin-grid seller-ops-grid" },
            h("section", { className: "card" },
                h("h3", null, "Seller Readiness"),
                h("div", { className: `readiness-score compact ${readiness?.level || "incomplete"}` }, h("span", null, "Health Score"), h("strong", null, readiness?.health_score ?? 0)),
                (readiness?.profile_gaps || []).length ? h("ul", { className: "log-list" }, readiness.profile_gaps.slice(0, 5).map(gap => h("li", { key: gap }, gap))) : h("div", { className: "notice ok" }, "Seller profile checks are complete."),
                h("button", { onClick: () => navigate("/dashboard/seller/readiness") }, "Open Readiness")
            ),
            h("section", { className: "card" },
                h("h3", null, "Seller Workbench"),
                h("div", { className: "seller-action-grid" },
                    h("button", { onClick: () => navigate("/dashboard/seller/catalogue") }, "Catalogue"),
                    h("button", { onClick: () => navigate("/dashboard/seller/bids") }, "Bid/RA Workflow"),
                    h("button", { onClick: () => navigate("/dashboard/seller/orders") }, "Orders"),
                    h("button", { onClick: () => navigate("/dashboard/pipeline") }, "Pipeline"),
                    h("button", { onClick: () => navigate("/dashboard/high-priority") }, "High Priority"),
                    h("button", { onClick: () => navigate("/dashboard/upcoming-deadlines") }, "Upcoming"),
                    h("button", { onClick: () => navigate("/dashboard/company-profile") }, "Company Profile")
                )
            ),
            h("section", { className: "card" },
                h("h3", null, "Bid Follow-Up"),
                h("div", { className: "seller-action-grid" },
                    h("button", { onClick: () => navigate("/dashboard/applied") }, "Applied"),
                    h("button", { onClick: () => navigate("/dashboard/tracking") }, "Tracking"),
                    h("button", { onClick: () => navigate("/dashboard/tenders") }, "All Tenders"),
                    h("button", { onClick: () => navigate("/dashboard/seller/readiness") }, "Documents")
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
        setMessage("Opening GeM login window...");
        try {
            const result = await api("/api/seller/gem-login/start", { method: "POST" });
            setCredential(result.credential);
            setAssisted({ active: true, url: result.url, started_at: result.started_at });
            setMessage(result.message || "GeM login window opened. Complete OTP/CAPTCHA there, then capture session here.");
        } catch (err) {
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
            setMessage(result.message || (result.active ? "GeM login window is active." : "No GeM login window is active."));
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
            setMessage(result.message || "GeM session captured securely.");
        } catch (err) {
            setMessage(err.message || "Could not capture GeM session. Complete OTP/CAPTCHA in the opened GeM browser first.");
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
                            h("li", null, "Open the real GeM portal."),
                            h("li", null, "Complete OTP/CAPTCHA in that browser window."),
                            h("li", null, "Return here and capture the session.")
                        )
                    ),
                    h("div", { className: "gem-assisted-actions" },
                        h("button", { className: "primary", disabled: saving || !credential?.configured, onClick: startAssistedLogin }, "Start GeM Login"),
                        h("button", { disabled: saving, onClick: checkAssistedLogin }, "Check Window"),
                        h("button", { disabled: saving || !assisted.active, onClick: captureAssistedLogin }, "Capture Session"),
                        h("button", { className: "danger", disabled: saving || !assisted.active, onClick: cancelAssistedLogin }, "Cancel")
                    )
                ),
                assisted?.active ? h("div", { className: "gem-window-status" },
                    h("span", null, "Window Active"),
                    h("strong", null, assisted.url || "GeM login browser opened")
                ) : null,
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
            const result = await api("/api/seller/gem-bids/sync-now", { method: "POST" });
            setMessage(result.message || "Sync check finished.");
            await load();
        } catch (err) {
            setMessage(err.message || (automatic ? "Could not auto-fetch participated bids." : "Could not start GeM sync."));
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
            )) : h("div", { className: "empty" }, syncing ? "Fetching participated bids from GeM..." : items.length ? "No bids match this filter." : "No participated bids fetched yet. Save GeM login, then sync this page.")
        )
    );
}

function TenderTable({ tenders, options, filters, setFilters, onRefresh, onApply, onReset, resultCount }) {
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
            h("input", { value: filters.q, onChange: e => update("q", e.target.value), onKeyDown: e => { if (e.key === "Enter") onApply(); }, placeholder: "Search title, department, state..." }),
            h("select", { value: filters.score, onChange: e => update("score", e.target.value) },
                h("option", { value: "all" }, "All Scores"),
                h("option", { value: "high" }, "High 70+"),
                h("option", { value: "medium" }, "Medium 40-69"),
                h("option", { value: "low" }, "Low <40"),
                h("option", { value: "unscored" }, "Unscored")
            ),
            h("button", { className: "primary", onClick: onApply }, "Apply"),
            h("button", { type: "button", onClick: () => setAdvancedOpen(!advancedOpen) }, advancedOpen ? "Hide Filters" : "Advanced Filters"),
            h("a", { className: "download-btn", href: "/exports/tenders/xlsx" }, "Download CSV"),
            h("a", { className: "download-btn", href: "/exports/tenders/pdf" }, "Download Report")
        ),
        advancedOpen ? h("div", { className: "advanced-filters" },
            select("status", "Status", options.statuses),
            select("department", "Buyer", options.departments),
            select("state", "State", options.states),
            select("category", "Category", options.categories),
            select("source", "Source", options.sources),
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
        h("div", { className: "filter-result" }, `Showing ${tenders.length} of ${resultCount ?? tenders.length} matching tenders`),
        h("div", { className: "panel" },
            tenders.length === 0 ? h("div", { className: "empty" }, "No tenders found.") :
            h("table", null,
                h("thead", null, h("tr", null, ["Tender", "Department", "Value", "Deadline", "Score", "Status", "Actions"].map(x => h("th", { key: x }, x)))),
                h("tbody", null, tenders.map(t => h(TenderRow, { key: t.id, tender: t, onSave: saveStatus })))
            )
        )
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
        h("td", null, tender.department || "GeM", h("div", { className: "desc" }, tender.state || "")),
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

function DashboardPage({ view }) {
    const [summary, setSummary] = useState(null);
    const [tenders, setTenders] = useState([]);
    const [options, setOptions] = useState({ departments: [], states: [], categories: [], sources: [], statuses: [] });
    const blankFilters = { q: "", score: "all", status: "", department: "", state: "", category: "", source: "", min_value: "", max_value: "", deadline_from: "", deadline_to: "", deadline_bucket: "", eligibility: "", bid_decision: "", sort: "newest" };
    const [filters, setFilters] = useState(blankFilters);
    const [resultCount, setResultCount] = useState(0);
    const [message, setMessage] = useState("");
    function queryString(nextFilters = filters) {
        const params = new URLSearchParams({ view, limit: "200" });
        Object.entries(nextFilters).forEach(([key, value]) => {
            if (value !== "" && value !== null && value !== undefined && !(key === "score" && value === "all") && !(key === "sort" && value === "newest")) {
                params.set(key, value);
            }
        });
        return params.toString();
    }
    async function load(nextFilters = filters) {
        const [s, t, o] = await Promise.all([api("/api/dashboard/summary"), api(`/api/tenders?${queryString(nextFilters)}`), api("/api/tender-filter-options")]);
        setSummary(s); setTenders(t.items || []); setResultCount(t.count ?? (t.items || []).length); setOptions(o);
    }
    useEffect(() => {
        setFilters(blankFilters);
        load(blankFilters).catch(e => setMessage(e.message));
    }, [view]);
    async function applyFilters() { await load(filters); }
    async function resetFilters() {
        setFilters(blankFilters);
        await load(blankFilters);
    }
    async function scrape() {
        setMessage("Manual scrape running...");
        const result = await api("/api/scrape-now", { method: "POST" });
        setMessage(scrapeMessage(result));
        await load();
    }
    async function extractAllEligibility() {
        setMessage("Extracting eligibility from current tender list...");
        const result = await api("/api/eligibility/extract", { method: "POST" });
        setMessage(`Eligibility extraction finished. Extracted ${result.extracted || 0}, failed ${result.failed || 0}.`);
        await load();
    }
    async function generateAllBidDecisions() {
        setMessage("Generating bid/no-bid recommendations...");
        const result = await api("/api/bid-decisions/generate", { method: "POST" });
        setMessage(`Bid/no-bid generation finished. Generated ${result.generated || 0}, failed ${result.failed || 0}.`);
        await load();
    }
    return h(React.Fragment, null,
        message ? h("p", { className: "status" }, message) : null,
        h(Summary, { summary }),
        h("div", { className: "top-actions" },
            h("button", { className: "primary", onClick: scrape }, "Manual Scrape"),
            h("button", { onClick: extractAllEligibility }, "Extract Eligibility"),
            h("button", { onClick: generateAllBidDecisions }, "Generate Bid/No-Bid")
        ),
        h(TenderTable, { tenders, options, filters, setFilters, onRefresh: () => load(filters), onApply: applyFilters, onReset: resetFilters, resultCount })
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
    const [documents, setDocuments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [options, setOptions] = useState({ document: [], vendor_assessment: [], caution_money: [], tds_certificate: [] });
    const [message, setMessage] = useState("");
    async function load() {
        const data = await api("/api/seller/readiness");
        setProfile({ ...blank, ...(data.profile || {}) });
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
        setSummary(result.summary || summary);
        setMessage("Seller readiness profile saved.");
    }
    async function saveDocument(doc, patch) {
        const next = { ...doc, ...patch };
        setDocuments(documents.map(item => item.doc_key === doc.doc_key ? next : item));
        const result = await api(`/api/seller/readiness/documents/${doc.doc_key}`, {
            method: "POST",
            body: JSON.stringify({ status: next.status, expiry_date: next.expiry_date, notes: next.notes }),
        });
        setDocuments(documents.map(item => item.doc_key === doc.doc_key ? result.document : item));
        setSummary(result.summary || summary);
    }
    const field = (key, label, placeholder = "") => h("label", { className: "field-block" }, h("span", null, label), h("input", { value: profile[key] || "", placeholder, onChange: e => setProfile({ ...profile, [key]: e.target.value }) }));
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
                    field("gem_seller_id", "GeM seller ID", "GeM seller registration ID"),
                    field("pan", "PAN", "ABCDE1234F"),
                    field("gstin", "GSTIN", "GST number or leave blank if exempt"),
                    field("udyam_number", "Udyam / MSME number"),
                    field("startup_india_number", "Startup India certificate number"),
                    h("div", { className: "value-row" }, field("odop_state", "ODOP state"), field("odop_product", "ODOP product")),
                    toggle("aadhaar_linked", " Aadhaar linked with registered mobile"),
                    toggle("bank_verified", " Bank account verified"),
                    toggle("address_verified", " Business address verified"),
                    toggle("secondary_user_created", " Secondary user created"),
                    select("vendor_assessment_status", "Vendor assessment", options.vendor_assessment),
                    select("caution_money_status", "Caution money", options.caution_money),
                    select("tds_certificate_status", "TDS certificate", options.tds_certificate),
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
                h("div", { className: "document-card-head" }, h("strong", null, doc.label), h("span", null, (doc.status || "missing").replaceAll("_", " "))),
                h("select", { value: doc.status || "missing", onChange: e => saveDocument(doc, { status: e.target.value }) },
                    (options.document || []).map(value => h("option", { key: value, value }, value.replaceAll("_", " ")))
                ),
                h("input", { type: "date", value: doc.expiry_date || "", onChange: e => saveDocument(doc, { expiry_date: e.target.value }) }),
                h("textarea", { value: doc.notes || "", placeholder: "Notes", onBlur: e => saveDocument(doc, { notes: e.target.value }), onChange: e => setDocuments(documents.map(item => item.doc_key === doc.doc_key ? { ...item, notes: e.target.value } : item)) })
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
            )) : h("div", { className: "empty" }, "No catalogue items yet.")
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
            )) : h("div", { className: "empty" }, "No bid/RA workflows yet.")
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
            )) : h("div", { className: "empty" }, "No tenders available for opportunity matching yet.")
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
            )) : h("div", { className: "empty" }, "No order trackers yet.")
        )
    );
}

function AdminPage() {
    const [summary, setSummary] = useState(null);
    const [logs, setLogs] = useState([]);
    const [message, setMessage] = useState("");
    async function load() { setSummary(await api("/api/dashboard/summary")); setLogs((await api("/api/admin/logs")).items || []); }
    useEffect(() => { load(); }, []);
    async function scrape() { setMessage("Manual scrape running..."); const r = await api("/api/scrape-now", { method: "POST" }); setMessage(scrapeMessage(r)); await load(); }
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
    const selectedValues = field => settings[field] || [];
    const setSelected = (field, event) => setSettings({ ...settings, [field]: Array.from(event.target.selectedOptions).map(option => option.value) });
    const niceLabel = value => String(value || "").split(" ").map(part => part.length <= 4 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
    const multiSelect = (field, label, items) => {
        const selected = selectedValues(field);
        const options = Array.from(new Set([...(items || []), ...selected])).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
        return h("label", { className: "field-block gem-alert-select-block" },
            h("span", null, label),
            h("select", { multiple: true, className: "gem-alert-select", value: selected, onChange: e => setSelected(field, e) },
                options.map(item => h("option", { key: item, value: item }, niceLabel(item)))
            ),
            h("div", { className: "selected-alert-tags" },
                selected.length ? selected.map(item => h("button", {
                    key: item,
                    type: "button",
                    className: "selected-alert-tag",
                    onClick: () => setSettings({ ...settings, [field]: selected.filter(value => value !== item) })
                }, niceLabel(item), h("span", null, "x"))) : h("small", null, "Select one or more options")
            )
        );
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
            h("p", { className: "desc" }, "Watch specific GeM categories or company names. Scheduled checks run daily at 6 AM and 6 PM and notify you when matching new tenders are added."),
            message ? h("p", { className: "status" }, message) : null,
            h("form", { className: "stack", onSubmit: save },
                h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!settings.enabled, onChange: e => setSettings({ ...settings, enabled: e.target.checked }) }), " Enable GeM alert schedule"),
                multiSelect("categories", "GeM categories", settings.options?.categories || []),
                multiSelect("companies", "Companies / departments", settings.options?.company_departments || []),
                h("div", { className: "schedule-pills" }, (settings.schedules || ["06:00","18:00"]).map(slot => h("span", { key: slot }, slot === "06:00" ? "6:00 AM" : "6:00 PM"))),
                h("button", { className: "primary" }, "Save Alert Settings"),
                h("button", { type: "button", disabled: running, onClick: runNow }, running ? "Running..." : "Run Alert Check Now")
            )
        ),
        h("section", { className: "card" },
            h("h3", null, "Alert Status"),
            h("div", { className: "alert-status-grid" },
                h("div", null, h("span", null, "Telegram"), h("strong", null, settings.telegram_enabled ? "Enabled" : "Off")),
                h("div", null, h("span", null, "Email"), h("strong", null, settings.email_enabled ? "Enabled" : "Off")),
                h("div", null, h("span", null, "Last 6 AM"), h("strong", null, settings.last_6am || "Not run")),
                h("div", null, h("span", null, "Last 6 PM"), h("strong", null, settings.last_6pm || "Not run"))
            ),
            h("div", { className: "notice" }, "Alerts use your Profile notification toggles. Keep Telegram or Email enabled in Profile to receive messages.")
        )
    );
}

function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [digestMessage, setDigestMessage] = useState("");
    async function load() { setSettings(await api("/api/admin/settings")); }
    useEffect(() => { load(); }, []);
    if (!settings) return h("div", { className: "empty" }, "Loading settings...");
    async function saveHigh(value) { await api("/api/admin/settings/only-high-priority", { method: "POST", body: JSON.stringify({ enabled: value }) }); await load(); }
    async function saveLocation(e) { e.preventDefault(); await api("/api/admin/settings/location", { method: "POST", body: JSON.stringify({ states: settings.scrape_states, city: settings.scrape_city }) }); await load(); }
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
    return h("div", { className: "admin-grid" },
        h("div", { className: "card" }, h("h3", null, "High Priority Scrape"), h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: settings.only_high_priority, onChange: e => saveHigh(e.target.checked) }), " Keep only high priority bids")),
        h("div", { className: "card" }, h("h3", null, "Location Filters"), h("form", { onSubmit: saveLocation, className: "stack" },
            h("select", { multiple: true, value: settings.scrape_states, onChange: e => setSettings({ ...settings, scrape_states: Array.from(e.target.selectedOptions).map(o => o.value) }) }, settings.indian_states.map(s => h("option", { key: s, value: s }, s))),
            h("input", { value: settings.scrape_city || "", onChange: e => setSettings({ ...settings, scrape_city: e.target.value }), placeholder: "City" }),
            h("button", { className: "primary" }, "Save Location")
        )),
        h("div", { className: "card" }, h("h3", null, "Auto Scrape"), h("form", { onSubmit: saveAuto, className: "stack" },
            h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: settings.auto_scrape_enabled, onChange: e => setSettings({ ...settings, auto_scrape_enabled: e.target.checked }) }), " Enabled"),
            h("select", { value: settings.auto_scrape_mode, onChange: e => setSettings({ ...settings, auto_scrape_mode: e.target.value }) }, h("option", { value: "interval" }, "Every N hours"), h("option", { value: "daily" }, "Daily time")),
            h("input", { type: "number", value: settings.auto_scrape_interval_hours, onChange: e => setSettings({ ...settings, auto_scrape_interval_hours: e.target.value }) }),
            h("input", { type: "time", value: settings.auto_scrape_time, onChange: e => setSettings({ ...settings, auto_scrape_time: e.target.value }) }),
            h("button", { className: "primary" }, "Save Auto Scrape")
        )),
        h("div", { className: "card" }, h("h3", null, "Daily Digest Alerts"), h("form", { onSubmit: saveDigest, className: "stack" },
            digestMessage ? h("p", { className: "status" }, digestMessage) : null,
            h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!settings.daily_digest_enabled, onChange: e => setSettings({ ...settings, daily_digest_enabled: e.target.checked }) }), " Send daily digest"),
            h("label", { className: "field-block" }, h("span", null, "Digest time"), h("input", { type: "time", value: settings.daily_digest_time || "09:00", onChange: e => setSettings({ ...settings, daily_digest_time: e.target.value }) })),
            h("label", { className: "field-block" }, h("span", null, "High priority minimum score"), h("input", { type: "number", min: 0, max: 100, value: settings.daily_digest_min_score || "70", onChange: e => setSettings({ ...settings, daily_digest_min_score: e.target.value }) })),
            settings.daily_digest_last_run ? h("p", { className: "desc" }, `Last digest: ${settings.daily_digest_last_run}`) : h("p", { className: "desc" }, "No daily digest sent yet."),
            h("button", { className: "primary" }, "Save Digest Settings"),
            h("button", { type: "button", onClick: sendDigestNow }, "Send Digest Now")
        ))
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
        setMessage(`Deleted ${result.deleted_tenders || 0} tenders.`);
        setSummary(await api("/api/admin/delete-summary"));
    }
    return h("div", { className: "card danger-card" }, h("h3", null, "Delete Tender Data"), h("p", { className: "desc" }, `Current tender entries: ${summary?.tenders ?? 0}`), message ? h("p", { className: "status" }, message) : null, h("input", { value: confirm, onChange: e => setConfirm(e.target.value), placeholder: "DELETE ALL TENDERS" }), h("label", { className: "toggle" }, h("input", { type: "checkbox", checked, onChange: e => setChecked(e.target.checked) }), " I understand this deletes tender data for this user."), h("button", { className: "primary danger", disabled: confirm !== "DELETE ALL TENDERS" || !checked, onClick: remove }, "Delete All Tender Entries"));
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

function ProfilePage({ me, refreshMe }) {
    const [form, setForm] = useState({ name: me?.name || "", email: me?.email || "", telegram_enabled: me?.notifications?.telegram, email_enabled: me?.notifications?.email });
    const [password, setPassword] = useState({ current_password: "", new_password: "", confirm_password: "" });
    const [message, setMessage] = useState("");
    useEffect(() => setForm({ name: me?.name || "", email: me?.email || "", telegram_enabled: me?.notifications?.telegram, email_enabled: me?.notifications?.email }), [me]);
    async function saveProfile(e) { e.preventDefault(); await api("/api/profile", { method: "POST", body: JSON.stringify(form) }); setMessage("Profile saved."); refreshMe(); }
    async function savePassword(e) { e.preventDefault(); await api("/api/profile/password", { method: "POST", body: JSON.stringify(password) }); setPassword({ current_password: "", new_password: "", confirm_password: "" }); setMessage("Password updated."); }
    return h("div", { className: "admin-grid" },
        h("div", { className: "card" }, h("h3", null, "Account"), message ? h("p", { className: "status" }, message) : null, h("form", { onSubmit: saveProfile, className: "stack" }, h("input", { value: form.name, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: "Name" }), h("input", { type: "email", value: form.email, onChange: e => setForm({ ...form, email: e.target.value }), placeholder: "Email" }), h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!form.telegram_enabled, onChange: e => setForm({ ...form, telegram_enabled: e.target.checked }) }), " Telegram alerts"), h("label", { className: "toggle" }, h("input", { type: "checkbox", checked: !!form.email_enabled, onChange: e => setForm({ ...form, email_enabled: e.target.checked }) }), " Email alerts"), h("button", { className: "primary" }, "Save Profile"))),
        h("div", { className: "card" }, h("h3", null, "Password"), h("form", { onSubmit: savePassword, className: "stack" }, h("input", { type: "password", value: password.current_password, onChange: e => setPassword({ ...password, current_password: e.target.value }), placeholder: "Current password" }), h("input", { type: "password", value: password.new_password, onChange: e => setPassword({ ...password, new_password: e.target.value }), placeholder: "New password" }), h("input", { type: "password", value: password.confirm_password, onChange: e => setPassword({ ...password, confirm_password: e.target.value }), placeholder: "Confirm password" }), h("button", { className: "primary" }, "Update Password")))
    );
}

function SimpleTable({ title, headers, rows }) {
    return h("div", { className: "panel table-panel" }, h("h3", null, title), rows.length ? h("table", null, h("thead", null, h("tr", null, headers.map(x => h("th", { key: x }, x)))), h("tbody", null, rows.map((row, i) => h("tr", { key: i }, row.map((cell, j) => h("td", { key: j }, cell)))))) : h("div", { className: "empty" }, "No data available."));
}

function App() {
    const [path, setPath] = useState(location.pathname);
    const [me, setMe] = useState(null);
    const [loading, setLoading] = useState(true);
    const publicRoutes = ["/", "/features", "/pricing", "/how-it-works", "/about", "/contact", "/login", "/signup"];
    useEffect(() => {
        const onNav = () => setPath(location.pathname);
        addEventListener("popstate", onNav); addEventListener("app:navigate", onNav);
        return () => { removeEventListener("popstate", onNav); removeEventListener("app:navigate", onNav); };
    }, []);
    useEffect(() => {
        document.title = `${pageTitle(path)} | Tender AI`;
    }, [path]);
    async function refreshMe() {
        try { setMe(await api("/api/me")); }
        finally { setLoading(false); }
    }
    useEffect(() => {
        if (publicRoutes.includes(path)) { setLoading(false); return; }
        setLoading(true); refreshMe();
    }, [path]);
    if (path === "/") return h(HomePage);
    if (path === "/features") return h(FeaturesPage);
    if (path === "/pricing") return h(PricingPage);
    if (path === "/how-it-works") return h(HowItWorksPage);
    if (path === "/about") return h(AboutPage);
    if (path === "/contact") return h(ContactPage);
    if (path === "/login") return h(AuthPage, { mode: "login" });
    if (path === "/signup") return h(AuthPage, { mode: "signup" });
    if (loading) return h("div", { className: "empty" }, "Loading...");
    const sellerOnlyRoutes = ["/dashboard/seller"];
    const buyerOnlyRoutes = ["/dashboard/buyer", "/dashboard/buyers", "/dashboard/market", "/dashboard/reports", "/dashboard/analysis", "/dashboard/competitors", "/dashboard/admin"];
    let route = path === "/dashboard" ? roleDashboard(me) : path;
    if (me?.role === "seller" && buyerOnlyRoutes.some(prefix => route === prefix || route.startsWith(`${prefix}/`))) route = "/dashboard/seller";
    if (me?.role !== "seller" && sellerOnlyRoutes.some(prefix => route === prefix || route.startsWith(`${prefix}/`))) route = "/dashboard/buyer";
    let page;
    if (route === "/dashboard/buyer") page = h(BuyerDashboardPage);
    else if (route === "/dashboard/seller") page = h(SellerDashboardPage);
    else if (route === "/dashboard/seller/analytics") page = h(SellerAnalyticsPage);
    else if (route === "/dashboard/seller/gem-login") page = h(SellerGemLoginPage);
    else if (route === "/dashboard/seller/gem-bids") page = h(SellerGemBidsPage);
    else if (route === "/dashboard/seller/readiness") page = h(SellerReadinessPage);
    else if (route === "/dashboard/seller/catalogue") page = h(SellerCataloguePage);
    else if (route === "/dashboard/seller/opportunities") page = h(SellerOpportunitiesPage);
    else if (route === "/dashboard/seller/bids") page = h(SellerBidsPage);
    else if (route === "/dashboard/seller/orders") page = h(SellerOrdersPage);
    else if (route === "/dashboard/tenders") page = h(DashboardPage, { view: "all" });
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
    return h(Shell, { me, path: route }, page);
}

createRoot(document.getElementById("root")).render(h(App));

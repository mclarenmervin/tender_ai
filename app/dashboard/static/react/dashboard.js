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

function navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new Event("app:navigate"));
}

async function api(path, options = {}) {
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    const response = await fetch(path, { credentials: "same-origin", headers, ...options });
    if (response.status === 401) {
        if (!location.pathname.startsWith("/login") && !location.pathname.startsWith("/signup")) navigate("/login");
        throw new Error("Login required");
    }
    if (!response.ok) {
        let message = `Request failed: ${response.status}`;
        try { message = (await response.json()).detail || message; } catch { message = await response.text() || message; }
        throw new Error(message);
    }
    return response.json();
}

function money(value) {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function scoreClass(score) {
    if (score >= 70) return "high";
    if (score >= 40) return "mid";
    return "low";
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
    const [error, setError] = useState("");
    const isSignup = mode === "signup";
    const { me, checked } = useSessionProbe();
    useEffect(() => {
        if (checked && me) navigate("/dashboard");
    }, [checked, me]);

    async function submit(event) {
        event.preventDefault();
        setError("");
        try {
            await api(isSignup ? "/api/signup" : "/api/login", {
                method: "POST",
                body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
            });
            navigate("/dashboard");
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
            h("input", { value: email, onChange: e => setEmail(e.target.value), placeholder: "Email", type: "email", required: true }),
            h("input", { value: password, onChange: e => setPassword(e.target.value), placeholder: "Password", type: "password", required: true }),
            h("button", { className: "primary" }, isSignup ? "Create Account" : "Login"),
            h("button", { type: "button", className: "link-btn", onClick: () => navigate(isSignup ? "/login" : "/signup") }, isSignup ? "Already have an account?" : "Create new account")
        )
    );
}

function Shell({ children, me, path }) {
    return h("div", { className: "app" },
        h("aside", { className: "sidebar" },
            h("div", { className: "brand" }, "Tender ", h("span", null, "AI")),
            h("div", { className: "muted" }, "Intelligence Platform"),
            h("nav", { className: "nav" },
                nav.map(([section, items]) => h("div", { key: section },
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
        setMessage(`Scrape finished. Inserted ${result.inserted || 0}, scored ${result.scored || 0}.`);
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
                    (buyer.recent_tenders || []).map(item => h("button", { key: item.id, type: "button", onClick: () => navigate("/dashboard") },
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

function AdminPage() {
    const [summary, setSummary] = useState(null);
    const [logs, setLogs] = useState([]);
    const [message, setMessage] = useState("");
    async function load() { setSummary(await api("/api/dashboard/summary")); setLogs((await api("/api/admin/logs")).items || []); }
    useEffect(() => { load(); }, []);
    async function scrape() { setMessage("Manual scrape running..."); const r = await api("/api/scrape-now", { method: "POST" }); setMessage(`Inserted ${r.inserted || 0}, scored ${r.scored || 0}.`); await load(); }
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
    async function load() { setSettings(await api("/api/admin/gem-alerts")); }
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
        const result = await api("/api/admin/gem-alerts", { method: "POST", body: JSON.stringify(settings) });
        setSettings({ ...settings, ...result });
        setMessage("GeM alerts saved.");
    }
    async function runNow() {
        setRunning(true);
        setMessage("Running GeM alert check...");
        try {
            const result = await api("/api/admin/gem-alerts/run-now", { method: "POST" });
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
    const route = path === "/" ? "/dashboard" : path;
    let page;
    if (route === "/dashboard/high-priority") page = h(DashboardPage, { view: "high" });
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
    else if (route === "/dashboard/admin/gem-alerts") page = h(GemAlertsPage);
    else if (route === "/dashboard/admin/settings") page = h(SettingsPage);
    else if (route === "/dashboard/admin/delete") page = h(DeletePage);
    else if (route === "/dashboard/company-profile") page = h(CompanyProfilePage);
    else if (route === "/dashboard/profile") page = h(ProfilePage, { me, refreshMe });
    else page = h(DashboardPage, { view: "all" });
    return h(Shell, { me, path: route }, page);
}

createRoot(document.getElementById("root")).render(h(App));

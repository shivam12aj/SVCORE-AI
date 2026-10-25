# TeamOnlyGrowth

**Your Growth. Our Strategy.**

The full TeamOnlyGrowth platform: marketing website, customer portal (auth + dashboard), admin CRM, Razorpay payments, an AI assistant, and Telegram/email/Google Sheets automation — all in one repository, deployable to Netlify for free.

This README assumes no prior experience. Follow it top to bottom the first time.

---

## 1. Project structure

```
teamonlygrowth/
├── index.html, services.html, service.html, ...   # every page (plain HTML, no build step)
├── pages/                                           # privacy.html, terms.html, refund.html
├── partials/                                        # navbar.html, footer.html (shared, injected by js/partials.js)
├── assets/                                           # founder-photo.jpg, teamonlygrowth-logo.png (your real files)
├── css/styles.css                                    # the entire design system
├── config/                                            # ⭐ single source of truth
│   ├── company.js       # brand, founder, contact, social links
│   ├── services.js       # all 8 services, pricing, detail content, related-services map
│   └── faq.js             # general FAQ
├── js/                                                 # all frontend behavior (ES modules, no framework/build tool)
├── netlify/functions/                                  # backend — see "How the backend works" below
│   └── lib/                                             # shared server-only helpers (telegram, email, sheets, supabase admin)
├── supabase/
│   ├── schema.sql          # run first — creates all tables + triggers
│   └── policies.sql        # run second — Row Level Security
├── netlify.toml, package.json, .env.example, .gitignore
└── robots.txt, sitemap.xml
```

### What each file does

| File | Purpose |
|---|---|
| `config/company.js` | Brand name, founder info, WhatsApp/email, social links. Edit here to change contact details site-wide. |
| `config/services.js` | Every service's price, inclusions, detail-page content, and the `relatedServices` map ("You may also need"). Edit here to change any price or add a service. |
| `js/app.js` | Shared brand injection, mobile nav, WhatsApp link building, the AI assistant widget (with a local fallback matcher). |
| `js/partials.js` | Loads the shared navbar/footer into every page. |
| `js/auth.js` | Signup, login, logout, forgot/reset password (Supabase Auth). |
| `js/dashboard.js` | Customer dashboard: profile, enquiries, quotes, payments, projects, project updates. |
| `js/admin.js` | Admin CRM: overview KPIs, leads/customers/enquiries/quotes/orders/payments/projects, analytics, quote creation. |
| `js/requirement.js` | The "tell us your requirement" step after choosing a service. |
| `js/checkout.js` | Razorpay Checkout integration. |
| `js/services.js` | Renders the services grid and each service's detail page + related services from `config/services.js`. |
| `netlify/functions/*.js` | The backend — see below. |
| `supabase/schema.sql` / `policies.sql` | The database structure and security rules. |

---

## 2. How the backend works (Netlify Functions)

There's no separate backend server — small serverless functions in `netlify/functions/` run on demand:

| Function | Does what |
|---|---|
| `submit-lead.js` | Saves contact/custom-package form submissions to Supabase, notifies Telegram, logs to Sheets. |
| `notify-enquiry.js` | Fires "new enquiry" Telegram alert + confirmation email after a logged-in customer submits a requirement. |
| `create-quote.js` | Admin-only. Creates a quote, notifies the customer by email/Telegram. |
| `create-order.js` | Creates a Razorpay order. **Recomputes the price server-side** from `config/services.js` (or an approved quote) — it never trusts a price sent from the browser. |
| `verify-payment.js` | Verifies the Razorpay payment signature server-side, marks the order paid, creates the project, sends notifications. |
| `razorpay-webhook.js` | An independent safety net — Razorpay calls this directly, so payment status still updates even if a customer closes their browser right after paying. |
| `update-project-status.js` | Admin-only. Changes a project's status and fires "Work Started"/"Project Completed" alerts. |
| `ai-chat.js` | The AI assistant backend — grounded only in `config/services.js`/`config/faq.js`/`config/company.js`, so it can't invent prices or promises. |
| `send-welcome-email.js` | Sends the welcome email + registration alert after signup. |
| `lib/telegram.js`, `lib/email.js`, `lib/googleSheets.js`, `lib/supabaseAdmin.js` | Shared helpers, not directly callable — imported by the functions above. |

**Every integration degrades gracefully.** If Razorpay/Telegram/email/Sheets/AI credentials aren't set, that specific feature is skipped (or falls back to WhatsApp) — the rest of the site keeps working normally.

---

## 3. Setup, in order

### Step 1 — GitHub
This project should live in one GitHub repository (frontend + backend + config together, as required). If you're reading this from that repo already, skip to Step 2.

### Step 2 — Supabase (database + auth)
1. Go to [supabase.com](https://supabase.com) → New Project (free tier is enough to start).
2. Once created, open **SQL Editor** and run the contents of `supabase/schema.sql`, then run `supabase/policies.sql`.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → this is `SUPABASE_URL`
   - `anon public` key → this is `SUPABASE_ANON_KEY`
   - `service_role` key → this is `SUPABASE_SERVICE_ROLE_KEY` (**secret — never share or commit this**)
4. Open `js/supabase-client.js` in the repo and paste your `SUPABASE_URL` and `SUPABASE_ANON_KEY` into the two placeholder constants at the top. (These two values are meant to be public — real protection comes from the RLS policies you just ran, not from hiding them.)
5. **Make yourself an admin**: after you sign up on the live site once, go to Supabase **Table Editor → admin_users** and add a row with your account's `user_id` (find it in **Authentication → Users**). This is what unlocks `/admin.html`.

### Step 3 — Netlify environment variables
In Netlify: **Site configuration → Environment variables**, add everything from `.env.example` that you have values for:

| Variable | Required for | Where to get it |
|---|---|---|
| `SUPABASE_URL` | Backend functions | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend functions | Supabase → Project Settings → API (**secret**) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payments | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | Payment webhook safety net | You choose this when adding the webhook (Step 5) |
| `ANTHROPIC_API_KEY` | AI assistant (full version) | [console.anthropic.com](https://console.anthropic.com) → API Keys. Without this, the AI widget still works using a built-in local matcher — it just can't have free-form conversations. |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Admin Telegram alerts | Message [@BotFather](https://t.me/BotFather) to create a bot and get the token; message [@userinfobot](https://t.me/userinfobot) to get your chat ID |
| `RESEND_API_KEY` | Transactional emails | [resend.com](https://resend.com) → API Keys (free tier available) |
| `EMAIL_FROM` | Transactional emails | e.g. `TeamOnlyGrowth <hello@yourdomain.com>` once you verify a domain in Resend |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Sheets reporting | See Step 6 below |

### Step 4 — Deploy to Netlify
1. In Netlify: **Add new site → Import an existing project → connect this GitHub repo.**
2. Build settings are already configured via `netlify.toml` — no changes needed (static site, no build step, functions auto-detected).
3. Deploy. You'll get a URL like `https://teamonlygrowth.netlify.app`.

### Step 5 — Razorpay webhook
1. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**.
2. URL: `https://<your-site>.netlify.app/.netlify/functions/razorpay-webhook`
3. Events: `payment.captured`, `payment.failed`
4. Set a secret when creating it, and put that same value into `RAZORPAY_WEBHOOK_SECRET`.

### Step 6 — Google Sheets (optional)
Supabase is always the primary database — this just mirrors key events into a Sheet for easy reporting.
1. Create a Google Sheet with a header row matching: `Date, Name, Email, WhatsApp, City, Business, Business Type, Service, Requirement, Source, UTM Source, UTM Medium, UTM Campaign, Status, Payment Status, Amount, Notes`.
2. **Extensions → Apps Script**, paste:
   ```js
   function doPost(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     const data = JSON.parse(e.postData.contents);
     const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
     sheet.appendRow(headers.map(h => data[h] || ""));
     return ContentService.createTextOutput("OK");
   }
   ```
3. **Deploy → New deployment → Web app**. "Who has access": Anyone. Copy the URL.
4. Set `GOOGLE_SHEETS_WEBHOOK_URL` to that URL in Netlify.

### Step 7 — Analytics (optional)
Open `config/company.js` and fill in `googleAnalyticsId` / `googleAdsConversionId` / `googleAdsConversionLabel`. Leave blank to skip — the site works fully without them.

---

## 4. Testing checklist

- [ ] Homepage loads, founder photo and logo display correctly on mobile (360/390/430px) and desktop (1024/1440px+)
- [ ] All 8 services load with correct pricing and exactly 5 related services each
- [ ] Signup → check email confirmation → login works
- [ ] Submit a requirement for a fixed-price service → proceeds straight to checkout
- [ ] Submit a requirement for a "starting price" service → admin creates a quote → customer sees "Pay now" once Approved
- [ ] Complete a real Razorpay test payment (use [Razorpay test cards](https://razorpay.com/docs/payments/payments/test-card-upi-details/)) → dashboard shows "Paid" project
- [ ] Admin can log in at `/admin.html` only after being added to `admin_users`
- [ ] WhatsApp buttons open pre-filled messages
- [ ] AI assistant answers pricing/service questions without inventing anything

---

## 5. Making changes later

Because everything reads from `config/`, most changes are one-line edits:

- **Change a price** → edit the `price`/`priceLabel` field in `config/services.js`. Updates the website, checkout amount, and AI assistant automatically.
- **Add a service** → add an entry to `config/services.js` and update `relatedServices`.
- **Change the logo/founder photo** → replace the files in `assets/` (keep the same filenames).
- **Change WhatsApp/email** → edit `config/company.js`.
- **Add an FAQ** → edit `config/faq.js`.
- **Change the refund/privacy/terms text** → edit the relevant file in `pages/`.
- **Add an admin feature or automation** → ask Claude to extend the relevant file in `netlify/functions/` or `js/admin.js`.

---

## 6. Known limitations (honest, not hidden)

- **Messages tab**: the `messages` table and its RLS policies exist in the schema, but there's no dedicated two-way chat UI yet in the dashboard/admin — customers currently reach TeamOnlyGrowth via WhatsApp/email instead.
- **Portfolio/case studies**: intentionally not populated with placeholder client work — real case studies will be added once clients agree to be featured.
- **AI assistant**: without `ANTHROPIC_API_KEY` configured, it uses a built-in rule-based matcher (still answers real pricing/service questions from `config/`, just can't hold a free-form conversation).

---

## 7. Custom domain later

Netlify: **Site configuration → Domain management → Add a domain.** No code changes needed — everything uses relative paths and the config file, not the Netlify subdomain.

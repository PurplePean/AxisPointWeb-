# AxisPoint Partners Website

Institutional-grade commercial real estate asset management for owners and advisors across Texas.

## Project Structure

This is a pnpm monorepo containing:

- **apps/web** - Main website (axispoint.llc)
- **apps/qr** - Mobile QR digital card (qr.axispoint.llc)
- **packages/brand** - Shared brand assets, colors, fonts, team data, and types
- **content/** - Markdown articles and publications
- **prototypes/** - HTML reference files (DO NOT MODIFY)

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling (with custom brand preset)
- **React Router v6** - Client-side routing
- **gray-matter + remark** - Markdown parsing
- **pnpm** - Package manager (required)

## Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0

Install pnpm if you haven't already:
```bash
npm install -g pnpm
```

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   # For web app
   cp apps/web/.env.example apps/web/.env.local
   # Edit apps/web/.env.local with your actual values
   ```

3. **Start development server:**
   ```bash
   # Start all apps
   pnpm dev

   # Or start specific app
   pnpm dev:web
   ```

4. **Build for production:**
   ```bash
   # Build all apps
   pnpm build

   # Or build specific app
   pnpm build:web
   ```

## Development

### Running the web app

```bash
pnpm dev:web
```

The app will be available at http://localhost:3000

### Type checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
```

### Formatting

```bash
pnpm format
```

## Project Guidelines

### Design Fidelity

- **Match prototypes exactly** - No creative liberties or design changes
- All prototypes are in `/prototypes` folder
- Colors, fonts, spacing must match exactly

### Brand Requirements

- **Team members:** Both titled "Partner" only (not "Managing Partner")
- **No LinkedIn links** anywhere
- **No headshots** - Use initials avatars only (ZR teal, EV purple)
- **Zachary Russell:** zach@axispoint.llc, (832) 580-2815, teal color
- **Ethaniel Vu:** ethaniel@axispoint.llc, (832) 499-8389, purple color

### Contact Form

- 6-step flow with conditional routing
- **NO NNN or Net Lease** in asset class options
- Asset classes: Multifamily, Industrial, Retail, Office, Mixed-Use, Self-Storage, Show me what fits
- Success screen: no routing attribution, no name reveal
- Calendar: weekdays only, 8am-5pm CT

### Content System

- Articles in `/content/articles/*.md`
- Publications in `/content/publications/*.md`
- Filter by `published: true`
- Empty state when no content
- **No hardcoded article content**

## Deployment

Deployment is automated via GitHub Actions to Namecheap FTP.

### Environment Variables (GitHub Secrets)

- `FORM_ENDPOINT` - Google Apps Script URL
- `FTP_SERVER` - Namecheap FTP host for main site
- `FTP_USERNAME` - FTP username
- `FTP_PASSWORD` - FTP password
- `FTP_SERVER_QR` - QR subdomain FTP host
- `FTP_USERNAME_QR` - QR FTP username
- `FTP_PASSWORD_QR` - QR FTP password

## Architecture

### Brand Package

The `@axispoint/brand` package provides shared:
- Color tokens (teal, purple, magenta, ink, body, etc.)
- Font configuration (Cormorant Garamond, Figtree)
- Team member data
- TypeScript types
- Tailwind CSS preset

Both apps import from this package to maintain consistency.

### Web App Structure

```
apps/web/
├── src/
│   ├── components/
│   │   ├── ui/              # Shared UI components
│   │   ├── contact/         # Contact form components
│   │   ├── Nav.tsx
│   │   ├── Footer.tsx
│   │   └── Layout.tsx
│   ├── pages/               # Page components
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   ├── App.tsx              # Router setup
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── index.html
├── vite.config.ts
└── tailwind.config.js
```

## Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:qr` | Start QR app only |
| `pnpm build` | Build all apps for production |
| `pnpm build:web` | Build web app only |
| `pnpm build:qr` | Build QR app only |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |

## License

Private - All rights reserved by AxisPoint Partners LLC

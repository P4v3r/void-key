# VOID-KEY

> Client-side PGP identity manager and secure message encryption — built with Svelte.

## Features

- **Generate RSA-4096 key pairs** directly in your browser — no server, no tracking
- **Encrypt messages** using any standard PGP public key
- **Decrypt messages** by uploading your identity and entering your passphrase
- **Sign & verify** messages with digital signatures
- **Import / export** keys in standard `.asc` (PGP Armored) or `.json` (Void Key backup) format
- **Auto-lock** after configurable inactivity — private keys wiped from RAM
- **Browser cache** option for convenient unlock across page refreshes

Everything runs 100% client-side. Your keys, passphrases, and messages **never leave your device**.

## Quick Start

```sh
# Clone the repo
git clone https://github.com/P4v3r/void-key.git
cd void-key

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open your browser at the URL shown in the terminal.

## Usage

1. **Create Identity** — Enter your name, email, and a strong passphrase. Download the `.json` backup immediately.
2. **Unlock & Decrypt** — Upload your `.json` (or `.asc` private key) and enter your passphrase to decrypt received messages.
3. **Encrypt Message** — Paste a recipient's public key, write your message, and get an encrypted PGP block.
4. **Sign & Verify** — Sign a message to prove authorship, or verify a signed message from someone else.
5. **Settings** — Toggle auto-lock timeout and browser caching.

### File Formats

| Extension | Purpose |
|-----------|---------|
| `.json` | Void Key full backup — contains name, email, public + private key |
| `.asc` / `.pem` | Standard PGP Armored key — importable into Thunderbird, GPG, etc. |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run format` | Format all files with Prettier |
| `npm run lint` | Check formatting with Prettier |

## Tech Stack

- [Svelte 5](https://svelte.dev/) — Reactive UI framework
- [SvelteKit 2](https://kit.svelte.dev/) — Application framework
- [OpenPGP.js 6](https://openpgpjs.org/) — PGP standard implementation
- [Lucide Svelte](https://lucide.dev/) — Icon library

## Security Notes

- All cryptographic operations run in the browser via OpenPGP.js
- No backend, no API calls, no data transmission
- Private keys are held only in RAM once decrypted
- Auto-lock automatically clears private keys from memory after inactivity
- Browser cache is optional and controlled by the user

## License

MIT — see [LICENSE](LICENSE).

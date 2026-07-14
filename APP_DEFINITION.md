# Life Synth - Application Definition

This document defines the **Life Synth** application, its tech stack, architecture, musical mapping logic, and subscription system. Use the content of this file to prime Gemini or other LLMs when requesting new features or changes.

---

## 1. Project Overview
**Life Synth** is an interactive, ambient web application that transforms real-time digital behavior (keystrokes, mouse movements, scrolling, clicks, and stillness) into a live, evolving musical composition and particle visualizer.

- **URL:** [https://life-synth.vercel.app](https://life-synth.vercel.app)
- **Codebase Repository:** [https://github.com/5ha99y0/life-synth](https://github.com/5ha99y0/life-synth)
- **Deployment Platform:** Vercel

---

## 2. Technical Stack
- **Frontend:** Pure HTML5, CSS3 (Vanilla), and Vanilla JavaScript.
- **Audio Engine:** Native Web Audio API (no external libraries like Tone.js).
- **Graphics & Visuals:** HTML5 `<canvas>` with a custom 2D particle physics/rendering engine.
- **Backend (Serverless):** Node.js Vercel Serverless Function (`/api/webhook.js`) to handle Stripe subscription webhooks.
- **Payments Integration:** Stripe Checkout (Stripe Payment Links) and Stripe Webhooks.

---

## 3. Core Architecture & File Structure

```
life-synth/
├── .github/              # GitHub configurations (if any)
├── .vercel/              # Local Vercel deployment cache (git-ignored)
├── api/
│   └── webhook.js        # Node.js Stripe Webhook handler (handles subscription lifecycle)
├── app.html              # Core application interface & synthesizer engine
├── index.html            # Entry file that redirects to landing.html
├── landing.html          # Product landing page with features and "Go Premium" button
├── package.json          # Node dependencies and npm script configurations
├── privacy.html          # Privacy policy page
├── terms.html            # Terms of service page
└── vercel.json           # Vercel routing, rewrite rules, and headers configuration
```

---

## 4. Audio & Synthesizer Engine (`app.html`)
The audio engine is built entirely using the native browser Web Audio API:

### Sound Generation Nodes
- **Synths:** Built dynamically using `OscillatorNode` (sine, triangle, saw, square) combined with `GainNode` for ADSR envelopes and `StereoPannerNode` for spatial positioning.
- **Drums:** Synthesized dynamically using noise buffers (for hi-hats/snares) and low-pass swept sine oscillators (for kicks).
- **Algorithmic Reverb:** Built using a custom ConvolverNode initialized with a generated impulse response buffer (white noise decay).
- **Master FX Chain:** Synths/Drums -> CompressorNode -> AnalyserNode -> Reverb/Convolver -> Master Gain -> Destination.

### Music & Scale Mapping
- Inputs are mapped to frequencies using musical scales (Pentatonic, Major, Minor).
- Keys are mapped to pitches (e.g., standard QWERTY rows map ascending/descending notes).
- Mouse movements modulate synthesizer parameters:
  - **X-coordinate:** Modulates frequency/pitch.
  - **Y-coordinate:** Modulates synth type (waveshape) or volume.
  - **Speed:** Modulates tempo, envelope decay rates, or note density.

### Behavioral Mapping Matrix
| Input Event | Audio Reaction | Visual Reaction |
| :--- | :--- | :--- |
| **Keystroke** | Plays a note mapped to key index. | Spawns a glowing particle trail. |
| **Mouse Move** | Modulates active oscillator filters and panning. | Particles follow cursor coordinates. |
| **Mouse Click** | Plays synthesized drum beats (kick/snare). | Spawns shockwave particle bursts. |
| **Mouse Scroll** | Shifts octaves or modifies arpeggiator rates. | Adjusts particle colors and gravity. |
| **Stillness (Idle)** | Triggers soft, ambient background chords (`ambientTick`). | Particles drift slowly, simulating stardust. |

---

## 5. Subscriptions & Paywall System
Life Synth operates on a Freemium model:

- **Free Tier:**
  - Limited to a **10-minute** active session timer.
  - After 10 minutes, the session ends, music stops, and a paywall overlay blocks the screen.
- **Premium Tier ($4.99/month):**
  - **14-day free trial** (configured via Stripe Payment Link and reflected in paywall UI).
  - Unlimited session length.
  - Ability to record and export tracks.
  - Unlock additional scales and instruments.
- **Integration:**
  - The frontend checks premium status by looking at LocalStorage or cookies.
  - For testing/demo purposes, there is a hidden bypass function (`activateDemoPremium()`).
  - Webhooks in `api/webhook.js` process raw Stripe body data to verify signatures and track subscription events.

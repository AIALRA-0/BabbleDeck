# BabbleDeck UI/UX Specification

## 1. Design direction

Visual style: **Notion / Linear / Vercel / shadcn-ui inspired modern minimal SaaS**.

Keywords:

```text
calm
precise
quiet
fast
readable
trustworthy
low-friction
```

Avoid:

- noisy gradients as primary surfaces.
- gamified UI.
- skeuomorphic recorder controls.
- dense enterprise dashboards in MVP.
- jargon-heavy copy.

## 2. Design principles

1. **Action clarity.** One dominant action per screen.
2. **Caption readability.** Live text must be readable from arm’s length on mobile.
3. **Status transparency.** Always show listening/connecting/backup/translation state.
4. **Mobile-first recorder.** The recorder may be a phone held in a noisy room.
5. **Progressive disclosure.** Advanced settings hidden until needed.
6. **Recovery-first.** Error states should tell users exactly what to do next.
7. **Accessibility-first.** Keyboard and contrast must be good.

## 3. Design system

### 3.1 Color palette

Use shadcn/ui CSS variable approach.

Base:

```css
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--card: 0 0% 100%;
--card-foreground: 222.2 84% 4.9%;
--muted: 210 40% 96.1%;
--muted-foreground: 215.4 16.3% 46.9%;
--border: 214.3 31.8% 91.4%;
--primary: 222.2 47.4% 11.2%;
--primary-foreground: 210 40% 98%;
--destructive: 0 84.2% 60.2%;
```

Semantic states:

- Listening: green badge/dot.
- Reconnecting: amber badge/dot.
- Error: red badge/dot.
- Uploading backup: blue/neutral badge.
- Final transcript: foreground.
- Partial transcript: muted foreground.

### 3.2 Typography

- Primary font: system sans or Inter if configured.
- UI text: 14–16px.
- Caption text mobile: 22–32px depending mode.
- Large caption mode: 32–44px.
- Mono font for logs/debug only.

### 3.3 Spacing

- 4px base grid.
- Cards: 16–24px padding.
- Mobile bottom action area: safe-area aware.
- Avoid cramped touch targets.

### 3.4 Components

Use shadcn/ui components where possible:

- Button.
- Card.
- Input.
- Textarea.
- Select.
- Switch.
- Tabs.
- Dialog.
- Sheet.
- Badge.
- Alert.
- Dropdown menu.
- Toast/Sonner.
- Table.
- Skeleton.

## 4. Information architecture

```text
Landing
  ├─ Login
  └─ Public viewer link

Dashboard
  ├─ New session
  ├─ Session list
  ├─ Session detail/history
  ├─ Settings
  └─ Audit/logs later

Recorder
  ├─ Mic setup
  ├─ Live recording
  ├─ Backup status
  └─ Stop/finalize

Viewer
  ├─ Live captions
  ├─ Display preferences
  └─ Connection state
```

## 5. Page specifications

## 5.1 Landing page `/`

Purpose: explain the product and route users quickly.

Sections:

1. Top nav:
   - BabbleDeck logo.
   - Login.
2. Hero:
   - Headline: `Live multilingual captions that stay saved.`
   - Subtext: `Record once. Let every device read realtime transcript and translation.`
   - CTA: `Open portal`.
3. Feature strip:
   - Realtime captions.
   - Multilingual translation.
   - Local backup.
   - Exportable records.
4. Minimal footer.

Visual: Vercel-style clean hero, plenty of whitespace.

## 5.2 Login page `/login`

Fields:

- Email.
- Password.
- Sign in button.

States:

- Loading.
- Invalid credentials.
- Rate limited.
- Password rotation required.

Copy:

- Avoid saying whether email exists.
- Error: `Sign-in failed. Check your credentials and try again.`

## 5.3 Dashboard `/dashboard`

Primary elements:

- Header with product name and user menu.
- Primary button: `New live session`.
- Session cards/table.
- Cost summary widget later.

Session row/card fields:

- Title.
- Status.
- Target language.
- Duration.
- Estimated cost.
- Created date.
- Actions: Open, Record, Export.

Empty state:

`Create your first live session. It takes less than a minute.`

## 5.4 New session `/sessions/new`

Minimal form:

- Title.
- Target language.
- Source language mode: Auto default.
- Provider mode: Realtime default.
- Budget cap: default from settings.

Advanced collapsed:

- Candidate source languages.
- Quality enhancement mode.
- Raw audio retention.

CTA:

- `Create session`.

After create:

- Navigate to recorder.

## 5.5 Recorder `/sessions/[id]/record`

Mobile-first layout.

### Pre-recording state

Cards:

1. Session title/status.
2. Microphone setup:
   - Permission status.
   - Device selector.
   - Volume meter.
   - Test input guidance.
3. Share card:
   - Viewer link.
   - QR code.
   - Copy button.
4. Primary action:
   - `Start recording`.

### Recording state

Top status bar:

- Listening.
- Provider connected.
- Backup uploading.
- Viewer count.
- Estimated cost.

Main:

- Live original partial/final preview.
- Live translation preview.
- Volume meter.

Bottom sticky actions:

- `Stop` destructive confirmation.
- `Pause` later optional.
- `Share`.

Warnings:

- Mic too quiet.
- Audio clipping.
- Network reconnecting.
- Backup pending.
- Budget approaching cap.

## 5.6 Viewer `/s/[shareToken]`

No login required unless session protected.

Default mobile layout:

- Session title small.
- Status badge.
- Large translation text.
- Original text smaller optional.
- Bottom toolbar:
  - Text size.
  - Show original toggle.
  - Theme toggle.

Desktop layout:

- Two-column original/translation optional.
- Timeline mode optional.

States:

- Waiting for session.
- Live.
- Reconnecting.
- Session ended.
- Invalid link.

## 5.7 Session detail/history `/sessions/[id]`

Tabs:

- Transcript.
- Audio backup.
- Exports.
- Usage.
- Settings.

Transcript timeline:

- Timestamp.
- Original.
- Translation.
- Language badge.
- Edit action.
- Retranslate action.

Export actions:

- Markdown.
- TXT.
- JSON.
- SRT/VTT when available.

## 5.8 Settings `/settings`

Sections:

1. Provider status.
2. Default session settings.
3. Glossary.
4. Budget limits.
5. Data retention.
6. Security.

Provider status must show configured/not configured, never show secrets.

## 6. Interaction details

### 6.1 Start recording flow

```text
Click Start
  ↓
If mic permission unknown: browser permission prompt
  ↓
If denied: show recovery
  ↓
If granted: run 3-second level test
  ↓
Connect realtime socket
  ↓
Connect provider
  ↓
Start recording state
```

### 6.2 Stop recording flow

```text
Click Stop
  ↓
Confirmation dialog
  ↓
Stop provider stream
  ↓
Flush local chunks
  ↓
Mark session completed
  ↓
Navigate/offer history export
```

Dialog copy:

`Stop this session? Live captions will end, but saved audio chunks will continue uploading until complete.`

### 6.3 Reconnect flow

- Banner: `Connection lost. Still saving local audio when possible.`
- Disable stop? No, stop should remain available.
- After reconnect: `Reconnected. Uploading saved chunks.`

### 6.4 Mic-denied flow

Show:

- `Microphone access is blocked.`
- Browser-specific tips.
- `Retry microphone access` button.

### 6.5 Budget exceeded flow

- Warning at 80%.
- Critical at 95%.
- Mark session `provider_degraded` at the configured hard cap.
- Continue recorder-side local backup and chunk upload after provider degradation.

## 7. Responsive breakpoints

```text
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

Mobile recorder:

- Single column.
- Sticky bottom primary action.
- Large touch targets.

Desktop dashboard:

- Sidebar or top nav.
- Table/card hybrid.

## 8. Accessibility requirements

- All controls have accessible labels.
- Recording state not conveyed by color alone.
- Buttons minimum 44px touch target on mobile.
- Captions high contrast.
- Keyboard focus visible.
- Dialog focus trapped.
- Live transcript region should use ARIA thoughtfully; avoid overwhelming screen readers. Consider user-controlled screen reader mode.

## 9. Copy guidelines

Use simple user-facing language:

- `Listening` not `stream active`.
- `Backing up audio` not `uploading chunks`.
- `Translation delayed` not `provider latency`.
- `Reconnect needed` not `WS error`.

## 10. Visual QA checklist

Before marking UI work done:

- Desktop screenshot.
- 390px mobile screenshot.
- Dark mode if implemented.
- Empty state.
- Loading state.
- Error state.
- Long transcript overflow.
- Long session title truncation.
- No horizontal scroll on mobile.

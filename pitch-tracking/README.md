# Pitch Tracker

A Progressive Web App (PWA) for high school baseball pitching coaches to track pitches during games and generate reports.

## Features

- **Pitch tracking** – Record each pitch (type + result) during live games
- **Batter last at-bat** – See what the current batter did in their previous plate appearance
- **Pitch performance** – Live stats for each pitch type (strikes, balls, strike %) during the game
- **Post-game reports** – Summary, pitch breakdown, and at-bat list after each game
- **Pitcher reports** – Individual game reports and composite stats across all appearances
- **Trends** – Strike % by game to spot performance trends over time

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build for production

```bash
npm run build
npm run preview
```

The app works offline and can be installed on your phone or tablet as a PWA.

## Data storage

All data is stored locally in your browser (IndexedDB). No server or account required.

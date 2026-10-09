# Atlas Drive

Open-world 3D street racer that runs in your phone's browser. Pick a real place and drive it: streets, buildings, flyovers, underpasses and landmark names stream in from OpenStreetMap as you go.

**Play:** https://red-snow.github.io/atlas-drive/

## Features
- **Real places, streamed:** the map loads in 320 m tiles around and ahead of the car, so you can keep driving across a whole city.
- **Flyovers and underpasses:** roads tagged as bridges become elevated decks with ramps, pillars and railings; tunnels and underpasses become sunken roads. Physics follows the height, so you can drive over, under and through them.
- **Names:** landmarks, named buildings, shops and street signs appear in 3D, and the HUD shows the street you are on.
- **Six cars:** supercar, sedan, hatchback, SUV, pickup and van, each with its own handling and a driver's-seat cockpit.
- **Traffic:** AI cars, taxis, vans, buses and trucks follow the real road network and keep to the local side of the road.
- **Cameras:** chase, far chase, hood, driver's seat, cinematic and drone.
- **Golden hour and night**, checkpoint runs, free roam with drift scoring, touch and keyboard controls.

## Photoreal 3D (optional)
Turn on *Use Google photoreal 3D buildings* in the menu and paste your own Google Maps Platform API key with the **Map Tiles API** enabled (billing must be on for the project). The key is stored only in your browser. 3D imagery comes from Google Maps; streets, names and collision come from OpenStreetMap.

## Controls
Touch: steer, gas, brake and drift buttons. Keyboard: arrows/WASD drive, Space drift, C camera, L names, R respawn.

## Credits
Map data © OpenStreetMap contributors. Photoreal 3D tiles © Google. Supercar model by vicent091036 (Sketchfab), from the three.js examples. Built with three.js and 3d-tiles-renderer (NASA-AMMOS, Apache-2.0).

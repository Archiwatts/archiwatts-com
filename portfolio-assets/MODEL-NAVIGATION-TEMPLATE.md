# Shared 3D navigation template (version 3)

All current and future interactive 3D project pages use the shared controls from Hive:

- Load touch-joystick.js, model-navigation.js and model-navigation.css (CSS last).
- Expose window.daylightContext with scene, camera, renderer and controls.
- Expose modelWalkBridge.mode(), or modelNavigationAdapter.mode() and optional ground().
- Native horizontal movement must consume touchJoystick.x/y/active. Keep diagonal input normalized and clear input on release, blur and cancellation.
- Desktop uses the generated model-walk-hint (WASD) and the Q/E elevation row, aligned in the model viewport to the right of portfolio-rail. Native directional pads and old hint/tour overlays are hidden at every screen width.
- Mobile uses the same left joystick and Up/Down arrows on every project; keyboard labels are hidden. An idle tour-status box is hidden.
- Walking mode hides the editorial selection card so it does not overlap movement controls. Orbit mode retains the selection card.
- Include a release version on the shared asset URLs when publishing changes.

Use work/install-model-navigation-template.py to add the shared script/CSS references to future 3D pages.

For an authentic project logo in the shared panel, set window.modelProjectLogo to its asset path before shared-model-panel.js initializes. Existing Hive and Tranquil River logo paths are provided. Do not invent a logo for a project with no supplied logo.

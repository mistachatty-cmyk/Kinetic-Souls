<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>App Prototyping Canvas</title>
<style>
body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background-color: #f9f9f9; }
.dev-panel { border: 1px solid #ccc; background: #fff; padding: 15px; margin-bottom: 20px; border-radius: 6px; display: inline-block; }
#main-view { padding: 20px; background: #fff; border: 1px solid #ccc; border-radius: 6px; min-height: 200px; }
#mobile-controls { display: none; background: #e0e0e0; padding: 40px 20px; margin-top: 20px; border-radius: 8px; text-align: center; border: 2px dashed #aaa; }
#joystick-base { width: 120px; height: 120px; background: #bbb; border-radius: 50%; position: relative; margin: 20px auto; touch-action: none; }
#joystick-knob { width: 50px; height: 50px; background: #333; border-radius: 50%; position: absolute; top: 35px; left: 35px; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.active-drag #joystick-knob { transition: none; }
#debug-output { font-family: monospace; font-size: 16px; margin-top: 15px; }
</style>
</head>
<body>

<div class="dev-panel">
<label style="cursor: pointer; font-weight: bold;">
<input type="checkbox" id="flag-mobile"> Enable Mobile UI (Opt-in)
</label>
</div>

<div id="main-view">
<h2>Main App View</h2>
<p>Your core app logic and canvas go here.</p>
</div>

<div id="mobile-controls">
<h3>🕹️ Mobile Controls Active</h3>
<div id="joystick-base"><div id="joystick-knob"></div></div>
<div id="debug-output">X: 0.00, Y: 0.00</div>
</div>

<script>
const appState = { useMobileUI: false };
const dom = {
mobileToggle: document.getElementById('flag-mobile'),
mobileContainer: document.getElementById('mobile-controls'),
joyBase: document.getElementById('joystick-base'),
joyKnob: document.getElementById('joystick-knob'),
joyOutput: document.getElementById('debug-output')
};

</script>
</body>
</html>
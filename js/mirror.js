//
// VIDEO GRABBER -------------------------------------------------------
// Grab the webcam-feed & pass the output to a video-element
//

var Grabber = (function() {

	'use strict';
	
	var video = document.querySelector('video'),
	    header = document.querySelector('header'),
	    alert = document.createElement('h3');

	// Remove noscript-message
	header.removeChild(document.querySelector('noscript'));

	// WebRTC is vendor-prefixed and
	// supported by Chrome & Firefox
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

	// Blob objects are vendor-prefixed and
	// supported by Safari, Android & Blackberry
	window.URL = window.URL || window.webkitURL;


	//
	// OUCH! NO LOVE FOR WEBRTC -----------------------------
	//

	if(!navigator.getUserMedia || !window.URL) {

		var html = '';
		html += 'Ouch! No love for WebRTC here<br />';
		html += 'Try <a href="http://www.google.com/chrome/" target="_blank">Google Chrome</a> ';
		html += 'or <a href="http://www.mozilla.org/firefox/" target="_blank">Firefox</a>';

		alert.innerHTML = html;
		header.appendChild(alert);

		return;

	}


	//
	// WEBRTC SUPPORTED - GRAB THE FEED ---------------------
	//

	var onSuccess = function(stream) {

		// Remove 'Allow camera access' message
		setTimeout(function() { header.removeChild(alert); }, 500);
		alert.className += ' fade-out';

		// Pass the API response to the video element
		video.src = window.URL.createObjectURL(stream);
		// Initialize the DOM &
		// subtraction modules
		Subtraction.init();
		DOM.init();

	};

	var onError = function(e) {

		// No stream, do something else ...
		// console.log('ERROR - ', e);

	};

	// Grab webcam stream from API
	navigator.getUserMedia({ audio: false, video: true }, onSuccess, onError);
	
	// Add 'Allow camera access' message
	alert.setAttribute('class', 'icon icon-up');
	alert.innerHTML = "Give me some sugar &<br />allow camera access";
	header.appendChild(alert);


	//
	// API --------------------------------------------------
	//

	return {

		getVideo: function() { return video; }

	};


}());








//
// BACKGROUND SUBTRACTION ----------------------------------------------
// Detect movement by subtracting the background (snapshot of a previous frame)
// from the current webcam-frame (in grayscale) and draw the output to the canvas
// Then pixelate the output & update the DOM (passing the color of current pixel)
//

var Subtraction = (function() {

	'use strict';

	var canvas = document.querySelector('canvas'),
	    c = canvas.getContext('2d'),
	    width = 160,
	    height = 120,
	    threshold = 30,
	    frames = 0,
	    abs = Math.abs,
	    size = width * height,

	    pixels, grayscale, bg, diff;


	//
	// INITIALIZE -------------------------------------------
	//

	var init = function() {

		// Set canvas & go!
		canvas.width = width;
		canvas.height = height;
		
		// Wait for the feed
		// then start updating
		setTimeout(update, 1500);

	};


	//
	// UPDATE -----------------------------------------------
	//

	var update = function() {

		// Call next frame
		rAF(update);

		// Draw video frame to canvas
		// In Chrome we can draw mirrored: x, y, -width, height
		// Firefox doesn't support this, so we need to take
		// a small detour to mirror the webcam-feed
		c.save();
		c.scale(-1, 1);
		c.drawImage(Grabber.getVideo(), -width, 0, width, height);
		c.restore();

		// Get pixel-data from canvas
		// and convert to grayscale
		pixels = c.getImageData(0, 0, width, height);
		grayscale = convertToGrayscale(pixels);

		// Draw grayscale
		c.putImageData(grayscale, 0, 0);

		// Take a snapshot every 10 millis
		if(frames % 10 === 0) bg = grayscale;
		frames++;

		// Wait for the first
		// background image
		if(!bg) return;

		// Get absolute difference between
		// background & grayscale frame
		diff = subtractBackground(pixels, grayscale, bg);

		// Now pixellate the result
		// This will be used to animate
		// and color the DOM
		pixellate(diff, 8);

	};


	//
	// CONVERT VIDEO FRAME TO GRAYSCALE ---------------------
	// Convert colored pixels to grayscale
	// and return the result in a new pixelArray
	//

	var convertToGrayscale = function(color) {

		var grayscale = c.createImageData(width, height),
		    graydata = grayscale.data,
		    colordata = color.data,
		    i = size;

		while(--i) {

			var r = 4 * i,
			    g = r + 1,
			    b = r + 2,
			    a = r + 3,
			    brightness = 0.34 * colordata[r] + 0.5 * colordata[g] + 0.16 * colordata[b];

			graydata[r] = brightness;    // Red
			graydata[g] = brightness;    // Green
			graydata[b] = brightness;    // Blue
			graydata[a] = 255;           // Alpha
		}

		return grayscale;

	};


	//
	// SUBTRACT BACKGROUND FROM CURRENT FRAME ---------------
	// Get absolute difference and return
	// the result in a new pixelArray
	//

	var subtractBackground = function(color, background, gray) {

		var result = c.createImageData(width, height),
		    bgdata = background.data,
		    colordata = color.data,
		    graydata = gray.data,
		    data = result.data,
		    i = size;

		while(--i) {

			var r = 4 * i,
			    g = r + 1,
			    b = r + 2,
			    a = r + 3;

			data[r] = abs( bgdata[r] - graydata[r] ) < threshold ? 0 : colordata[r];
			data[g] = abs( bgdata[g] - graydata[g] ) < threshold ? 0 : colordata[g];
			data[b] = abs( bgdata[b] - graydata[b] ) < threshold ? 0 : colordata[b];
			data[a] = 255;

		}

		return result;

	};


	//
	// GET PIXEL COLOR --------------------------------------
	// Get the color value of a single pixel
	//

	var getPixelColor = function(color, x, y) {
	
		var offset = x * 4 + y * 4 * color.width,
		    data = color.data,

		    r, g, b, a;

		r = data[offset];
		g = data[offset + 1];
		b = data[offset + 2];
		a = data[offset + 3];

		// Amplify color range
		r += (r * 0.5) >> 0;
		b += (b * 0.25) >> 0;
		if(a === 0) a = 255;

		return "rgba(" + r + "," + g + "," + b + "," + a + ")";

	};


	//
	// PIXELLATE FRAME --------------------------------------
	// Pixellate the resulting image
	// This will be used to animate and color the DOM
	//

	var pixellate = function(color, size) {

		var i = 0;
		for(var y = 0; y < height; y += size) {
			for(var x = 0; x < width; x += size) {

				var rgb = getPixelColor(color, x, y);
				DOM.update(i, rgb);

				// Debug draw
				//c.fillStyle = rgb;
				//c.fillRect(x, height + y, size, size);
				
				i++;

			}
		}
	};


	//
	// API --------------------------------------------------
	//

	return {

		init: init

	};

}());








//
// DOM MANIPULATION ----------------------------------------------------
// Create pixel-grid & update the DOM
//

var DOM = (function() {

	'use strict';

	var mirror = document.querySelector('#mirror'),
	    canvas = document.querySelector('canvas'),

	    pixels, colors;


	//
	// INITIALIZE -------------------------------------------
	//

	var init = function() {

		// Create pixels
		var html = '', i = 0;
		for(var x = 0; x < 20; x++) {
			for(var y = 0; y < 15; y++) {

				html += '<div id="'+ (i++) +'" class="pixel">';
				html += '<div class="inner">';
				html += '<div class="front"></div>';
				html += '<div class="back"></div>';
				html += '</div>';
				html += '</div>';

			}
		}

		// Inject to the DOM
		// and cache elements
		mirror.innerHTML += html;
		pixels = document.getElementsByClassName('pixel');
		colors = document.getElementsByClassName('back');

		// Build-up/fade-in
		setTimeout(function() { mirror.setAttribute('class', 'fade-in'); }, 750);
		setTimeout(function() { canvas.setAttribute('class', 'fade-in'); }, 1750);

	};


	//
	// UPDATE -----------------------------------------------
	//

	var update = function(id, color) {

		var classList = pixels[id].classList;

		// Stop if the pixel is already colored
		if(classList.contains('hover')) return;

		// Colorize pixels
		// Note: black is excluded
		if(color !== 'rgba(0,0,0,255)') {

			colors[id].style.backgroundColor = color;
			classList.add('hover');

			// Attach audio to some pixels
			if(id % 12 === 2) Sound.generator();

			// Start auto-timeout which reset
			// pixels to the default state
			clearTimeout(colors[id].timer);
			colors[id].timer = setTimeout(function() { classList.remove('hover'); }, 500);

		}

	};


	//
	// API --------------------------------------------------
	//

	return {

		init: init,
		update: update

	};

}());








//
// WEB AUDIO API -------------------------------------------------------
// Generate sounds when updating the DOM
//

var Sound = (function() {

	'use strict';

	// Web Audio API is vendor-prefixed so
	// we need to grab the correct context
	window.AudioContext = window.AudioContext || window.webkitAudioContext;

	// Create audio context
	var audio = window.AudioContext ? new AudioContext() : false;


	//
	// GENERATE SOUND ---------------------------------------
	//

	var generator = function() {

		// Stop here if there's
		// no Web Audio API support
		if(!audio) return;

		var oscillator = audio.createOscillator(),
		    volume = audio.createGain();

		// Use gain to gently fade-out the volume
		// and patch the output to the audio context
		volume.gain.linearRampToValueAtTime(0, audio.currentTime);
		volume.gain.linearRampToValueAtTime(0.6, audio.currentTime + 0.01);
		volume.gain.linearRampToValueAtTime(0, audio.currentTime + 0.01 + (Math.random() * 2.9));
		volume.connect(audio.destination);

		// Generate sound with an oscillator
		// and patch the output to the volume
		oscillator.frequency.value = 220 + (Math.random() * 680) >> 0;
		oscillator.connect(volume);
		oscillator.type = 0;

		// Start/stop sound
		setTimeout(function() { oscillator.noteOff(0); }, 3000);
		oscillator.noteOn(0);

	};


	//
	// API --------------------------------------------------
	//

	return {

		generator: generator

	};

}());








//
// REQUEST ANIMATION FRAME ---------------------------------------------
//

var rAF = (function() {

	'use strict';

	var vendors = ['ms', 'o', 'moz', 'webkit', ''], i = vendors.length;
	var then = 0;
	var rAF;

	while(i-- && !rAF) rAF = window[vendors[i] + 'requestAnimationFrame'];
	rAF = rAF || function(callback) {

		var now = +new Date(), time = Math.max(0, 16 - (now - then));
		var id = setTimeout(function() { callback(now + time); }, time);
		then = now + time;

		return id;

	};


	//
	// API --------------------------------------------------
	//

	return rAF;

}());